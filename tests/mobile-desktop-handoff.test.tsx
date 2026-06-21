import React, { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import MobileDesktopHandoff from "@/app/components/MobileDesktopHandoff";
import PlaylistQueryPrefill from "@/app/components/PlaylistQueryPrefill";

const navigation = vi.hoisted(() => ({
  searchParams: new URLSearchParams(),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => navigation.searchParams,
}));

const playlistId = "588N4Kt4446o660ARpswUD";

function PrefillHarness() {
  const [value, setValue] = useState("");
  return (
    <>
      <PlaylistQueryPrefill setPlaylistUrlInput={setValue} />
      <textarea aria-label="Playlist" value={value} readOnly />
    </>
  );
}

describe("mobile desktop handoff", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    navigation.searchParams = new URLSearchParams();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  test.each([
    playlistId,
    `https://open.spotify.com/playlist/${playlistId}?si=handoff`,
    `spotify:playlist:${playlistId}`,
  ])(
    "prefills the playlist input from an encoded query value: %s",
    async (value) => {
      navigation.searchParams = new URLSearchParams(
        `playlist=${encodeURIComponent(value)}`,
      );

      await act(async () => root.render(<PrefillHarness />));

      expect(
        (container.querySelector("textarea") as HTMLTextAreaElement).value,
      ).toBe(value);
    },
  );

  test("leaves the existing desktop input empty without a playlist query", async () => {
    await act(async () => root.render(<PrefillHarness />));

    expect(
      (container.querySelector("textarea") as HTMLTextAreaElement).value,
    ).toBe("");
  });

  test("renders the mobile handoff panel for a small viewport", async () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 390,
    });

    await act(async () =>
      root.render(
        <MobileDesktopHandoff playlistInput="" focusPlaylistInput={vi.fn()} />,
      ),
    );

    const panel = container.querySelector("aside");
    expect(panel?.className).toContain("md:hidden");
    expect(container.textContent).toContain("Use this on your computer");
    expect(container.textContent).toContain(
      "Paste a playlist first to create your desktop link.",
    );
  });

  test("copies a desktop URL containing the encoded playlist input", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    const playlist = `https://open.spotify.com/playlist/${playlistId}?si=abc`;
    await act(async () =>
      root.render(
        <MobileDesktopHandoff
          playlistInput={playlist}
          focusPlaylistInput={vi.fn()}
        />,
      ),
    );

    const copyButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Copy desktop link",
    );
    await act(async () => copyButton?.click());

    expect(writeText).toHaveBeenCalledWith(
      `${window.location.origin}?playlist=${encodeURIComponent(playlist)}`,
    );
    expect(copyButton?.textContent).toBe("Copied");
  });
});
