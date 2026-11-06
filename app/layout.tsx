import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.playlistshopper.com"),
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Playlist Shopper",
    title: "Playlist Shopper — Spotify, rekordbox & Beatport",
    description:
      "Compare Spotify playlists with your rekordbox XML library and find tracks to buy on Beatport. Library matching stays on your device.",
    locale: "en_US",
    alternateLocale: ["ja_JP"],
    images: [
      {
        url: "/og/playlist-shopper-v2.jpg",
        width: 1734,
        height: 907,
        alt: "Playlist Shopper in bold lettering beside fine circular grooves.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Playlist Shopper — Spotify, rekordbox & Beatport",
    description:
      "Compare your Spotify playlists with rekordbox and find tracks to buy on Beatport.",
    images: [
      {
        url: "/og/playlist-shopper-v2.jpg",
        alt: "Playlist Shopper in bold lettering beside fine circular grooves.",
      },
    ],
  },
  title: "Playlist Shopper — Spotify, rekordbox & Beatport",
  description:
    "Compare Spotify playlists with your rekordbox XML library and find tracks to buy on Beatport. Library matching stays on your device.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <LanguageProvider>{children}</LanguageProvider>
        <Analytics />
      </body>
    </html>
  );
}
