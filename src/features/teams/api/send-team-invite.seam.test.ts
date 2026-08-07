import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

function readApi() {
    return readFileSync(path.join(dirname, "team-members-api.ts"), "utf8");
}

function readHook() {
    return readFileSync(
        path.join(dirname, "../model/use-team-members.ts"),
        "utf8"
    );
}

describe("sendTeamInviteEmail API", () => {
    it("invokes send-team-invite with inviteId and app origin", () => {
        const source = readApi();

        expect(source).toMatch(
            /export async function sendTeamInviteEmail\(inviteId: string\)/
        );
        expect(source).toMatch(
            /functions\.invoke\(\s*["']send-team-invite["']/
        );
        expect(source).toMatch(/inviteId/);
        expect(source).toMatch(/x-invite-origin|origin/);
    });
});

describe("useCreateTeamInvite email send", () => {
    it("invokes send after email invite create and toasts on send failure", () => {
        const source = readHook();

        expect(source).toMatch(/sendTeamInviteEmail/);
        expect(source).toMatch(/kind === ["']email["']/);
        expect(source).toMatch(/members\.inviteEmailDelayed/);
        expect(source).not.toMatch(
            /kind === ["']open["'][\s\S]*sendTeamInviteEmail/
        );
    });

    it("does not require send success for create to succeed", () => {
        const source = readHook();
        // send errors toast, but create result is still returned
        expect(source).toMatch(
            /sendTeamInviteEmail[\s\S]*toast\.(message|warning)[\s\S]*return data/
        );
    });
});
