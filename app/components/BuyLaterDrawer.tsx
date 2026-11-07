"use client";

import { useEffect, useRef, type ComponentProps } from "react";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import BuyLaterPanel from "./BuyLaterPanel";

type Props = ComponentProps<typeof BuyLaterPanel> & {
  open: boolean;
  onClose: () => void;
};
export default function BuyLaterDrawer({ open, onClose, ...queue }: Props) {
  const { t } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!open || !ref.current) return;
    const dialog = ref.current;
    const origin = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      if (
        origin instanceof HTMLElement &&
        origin !== document.body &&
        origin.isConnected
      )
        origin.focus();
      else
        document
          .querySelector<HTMLButtonElement>(
            'button[aria-controls="buy-later-drawer"]',
          )
          ?.focus();
    };
  }, [open]);
  return (
    <dialog
      ref={ref}
      id="buy-later-drawer"
      aria-labelledby="buy-later-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="fixed inset-y-0 left-auto right-0 m-0 h-dvh max-h-none w-full max-w-[480px] border-l border-white/15 bg-[#0c1116] p-0 text-slate-100 shadow-2xl backdrop:bg-black/65"
    >
      <div className="flex h-full flex-col">
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-white/10 px-6 py-5">
          <div>
            <h2 id="buy-later-title" className="text-xl font-semibold">
              {t("Buy Later")}{" "}
              <span className="ml-2 text-base font-normal text-emerald-300">
                {queue.items.length}
              </span>
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              {t("Saved across your playlists on this browser.")}
            </p>
          </div>
          <button
            type="button"
            autoFocus
            onClick={onClose}
            aria-label={t("Close saved tracks")}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-xl hover:bg-white/10"
          >
            ×
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4">
          {queue.items.length === 0 && !queue.storageWarning && (
            <div className="py-12 text-center">
              <p className="text-lg font-medium">
                {t("Your shopping list starts here.")}
              </p>
              <p className="mx-auto mt-3 max-w-xs text-sm leading-6 text-slate-400">
                {t(
                  "Use Buy Later beside a track to keep it here while you browse.",
                )}
              </p>
            </div>
          )}
          <BuyLaterPanel {...queue} showHeading={false} />
        </div>
      </div>
    </dialog>
  );
}
