import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { resetLocalData } from "@/lib/storage/resetLocalData";
import ErrorScreen from "@/app/error";

const { deleteXml } = vi.hoisted(() => ({ deleteXml: vi.fn() }));
vi.mock("@/lib/storage/savedRekordboxXml", () => ({
  deleteSavedRekordboxXml: deleteXml,
}));
const keys = [
  "spotify-shopper-results",
  "spotify-shopper-active-tab",
  "spotify-shopper-form-collapsed",
  "playlist-shopper-buy-queue",
];
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  keys.forEach((key) => localStorage.setItem(key, "saved"));
  localStorage.setItem("share:unrelated-app", "keep");
  deleteXml.mockReset().mockResolvedValue(undefined);
});
afterEach(() => vi.restoreAllMocks());
describe("recovery reset boundaries", () => {
  it("history and settings resets preserve XML and purchase queue", async () => {
    await resetLocalData("history");
    expect(localStorage.getItem(keys[0])).toBeNull();
    expect(localStorage.getItem(keys[3])).toBe("saved");
    await resetLocalData("settings");
    expect(localStorage.getItem(keys[1])).toBeNull();
    expect(localStorage.getItem(keys[2])).toBeNull();
    expect(localStorage.getItem(keys[3])).toBe("saved");
    expect(deleteXml).not.toHaveBeenCalled();
  });
  it("full reset waits for XML deletion and removes only this app's known keys", async () => {
    let finish!: () => void;
    deleteXml.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const pending = resetLocalData("all");
    expect(localStorage.getItem(keys[0])).toBe("saved");
    finish();
    await pending;
    keys.forEach((key) => expect(localStorage.getItem(key)).toBeNull());
    expect(localStorage.getItem("share:unrelated-app")).toBe("keep");
  });
  it("shows failed XML deletion and does not claim recovery succeeded", async () => {
    deleteXml.mockRejectedValue(new Error("blocked"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const div = document.createElement("div");
    const root = createRoot(div);
    const reset = vi.fn();
    try {
      await act(async () => {
        root.render(<ErrorScreen error={new Error("failed")} reset={reset} />);
      });
      const button = Array.from(div.querySelectorAll("button")).find((b) =>
        b.textContent?.startsWith("Delete all"),
      )!;
      await act(async () => {
        button.click();
      });
      expect(div.querySelector('[role="alert"]')?.textContent).toContain(
        "Reset could not finish",
      );
      expect(reset).not.toHaveBeenCalled();
      expect(localStorage.getItem(keys[3])).toBe("saved");
    } finally {
      act(() => root.unmount());
    }
  });
});
