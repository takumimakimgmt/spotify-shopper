import { MAX_XML_BYTES, MAX_XML_UPLOAD_BYTES } from "../constants";

const prepared = new WeakMap<File, Promise<File>>();
const fields = ["Name", "Artist", "Album", "ISRC"] as const;

function readFile(file: File): Promise<string> {
  if (typeof file.text === "function") return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () =>
      reject(new Error("Could not read the selected XML."));
    reader.readAsText(file);
  });
}

/** Retain every collection entry, but never send local file paths, cues or playlists. */
export function compactLibraryXml(text: string): string {
  if (/<!\s*(DOCTYPE|ENTITY)\b/i.test(text)) {
    throw new Error("XML document types and entities are not supported.");
  }
  const document = new DOMParser().parseFromString(text, "application/xml");
  if (document.querySelector("parsererror"))
    throw new Error("Invalid XML file.");
  const collections = document.getElementsByTagName("COLLECTION");
  if (collections.length !== 1)
    throw new Error("XML must contain one COLLECTION.");
  const collection = collections[0];
  const output = document.implementation.createDocument(null, "DJ_PLAYLISTS");
  const target = output.createElement("COLLECTION");
  output.documentElement.appendChild(target);
  let count = 0;
  // Reject excessive structure before copying. No truncation or partial library matching.
  const stack: Array<[Element, number]> = [[document.documentElement, 1]];
  let nodes = 0;
  while (stack.length) {
    const [element, depth] = stack.pop()!;
    if (++nodes > 300_000 || depth > 64)
      throw new Error("XML structure is too complex.");
    for (const child of element.children) stack.push([child, depth + 1]);
  }
  for (const child of collection.children) {
    if (child.tagName !== "TRACK") continue;
    if (++count > 100_000)
      throw new Error("XML exceeds 100,000 library entries.");
    const track = output.createElement("TRACK");
    for (const field of fields) {
      const value = child.getAttribute(field);
      if ((value?.length ?? 0) > 2048)
        throw new Error("XML track metadata is too long.");
      if (value !== null) track.setAttribute(field, value);
    }
    target.appendChild(track);
  }
  target.setAttribute("Entries", String(count));
  const serialized = new XMLSerializer().serializeToString(output);
  if (new Blob([serialized]).size > MAX_XML_UPLOAD_BYTES) {
    throw new Error(
      "Library metadata still exceeds the 3 MB transfer limit. No tracks were sent. Choose a smaller export and check its coverage.",
    );
  }
  return serialized;
}

export async function prepareXmlUpload(
  file: File,
  signal?: AbortSignal,
): Promise<File> {
  signal?.throwIfAborted();
  if (file.size > MAX_XML_BYTES)
    throw new Error("XML file too large (max 50MB).");
  let promise = prepared.get(file);
  if (!promise) {
    promise = readFile(file).then(
      (text) =>
        new File([compactLibraryXml(text)], "library-metadata.xml", {
          type: "text/xml",
        }),
    );
    prepared.set(file, promise);
    void promise.catch(() => prepared.delete(file));
  }
  const result = await promise;
  signal?.throwIfAborted();
  return result;
}
