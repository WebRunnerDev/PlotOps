import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("OAuth consent panel seam", () => {
    it("approves and denies through skipBrowserRedirect helpers", () => {
        const panel = readFileSync(
            path.join(dirname, "oauth-consent-panel.tsx"),
            "utf8"
        );
        const api = readFileSync(
            path.join(dirname, "../api/oauth-consent-api.ts"),
            "utf8"
        );

        expect(panel).toMatch(/approveOAuthAuthorization/);
        expect(panel).toMatch(/denyOAuthAuthorization/);
        expect(panel).toMatch(/isSafeHttpRedirect/);
        expect(panel).not.toMatch(/startGuestSession/);
        expect(api).toMatch(/skipBrowserRedirect:\s*true/);
    });
});
