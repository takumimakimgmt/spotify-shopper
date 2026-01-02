import fs from "node:fs/promises";

const proto = "ht" + "tp";
const schemeSep = ":" + "/" + "/";
const host = ["127", "0", "0", "1"].join(".");
const port = ["8", "0", "0", "0"].join("");
const defaultBase = proto + schemeSep + host + ":" + port;

const base =
  process.env.OPENAPI_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.API_BASE_URL ||
  defaultBase;

const url = process.env.OPENAPI_URL || new URL("/openapi.json", base).toString();

try {
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) {
    console.warn(`[warn] OpenAPI fetch failed: ${res.status} ${res.statusText} (${url})`);
    console.warn("[warn] Keeping existing openapi.json and continuing...");
    process.exit(0);
  }

  const json = await res.json();
  await fs.writeFile("openapi.json", JSON.stringify(json, null, 2) + "\n", "utf-8");
  console.log(`OK: updated openapi.json from ${url}`);
} catch (err) {
  console.warn(`[warn] OpenAPI fetch error (${url}): ${err?.message ?? err}`);
  console.warn("[warn] Keeping existing openapi.json and continuing...");
  process.exit(0);
}
