import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, "../../../..");

function read(relativePath: string) {
    return readFileSync(path.join(root, relativePath), "utf8");
}

describe("connected accounts settings seam", () => {
    it("renders ConnectedAccountsSettings on /settings for signed-in users only", () => {
        const settings = read("src/routes/(main)/settings.tsx");

        expect(settings).toMatch(/ConnectedAccountsSettings/);
        expect(settings).toMatch(/ProfileSettingsForm/);
        expect(settings).toMatch(/\{guest \? null :/);
    });

    it("derives provider slots and wires connect/disconnect actions", () => {
        const component = read(
            "src/features/auth/ui/connected-accounts-settings.tsx"
        );

        expect(component).toMatch(/deriveSignInProviderSlots/);
        expect(component).toMatch(/linkIdentityWithGitHub/);
        expect(component).toMatch(/linkIdentityWithGoogle/);
        expect(component).toMatch(/unlinkAuthIdentity/);
        expect(component).toMatch(/canUnlinkIdentity/);
        expect(component).toMatch(/settings\.connect/);
        expect(component).toMatch(/settings\.disconnect/);
    });

    it("has en+ru labels for connected accounts copy", () => {
        const en = JSON.parse(read("src/app/locales/auth/en.json"));
        const ru = JSON.parse(read("src/app/locales/auth/ru.json"));

        expect(en.settings.connectedAccountsTitle).toBe("Connected accounts");
        expect(en.settings.providers.github).toBe("GitHub");
        expect(ru.settings.connectedAccountsTitle).toMatch(/аккаунт/i);
        expect(ru.settings.connectedStatus).toMatch(/Подключ/i);
    });
});
