"use client";
import { useI18n } from "@/lib/i18n/LanguageProvider";
export default function SkeletonResults() {
  const { t: tr } = useI18n();

  return (
    <div className="w-full h-40 bg-slate-800/50 animate-pulse rounded-lg flex items-center justify-center text-slate-400 text-sm">
      {tr("Loading results...")}
    </div>
  );
}
