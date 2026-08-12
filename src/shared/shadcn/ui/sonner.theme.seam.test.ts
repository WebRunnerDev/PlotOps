import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("Sonner theme seam", () => {
    it("uses PlotOps useTheme instead of next-themes", () => {
        const source = fs.readFileSync(path.join(dirname, "sonner.tsx"), "utf8");

        expect(source).toMatch(
            /import\s+\{\s*useTheme\s*\}\s+from\s+"@\/app\/model\/theme"/
        );
        expect(source).not.toMatch(/next-themes/);
        expect(source).toMatch(/const\s+\{\s*theme\s*\}\s*=\s*useTheme\(\)/);
    });
});
