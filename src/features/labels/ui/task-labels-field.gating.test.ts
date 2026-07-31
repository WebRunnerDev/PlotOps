import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

function readUi(name: string) {
    return readFileSync(path.join(dirname, name), "utf8");
}

describe("TaskLabelsField Role gating seam", () => {
    it("gates create-label option on allowCreate (managers-only RLS)", () => {
        const field = readUi("task-labels-field.tsx");

        expect(field).toMatch(/allowCreate/);
        expect(field).toMatch(/allowCreate\s*&&/);
    });
});
