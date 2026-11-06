import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const arguments_ = process.argv.slice(2);

if (arguments_.length === 0) {
    console.error("Usage: npm run shadcn:add -- <component...>");
    process.exit(1);
}

const result = spawnSync("npx", ["shadcn", "add", ...arguments_], {
    cwd: root,
    shell: true,
    stdio: "inherit",
});

if (result.status !== 0) {
    process.exit(result.status ?? 1);
}

await import("./generate-shadcn-index.mjs");
