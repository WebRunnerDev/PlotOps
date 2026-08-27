import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)));

describe("useDeferredMount", () => {
    it("schedules readiness after a double requestAnimationFrame", () => {
        const source = readFileSync(
            path.join(root, "use-deferred-mount.ts"),
            "utf8"
        );

        expect(source).toMatch(/requestAnimationFrame/);
        expect(source).toMatch(
            /requestAnimationFrame\(\(\) => \{[\s\S]*requestAnimationFrame/
        );
        expect(source).toMatch(/cancelAnimationFrame/);
        expect(source).toMatch(/resetKey/);
    });
});
