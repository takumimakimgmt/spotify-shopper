import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import AnalyzeForm from "@/app/components/AnalyzeForm";

type ClipboardMock = {
  readText: ReturnType<typeof vi.fn>;
};

function makeProps(
  overrides: Partial<React.ComponentProps<typeof AnalyzeForm>> = {},
) {
  return {
    playlistUrlInput: "",
    rekordboxFile: null,
    rekordboxDate: null,
    rekordboxFilename: null,
    loading: false,
    isReanalyzing: false,
    progress: 0,
    errorText: null,
    errorMeta: undefined,
    banner: null,
    onDismissBanner: undefined,
    progressItems: [],
    setPlaylistUrlInput: vi.fn(),
    setRekordboxFile: vi.fn(),
    handleAnalyze: vi.fn(),
    handleRekordboxChange: vi.fn(),
    setForceRefreshHint: vi.fn(),
    cancelAnalyze: undefined,
    retryFailed: undefined,
    playlistUrlError: null,
    ...overrides,
  };
}

describe("AnalyzeForm paste button", () => {
  let container: HTMLDivElement;
  let root: Root;
  let clipboardDescriptor: PropertyDescriptor | undefined;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    clipboardDescriptor = Object.getOwnPropertyDescriptor(
      navigator,
      "clipboard",
    );
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();

    if (clipboardDescriptor) {
      Object.defineProperty(navigator, "clipboard", clipboardDescriptor);
    } else {
      Reflect.deleteProperty(navigator, "clipboard");
    }

    vi.restoreAllMocks();
  });

  function setClipboard(value: ClipboardMock | undefined) {
    if (value) {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value,
      });
      return;
    }

    Reflect.deleteProperty(navigator, "clipboard");
  }

  async function renderForm(props: React.ComponentProps<typeof AnalyzeForm>) {
    await act(async () => {
      root.render(<AnalyzeForm {...props} />);
    });
  }

  async function clickPaste() {
    const button = container.querySelector("button[type='button']");
    if (!(button instanceof HTMLButtonElement)) {
      throw new Error("Paste button not found");
    }

    await act(async () => {
      button.click();
      await Promise.resolve();
    });
  }

  test("shows blocked message when clipboard API is unavailable", async () => {
    setClipboard(undefined);
    const props = makeProps();
    await renderForm(props);

    await clickPaste();

    expect(container.textContent).toContain(
      "Clipboard access blocked. Press ⌘V / Ctrl+V.",
    );
    expect(props.setPlaylistUrlInput).not.toHaveBeenCalled();
  });

  test("shows empty message when clipboard text trims to empty", async () => {
    setClipboard({
      readText: vi.fn().mockResolvedValue("   "),
    });
    const props = makeProps();
    await renderForm(props);

    await clickPaste();

    expect(container.textContent).toContain(
      "Clipboard is empty. Press ⌘V / Ctrl+V.",
    );
    expect(props.setPlaylistUrlInput).not.toHaveBeenCalled();
  });

  test("populates the input when clipboard text exists", async () => {
    setClipboard({
      readText: vi
        .fn()
        .mockResolvedValue(" https://open.spotify.com/playlist/abc123 "),
    });
    const props = makeProps();
    await renderForm(props);

    await clickPaste();

    expect(props.setPlaylistUrlInput).toHaveBeenCalledWith(
      "https://open.spotify.com/playlist/abc123",
    );
    expect(container.textContent).not.toContain("Clipboard access blocked");
    expect(container.textContent).not.toContain("Clipboard is empty");
  });

  test("shows blocked message when readText throws", async () => {
    setClipboard({
      readText: vi.fn().mockRejectedValue(new Error("denied")),
    });
    const props = makeProps();
    await renderForm(props);

    await clickPaste();

    expect(container.textContent).toContain(
      "Clipboard access blocked. Press ⌘V / Ctrl+V.",
    );
    expect(props.setPlaylistUrlInput).not.toHaveBeenCalled();
  });
});
