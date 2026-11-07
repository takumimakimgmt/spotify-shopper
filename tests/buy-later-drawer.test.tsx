import React, { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import BuyLaterDrawer from "@/app/components/BuyLaterDrawer";
import { useBuyQueue } from "@/lib/state/useBuyQueue";
import type { PlaylistRow } from "@/lib/types";
const track: PlaylistRow = {
  index: 0,
  title: "Example Extended Mix",
  artist: "Example Artist",
  album: "Album",
  owned: false,
  stores: {},
};
function Harness() {
  const queue = useBuyQueue();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        id="trigger"
        aria-controls="buy-later-drawer"
        onClick={() => setOpen(true)}
      >
        Buy Later {queue.items.length}
      </button>
      {!open && (
        <button id="temporary" onClick={() => setOpen(true)}>
          Temporary trigger
        </button>
      )}
      <button
        id="save"
        onClick={() =>
          queue.addTrack(track, {
            name: "Beatport",
            url: "https://www.beatport.com/search?q=example",
          })
        }
      >
        Save track
      </button>
      <BuyLaterDrawer
        open={open}
        onClose={() => setOpen(false)}
        items={queue.items}
        onRemove={queue.removeItem}
      />
    </>
  );
}
let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  document.body.style.overflow = "";
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.removeAttribute("open");
    },
  });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(<Harness />));
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  localStorage.clear();
  Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
  Reflect.deleteProperty(HTMLDialogElement.prototype, "close");
  vi.restoreAllMocks();
});
it("opens an empty list, closes with Escape and restores focus and scrolling", async () => {
  const trigger = host.querySelector<HTMLButtonElement>("#trigger")!;
  trigger.focus();
  await act(async () => trigger.click());
  const dialog = host.querySelector("dialog")!;
  expect(dialog.open).toBe(true);
  expect(dialog.textContent).toContain("Your shopping list starts here.");
  expect(document.body.style.overflow).toBe("hidden");
  await act(async () =>
    dialog.dispatchEvent(
      new Event("cancel", { bubbles: false, cancelable: true }),
    ),
  );
  expect(dialog.open).toBe(false);
  expect(document.activeElement).toBe(trigger);
  expect(document.body.style.overflow).toBe("");
});
it("updates the count, preserves saved links, removes a track and closes on the backdrop", async () => {
  await act(async () =>
    host.querySelector<HTMLButtonElement>("#save")!.click(),
  );
  expect(host.querySelector("#trigger")?.textContent).toContain("1");
  await act(async () =>
    host.querySelector<HTMLButtonElement>("#trigger")!.click(),
  );
  const dialog = host.querySelector("dialog")!;
  expect(dialog.textContent).toContain(track.title);
  expect(dialog.querySelector('a[href*="beatport"]')).toBeTruthy();
  await act(async () =>
    dialog
      .querySelector<HTMLButtonElement>(
        'button[aria-label="Remove Example Extended Mix from Buy Later"]',
      )!
      .click(),
  );
  expect(host.querySelector("#trigger")?.textContent).toContain("0");
  expect(dialog.textContent).toContain("Your shopping list starts here.");
  await act(async () => dialog.click());
  expect(dialog.open).toBe(false);
});

it("returns to the permanent button when the opening control disappears", async () => {
  const opener = host.querySelector<HTMLButtonElement>("#temporary")!;
  opener.focus();
  await act(async () => opener.click());
  await act(async () =>
    host
      .querySelector("dialog")!
      .dispatchEvent(new Event("cancel", { cancelable: true })),
  );
  expect(document.activeElement).toBe(host.querySelector("#trigger"));
});
it("does not call a storage read failure an empty shopping list", async () => {
  await act(async () =>
    root.render(
      <BuyLaterDrawer
        open
        onClose={() => {}}
        items={[]}
        onRemove={() => {}}
        storageWarning="Saved data could not be read."
      />,
    ),
  );
  expect(host.textContent).toContain("Saved data could not be read.");
  expect(host.textContent).not.toContain("Your shopping list starts here.");
});
