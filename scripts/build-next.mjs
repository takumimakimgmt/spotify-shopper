import { spawn } from "node:child_process";

const ignoredLine =
  "[baseline-browser-mapping] The data in this module is over two months old.";
const nextBin = process.platform === "win32" ? "next.cmd" : "next";

function createFilteredWriter(stream) {
  let pending = "";

  return {
    write(chunk) {
      pending += chunk.toString();
      const lines = pending.split(/\r?\n/);
      pending = lines.pop() ?? "";

      for (const line of lines) {
        if (line.startsWith(ignoredLine)) continue;
        stream.write(`${line}\n`);
      }
    },
    flush() {
      if (pending && !pending.startsWith(ignoredLine)) {
        stream.write(pending);
      }
    },
  };
}

const child = spawn(nextBin, ["build"], {
  env: {
    ...process.env,
    BROWSERSLIST_IGNORE_OLD_DATA: "true",
    BASELINE_BROWSER_MAPPING_IGNORE_OLD_DATA: "true",
  },
  stdio: ["inherit", "pipe", "pipe"],
});

const stdout = createFilteredWriter(process.stdout);
const stderr = createFilteredWriter(process.stderr);

child.stdout.on("data", (chunk) => stdout.write(chunk));
child.stderr.on("data", (chunk) => stderr.write(chunk));
child.on("error", (error) => {
  stdout.flush();
  stderr.flush();
  process.stderr.write(`Failed to start next build: ${error.message}\n`);
  process.exit(1);
});
child.on("close", (code, signal) => {
  stdout.flush();
  stderr.flush();
  if (signal) {
    process.stderr.write(`next build terminated by signal ${signal}\n`);
    process.exit(1);
  }
  process.exit(code ?? 1);
});
