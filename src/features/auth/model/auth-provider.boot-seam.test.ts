import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("AuthProvider boot validate seam", () => {
    it("passes the boot AbortSignal into validatePersistedSession", () => {
        const source = fs.readFileSync(
            path.join(dirname, "auth-provider.tsx"),
            "utf8"
        );

        expect(source).toMatch(/validatePersistedSession/);
        expect(source).toMatch(
            /validatePersistedSession\(\s*nextSession,\s*\{\s*signal:\s*abortController\.signal\s*\}\s*\)/
        );
        expect(source).toMatch(
            /if\s*\(\s*!mounted\s*\|\|\s*abortController\.signal\.aborted\s*\)\s*return/
        );
    });
});
