import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

function readSource(filename: string): string {
    return readFileSync(path.join(dirname, filename), "utf8");
}

describe("task drawer description image persist seam", () => {
    it("waits for editor uploads before committing description", () => {
        const source = readSource("task-drawer.tsx");

        expect(source).toMatch(/descriptionEditorReference/);
        expect(source).toMatch(/waitForIdle/);
        expect(source).toMatch(/await commitDescription\(\)/);
    });
});
