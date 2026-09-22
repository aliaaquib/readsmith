"use client";

import type { ProjectUnderstanding, ReadmeStrategy } from "@/lib/types";
import { AlertIcon } from "./icons";

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-line pt-4 first:border-t-0 first:pt-0">
      <h4 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint mb-2.5 font-mono">
        {title}
      </h4>
      {children}
    </div>
  );
}

function Tags({ items }: { items?: string[] }) {
  if (!items?.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((t) => (
        <span key={t} className="chip">
          {t}
        </span>
      ))}
    </div>
  );
}

export default function InsightsPanel({
  understanding,
  strategy,
}: {
  understanding: ProjectUnderstanding | null;
  strategy: ReadmeStrategy | null;
}) {
  if (!understanding) {
    return (
      <p className="text-sm text-ink-muted">
        Project insights will appear here once the analysis runs.
      </p>
    );
  }

  const stack = understanding.stack || {};
  const stackGroups = (
    [
      ["Languages", stack.languages],
      ["Frontend", stack.frontend],
      ["Backend", stack.backend],
      ["Database", stack.database],
      ["Infrastructure", stack.infrastructure],
      ["Tooling", stack.tooling],
    ] as const
  ).filter(([, v]) => v && v.length);

  return (
    <div className="space-y-5">
      <Group title="What it is">
        <p className="text-ink font-medium leading-snug">{understanding.name}</p>
        {understanding.tagline && (
          <p className="text-sm text-ink-muted mt-1 leading-relaxed">{understanding.tagline}</p>
        )}
        {understanding.category && (
          <span className="chip mt-2.5">{understanding.category}</span>
        )}
      </Group>

      {understanding.audience?.length ? (
        <Group title="Audience">
          <Tags items={understanding.audience} />
        </Group>
      ) : null}

      {understanding.features?.length ? (
        <Group title={`Features (${understanding.features.length})`}>
          <ul className="space-y-1.5">
            {understanding.features.slice(0, 8).map((f) => (
              <li key={f} className="text-sm text-ink-soft flex gap-2 leading-relaxed">
                <span className="text-accent mt-0.5">·</span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </Group>
      ) : null}

      {stackGroups.length ? (
        <Group title="Detected stack">
          <div className="space-y-3">
            {stackGroups.map(([label, items]) => (
              <div key={label}>
                <p className="text-xs text-ink-faint mb-1.5">{label}</p>
                <Tags items={items as string[]} />
              </div>
            ))}
          </div>
        </Group>
      ) : null}

      {understanding.environmentVariables?.length ? (
        <Group title="Environment">
          <div className="flex flex-wrap gap-1.5">
            {understanding.environmentVariables.map((e) => (
              <code
                key={e.name}
                className="font-mono text-xs bg-accent-wash text-accent-soft rounded px-1.5 py-0.5"
              >
                {e.name}
              </code>
            ))}
          </div>
        </Group>
      ) : null}

      {strategy ? (
        <Group title="README strategy">
          <p className="text-sm text-ink-muted leading-relaxed mb-2.5">{strategy.reasoning}</p>
          <div className="flex flex-wrap gap-1.5 mb-2.5">
            <span className="chip capitalize">{strategy.tone}</span>
          </div>
          <ol className="space-y-1">
            {strategy.sections.map((s, i) => (
              <li key={s} className="text-sm text-ink-soft flex gap-2.5 items-baseline">
                <span className="font-mono text-[11px] text-ink-faint tabular-nums">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        </Group>
      ) : null}

      {understanding.discrepancies?.length ? (
        <Group title="Discrepancies noted">
          <div className="space-y-2">
            {understanding.discrepancies.map((d, i) => (
              <div key={i} className="flex gap-2 text-sm text-flag leading-relaxed">
                <AlertIcon className="shrink-0 mt-0.5" width={14} height={14} />
                <span>{d}</span>
              </div>
            ))}
          </div>
        </Group>
      ) : null}

      {understanding.confidenceNotes?.length ? (
        <Group title="Notes">
          <ul className="space-y-1.5">
            {understanding.confidenceNotes.map((n, i) => (
              <li key={i} className="text-xs text-ink-muted leading-relaxed">
                {n}
              </li>
            ))}
          </ul>
        </Group>
      ) : null}
    </div>
  );
}
