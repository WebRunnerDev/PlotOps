import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("AppRouter boot screen seam", () => {
    it("overlays BootScreen above the router until auth entry is safe", () => {
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
        expect(source).toMatch(/shouldCoverAuthEntry/);
        expect(source).toMatch(/fixed inset-0/);
        expect(source).toMatch(/<BootScreen/);
        expect(source).toMatch(/mountApp/);
        // Must not mode=wait swap Boot off before Router redirects.
        expect(source).not.toMatch(/AnimatePresence\s+mode="wait"/);
        expect(source).not.toMatch(/animate-spin rounded-full/);
    });
});
