/**
 * CI step: type-checks every Supabase Edge Function with Deno, the runtime
 * that serves them. Vitest only transpiles these files, and no tsconfig
 * covers them, so without this a schema or library change that breaks a
 * function shows up only after deploy.
 *
 *   node scripts/check-edge-functions.ts
 *
 * Each function is checked with its own `deno.json` (the import map Supabase
 * deploys it with) against the shared `supabase/functions/deno.lock`, frozen:
 * a version that is not in the lockfile fails instead of being resolved anew.
 * After changing a `deno.json`, refresh the lockfile with
 *
 *   node scripts/check-edge-functions.ts --update-lock
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const FUNCTIONS_DIR = "supabase/functions";
const LOCK_FILE = path.join(FUNCTIONS_DIR, "deno.lock");

/** Function folders: every folder with an `index.ts`; `_shared` is not one. */
export function listFunctions(functionsDirectory: string): string[] {
    return readdirSync(functionsDirectory, { withFileTypes: true })
        .filter(
            (entry) =>
                entry.isDirectory() &&
                !entry.name.startsWith("_") &&
                existsSync(
                    path.join(functionsDirectory, entry.name, "index.ts")
                )
        )
        .map((entry) => entry.name)
        .toSorted();
}

function main() {
    const updateLock = process.argv.includes("--update-lock");
    const names = listFunctions(FUNCTIONS_DIR);
    const failed: string[] = [];

    for (const name of names) {
        const directory = path.join(FUNCTIONS_DIR, name);
        const config = path.join(directory, "deno.json");
        if (!existsSync(config)) {
            console.error(`${name}: no deno.json (its deploy import map)`);
            failed.push(name);
            continue;
        }
        console.log(`deno check ${name}`);
        const result = spawnSync(
            "deno",
            [
                "check",
                "--quiet",
                `--config=${config}`,
                `--lock=${LOCK_FILE}`,
                ...(updateLock ? [] : ["--frozen"]),
                path.join(directory, "index.ts"),
            ],
            { stdio: "inherit" }
        );
        if (result.error) {
            throw new Error(`Could not run deno: ${result.error.message}`, {
                cause: result.error,
            });
        }
        if (result.status !== 0) failed.push(name);
    }

    if (failed.length > 0) {
        console.error(`\nType check failed: ${failed.join(", ")}`);
        process.exitCode = 1;
        return;
    }
    console.log(`\n${names.length} Edge Functions type-check.`);
}

if (
    process.argv[1] &&
    path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
    main();
}
