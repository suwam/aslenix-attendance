import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";

const configHome = resolve(".wrangler-config");
mkdirSync(configHome, { recursive: true });

const require = createRequire(import.meta.url);
const viteBin = join(dirname(require.resolve("vite/package.json")), "bin", "vite.js");

const child = spawn(process.execPath, [viteBin, ...process.argv.slice(2)], {
  env: {
    ...process.env,
    XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME ?? configHome,
  },
  stdio: "inherit",
  shell: false,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
