"use client";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import React, { useState, useEffect, useRef } from "react";

interface ErrorAlertProps {
  title: string;
  message?: string | null;
  details?: string; // preformatted JSON or stack/body
  hint?: string;
}

export default function ErrorAlert({
  title,
  message,
  details,
  hint,
}: ErrorAlertProps) {
  const { t: tr } = useI18n();

  const [expanded, setExpanded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (message && ref.current) {
      ref.current.focus();
    }
  }, [message]);

  const hasDetails = typeof details === "string" && details.trim().length > 0;

  return (
    <div
      ref={ref}
      tabIndex={-1}
      className="rounded-md border border-red-500 bg-red-900/40 px-3 py-2 text-xs text-red-100 space-y-2"
      role="alert"
      aria-live="polite"
    >
      <p className="font-semibold">{tr(title)}</p>
      {message && <p className="text-red-200">{tr(message)}</p>}
      {hint && <p className="text-amber-200">{tr(hint)}</p>}

      {hasDetails && (
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-red-200 hover:text-red-100 underline"
          >
            {expanded ? tr("Hide details") : tr("Show details")}
          </button>
          {expanded && (
            <div className="mt-2 space-y-2">
              <pre className="bg-slate-950/50 rounded p-2 font-mono text-[10px] whitespace-pre-wrap text-slate-300">
                {details}
              </pre>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(details!)}
                className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 px-2 py-1 rounded"
              >
                {tr("Copy details")}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
