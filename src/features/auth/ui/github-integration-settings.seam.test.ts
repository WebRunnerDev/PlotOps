import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, "../../../..");

function read(relativePath: string) {
    return readFileSync(path.join(root, relativePath), "utf8");
}

describe("github integration settings seam", () => {
    it("renders GitHubIntegrationSettings on /settings between profile and connected accounts", () => {
        const settings = read("src/routes/(main)/settings.tsx");
        const renderBlock = settings.slice(settings.indexOf("{guest ? null :"));

        expect(settings).toMatch(/GitHubIntegrationSettings/);
        expect(renderBlock).toMatch(/ProfileSettingsForm/);
        expect(renderBlock).toMatch(/ConnectedAccountsSettings/);
        expect(renderBlock.indexOf("ProfileSettingsForm")).toBeLessThan(
            renderBlock.indexOf("GitHubIntegrationSettings")
        );
        expect(renderBlock.indexOf("GitHubIntegrationSettings")).toBeLessThan(
            renderBlock.indexOf("ConnectedAccountsSettings")
        );
    });

    it("shows github login, token status, and reconnect OAuth flows", () => {
        const component = read(
            "src/features/auth/ui/github-integration-settings.tsx"
        );

        expect(component).toMatch(/profile\?\.github_login/);
        expect(component).toMatch(/githubIdentityFromUser/);
        expect(component).toMatch(/fetchGitHubAuthenticatedUser/);
        expect(component).toMatch(/validateGitHubAccessToken/);
        expect(component).toMatch(/hasGitHubIdentity/);
        expect(component).toMatch(/linkIdentityWithGitHub/);
        expect(component).toMatch(/signInWithGitHub/);
        expect(component).toMatch(
            /settings\.githubIntegration\.googleOnlyExplanation/
        );
    });

    it("has en+ru labels for github integration copy", () => {
        const en = JSON.parse(read("src/app/locales/auth/en.json"));
        const ru = JSON.parse(read("src/app/locales/auth/ru.json"));

        expect(en.settings.githubIntegration.title).toBe("GitHub integration");
        expect(en.settings.githubIntegration.tokenStatus.valid).toBe("Valid");
        expect(en.settings.githubIntegration.reconnectGitHub).toMatch(
            /Reconnect/i
        );
        expect(ru.settings.githubIntegration.title).toMatch(/GitHub/i);
        expect(ru.settings.githubIntegration.tokenStatus.valid).toMatch(
            /действ/i
        );
    });
});
