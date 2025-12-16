import React from 'react';

interface ShopperHeaderProps {
  title: string;
  subtitle: string;
}

export function ShopperHeader({ title, subtitle }: ShopperHeaderProps) {
  return (
    <header className="space-y-3">
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      <p className="text-base text-emerald-300 font-medium leading-relaxed">{subtitle}</p>
    </header>
  );
}
