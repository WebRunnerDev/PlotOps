import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("AuthSessionGuard", () => {
    it("re-validates Auth on pathname changes via requireAuthSession", () => {
        const source = readFileSync(
            path.join(dirname, "auth-session-guard.tsx"),
            "utf8"
        );

        expect(source).toMatch(/requireAuthSession/);
        expect(source).toMatch(/pathname/);
        expect(source).toMatch(/\/sign-in/);
        expect(source).toMatch(/isGuest\(\)/);
    });
});
