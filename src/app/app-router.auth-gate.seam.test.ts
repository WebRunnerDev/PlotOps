import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("AppRouter auth gate seam", () => {
    it("invalidates the router when auth.user changes so beforeLoad re-gates to sign-in", () => {
        const source = fs.readFileSync(
            path.join(dirname, "app-router.tsx"),
            "utf8"
        );

        // Session expiry / SIGNED_OUT while already on a protected route must
        // re-run route guards — RouterProvider context alone does not.
        expect(source).toMatch(/router\.invalidate\(/);
        expect(source).toMatch(
            /useEffect\(\s*\(\)\s*=>\s*\{[\s\S]*?router\.invalidate\([\s\S]*?\}\s*,\s*\[[\s\S]*?auth\.user/
        );
    });
});
