"use client";

import { useState } from "react";
import type { ProjectUnderstanding, ReadmeStrategy } from "@/lib/types";
import MarkdownView from "./MarkdownView";
import InsightsPanel from "./InsightsPanel";
import {
  CopyIcon,
  CheckIcon,
  DownloadIcon,
  EyeIcon,
  CodeIcon,
  GithubIcon,
  GlobeIcon,
  RefreshIcon,
  SpinnerIcon,
} from "./icons";

const REFINEMENTS: { label: string; instruction: string }[] = [
  { label: "More concise", instruction: "Make the README more concise. Cut padding and tighten every section without losing essential information." },
  { label: "More technical", instruction: "Make it more technical and precise for an engineering audience, adding relevant detail where it is supported by the project understanding." },
  { label: "More visual", instruction: "Improve visual hierarchy and scanning: use tables, well-structured sections, and code blocks where they genuinely help. Do not invent images or badges." },
  { label: "Stronger intro", instruction: "Rewrite the opening so the first screen is more compelling and specific to this project, keeping it honest." },
  { label: "Add architecture", instruction: "Add or strengthen an architecture section using a simple text diagram, only using what is supported by the project understanding." },
];

export default function ResultView({
  markdown,
  understanding,
  strategy,
  onMarkdownChange,
  onRegenerate,
  githubUrl,
  websiteUrl,
}: {
  markdown: string;
  understanding: ProjectUnderstanding;
  strategy: ReadmeStrategy | null;
  onMarkdownChange: (md: string) => void;
  onRegenerate: () => void;
  githubUrl?: string;
  websiteUrl?: string;
}) {
  const [tab, setTab] = useState<"preview" | "source">("preview");
  const [copied, setCopied] = useState(false);
  const [refining, setRefining] = useState<string | null>(null);
  const [refineError, setRefineError] = useState<string | null>(null);
  const [customInstruction, setCustomInstruction] = useState("");
  const [editing, setEditing] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const download = () => {
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "README.md";
    a.click();
    URL.revokeObjectURL(url);
  };

  const refine = async (instruction: string, label: string) => {
    setRefining(label);
    setRefineError(null);
    try {
      const res = await fetch("/api/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markdown, instruction, understanding }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Refinement failed.");
      onMarkdownChange(data.markdown);
    } catch (err) {
      setRefineError(err instanceof Error ? err.message : "Refinement failed.");
    } finally {
      setRefining(null);
    }
  };

  const busy = refining !== null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-px bg-line rounded-2xl overflow-hidden border border-line shadow-card">
      {/* LEFT — document */}
      <div className="bg-surface flex flex-col min-h-[70vh]">
        {/* toolbar */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-line bg-paper/60">
          <div className="flex items-center gap-1 rounded-lg border border-line bg-surface p-0.5">
            <button
              onClick={() => setTab("preview")}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
                tab === "preview" ? "bg-ink text-paper" : "text-ink-muted hover:text-ink"
              }`}
            >
              <EyeIcon width={14} height={14} /> Preview
            </button>
            <button
              onClick={() => setTab("source")}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
                tab === "source" ? "bg-ink text-paper" : "text-ink-muted hover:text-ink"
              }`}
            >
              <CodeIcon width={14} height={14} /> Markdown
            </button>
          </div>

          <div className="flex items-center gap-2">
            {tab === "source" && (
              <button
                onClick={() => setEditing((e) => !e)}
                className={`btn-ghost !py-1.5 ${editing ? "!border-accent !text-accent" : ""}`}
              >
                {editing ? "Done editing" : "Edit"}
              </button>
            )}
            <button onClick={copy} className="btn-ghost !py-1.5">
              {copied ? <CheckIcon width={14} height={14} className="text-signal" /> : <CopyIcon width={14} height={14} />}
              {copied ? "Copied" : "Copy"}
            </button>
            <button onClick={download} className="btn-ghost !py-1.5">
              <DownloadIcon width={14} height={14} /> README.md
            </button>
          </div>
        </div>

        {/* body */}
        <div className="flex-1 overflow-auto thin-scroll">
          {tab === "preview" ? (
            <div className="px-7 py-8 max-w-3xl mx-auto">
              <MarkdownView markdown={markdown} />
            </div>
          ) : editing ? (
            <textarea
              value={markdown}
              onChange={(e) => onMarkdownChange(e.target.value)}
              spellCheck={false}
              className="w-full h-full min-h-[60vh] resize-none bg-surface text-ink font-mono text-[13px] leading-relaxed p-6 outline-none"
            />
          ) : (
            <pre className="p-6 font-mono text-[13px] leading-relaxed text-ink-soft whitespace-pre-wrap break-words">
              {markdown}
            </pre>
          )}
        </div>
      </div>

      {/* RIGHT — controls + insights */}
      <div className="bg-surface flex flex-col">
        <div className="px-5 py-4 border-b border-line">
          <div className="flex items-center gap-2 mb-3">
            {githubUrl && (
              <a href={githubUrl} target="_blank" rel="noreferrer" className="btn-ghost !py-1.5 flex-1">
                <GithubIcon width={14} height={14} /> Repo
              </a>
            )}
            {websiteUrl && (
              <a href={websiteUrl} target="_blank" rel="noreferrer" className="btn-ghost !py-1.5 flex-1">
                <GlobeIcon width={14} height={14} /> Site
              </a>
            )}
          </div>
          <button onClick={onRegenerate} disabled={busy} className="btn-ghost w-full">
            <RefreshIcon width={14} height={14} /> Start over
          </button>
        </div>

        {/* refine controls */}
        <div className="px-5 py-4 border-b border-line">
          <h4 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint mb-3 font-mono">
            Refine
          </h4>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {REFINEMENTS.map((r) => (
              <button
                key={r.label}
                onClick={() => refine(r.instruction, r.label)}
                disabled={busy}
                className="btn-ghost !py-1.5 !px-2.5 !text-[13px] disabled:opacity-40"
              >
                {refining === r.label ? (
                  <SpinnerIcon width={13} height={13} className="text-accent" />
                ) : null}
                {r.label}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (customInstruction.trim() && !busy) {
                refine(customInstruction.trim(), "custom");
                setCustomInstruction("");
              }
            }}
            className="flex gap-2"
          >
            <input
              value={customInstruction}
              onChange={(e) => setCustomInstruction(e.target.value)}
              placeholder="Or describe a change…"
              disabled={busy}
              className="field !py-2 !text-[13px]"
            />
            <button
              type="submit"
              disabled={busy || !customInstruction.trim()}
              className="btn-primary !py-2 !px-3 shrink-0"
            >
              {refining === "custom" ? (
                <SpinnerIcon width={14} height={14} />
              ) : (
                <RefreshIcon width={14} height={14} />
              )}
            </button>
          </form>
          {refineError && <p className="text-[13px] text-flag mt-2">{refineError}</p>}
        </div>

        {/* insights */}
        <div className="px-5 py-4 flex-1 overflow-auto thin-scroll">
          <h4 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint mb-3 font-mono">
            Project insights
          </h4>
          <InsightsPanel understanding={understanding} strategy={strategy} />
        </div>
      </div>
    </div>
  );
}
