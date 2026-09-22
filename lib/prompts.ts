import type { RepoSignals, WebsiteSignals, ProjectUnderstanding, ReadmeStrategy } from "./types";

/** Shared accuracy contract injected into every prompt. */
const ACCURACY_RULES = `
Accuracy is non-negotiable. You are documenting a REAL project, not marketing it.
NEVER invent features, technologies, statistics, architecture, commands, environment
variables, screenshots, links, roadmap items, or licenses. If a fact cannot be
supported by the provided repository or website signals, omit it. It is far better to
say less than to fabricate. When the repository and website disagree, surface the
discrepancy rather than silently picking one.`;

/** Compact the repo signals into a token-efficient briefing for the model. */
export function repoBriefing(repo: RepoSignals): string {
  const pkg = repo.packageJson;
  const parts: string[] = [];
  parts.push(`owner/repo: ${repo.owner}/${repo.repo}`);
  parts.push(`github_url: ${repo.htmlUrl}`);
  parts.push(`default_branch: ${repo.defaultBranch}`);
  if (repo.description) parts.push(`repo_description: ${repo.description}`);
  if (repo.homepage) parts.push(`homepage: ${repo.homepage}`);
  if (repo.topics.length) parts.push(`topics: ${repo.topics.join(", ")}`);
  if (repo.languages.length) parts.push(`languages (by bytes): ${repo.languages.join(", ")}`);
  if (repo.license) parts.push(`license (from metadata): ${repo.license}`);
  if (typeof repo.stars === "number") parts.push(`stars: ${repo.stars}, forks: ${repo.forks}`);
  parts.push(`package_manager: ${repo.detectedPackageManager || "unknown"}`);
  parts.push(`has_tests: ${repo.hasTests}, has_docker: ${repo.hasDocker}, has_ci: ${repo.hasCI}`);

  if (pkg?.scripts && Object.keys(pkg.scripts).length) {
    parts.push(`package.json scripts:\n${JSON.stringify(pkg.scripts, null, 2)}`);
  }
  if (pkg?.dependencies?.length) {
    parts.push(`dependencies: ${pkg.dependencies.join(", ")}`);
  }
  if (pkg?.devDependencies?.length) {
    parts.push(`devDependencies: ${pkg.devDependencies.join(", ")}`);
  }
  if (repo.envVarNames.length) {
    parts.push(`environment variable NAMES found (values NOT included): ${repo.envVarNames.join(", ")}`);
  }
  if (repo.topLevelDirs.length) {
    parts.push(`top-level directories:\n${repo.topLevelDirs.join("\n")}`);
  }
  if (repo.imageAssets?.length) {
    parts.push(`linkable image assets in repo (use ONLY these raw URLs for repo images):\n${repo.imageAssets.join("\n")}`);
  }
  parts.push(`notable files present: ${repo.notableFiles.join(", ")}`);

  // Include selected file contents (already truncated during ingestion).
  const contentBudgetFiles = repo.notableFiles.filter(
    (p) => !/readme/i.test(p) // README handled separately as "supporting context"
  );
  for (const p of contentBudgetFiles) {
    const content = repo.keyFiles[p];
    if (content) {
      parts.push(`----- FILE: ${p} -----\n${content.slice(0, 4000)}`);
    }
  }

  if (repo.existingReadme) {
    parts.push(
      `----- EXISTING README (supporting context ONLY — may be outdated; repo + site are source of truth) -----\n${repo.existingReadme.slice(0, 6000)}`
    );
  }

  if (repo.fetchNotes.length) parts.push(`ingestion notes: ${repo.fetchNotes.join("; ")}`);
  return parts.join("\n");
}

export function websiteBriefing(site: WebsiteSignals | null): string {
  if (!site) return "No live website was provided.";
  const parts: string[] = [];
  parts.push(`requested_url: ${site.url}`);
  parts.push(`final_url: ${site.finalUrl}`);
  if (site.title) parts.push(`title: ${site.title}`);
  if (site.siteName) parts.push(`site_name: ${site.siteName}`);
  if (site.ogTitle) parts.push(`og_title: ${site.ogTitle}`);
  if (site.description) parts.push(`meta_description: ${site.description}`);
  if (site.ogDescription) parts.push(`og_description: ${site.ogDescription}`);
  if (site.ogImage) parts.push(`og_image (linkable): ${site.ogImage}`);
  if (site.headings.length) parts.push(`headings:\n- ${site.headings.join("\n- ")}`);
  if (site.navLinks.length) parts.push(`navigation: ${site.navLinks.join(", ")}`);
  if (site.ctaTexts.length) parts.push(`calls to action: ${site.ctaTexts.join(", ")}`);
  if (site.bodyExcerpt) parts.push(`visible text excerpt:\n${site.bodyExcerpt}`);
  if (site.fetchNotes.length) parts.push(`website notes: ${site.fetchNotes.join("; ")}`);
  return parts.join("\n");
}

export function understandingPrompt(repo: RepoSignals, site: WebsiteSignals | null): string {
  return `You are a senior engineer who deeply understands software projects. Study the
repository and website signals below and produce a STRUCTURED understanding of what this
project actually is. Do not write a README yet.
${ACCURACY_RULES}

Focus on:
- What the project genuinely does and who it is for.
- The MEANINGFUL tech stack (not every dependency — the ones that define the project).
- Features that are actually implemented / evidenced.
- Real run commands, derived from actual package scripts or config. If scripts don't
  exist, infer from the ecosystem (e.g. cargo, go, python) only when clearly supported.
- Environment variables by NAME only.
- Whether screenshots/architecture/roadmap/contributing are warranted by evidence.
- Any discrepancies between the repo and the website.

=== REPOSITORY SIGNALS ===
${repoBriefing(repo)}

=== WEBSITE SIGNALS ===
${websiteBriefing(site)}

Respond with ONLY a JSON object matching this TypeScript interface (omit fields you cannot support):
interface ProjectUnderstanding {
  name: string;
  tagline?: string;              // one strong sentence, specific to THIS project
  description?: string;
  category?: string;             // e.g. "SaaS web app", "CLI tool", "library", "portfolio", "educational platform"
  audience?: string[];
  features: string[];            // concrete, evidenced
  stack: { frontend?: string[]; backend?: string[]; database?: string[]; infrastructure?: string[]; languages?: string[]; tooling?: string[]; };
  architecture?: string;         // short prose OR a simple text flow; only if it adds value
  projectStructure?: { path: string; role: string }[];  // only meaningful dirs
  commands?: { packageManager?: string; install?: string; dev?: string; build?: string; test?: string; start?: string; };
  environmentVariables?: { name: string; description?: string }[];
  screenshots?: { url: string; caption?: string }[];    // ONLY urls present in the signals
  links?: { website?: string; github?: string; docs?: string };
  license?: string;              // only if verifiable
  roadmap?: string[];            // only if evidenced (TODO/roadmap files, etc.)
  contributing?: boolean;        // true only if project invites contribution
  discrepancies?: string[];
  confidenceNotes?: string[];    // anything you were unsure about
}
Return raw JSON only, no markdown fences.`;
}

export function strategyPrompt(understanding: ProjectUnderstanding): string {
  return `You are an expert technical writer. Given the structured understanding of a
project below, decide how ITS README should be shaped. There is no fixed template —
different project categories deserve different structures. Choose the sections and order
that best explain THIS project and make a strong first impression in ~30 seconds.
${ACCURACY_RULES}

Only include sections you have evidence to fill. Prefer fewer, stronger sections over a
long generic outline. The first section should be a compelling hero (name + one-line
value + relevant links).

=== PROJECT UNDERSTANDING ===
${JSON.stringify(understanding, null, 2)}

Respond with ONLY a JSON object matching:
interface ReadmeStrategy {
  tone: string;                    // e.g. "confident and technical", "friendly and product-led"
  reasoning: string;               // 1-3 sentences on why this structure fits this project
  sections: string[];              // ordered section names you will actually write
  includeScreenshots: boolean;
  includeArchitecture: boolean;
  includeProjectStructure: boolean;
  includeRoadmap: boolean;
  includeContributing: boolean;
  includeBadges: boolean;          // only real, derivable badges (license, language, etc.)
}
Return raw JSON only, no markdown fences.`;
}

export function generationPrompt(
  understanding: ProjectUnderstanding,
  strategy: ReadmeStrategy
): string {
  return `You are writing the final README.md for a real project. Write it so a developer
who just discovered the repository understands it in about 30 seconds, and can go deeper
if they want. It must look great rendered on GitHub.
${ACCURACY_RULES}

Voice & quality rules:
- Write naturally and specifically. Avoid generic AI filler such as "This project is a…",
  "This README provides…", "A comprehensive solution…", "Cutting-edge…", "Leverage the
  power of…", "Seamless experience…", "Built with modern technologies…" — unless genuinely apt.
- Lead with a strong hero: project name as an H1, one specific sentence beneath it, then a
  single line of relevant links like [Live Demo] · [GitHub] · [Documentation] (only links
  that exist).
- Use visual hierarchy, concise sections, tables where they help, fenced code blocks for
  commands, and a simple text architecture diagram only if warranted.
- Only embed images whose URLs appear in the understanding's screenshots/links. Never
  fabricate images or badges. If badges are enabled, use real shields.io badges derivable
  from facts (language, license) — nothing invented.
- Use ONLY the run commands from the understanding. Do not assume npm if it isn't indicated.
- Document environment variables by name with placeholder values only (e.g. API_KEY=your_api_key).
- Do NOT include a giant file tree. Show structure only if it clarifies architecture.
- Do not pad length. Cut anything that doesn't help the reader.

Follow this section plan (order matters), writing only what you can support:
${strategy.sections.map((s, i) => `${i + 1}. ${s}`).join("\n")}

Tone: ${strategy.tone}

=== PROJECT UNDERSTANDING (source of truth) ===
${JSON.stringify(understanding, null, 2)}

Output ONLY the final README.md content in GitHub-Flavored Markdown. No preamble, no
explanation, no surrounding code fence.`;
}

export function refinePrompt(
  currentMarkdown: string,
  instruction: string,
  understanding: ProjectUnderstanding
): string {
  return `You are refining an existing README.md. Apply the user's instruction while
preserving everything accurate and good about the current version. Do not fabricate new
facts — stay grounded in the project understanding below.
${ACCURACY_RULES}

User instruction: "${instruction}"

=== PROJECT UNDERSTANDING (source of truth) ===
${JSON.stringify(understanding, null, 2)}

=== CURRENT README ===
${currentMarkdown}

Output ONLY the complete revised README.md in GitHub-Flavored Markdown. No preamble, no
surrounding code fence.`;
}
