import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const aboutSource = readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), "about.tsx"),
    "utf8"
);

describe("about page mobile seam", () => {
    it("prevents long copy from forcing horizontal overflow", () => {
        expect(aboutSource).toMatch(/min-w-0/);
        expect(aboutSource).toMatch(/break-words/);
    });
});
