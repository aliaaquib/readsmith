import { ingestRepository } from "@/lib/github";
import { analyzeWebsite } from "@/lib/website";
import { deriveUnderstanding, deriveStrategy, generateReadme } from "@/lib/ai";
import type { PipelineEvent, WebsiteSignals } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  let body: { repoUrl?: string; websiteUrl?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const repoUrl = (body.repoUrl || "").trim();
  const websiteUrl = (body.websiteUrl || "").trim();

  if (!repoUrl) {
    return Response.json({ error: "A GitHub repository URL is required." }, { status: 400 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: "Server is missing ANTHROPIC_API_KEY. See .env.example." },
      { status: 500 }
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: PipelineEvent) => {
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      };
      const step = (id: string, label: string, status: "start" | "done" | "error", detail?: string) =>
        send({ type: "step", id, label, status, detail });

      try {
        // 1. Repository discovery + analysis
        step("repo", "Connecting to repository", "start");
        const repo = await ingestRepository(repoUrl);
        step("repo", "Connected to repository", "done", `${repo.owner}/${repo.repo}`);

        step("structure", "Analyzing project structure", "start");
        const fileCount = repo.notableFiles.length;
        step(
          "structure",
          "Analyzed project structure",
          "done",
          `${fileCount} key files · ${repo.languages.slice(0, 3).join(", ") || "n/a"}`
        );

        // 2. Website analysis (optional)
        let site: WebsiteSignals | null = null;
        if (websiteUrl) {
          step("site", "Inspecting live website", "start");
          site = await analyzeWebsite(websiteUrl);
          const ok = !site.fetchNotes.some((n) => /could not|not html|http [45]/i.test(n));
          step(
            "site",
            ok ? "Inspected live website" : "Website inspection incomplete",
            ok ? "done" : "error",
            ok ? site.title || site.finalUrl : site.fetchNotes[0]
          );
        }

        // 3. Understanding
        step("understand", "Understanding what the project is", "start");
        const understanding = await deriveUnderstanding(repo, site);
        send({ type: "understanding", data: understanding });
        step(
          "understand",
          "Understood the project",
          "done",
          understanding.category || understanding.tagline || undefined
        );

        // 4. Strategy
        step("strategy", "Designing README structure", "start");
        const strategy = await deriveStrategy(understanding);
        send({ type: "strategy", data: strategy });
        step("strategy", "Designed README structure", "done", `${strategy.sections.length} sections`);

        // 5. Generation
        step("write", "Writing project documentation", "start");
        const markdown = await generateReadme(understanding, strategy);
        send({ type: "markdown", data: markdown });
        step("write", "Wrote project documentation", "done");

        send({ type: "done" });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Generation failed.";
        send({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
