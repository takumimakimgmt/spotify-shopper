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

  function mockClipboard() {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    return writeText;
  }

  async function clickCopy() {
    const copyButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Copy desktop link",
    );
    await act(async () => copyButton?.click());
    return copyButton;
  }

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

  test("uses handoff input before the main playlist input", async () => {
    const writeText = mockClipboard();
    const handoffInput = `spotify:playlist:${playlistId}`;
    await act(async () =>
      root.render(
        <MobileDesktopHandoff
          handoffInput={handoffInput}
          playlistInput={`https://open.spotify.com/playlist/${playlistId}`}
          focusPlaylistInput={vi.fn()}
        />,
      ),
    );

    const copyButton = await clickCopy();

    expect(writeText).toHaveBeenCalledWith(
      `${window.location.origin}?playlist=${encodeURIComponent(handoffInput)}`,
    );
    expect(copyButton?.textContent).toBe("Copied");
  });

  test("falls back to the main playlist input", async () => {
    const writeText = mockClipboard();
    const playlistInput = `https://open.spotify.com/playlist/${playlistId}?si=abc`;
    await act(async () =>
      root.render(
        <MobileDesktopHandoff
          playlistInput={playlistInput}
          focusPlaylistInput={vi.fn()}
        />,
      ),
    );

    await clickCopy();

    expect(writeText).toHaveBeenCalledWith(
      `${window.location.origin}?playlist=${encodeURIComponent(playlistInput)}`,
    );
  });

  test("falls back to the current analyzed playlist source", async () => {
    const writeText = mockClipboard();
    const activePlaylistInput = `https://open.spotify.com/playlist/${playlistId}?si=analyzed`;
    await act(async () =>
      root.render(
        <MobileDesktopHandoff
          playlistInput=""
          activePlaylistInput={activePlaylistInput}
          focusPlaylistInput={vi.fn()}
        />,
      ),
    );

    expect(container.textContent).not.toContain(
      "Paste a playlist first to create your desktop link.",
    );
    await clickCopy();
    expect(writeText).toHaveBeenCalledWith(
      `${window.location.origin}?playlist=${encodeURIComponent(activePlaylistInput)}`,
    );
  });

  test("uses the resolved desktop link for Email to myself", async () => {
    const activePlaylistInput = `spotify:playlist:${playlistId}`;
    await act(async () =>
      root.render(
        <MobileDesktopHandoff
          playlistInput=""
          activePlaylistInput={activePlaylistInput}
          focusPlaylistInput={vi.fn()}
        />,
      ),
    );

    const emailLink = Array.from(container.querySelectorAll("a")).find(
      (link) => link.textContent === "Email to myself",
    );
    const desktopLink = `${window.location.origin}?playlist=${encodeURIComponent(activePlaylistInput)}`;
    expect(decodeURIComponent(emailLink?.getAttribute("href") ?? "")).toContain(
      desktopLink,
    );
  });

  test("shows the empty message only when every playlist source is missing", async () => {
    await act(async () =>
      root.render(
        <MobileDesktopHandoff
          playlistInput=""
          activePlaylistInput=""
          queryPlaylist=""
          focusPlaylistInput={vi.fn()}
        />,
      ),
    );

    expect(container.textContent).toContain(
      "Paste a playlist first to create your desktop link.",
    );
    const copyButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Copy desktop link",
    );
    expect(copyButton?.disabled).toBe(true);
  });
});
