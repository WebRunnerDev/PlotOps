import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { listFunctions } from "./check-edge-functions.ts";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const functionsDirectory = path.join(root, "supabase/functions");

/** Version npm installed, which is what vitest runs the functions against. */
function installedVersion(name: string): string {
    const lock = readJson("package-lock.json") as {
        packages: Record<string, { version: string }>;
    };
    const entry = lock.packages[`node_modules/${name}`];
    if (!entry) throw new Error(`${name} is not in package-lock.json`);
    return entry.version;
}

function readJson(file: string): unknown {
    return JSON.parse(readFileSync(path.join(root, file), "utf8"));
}

describe("Edge Functions", () => {
    const names = listFunctions(functionsDirectory);

    it("finds the deployed functions and skips _shared", () => {
        expect(names).toContain("github-webhook");
        expect(names).not.toContain("_shared");
    });

    // Tests run the functions on Node with package-lock versions; Supabase
    // runs them with the deno.json versions. Pinning the same versions keeps
    // what is tested and what is deployed one and the same.
    it.each(names)("%s pins the npm versions the tests run against", (name) => {
        const config = readJson(`supabase/functions/${name}/deno.json`) as {
            imports: Record<string, string>;
        };
        for (const [specifier, target] of Object.entries(config.imports)) {
            expect(target).toBe(
                `npm:${specifier}@${installedVersion(specifier)}`
            );
        }
    });

    // Deploys bundle only `supabase/functions`, so the generated schema types
    // live there too, as an exact copy (`npm run db:types` writes both).
    it("uses the same Database types as the app", () => {
        const app = readFileSync(
            path.join(root, "src/shared/api/database.types.ts"),
            "utf8"
        );
        const functions = readFileSync(
            path.join(functionsDirectory, "_shared/database.types.ts"),
            "utf8"
        );
        expect(functions === app, "run `npm run db:types`").toBe(true);
    });
});
