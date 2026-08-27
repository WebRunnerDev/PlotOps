import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("router auth context seam", () => {
    it("uses a concrete auth placeholder instead of auth: undefined!", () => {
        const source = fs.readFileSync(path.join(dirname, "router.ts"), "utf8");

        // createRouter default must be safe for beforeLoad if invalidate/load
        // races ahead of RouterProvider merging the real Auth slice.
        expect(source).not.toMatch(/auth:\s*undefined!/);
        expect(source).toMatch(/auth:\s*\{/);
        expect(source).toMatch(/user:\s*null/);
    });
});
