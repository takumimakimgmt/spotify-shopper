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
    title: "Playlist Shopper — Spotify, Rekordbox & Beatport",
    description:
      "Compare Spotify playlists with your Rekordbox XML library and find purchase candidates on Beatport. Library matching stays on your device.",
    locale: "en_US",
    alternateLocale: ["ja_JP"],
    images: [
      {
        url: "/og/playlist-shopper-v1.jpg",
        width: 1734,
        height: 907,
        alt: "Playlist Shopper — Find missing tracks in Rekordbox. A playlist beside a record collection.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Playlist Shopper — Spotify, Rekordbox & Beatport",
    description:
      "Compare your Spotify playlists with Rekordbox and find purchase candidates on Beatport.",
    images: [
      {
        url: "/og/playlist-shopper-v1.jpg",
        alt: "Playlist Shopper — Find missing tracks in Rekordbox.",
      },
    ],
  },
  title: "Playlist Shopper — Spotify, Rekordbox & Beatport",
  description:
    "Compare Spotify playlists with your Rekordbox XML library and find purchase candidates on Beatport. Library matching stays on your device.",
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
