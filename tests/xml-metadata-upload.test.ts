import { describe, expect, it } from "vitest";
import {
  compactLibraryXml,
  prepareXmlUpload,
} from "@/lib/rekordbox/prepareXmlUpload";

describe("local library metadata preparation", () => {
  it("preserves all recording fields and entries while excluding paths and cues", () => {
    const xml =
      '<DJ_PLAYLISTS><COLLECTION><TRACK TrackID="1" Name="Song &amp; Edit" Artist="A &amp; B" Album="Album" ISRC="ID" Location="file://private/track.wav"><POSITION_MARK Name="private"/></TRACK><TRACK Name="Other" Artist="C"/></COLLECTION><PLAYLISTS><TRACK Key="1"/></PLAYLISTS></DJ_PLAYLISTS>';
    const compact = compactLibraryXml(xml);
    const doc = new DOMParser().parseFromString(compact, "application/xml");
    expect(doc.querySelectorAll("TRACK")).toHaveLength(2);
    expect(doc.querySelector("TRACK")?.getAttribute("Name")).toBe(
      "Song & Edit",
    );
    expect(doc.querySelector("TRACK")?.getAttribute("ISRC")).toBe("ID");
    expect(compact).not.toMatch(
      /private|Location|TrackID|POSITION_MARK|<PLAYLISTS>/,
    );
  });
  it.each([
    "<broken>",
    "<DJ_PLAYLISTS/>",
    "<R><COLLECTION/><COLLECTION/></R>",
    '<!DOCTYPE R [<!ENTITY e "bad">]><R><COLLECTION/></R>',
  ])("rejects invalid or ambiguous XML without dropping tracks", (xml) => {
    expect(() => compactLibraryXml(xml)).toThrow();
  });
  it("prepares an original file larger than the transfer limit without truncation", async () => {
    const xml =
      '<DJ_PLAYLISTS><COLLECTION><TRACK Name="Song" Artist="A" Location="' +
      "private".repeat(500_000) +
      '"/></COLLECTION></DJ_PLAYLISTS>';
    const file = new File([xml], "original.xml", { type: "text/xml" });
    expect(file.size).toBeGreaterThan(3 * 1024 * 1024);
    const output = await prepareXmlUpload(file);
    expect(output.size).toBeLessThan(500);
    expect(output.name).toBe("library-metadata.xml");
    expect(await prepareXmlUpload(file)).toBe(output);
  });
  it("rejects oversized metadata rather than silently reducing the collection", () => {
    const track = '<TRACK Name="' + "A".repeat(2000) + '" Artist="B"/>';
    const xml =
      "<DJ_PLAYLISTS><COLLECTION>" +
      track.repeat(1600) +
      "</COLLECTION></DJ_PLAYLISTS>";
    expect(() => compactLibraryXml(xml)).toThrow("No tracks were sent");
  });
  it("stops before preparing a cancelled request", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      prepareXmlUpload(new File(["bad"], "file.xml"), controller.signal),
    ).rejects.toThrow();
  });
});
