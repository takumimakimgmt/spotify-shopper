"use client";

import { BuyMeACoffeeButton } from "@/components/BuyMeACoffeeButton";

export function SiteFooter() {
  return (
    <footer className="w-full border-t py-8">
      <div className="mx-auto max-w-5xl px-4 flex items-center justify-center">
        <BuyMeACoffeeButton />
      </div>
    </footer>
  );
}
