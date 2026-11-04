import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import {
  LanguageProvider,
  LANGUAGE_KEY,
  translate,
} from "@/lib/i18n/LanguageProvider";
import LanguageSwitcher from "@/app/components/LanguageSwitcher";
import ResultsTable from "@/app/components/ResultsTable";
import type { PlaylistRow } from "@/lib/types";
const track: PlaylistRow = {
  index: 1,
  title: "Search Beatport",
  artist: "Example Artist 日本語",
  album: "Album",
  owned: null,
  ownedReason: "version_mismatch",
  stores: {},
  libraryMatch: {
    status: "review",
    reason: "version_mismatch",
    matched_title: "Other Remix",
    matched_artist: "Example Artist 日本語",
  },
};
let root: ReturnType<typeof createRoot>;
let div: HTMLDivElement;
const mount = async () => {
  div = document.createElement("div");
  document.body.appendChild(div);
  root = createRoot(div);
  await act(async () => {
    root.render(
      <LanguageProvider>
        <LanguageSwitcher />
        <ResultsTable
          currentResult={{}}
          displayedTracks={[track]}
          onReviewDecision={() => {}}
        />
      </LanguageProvider>,
    );
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
};
const click = async (label: string) => {
  const button = [...div.querySelectorAll("button")].find(
    (x) => x.textContent === label,
  )!;
  expect(button).toBeTruthy();
  await act(async () => button.click());
};
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
});
afterEach(() => {
  if (root) act(() => root.unmount());
  div?.remove();
  vi.restoreAllMocks();
  localStorage.clear();
  document.documentElement.lang = "en";
});
describe("language preference and UI", () => {
  it("switches actual result labels, preserves recording metadata and saved work, and restores after remount", async () => {
    localStorage.setItem(LANGUAGE_KEY, "en");
    localStorage.setItem("spotify-shopper-results", "keep-existing-results");
    await mount();
    expect(div.textContent).toContain("Compare recordings");
    await click("日本語");
    expect(document.documentElement.lang).toBe("ja");
    expect(div.textContent).toContain("曲を見比べる");
    expect(div.textContent).toContain("確認が必要");
    expect(div.textContent).toContain("Beatportで検索");
    expect(
      div.querySelector('a[aria-label="Search Beatportを試聴"]')?.textContent,
    ).toBe("Search Beatport");
    expect(div.textContent).toContain("Example Artist 日本語");
    expect(localStorage.getItem("spotify-shopper-results")).toBe(
      "keep-existing-results",
    );
    expect(localStorage.getItem(LANGUAGE_KEY)).toBe("ja");
    act(() => root.unmount());
    div.remove();
    await mount();
    expect(div.textContent).toContain("曲を見比べる");
    await click("English");
    expect(document.documentElement.lang).toBe("en");
    expect(div.textContent).toContain("Compare recordings");
  });
  it("uses Japanese browser preference for new visitors and honours explicit English", async () => {
    vi.spyOn(navigator, "languages", "get").mockReturnValue(["ja-JP", "en"]);
    await mount();
    expect(div.textContent).toContain("曲を見比べる");
    await click("English");
    act(() => root.unmount());
    div.remove();
    await mount();
    expect(div.textContent).toContain("Compare recordings");
  });
  it("still switches when storage fails and explains that the choice is temporary", async () => {
    await mount();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    await click("日本語");
    expect(div.textContent).toContain("曲を見比べる");
    expect(div.textContent).toContain("言語の設定を保存できませんでした");
  });
  it("handles preference updates in another tab without touching work", async () => {
    localStorage.setItem(LANGUAGE_KEY, "en");
    await mount();
    await act(async () => {
      window.dispatchEvent(
        new StorageEvent("storage", { key: LANGUAGE_KEY, newValue: "ja" }),
      );
    });
    expect(div.textContent).toContain("曲を見比べる");
  });
  it("substitutes placeholders literally and preserves unmapped diagnostics", () => {
    expect(translate("ja", "Listen to {title}", { title: "$& <Remix>" })).toBe(
      "$& <Remix>を試聴",
    );
    expect(translate("ja", "unmapped diagnostic 123")).toBe(
      "unmapped diagnostic 123",
    );
  });
});
