import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("useCapturedWheelSession seam", () => {
    it("claims Alt wheel from anywhere inside its targets", () => {
        const source = readFileSync(
            path.join(dirname, "use-captured-wheel-session.ts"),
            "utf8"
        );

        expect(source).toMatch(
            /if \(!hasDrawerWheelModifier\(event\)\) \{\s*\/\/[^\n]*\n\s*endSession\(\);\s*return;/
        );
        expect(source).toMatch(/rootReference\.current\?\.contains\(node\)/);
        expect(source).toMatch(/target\.current\?\.contains\(node\)/);
        expect(source).toMatch(/!isInsideTargets\(event\.target\)/);
        expect(source).toMatch(/capture: true/);
        expect(source).toMatch(/preventDefault/);
    });
});
