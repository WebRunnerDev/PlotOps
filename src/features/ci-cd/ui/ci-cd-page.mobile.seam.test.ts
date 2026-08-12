import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("CiCdPage mobile seam", () => {
    it("stacks summary cells and run metadata on narrow viewports", () => {
        const page = readFileSync(path.join(dirname, "ci-cd-page.tsx"), "utf8");

        expect(page).toMatch(/min-w-0 max-w-5xl/);
        expect(page).toMatch(/grid-cols-1[\s\S]*sm:grid-cols-3/);
        expect(page).toMatch(
            /flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between/
        );
        expect(page).toMatch(/wrap-break-word/);
    });
});

describe("BuildLogDialog mobile seam", () => {
    it("uses full-viewport layout and stacked job rows on mobile", () => {
        const dialog = readFileSync(
            path.join(dirname, "build-log-dialog.tsx"),
            "utf8"
        );

        expect(dialog).toMatch(/max-sm:h-dvh/);
        expect(dialog).toMatch(/max-sm:max-h-dvh/);
        expect(dialog).toMatch(/max-sm:translate-x-0 max-sm:translate-y-0/);
        expect(dialog).toMatch(
            /flex-col gap-2[\s\S]*sm:flex-row sm:items-center sm:justify-between/
        );
        expect(dialog).toMatch(/break-all/);
    });
});
