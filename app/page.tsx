"use client";

import { useCallback, useRef, useState } from "react";
import type {
  PipelineEvent,
  ProjectUnderstanding,
  ReadmeStrategy,
} from "@/lib/types";
import type { StepState } from "@/components/ProgressStream";
import ProgressStream from "@/components/ProgressStream";
import ResultView from "@/components/ResultView";
import { GithubIcon, GlobeIcon, ArrowIcon, AlertIcon, SpinnerIcon } from "@/components/icons";

type Phase = "idle" | "running" | "done" | "error";

export default function Home() {
  const [repoUrl, setRepoUrl] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [steps, setSteps] = useState<StepState[]>([]);
  const [understanding, setUnderstanding] = useState<ProjectUnderstanding | null>(null);
  const [strategy, setStrategy] = useState<ReadmeStrategy | null>(null);
  const [markdown, setMarkdown] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const submittedRef = useRef({ repoUrl: "", websiteUrl: "" });

  const upsertStep = useCallback((step: StepState) => {
    setSteps((prev) => {
      const idx = prev.findIndex((s) => s.id === step.id);
      if (idx === -1) return [...prev, step];
      const next = [...prev];
      next[idx] = step;
      return next;
    });
  }, []);

  const run = useCallback(
    async (repo: string, site: string) => {
      setPhase("running");
      setSteps([]);
      setUnderstanding(null);
      setStrategy(null);
      setMarkdown("");
      setError(null);
      submittedRef.current = { repoUrl: repo, websiteUrl: site };

      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ repoUrl: repo, websiteUrl: site }),
        });

        if (!res.ok && !res.body) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `Request failed (${res.status}).`);
        }

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            if (!line.trim()) continue;
            let event: PipelineEvent;
            try {
              event = JSON.parse(line);
            } catch {
              continue;
            }
            handleEvent(event);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
        setPhase("error");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const handleEvent = useCallback(
    (event: PipelineEvent) => {
      switch (event.type) {
        case "step":
          upsertStep({ id: event.id, label: event.label, status: event.status, detail: event.detail });
          break;
        case "understanding":
          setUnderstanding(event.data);
          break;
        case "strategy":
          setStrategy(event.data);
          break;
        case "markdown":
          setMarkdown(event.data);
          break;
        case "done":
          setPhase("done");
          break;
        case "error":
          setError(event.message);
          setPhase("error");
          break;
      }
    },
    [upsertStep]
  );

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoUrl.trim()) return;
    run(repoUrl.trim(), websiteUrl.trim());
  };

  const reset = () => {
    setPhase("idle");
    setSteps([]);
    setUnderstanding(null);
    setStrategy(null);
    setMarkdown("");
    setError(null);
  };

  // ── Result screen ──────────────────────────────────────────────
  if (phase === "done" && markdown && understanding) {
    return (
      <main className="min-h-screen">
        <ResultHeader onReset={reset} />
        <div className="max-w-[1240px] mx-auto px-5 pb-16">
          <ResultView
            markdown={markdown}
            understanding={understanding}
            strategy={strategy}
            onMarkdownChange={setMarkdown}
            onRegenerate={reset}
            githubUrl={understanding.links?.github || submittedRef.current.repoUrl}
            websiteUrl={understanding.links?.website || submittedRef.current.websiteUrl || undefined}
          />
        </div>
      </main>
    );
  }

  // ── Landing + running ──────────────────────────────────────────
  return (
    <main className="min-h-screen flex flex-col">
      <header className="max-w-[1240px] w-full mx-auto px-5 py-6 flex items-center justify-between">
        <Wordmark />
        <a
          href="https://github.com"
          target="_blank"
          rel="noreferrer"
          className="text-sm text-ink-muted hover:text-ink transition-colors hidden sm:block"
        >
          How it works
        </a>
      </header>

      <div className="flex-1 flex items-center">
        <div className="max-w-[1240px] w-full mx-auto px-5 py-10 grid lg:grid-cols-[1.05fr_0.95fr] gap-14 items-center">
          {/* Hero copy */}
          <div className="animate-reveal">
            <div className="chip mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-signal" />
              Reads the repo, not a template
            </div>
            <h1 className="font-display text-[clamp(2.4rem,5vw,3.6rem)] leading-[1.05] tracking-[-0.02em] text-ink">
              Turn your project into a README people actually read.
            </h1>
            <p className="mt-5 text-lg text-ink-muted leading-relaxed max-w-xl">
              Readsmith studies your repository and live site, works out what the
              project genuinely is, and writes documentation shaped around what makes
              it interesting — not a one-size-fits-all outline.
            </p>

            <ul className="mt-8 space-y-2.5 text-[15px] text-ink-soft">
              {[
                "Structure chosen per project — a CLI reads differently from a SaaS app",
                "Grounded in real files, scripts, and site content — nothing invented",
                "Refine the result, export a clean README.md",
              ].map((t) => (
                <li key={t} className="flex gap-3">
                  <span className="text-accent font-mono text-sm mt-0.5">→</span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Form / progress card */}
          <div
            className="bg-surface border border-line rounded-2xl shadow-lift p-6 sm:p-7 animate-reveal"
            style={{ animationDelay: "80ms" }}
          >
            {phase === "running" || phase === "error" ? (
              <RunningCard
                steps={steps}
                error={error}
                phase={phase}
                understanding={understanding}
                onRetry={() => run(submittedRef.current.repoUrl, submittedRef.current.websiteUrl)}
                onReset={reset}
              />
            ) : (
              <form onSubmit={onSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-ink mb-1.5">
                    GitHub repository
                  </label>
                  <div className="relative">
                    <GithubIcon
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
                      width={17}
                      height={17}
                    />
                    <input
                      value={repoUrl}
                      onChange={(e) => setRepoUrl(e.target.value)}
                      placeholder="github.com/owner/project"
                      className="field !pl-10"
                      autoFocus
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-ink mb-1.5">
                    Live website{" "}
                    <span className="text-ink-faint font-normal">· optional, recommended</span>
                  </label>
                  <div className="relative">
                    <GlobeIcon
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
                      width={17}
                      height={17}
                    />
                    <input
                      value={websiteUrl}
                      onChange={(e) => setWebsiteUrl(e.target.value)}
                      placeholder="yourproject.com"
                      className="field !pl-10"
                    />
                  </div>
                </div>

                <button type="submit" className="btn-primary w-full !py-3.5" disabled={!repoUrl.trim()}>
                  Understand & write the README
                  <ArrowIcon width={16} height={16} />
                </button>

                <p className="text-xs text-ink-faint text-center leading-relaxed pt-1">
                  Public repos work as-is. Add a GITHUB_TOKEN for private repos and higher limits.
                </p>
              </form>
            )}
          </div>
        </div>
      </div>

      <footer className="max-w-[1240px] w-full mx-auto px-5 py-6 text-xs text-ink-faint border-t border-line">
        Readsmith · an AI that understands your project, then documents it.
      </footer>
    </main>
  );
}

function RunningCard({
  steps,
  error,
  phase,
  understanding,
  onRetry,
  onReset,
}: {
  steps: StepState[];
  error: string | null;
  phase: Phase;
  understanding: ProjectUnderstanding | null;
  onRetry: () => void;
  onReset: () => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-2.5 mb-5">
        {phase === "error" ? (
          <AlertIcon className="text-flag" width={18} height={18} />
        ) : (
          <SpinnerIcon className="text-accent" width={18} height={18} />
        )}
        <h3 className="font-medium text-ink">
          {phase === "error" ? "Couldn't finish" : "Working through your project"}
        </h3>
      </div>

      <ProgressStream steps={steps} />

      {understanding?.name && phase !== "error" && (
        <div className="mt-4 pt-4 border-t border-line">
          <p className="text-sm text-ink-muted">
            Understood as{" "}
            <span className="text-ink font-medium">{understanding.name}</span>
            {understanding.category ? ` · ${understanding.category}` : ""}
          </p>
        </div>
      )}

      {phase === "error" && (
        <div className="mt-4 pt-4 border-t border-line">
          <p className="text-sm text-flag leading-relaxed mb-3">{error}</p>
          <div className="flex gap-2">
            <button onClick={onRetry} className="btn-ghost">
              Try again
            </button>
            <button onClick={onReset} className="btn-ghost">
              Start over
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ResultHeader({ onReset }: { onReset: () => void }) {
  return (
    <header className="border-b border-line bg-paper/70 backdrop-blur sticky top-0 z-10">
      <div className="max-w-[1240px] mx-auto px-5 py-3.5 flex items-center justify-between">
        <Wordmark />
        <button onClick={onReset} className="btn-ghost !py-1.5">
          New README
        </button>
      </div>
    </header>
  );
}

function Wordmark() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-7 h-7 rounded-md bg-ink text-paper grid place-items-center font-display text-sm font-semibold">
        R
      </div>
      <span className="font-display text-lg text-ink tracking-[-0.01em]">Readsmith</span>
    </div>
  );
}
