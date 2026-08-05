import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

function readUi() {
    return readFileSync(
        path.join(dirname, "team-members-settings.tsx"),
        "utf8"
    );
}

describe("TeamMembersSettings guest messaging", () => {
    it("surfaces demo-only membership and unavailable invites in Guest Mode", () => {
        const source = readUi();

        expect(source).toMatch(/isGuest\(\)/);
        expect(source).toMatch(/guestActionPolicy\(guest\)\.canCreateInvite/);
        expect(source).toMatch(/members\.guestDemoNotice/);
        expect(source).toMatch(/members\.guestInviteUnavailable/);
        expect(source).toMatch(/guest\s*\?\s*\(/);
    });
});
