import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, "../../../..");

function read(relativePath: string) {
    return readFileSync(path.join(root, relativePath), "utf8");
}

describe("BoardArchiveDialog multi-select seam", () => {
    it("wires checkboxes and bulk restore/delete through batch hook methods", () => {
        const source = read("src/features/tasks/ui/board-archive-dialog.tsx");
        const en = read("src/app/locales/board/en.json");
        const ru = read("src/app/locales/board/ru.json");

        expect(source).toMatch(/Checkbox/);
        expect(source).toMatch(/restoreTasks/);
        expect(source).toMatch(/deleteTasks/);
        expect(source).toMatch(/selectedIds/);
        expect(source).toMatch(/archive\.selectAll/);
        expect(source).toMatch(/archive\.restoreSelected/);
        expect(source).toMatch(/archive\.deleteSelected/);

        for (const locale of [en, ru]) {
            expect(locale).toMatch(/"selectAll"/);
            expect(locale).toMatch(/"restoreSelected"/);
            expect(locale).toMatch(/"deleteSelected"/);
            expect(locale).toMatch(/"restoredCount"/);
            expect(locale).toMatch(/"deletedCount"/);
            expect(locale).toMatch(/"bulkDeleteTitle"/);
            expect(locale).toMatch(/"bulkDeleteDescription"/);
        }
    });
});
