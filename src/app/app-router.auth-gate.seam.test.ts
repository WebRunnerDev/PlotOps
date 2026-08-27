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
        // Session expiry / SIGNED_OUT while already on a protected route must
        // re-run route guards — RouterProvider context alone does not.
        expect(source).toMatch(/router\.invalidate\(/);
        expect(source).toMatch(
            /useEffect\(\s*\(\)\s*=>\s*\{[\s\S]*?router\.invalidate\([\s\S]*?\}\s*,\s*\[[\s\S]*?auth\.user/
        );
    });

    it("skips invalidate while auth.isLoading so beforeLoad never sees auth: undefined", () => {
        // Hooks run before the isLoading early return that mounts RouterProvider.
        // Invalidating during boot hits createRouter's placeholder context
        // (auth: undefined!) and throws in beforeLoad — error flash, then OK.
        expect(source).toMatch(
            /useEffect\(\s*\(\)\s*=>\s*\{[\s\S]*?if\s*\(\s*auth\.isLoading\s*\)\s*return;[\s\S]*?router\.invalidate\([\s\S]*?\}\s*,\s*\[[\s\S]*?auth\.isLoading[\s\S]*?auth\.user/
        );
    });
});
