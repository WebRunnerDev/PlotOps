import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("TeamsPage mobile seam", () => {
    it("stacks home cards on narrow viewports via grid-cols-1", () => {
        const source = readFileSync(
            path.join(dirname, "teams-page.tsx"),
            "utf8"
        );

        expect(source).toMatch(/grid-cols-1/);
        expect(source).toMatch(/sm:grid-cols-2/);
    });
});
