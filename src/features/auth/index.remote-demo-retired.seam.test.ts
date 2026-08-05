import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("auth barrel: remote shared demo retired", () => {
    it("does not export credential helpers or email/UUID guest detection", () => {
        const source = readFileSync(path.join(dirname, "index.ts"), "utf8");

        expect(source).not.toMatch(/getGuestCredentials/);
        expect(source).not.toMatch(/GUEST_DEMO_LOCAL_PASSWORD/);
        expect(source).not.toMatch(/GUEST_DEMO_EMAIL/);
        expect(source).not.toMatch(/GUEST_DEMO_USER_ID/);
        expect(source).not.toMatch(/isGuestSession/);
        expect(source).not.toMatch(/get-guest-credentials/);
        expect(source).not.toMatch(/is-guest-session/);
    });
});
