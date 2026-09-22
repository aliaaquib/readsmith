import type { PackageJsonSummary, RepoSignals } from "./types";

const GH_API = "https://api.github.com";

/** Parse a GitHub repo URL (or owner/repo shorthand) into its parts. */
export function parseRepoUrl(input: string): { owner: string; repo: string } {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Provide a GitHub repository URL.");

  // owner/repo shorthand
  const shorthand = /^([\w.-]+)\/([\w.-]+)$/.exec(trimmed);
  if (shorthand) {
    return { owner: shorthand[1], repo: stripGit(shorthand[2]) };
  }

  let url: URL;
  try {
    url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
  } catch {
    throw new Error("That doesn't look like a valid GitHub URL.");
  }
  if (!/github\.com$/i.test(url.hostname)) {
    throw new Error("Only github.com repositories are supported.");
  }
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length < 2) {
    throw new Error("URL must point to a repository, e.g. github.com/owner/repo.");
  }
  return { owner: parts[0], repo: stripGit(parts[1]) };
}

function stripGit(name: string) {
  return name.replace(/\.git$/i, "");
}

function ghHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "readsmith",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function ghJson<T>(path: string): Promise<T> {
  const res = await fetch(`${GH_API}${path}`, { headers: ghHeaders() });
  if (res.status === 403 && res.headers.get("x-ratelimit-remaining") === "0") {
    throw new Error(
      "GitHub rate limit reached. Add a GITHUB_TOKEN to your environment to raise it."
    );
  }
  if (res.status === 404) {
    throw new Error("Repository not found. Check the URL, or add a token for private repos.");
  }
  if (!res.ok) {
    throw new Error(`GitHub request failed (${res.status}) for ${path}.`);
  }
  return res.json() as Promise<T>;
}

/** Fetch a raw file's text from the repo, returning null if missing. */
async function fetchRawFile(
  owner: string,
  repo: string,
  branch: string,
  path: string,
  maxBytes = 60_000
): Promise<string | null> {
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
  const res = await fetch(url, { headers: { "User-Agent": "readsmith" } });
  if (!res.ok) return null;
  const text = await res.text();
  return text.length > maxBytes ? text.slice(0, maxBytes) + "\n… [truncated]" : text;
}

interface TreeItem {
  path: string;
  type: "blob" | "tree";
  size?: number;
}

// Files worth reading in full to understand the project.
const KEY_FILE_PATTERNS: RegExp[] = [
  /^package\.json$/i,
  /^readme(\.md)?$/i,
  /^\.env\.example$/i,
  /^\.env\.sample$/i,
  /^\.env\.template$/i,
  /^(docker-compose\.ya?ml|dockerfile)$/i,
  /^(next|nuxt|vite|astro|svelte|remix|tailwind|vue|angular)\.config\.[a-z.]+$/i,
  /^tsconfig\.json$/i,
  /^(cargo\.toml|go\.mod|pyproject\.toml|requirements\.txt|gemfile|composer\.json|pom\.xml|build\.gradle(\.kts)?)$/i,
  /^(pubspec\.yaml|makefile|justfile)$/i,
  /^prisma\/schema\.prisma$/i,
  /^(vercel|netlify|now)\.json$/i,
  /^app\/layout\.[jt]sx?$/i,
  /^(src\/)?main\.[a-z]+$/i,
];

// Directory names that carry semantic meaning for architecture.
const DIR_ROLES: Record<string, string> = {
  app: "application routes / entrypoints",
  pages: "routes (pages router)",
  src: "source code",
  components: "reusable UI components",
  lib: "application logic / utilities",
  server: "server-side code",
  api: "API endpoints",
  routes: "route handlers",
  hooks: "React hooks",
  prisma: "database schema (Prisma)",
  db: "database layer",
  migrations: "database migrations",
  public: "static assets",
  assets: "static assets",
  styles: "styling",
  content: "content / MDX",
  docs: "documentation",
  tests: "tests",
  test: "tests",
  __tests__: "tests",
  cypress: "end-to-end tests",
  e2e: "end-to-end tests",
  scripts: "utility scripts",
  cmd: "command entrypoints (Go)",
  pkg: "packages (Go)",
  internal: "internal packages",
  services: "service modules",
  models: "data models",
  controllers: "controllers",
  utils: "utilities",
  config: "configuration",
  infra: "infrastructure as code",
  terraform: "infrastructure (Terraform)",
  k8s: "Kubernetes manifests",
  packages: "monorepo packages",
  apps: "monorepo applications",
};

const IMAGE_RE = /\.(png|jpe?g|gif|webp|svg)$/i;
const SCREENSHOT_HINT = /(screenshot|screen-shot|demo|preview|hero|dashboard|banner|cover|og-?image|social)/i;

export async function ingestRepository(repoUrl: string): Promise<RepoSignals> {
  const { owner, repo } = parseRepoUrl(repoUrl);
  const fetchNotes: string[] = [];

  const meta = await ghJson<any>(`/repos/${owner}/${repo}`);
  const defaultBranch: string = meta.default_branch || "main";

  // Languages breakdown.
  let languages: string[] = [];
  try {
    const langMap = await ghJson<Record<string, number>>(
      `/repos/${owner}/${repo}/languages`
    );
    languages = Object.entries(langMap)
      .sort((a, b) => b[1] - a[1])
      .map(([k]) => k);
  } catch {
    fetchNotes.push("Could not read language breakdown.");
  }

  // Recursive tree (single call). May be truncated for very large repos.
  let tree: TreeItem[] = [];
  try {
    const treeRes = await ghJson<{ tree: TreeItem[]; truncated: boolean }>(
      `/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`
    );
    tree = treeRes.tree || [];
    if (treeRes.truncated) fetchNotes.push("Repository tree was large and truncated.");
  } catch {
    fetchNotes.push("Could not read full file tree.");
  }

  const blobs = tree.filter((t) => t.type === "blob");
  const allPaths = blobs.map((b) => b.path);

  // Top-level directories with roles.
  const topDirsSet = new Set<string>();
  for (const p of allPaths) {
    const seg = p.split("/")[0];
    if (p.includes("/")) topDirsSet.add(seg);
  }
  const topLevelDirs = [...topDirsSet]
    .filter((d) => !d.startsWith("."))
    .sort()
    .map((d) => (DIR_ROLES[d.toLowerCase()] ? `${d}/ → ${DIR_ROLES[d.toLowerCase()]}` : `${d}/`));

  // Identify notable / key files.
  const keyPaths = allPaths.filter((p) =>
    KEY_FILE_PATTERNS.some((re) => re.test(p) || re.test(p.split("/").pop() || ""))
  );

  // Screenshot / image assets that could be linked.
  const imageAssets = allPaths.filter(
    (p) => IMAGE_RE.test(p) && (SCREENSHOT_HINT.test(p) || /(screenshots?|images?|assets|docs|public|\.github)\//i.test(p))
  );

  // Fetch key file contents (bounded).
  const keyFiles: Record<string, string> = {};
  const uniqueKeyPaths = [...new Set(keyPaths)].slice(0, 20);
  await Promise.all(
    uniqueKeyPaths.map(async (p) => {
      const content = await fetchRawFile(owner, repo, defaultBranch, p);
      if (content != null) keyFiles[p] = content;
    })
  );

  // Parse package.json if present.
  let packageJson: PackageJsonSummary | undefined;
  const pkgRaw = keyFiles["package.json"];
  if (pkgRaw) {
    try {
      const parsed = JSON.parse(pkgRaw);
      packageJson = {
        name: parsed.name,
        version: parsed.version,
        description: parsed.description,
        scripts: parsed.scripts,
        dependencies: parsed.dependencies ? Object.keys(parsed.dependencies) : [],
        devDependencies: parsed.devDependencies ? Object.keys(parsed.devDependencies) : [],
      };
    } catch {
      fetchNotes.push("package.json could not be parsed.");
    }
  }

  // Package manager detection via lockfiles.
  let detectedPackageManager: RepoSignals["detectedPackageManager"] = null;
  if (allPaths.some((p) => /(^|\/)pnpm-lock\.yaml$/.test(p))) detectedPackageManager = "pnpm";
  else if (allPaths.some((p) => /(^|\/)yarn\.lock$/.test(p))) detectedPackageManager = "yarn";
  else if (allPaths.some((p) => /(^|\/)bun\.lockb$/.test(p))) detectedPackageManager = "bun";
  else if (allPaths.some((p) => /(^|\/)package-lock\.json$/.test(p))) detectedPackageManager = "npm";
  else if (packageJson) detectedPackageManager = "npm";

  // Existing README.
  const existingReadmeKey = Object.keys(keyFiles).find((k) => /readme/i.test(k));
  const existingReadme = existingReadmeKey ? keyFiles[existingReadmeKey] : undefined;

  // Environment variable names: from .env.example and referenced code.
  const envVarNames = collectEnvVars(keyFiles);

  const signals: RepoSignals = {
    owner,
    repo,
    htmlUrl: meta.html_url,
    defaultBranch,
    description: meta.description || undefined,
    homepage: meta.homepage || undefined,
    topics: meta.topics || [],
    primaryLanguage: meta.language || undefined,
    languages: languages.length ? languages : meta.language ? [meta.language] : [],
    stars: meta.stargazers_count,
    forks: meta.forks_count,
    license: meta.license?.spdx_id && meta.license.spdx_id !== "NOASSERTION"
      ? meta.license.spdx_id
      : meta.license?.name,
    notableFiles: uniqueKeyPaths,
    topLevelDirs,
    keyFiles,
    packageJson,
    detectedPackageManager,
    existingReadme,
    envVarNames,
    hasTests: allPaths.some((p) =>
      /(^|\/)(tests?|__tests__|spec|e2e|cypress)\//i.test(p) || /\.(test|spec)\.[a-z]+$/i.test(p)
    ),
    hasDocker: allPaths.some((p) => /(^|\/)dockerfile$/i.test(p) || /docker-compose\.ya?ml$/i.test(p)),
    hasCI: allPaths.some((p) => /(^|\/)\.github\/workflows\//i.test(p) || /(^|\/)\.gitlab-ci\.yml$/i.test(p)),
    fetchNotes,
  };

  // Attach discovered screenshots as raw URLs the README can actually link.
  signals.imageAssets = imageAssets
    .slice(0, 12)
    .map((p) => `https://raw.githubusercontent.com/${owner}/${repo}/${defaultBranch}/${p}`);

  return signals;
}

/** Extract env var names from .env.example files and shallow code references. */
function collectEnvVars(keyFiles: Record<string, string>): string[] {
  const names = new Set<string>();
  for (const [path, content] of Object.entries(keyFiles)) {
    if (/\.env/i.test(path)) {
      for (const line of content.split("\n")) {
        const m = /^\s*([A-Z][A-Z0-9_]{2,})\s*=/.exec(line);
        if (m) names.add(m[1]);
      }
    }
  }
  return [...names].sort();
}
