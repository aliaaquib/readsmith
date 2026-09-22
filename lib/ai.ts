import Anthropic from "@anthropic-ai/sdk";
import type {
  ProjectUnderstanding,
  ReadmeStrategy,
  RepoSignals,
  WebsiteSignals,
} from "./types";
import {
  understandingPrompt,
  strategyPrompt,
  generationPrompt,
  refinePrompt,
} from "./prompts";

const DEFAULT_MODEL = "claude-3-5-sonnet-latest";

let client: Anthropic | null = null;

export function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to your environment (see .env.example)."
    );
  }
  if (!client) client = new Anthropic({ apiKey });
  return client;
}

function model(): string {
  return process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;
}

async function complete(prompt: string, maxTokens: number): Promise<string> {
  const res = await getClient().messages.create({
    model: model(),
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  });
  return res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

/** Pull a JSON object out of a model response, tolerating stray fences/prose. */
function parseJson<T>(raw: string, context: string): T {
  let text = raw.trim();
  // Strip markdown fences if present.
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  if (fence) text = fence[1].trim();
  // Fall back to the first {...} block.
  if (!text.startsWith("{")) {
    const brace = text.indexOf("{");
    const lastBrace = text.lastIndexOf("}");
    if (brace !== -1 && lastBrace > brace) text = text.slice(brace, lastBrace + 1);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Failed to parse ${context} from the model response.`);
  }
}

export async function deriveUnderstanding(
  repo: RepoSignals,
  site: WebsiteSignals | null
): Promise<ProjectUnderstanding> {
  const raw = await complete(understandingPrompt(repo, site), 4000);
  const understanding = parseJson<ProjectUnderstanding>(raw, "project understanding");

  // Guarantee the essentials and backfill verifiable links from raw signals.
  understanding.name ||= repo.repo;
  understanding.features ||= [];
  understanding.stack ||= {};
  understanding.links = {
    github: repo.htmlUrl,
    website: site?.finalUrl || repo.homepage || understanding.links?.website,
    docs: understanding.links?.docs,
  };
  return understanding;
}

export async function deriveStrategy(
  understanding: ProjectUnderstanding
): Promise<ReadmeStrategy> {
  const raw = await complete(strategyPrompt(understanding), 1500);
  const strategy = parseJson<ReadmeStrategy>(raw, "README strategy");
  strategy.sections ||= ["Overview", "Features", "Tech Stack", "Getting Started"];
  strategy.tone ||= "confident and technical";
  return strategy;
}

export async function generateReadme(
  understanding: ProjectUnderstanding,
  strategy: ReadmeStrategy
): Promise<string> {
  return complete(generationPrompt(understanding, strategy), 6000);
}

export async function refineReadme(
  currentMarkdown: string,
  instruction: string,
  understanding: ProjectUnderstanding
): Promise<string> {
  return complete(refinePrompt(currentMarkdown, instruction, understanding), 6000);
}
