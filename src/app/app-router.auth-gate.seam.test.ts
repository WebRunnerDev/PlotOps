import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("AppRouter auth gate seam", () => {
    const source = fs.readFileSync(
        path.join(dirname, "app-router.tsx"),
        "utf8"
    );

    it("invalidates the router when auth.user changes so beforeLoad re-gates to sign-in", () => {
        expect(source).toMatch(/router\.invalidate\(/);
        expect(source).toMatch(
            /useEffect\(\s*\(\)\s*=>\s*\{[\s\S]*?router\.invalidate\([\s\S]*?\}\s*,\s*\[[\s\S]*?auth\.user/
        );
    });

    it("skips invalidate while auth is booting so beforeLoad never sees auth: undefined", () => {
        expect(source).toMatch(
            /if\s*\(\s*auth\.isLoading\s*\|\|\s*showBoot\s*\)\s*return;/
        );
        expect(source).toMatch(/router\.invalidate\(/);
    });

    it("keeps BootScreen cover until signed-in users leave auth entry paths", () => {
        expect(source).toMatch(/rewriteAuthEntryLocation/);
        expect(source).toMatch(/authEntryResolved/);
        expect(source).toMatch(/isAuthEntryPath/);
        expect(source).toMatch(/shouldCoverAuthEntry/);
    });
});
