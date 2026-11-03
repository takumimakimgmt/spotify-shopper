import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import AnalyzeForm from "@/app/components/AnalyzeForm";

function makeProps(
  overrides: Partial<React.ComponentProps<typeof AnalyzeForm>> = {},
) {
  return {
    playlistUrlInput: "",
    rekordboxFile: null,
    rekordboxDate: null,
    rekordboxFilename: null,
    savedRekordboxXmlMeta: null,
    savedRekordboxXmlBusy: false,
    savedRekordboxXmlError: null,
    loading: false,
    isReanalyzing: false,
    progress: 0,
    phaseLabel: null,
    errorText: null,
    errorMeta: undefined,
    banner: null,
    onDismissBanner: undefined,
    progressItems: [],
    setPlaylistUrlInput: vi.fn(),
    setRekordboxFile: vi.fn(),
    handleAnalyze: vi.fn(),
    handleRekordboxChange: vi.fn(),
    useSavedRekordboxXml: vi.fn(),
    forgetSavedRekordboxXml: vi.fn(),
    setForceRefreshHint: vi.fn(),
    cancelAnalyze: undefined,
    retryFailed: undefined,
    playlistUrlError: null,
    ...overrides,
  };
}

function textButton(container: HTMLElement, label: string) {
  const button = Array.from(container.querySelectorAll("button")).find(
    (candidate) => candidate.textContent === label,
  );

  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`Button not found: ${label}`);
  }

  return button;
}

describe("AnalyzeForm", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  async function renderForm(props: React.ComponentProps<typeof AnalyzeForm>) {
    await act(async () => {
      root.render(<AnalyzeForm {...props} />);
    });
  }

  test("renders the ordered playlist and Rekordbox steps", async () => {
    await renderForm(makeProps());

    expect(container.textContent).toContain("1.Spotify playlist");
    expect(container.textContent).toContain("2.Rekordbox library");
    expect(container.textContent).toContain("No XML selected");
    expect(container.textContent).toContain("Upload Rekordbox XML");
    expect(textButton(container, "Upload")).toBeDefined();
    const submit = textButton(container, "Browse playlist");
    expect(
      textButton(container, "Upload").compareDocumentPosition(submit) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(container.textContent).toContain("up to 3 MB");
    expect(container.textContent).toContain("ownership stays unverified");
    expect(
      Array.from(container.querySelectorAll("button")).some(
        (button) => button.textContent === "Remove",
      ),
    ).toBe(false);
    expect(container.textContent).not.toContain("Continue on your computer");
  });

  test("renders saved XML metadata and saved XML actions", async () => {
    const props = makeProps({
      savedRekordboxXmlMeta: {
        filename: "collection.xml",
        uploadedAt: "2026-05-07T00:00:00.000Z",
        lastModified: Date.UTC(2026, 4, 6, 0, 0, 0),
        size: 2048,
        type: "text/xml",
      },
    });

    await renderForm(props);

    expect(container.textContent).toContain("Rekordbox library");
    expect(container.textContent).toContain("collection.xml");
    expect(container.textContent).toContain("2 KB");
    expect(textButton(container, "Check ownership").type).toBe("submit");

    const uploadButton = textButton(container, "Upload");
    const removeButton = textButton(container, "Remove");
    expect(textButton(container, "Check ownership").type).toBe("submit");

    await act(async () => {
      removeButton.click();
    });

    expect(uploadButton).toBeDefined();
    expect(props.forgetSavedRekordboxXml).toHaveBeenCalledTimes(1);
    expect(container.textContent).not.toContain("Use saved");
    expect(container.textContent).not.toContain("Forget");
  });

  test("renders uploaded XML with Upload and Remove actions", async () => {
    const props = makeProps({
      rekordboxFile: new File(["<DJ_PLAYLISTS />"], "uploaded.xml", {
        type: "text/xml",
      }),
      rekordboxFilename: "uploaded.xml",
    });

    await renderForm(props);

    const removeButton = textButton(container, "Remove");
    expect(textButton(container, "Check ownership").type).toBe("submit");

    await act(async () => {
      removeButton.click();
    });

    expect(textButton(container, "Upload")).toBeDefined();
    expect(props.setRekordboxFile).toHaveBeenCalledWith(null);
    expect(props.forgetSavedRekordboxXml).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain("Use saved");
    expect(container.textContent).not.toContain("Forget");
  });

  test("renders the playlist URL input and Browse playlist button", async () => {
    await renderForm(makeProps());

    const input = container.querySelector(
      "textarea[placeholder='Paste Spotify playlist URL']",
    );
    const analyzeButton = textButton(container, "Browse playlist");

    expect(input).toBeInstanceOf(HTMLTextAreaElement);
    expect(input?.getAttribute("id")).toBe("playlist-url");
    expect(container.querySelector("label[for='playlist-url']")).not.toBeNull();
    expect(analyzeButton.type).toBe("submit");
  });

  test("calls setPlaylistUrlInput when the input value changes", async () => {
    const props = makeProps();
    await renderForm(props);

    const input = container.querySelector(
      "textarea[placeholder='Paste Spotify playlist URL']",
    );
    if (!(input instanceof HTMLTextAreaElement)) {
      throw new Error("Playlist input not found");
    }

    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value",
      )?.set;
      valueSetter?.call(input, "https://open.spotify.com/playlist/abc123");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(props.setPlaylistUrlInput).toHaveBeenCalledWith(
      "https://open.spotify.com/playlist/abc123",
    );
  });

  test("keeps Browse playlist disabled when there is no playlist URL", async () => {
    await renderForm(makeProps({ playlistUrlInput: "   " }));

    expect(textButton(container, "Browse playlist").disabled).toBe(true);
  });

  test("enables Browse playlist when there is a playlist URL", async () => {
    await renderForm(
      makeProps({
        playlistUrlInput: "https://open.spotify.com/playlist/abc123",
      }),
    );

    expect(textButton(container, "Browse playlist").disabled).toBe(false);
  });

  test("shows indeterminate Spotify fetch feedback while analysis is running", async () => {
    const cancelAnalyze = vi.fn();

    await renderForm(
      makeProps({
        playlistUrlInput: "https://open.spotify.com/playlist/abc123",
        loading: true,
        progress: 35,
        phaseLabel: "Fetching Spotify...",
        cancelAnalyze,
      }),
    );

    expect(
      container.textContent?.match(/Fetching Spotify\.\.\./g),
    ).toHaveLength(1);
    expect(container.textContent).toContain(
      "First run can take a few seconds while the server wakes up.",
    );
    expect(container.textContent).toContain("Working...");
    expect(container.textContent).not.toContain("35%");
    expect(textButton(container, "Browse playlist").disabled).toBe(true);

    await act(async () => {
      textButton(container, "Cancel").click();
    });

    expect(cancelAnalyze).toHaveBeenCalledTimes(1);
  });

  test("shows invalid playlist errors beside the input", async () => {
    await renderForm(
      makeProps({
        playlistUrlInput:
          "https://open.spotify.com/album/588N4Kt4446o660ARpswUD",
        errorText: "Enter a Spotify playlist URL, URI, or ID.",
        errorMeta: {
          error_code: "PLAYLIST_INVALID",
          message: "Enter a Spotify playlist URL, URI, or ID.",
        },
      }),
    );

    expect(container.textContent).toContain("Invalid playlist input");
    expect(container.textContent).toContain(
      "Enter a Spotify playlist URL, URI, or ID.",
    );
    expect(container.textContent).not.toContain("Show refresh tips");
    const input = container.querySelector("#playlist-url");
    expect(input?.getAttribute("aria-invalid")).toBe("true");
    expect(input?.getAttribute("aria-describedby")).toBe("playlist-url-error");
    expect(container.textContent).not.toContain("Retry");
  });
  test("blocks a selected file over the hosted XML limit before submission", async () => {
    const file = new File(["xml"], "large.xml", { type: "text/xml" });
    Object.defineProperty(file, "size", { value: 3 * 1024 * 1024 + 1 });
    await renderForm(
      makeProps({
        playlistUrlInput:
          "https://open.spotify.com/playlist/0jKqvXbsroCPdccFmORnPz",
        rekordboxFile: file,
        rekordboxFilename: file.name,
      }),
    );
    expect(textButton(container, "Check ownership").disabled).toBe(true);
    expect(container.textContent).toContain("max 3MB");
  });
});
