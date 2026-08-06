import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("LoginForm Guest Session entry seam", () => {
    it("starts a Guest Session from Try demo without remote password sign-in", () => {
        const source = readFileSync(
            path.join(dirname, "login-form.tsx"),
            "utf8"
        );

        expect(source).toMatch(/startGuestSession/);
        expect(source).toMatch(/GUEST_DEMO_BOARD_ID/);
        expect(source).toMatch(/GUEST_DEMO_PROJECT_ID/);
        expect(source).toMatch(/leaveGuestSession/);
        expect(source).not.toMatch(/getGuestCredentials/);
        expect(source).not.toMatch(/signInWithPassword\(\s*getGuest/);
    });
});
