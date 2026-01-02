"use client";

export function BuyMeACoffeeLink() {
  const href = process.env.NEXT_PUBLIC_BMC_URL;
  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium hover:opacity-90"
    >
      ☕ Buy me a coffee
    </a>
  );
}
