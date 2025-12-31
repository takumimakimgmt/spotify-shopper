import fs from "node:fs/promises";
import openapiTS, { astToString } from "openapi-typescript";

const schemaText = await fs.readFile("openapi.json", "utf-8");
const schema = JSON.parse(schemaText);

const ast = await openapiTS(schema);
const output = astToString(ast) + "\n";

await fs.mkdir("lib/api", { recursive: true });
await fs.writeFile("lib/api/openapi.ts", output, "utf-8");
console.log("[ok] generated lib/api/openapi.ts");
