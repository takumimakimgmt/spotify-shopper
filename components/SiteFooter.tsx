"use client";

import { BuyMeACoffeeLink } from "@/components/BuyMeACoffeeLink";

export function SiteFooter() {
  return (
    <footer className="w-full border-t py-8">
      <div className="mx-auto max-w-5xl px-4 flex items-center justify-center">
        <BuyMeACoffeeLink />
      </div>
    </footer>
  );
}
