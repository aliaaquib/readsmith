"use client";

import { CheckIcon, SpinnerIcon, AlertIcon } from "./icons";

export interface StepState {
  id: string;
  label: string;
  status: "start" | "done" | "error";
  detail?: string;
}

export default function ProgressStream({ steps }: { steps: StepState[] }) {
  return (
    <ol className="space-y-0">
      {steps.map((s, i) => (
        <li
          key={s.id + i}
          className="flex items-start gap-3 py-2.5 animate-reveal"
          style={{ animationDelay: `${Math.min(i * 40, 240)}ms` }}
        >
          <span className="mt-0.5 shrink-0">
            {s.status === "done" && <CheckIcon className="text-signal" width={17} height={17} />}
            {s.status === "start" && (
              <SpinnerIcon className="text-accent" width={17} height={17} />
            )}
            {s.status === "error" && <AlertIcon className="text-flag" width={17} height={17} />}
          </span>
          <div className="min-w-0">
            <p
              className={`text-[15px] leading-tight ${
                s.status === "done"
                  ? "text-ink"
                  : s.status === "error"
                  ? "text-flag"
                  : "text-ink-soft"
              }`}
            >
              {s.label}
            </p>
            {s.detail && (
              <p className="text-[13px] text-ink-faint mt-0.5 font-mono truncate">{s.detail}</p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
