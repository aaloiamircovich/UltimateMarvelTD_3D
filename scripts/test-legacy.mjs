import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const cwd = fileURLToPath(new URL("../src/legacy/", import.meta.url));
const files = readdirSync(new URL("../src/legacy/test/", import.meta.url))
  .filter(f => f.endsWith(".test.js")).map(f => `test/${f}`);
const result = spawnSync(process.execPath, ["--test", ...files], { cwd, stdio: "inherit" });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
