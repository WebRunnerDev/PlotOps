import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const rootSource = readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), "__root.tsx"),
    "utf8"
);

describe("root not-found seam", () => {
    it("wires NotFoundPage through root notFoundComponent chrome", () => {
        expect(rootSource).toMatch(/NotFoundPage/);
        expect(rootSource).toMatch(/notFoundComponent:\s*RootNotFound/);
        expect(rootSource).toMatch(/function RootNotFound/);
    });
});
