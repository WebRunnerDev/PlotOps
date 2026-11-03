import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("LoginForm OAuth consent seam", () => {
    it("hides Try demo and returns to the consent path after password sign-in", () => {
        const source = readFileSync(
            path.join(dirname, "login-form.tsx"),
            "utf8"
        );

        expect(source).toMatch(/redirectTo\?: string/);
        expect(source).toMatch(/isOAuthConsentRedirect\(safeRedirect\)/);
        expect(source).toMatch(/hideGuestDemo \? null/);
        expect(source).toMatch(/history\.push\(safeRedirect\)/);
    });
});
