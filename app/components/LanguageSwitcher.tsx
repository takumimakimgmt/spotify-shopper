"use client";
import { useI18n } from "@/lib/i18n/LanguageProvider";
export default function LanguageSwitcher() {
  const { language, setLanguage, t, warning } = useI18n();
  return (
    <div className="mb-6 flex flex-col items-end gap-2">
      <span className="text-sm font-medium text-slate-200">
        Language / 言語
      </span>
      <div
        role="group"
        aria-label="Language / 言語"
        className="inline-flex rounded-lg border border-white/20 p-1 text-sm"
      >
        {(
          [
            ["ja", "日本語"],
            ["en", "English"],
          ] as const
        ).map(([code, label]) => (
          <button
            type="button"
            key={code}
            lang={code}
            aria-pressed={language === code}
            onClick={() => setLanguage(code)}
            className={`min-h-11 rounded-md px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 ${language === code ? "bg-white/15 text-white" : "text-slate-200 hover:text-white"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {warning && (
        <p role="status" className="text-xs text-amber-200">
          {t(warning)}
        </p>
      )}
    </div>
  );
}
