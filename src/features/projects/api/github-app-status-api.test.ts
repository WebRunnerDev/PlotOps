import { describe, expect, it, vi } from "vitest";

vi.mock("@/shared/api/supabase", () => ({ supabase: {} }));

const { parseGithubAppStatus } = await import("./github-app-status-api");

describe("parseGithubAppStatus", () => {
    it("keys statuses by Repository id and keeps only GitHub install links", () => {
        expect(
            parseGithubAppStatus({
                configured: true,
                installUrl: "https://github.com/apps/plotops/installations/new",
                repositories: [
                    { id: "web", status: "installed" },
                    { id: "api", status: "not_installed" },
                    { id: "odd", status: "maybe" },
                    { status: "installed" },
                ],
            })
        ).toEqual({
            configured: true,
            installUrl: "https://github.com/apps/plotops/installations/new",
            statuses: {
                api: "not_installed",
                odd: "unknown",
                web: "installed",
            },
        });

        expect(
            parseGithubAppStatus({ installUrl: "https://evil.test/install" })
                .installUrl
        ).toBeNull();
    });

    it("tolerates an empty body", () => {
        expect(parseGithubAppStatus(null)).toEqual({
            configured: false,
            installUrl: null,
            statuses: {},
        });
    });
});
