// Shared domain types for the Readsmith pipeline.

/** Raw signals pulled from a GitHub repository before any AI interpretation. */
export interface RepoSignals {
  owner: string;
  repo: string;
  htmlUrl: string;
  defaultBranch: string;
  description?: string;
  homepage?: string;
  topics: string[];
  primaryLanguage?: string;
  languages: string[];
  stars?: number;
  forks?: number;
  license?: string;
  /** Selected, meaningful file paths (not the entire tree). */
  notableFiles: string[];
  /** Top-level directories with a short heuristic role. */
  topLevelDirs: string[];
  /** Contents of key files, keyed by path. Truncated for size. */
  keyFiles: Record<string, string>;
  packageJson?: PackageJsonSummary;
  detectedPackageManager?: "npm" | "yarn" | "pnpm" | "bun" | null;
  existingReadme?: string;
  envVarNames: string[];
  hasTests: boolean;
  hasDocker: boolean;
  hasCI: boolean;
  /** Raw URLs to image assets in the repo that could be linked from a README. */
  imageAssets?: string[];
  fetchNotes: string[];
}

export interface PackageJsonSummary {
  name?: string;
  version?: string;
  description?: string;
  scripts?: Record<string, string>;
  dependencies?: string[];
  devDependencies?: string[];
}

/** Raw signals pulled from a live website. */
export interface WebsiteSignals {
  url: string;
  finalUrl: string;
  title?: string;
  description?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  siteName?: string;
  headings: string[];
  navLinks: string[];
  ctaTexts: string[];
  images: string[];
  bodyExcerpt: string;
  fetchNotes: string[];
}

/** The AI's structured understanding of what the project actually is. */
export interface ProjectUnderstanding {
  name: string;
  tagline?: string;
  description?: string;
  category?: string;
  audience?: string[];
  features: string[];
  stack: {
    frontend?: string[];
    backend?: string[];
    database?: string[];
    infrastructure?: string[];
    languages?: string[];
    tooling?: string[];
  };
  architecture?: string;
  projectStructure?: { path: string; role: string }[];
  commands?: {
    packageManager?: string;
    install?: string;
    dev?: string;
    build?: string;
    test?: string;
    start?: string;
  };
  environmentVariables?: { name: string; description?: string }[];
  screenshots?: { url: string; caption?: string }[];
  links?: {
    website?: string;
    github?: string;
    docs?: string;
  };
  license?: string;
  roadmap?: string[];
  contributing?: boolean;
  discrepancies?: string[];
  confidenceNotes?: string[];
}

/** The AI's plan for how the README should be shaped for THIS project. */
export interface ReadmeStrategy {
  tone: string;
  reasoning: string;
  sections: string[];
  includeScreenshots: boolean;
  includeArchitecture: boolean;
  includeProjectStructure: boolean;
  includeRoadmap: boolean;
  includeContributing: boolean;
  includeBadges: boolean;
}

export interface GenerationResult {
  understanding: ProjectUnderstanding;
  strategy: ReadmeStrategy;
  markdown: string;
}

/** Streaming progress events sent to the client. */
export type PipelineEvent =
  | { type: "step"; id: string; label: string; status: "start" | "done" | "error"; detail?: string }
  | { type: "understanding"; data: ProjectUnderstanding }
  | { type: "strategy"; data: ReadmeStrategy }
  | { type: "markdown"; data: string }
  | { type: "done" }
  | { type: "error"; message: string };
