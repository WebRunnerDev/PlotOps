import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error("Usage: npm run shadcn:add -- <component...>");
  process.exit(1);
}

const result = spawnSync("npx", ["shadcn", "add", ...args], {
  cwd: root,
  shell: true,
  stdio: "inherit",
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

await import("./generate-shadcn-index.mjs");
