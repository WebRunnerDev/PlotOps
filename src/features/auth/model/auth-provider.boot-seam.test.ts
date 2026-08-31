import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("AuthProvider boot validate seam", () => {
    it("validates INITIAL_SESSION through validatePersistedSession with AbortSignal", () => {
        const source = fs.readFileSync(
            path.join(dirname, "auth-provider.tsx"),
            "utf8"
        );

        expect(source).toMatch(/validatePersistedSession/);
        expect(source).toMatch(/event === "INITIAL_SESSION"/);
        expect(source).toMatch(/event !== "TOKEN_REFRESHED"/);
        expect(source).toMatch(/applyValidatedBootSession/);
        expect(source).toMatch(
            /validatePersistedSession\([\s\S]*?signal:\s*abortController\.signal/
        );
        expect(source).toMatch(
            /if\s*\(\s*!mounted\s*\|\|\s*abortController\.signal\.aborted\s*\)\s*return/
        );
    });
});
