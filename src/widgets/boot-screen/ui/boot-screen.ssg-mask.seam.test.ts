import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("BootScreen SSG auth mask seam", () => {
    it("clears the pre-React SSG auth mask on mount", () => {
        const source = fs.readFileSync(
            path.join(dirname, "boot-screen.tsx"),
            "utf8"
        );

        expect(source).toMatch(/clearSsgAuthSessionMask/);
        expect(source).toMatch(
            /useLayoutEffect\(\s*\(\)\s*=>\s*\{[\s\S]*?clearSsgAuthSessionMask\(\)/
        );
    });
});
