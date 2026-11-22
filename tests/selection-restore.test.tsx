import React, { act, useEffect } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { useSelectionState } from "@/lib/state/useSelectionState";
it("restores selection after hydration without mismatching server HTML or overwriting storage", async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.setItem("spotify-shopper-active-tab", "saved-playlist");
  localStorage.setItem("spotify-shopper-form-collapsed", "true");
  let selection: ReturnType<typeof useSelectionState>;
  function Harness() {
    const value = useSelectionState(null, false);
    useEffect(() => {
      selection = value;
    }, [value]);
    return (
      <p>
        {value.formCollapsed ? "Results" : "Input"}:{value.activeTab}
      </p>
    );
  }
  const host = document.createElement("div");
  host.innerHTML = renderToString(<Harness />);
  document.body.append(host);
  expect(host.textContent).toBe("Input:");
  const mismatch = vi.fn();
  let root: ReturnType<typeof createRoot> | undefined;
  try {
    await act(async () => {
      root = hydrateRoot(host, <Harness />, { onRecoverableError: mismatch });
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
    });
    expect(mismatch).not.toHaveBeenCalled();
    expect(selection!.selectionHydrated).toBe(true);
    expect(host.textContent).toBe("Results:saved-playlist");
    expect(localStorage.getItem("spotify-shopper-form-collapsed")).toBe("true");
    await act(async () => selection.setFormCollapsed(false));
    expect(localStorage.getItem("spotify-shopper-form-collapsed")).toBe(
      "false",
    );
  } finally {
    act(() => root?.unmount());
    host.remove();
    localStorage.clear();
  }
});
