"use client";

import { useI18n } from "@/lib/i18n/LanguageProvider";
import React, { useEffect, useState } from "react";
import { resetLocalData, type ResetScope } from "../lib/storage/resetLocalData";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t: tr } = useI18n();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  useEffect(() => {
    console.error("[GlobalError]", error);
  }, [error]);

  async function clear(scope: ResetScope) {
    setBusy(true);
    setFailure(null);
    try {
      await resetLocalData(scope);
      reset();
    } catch {
      setFailure(
        "Reset could not finish. Some data may remain. Check browser storage access and retry.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      <h1 className="text-lg font-semibold">{tr("Something went wrong")}</h1>
      <p>
        {tr(
          "Try again first. If the problem continues, choose which saved data to remove.",
        )}
      </p>
      {failure && <p role="alert">{tr(failure)}</p>}
      <div className="flex flex-wrap gap-3">
        <button disabled={busy} onClick={() => reset()}>
          {tr("Retry")}
        </button>
        <button disabled={busy} onClick={() => void clear("history")}>
          {tr("Clear analysis history (keep XML and Buy Later)")}
        </button>
        <button disabled={busy} onClick={() => void clear("settings")}>
          {tr("Reset display settings (keep saved data)")}
        </button>
        <button disabled={busy} onClick={() => void clear("all")}>
          {tr(
            "Delete all saved data (history, XML, Buy Later, confirmations and settings)",
          )}
        </button>
      </div>
      {busy && <p role="status">{tr("Removing selected data\u2026")}</p>}
      <details>
        <summary>{tr("Error details")}</summary>
        <pre className="whitespace-pre-wrap">
          {String(error?.message ?? error)}
          {error?.digest ? `\n\ndigest: ${error.digest}` : ""}
        </pre>
      </details>
    </div>
  );
}
