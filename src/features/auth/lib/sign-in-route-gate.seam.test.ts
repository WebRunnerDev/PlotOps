import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("sign-in route gate OAuth consent seam", () => {
    it("honors ?redirect= and does not send guests into the consent flow", () => {
        const source = readFileSync(
            path.join(dirname, "sign-in-route-gate.ts"),
            "utf8"
        );

        expect(source).toMatch(/parseSafeAppRedirect\(search\?\.redirect\)/);
        expect(source).toMatch(/PENDING_OAUTH_CONSENT_KEY/);
        expect(source).toMatch(/leaveGuestSession/);
        expect(source).toMatch(/href:\s*redirectTo/);
    });
});
