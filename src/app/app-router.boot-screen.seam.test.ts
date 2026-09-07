import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("AppRouter boot screen seam", () => {
    it("uses BootScreen + AnimatePresence exit morph gated by useBootVisible", () => {
        const source = fs.readFileSync(
            path.join(dirname, "app-router.tsx"),
            "utf8"
        );

        expect(source).toMatch(
            /import\s+\{\s*BootScreen,\s*useBootVisible\s*\}\s+from\s+"@\/widgets\/boot-screen"/
        );
        expect(source).toMatch(
            /import\s+\{\s*AnimatePresence\s*\}\s+from\s+"motion\/react"/
        );
        expect(source).toMatch(
            /const\s+showBoot\s*=\s*useBootVisible\(\s*auth\.isLoading\s*,\s*auth\.bootError\s*\)/
        );
        expect(source).toMatch(/<AnimatePresence\s+mode="wait">/);
        expect(source).toMatch(/showBoot\s*\?\s*\(/);
        expect(source).toMatch(/<BootScreen/);
        expect(source).not.toMatch(/animate-spin rounded-full/);
    });
});
