import fs from "node:fs/promises";

const target = "_teacher_data";

try {
  const st = await fs.lstat(target);
  if (st.isSymbolicLink()) {
    // local dev may have symlink; Vercel won't. Keep as-is.
    console.log(`[prebuild] ${target} is symlink; leaving it`);
    process.exit(0);
  }
  if (st.isDirectory()) {
    console.log(`[prebuild] ${target} exists`);
    process.exit(0);
  }
  console.warn(`[prebuild] ${target} exists but is not a directory; continuing anyway`);
} catch {
  // not exists
}

await fs.mkdir(target, { recursive: true });
console.log(`[prebuild] created ${target}`);
