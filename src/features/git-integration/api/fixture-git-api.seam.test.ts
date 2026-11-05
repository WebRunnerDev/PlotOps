import { afterEach, describe, expect, it, vi } from "vitest";

import {
    fetchFixtureBranchCommits,
    fetchFixtureBranchPullRequests,
    fetchFixtureCommitFiles,
    fetchFixturePullRequestChecks,
    fetchFixturePullRequestCommits,
    fetchFixturePullRequestFiles,
} from "@/features/git-integration/api/fixture-git-api";

function stubSessionStorage() {
    const store = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
        getItem: (key: string) => store.get(key) ?? null,
        removeItem: (key: string) => {
            store.delete(key);
        },
        setItem: (key: string, value: string) => {
            store.set(key, value);
        },
    });
}

afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
});

describe("fixture git API (guest seam)", () => {
    it("returns canned commits for a demo branch without calling GitHub", async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);

        const commits = await fetchFixtureBranchCommits(
            "demo/plotops",
            "feature/TASK-1-guest-signin-cta"
        );

        expect(fetchMock).not.toHaveBeenCalled();
        expect(commits.length).toBeGreaterThanOrEqual(2);
        expect(commits[0]).toEqual(
            expect.objectContaining({
                message: expect.any(String),
                sha: expect.stringMatching(/^[0-9a-f]{7,40}$/i),
                url: expect.stringContaining("github.com"),
            })
        );
    });

    it("returns a canned PR list keyed to the branch without calling GitHub", async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);

        const prs = await fetchFixtureBranchPullRequests(
            "demo/plotops",
            "feature/FEAT-2-guest-ci-mock"
        );

        expect(fetchMock).not.toHaveBeenCalled();
        expect(prs).toHaveLength(1);
        expect(prs[0]).toEqual(
            expect.objectContaining({
                head_ref: "feature/FEAT-2-guest-ci-mock",
                number: expect.any(Number),
                state: "open",
                title: expect.any(String),
            })
        );
    });

    it("returns a canned unified-diff file list without calling GitHub", async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);

        const result = await fetchFixturePullRequestFiles("demo/plotops", 42);

        expect(fetchMock).not.toHaveBeenCalled();
        expect(result.truncated).toBe(false);
        expect(result.files.length).toBeGreaterThanOrEqual(1);
        expect(result.files[0]).toEqual(
            expect.objectContaining({
                filename: expect.any(String),
                patch: expect.stringContaining("@@"),
                status: "modified",
            })
        );
    });

    it("returns canned PR commits and per-commit files without calling GitHub", async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);

        const commitsResult = await fetchFixturePullRequestCommits(
            "demo/plotops",
            42
        );
        const filesResult = await fetchFixtureCommitFiles(
            "demo/plotops",
            commitsResult.commits[0]!.sha
        );

        expect(fetchMock).not.toHaveBeenCalled();
        expect(commitsResult.commits.length).toBeGreaterThanOrEqual(2);
        expect(filesResult.files.length).toBeGreaterThanOrEqual(1);
    });
});

describe("fixture git API per Repository (Guest «Web + API»)", () => {
    it("answers a seeded branch with its own PR in that Repository", async () => {
        stubSessionStorage();
        const { startGuestSession } = await import("@/features/guest-mode");
        startGuestSession();

        const web = await fetchFixtureBranchPullRequests(
            "plotops-demo/web",
            "feature/FEAT-2-guest-ci-mock"
        );
        const api = await fetchFixtureBranchPullRequests(
            "plotops-demo/api",
            "feature/FEAT-2-guest-ci-mock"
        );

        expect(web).toEqual([
            expect.objectContaining({
                merged_at: null,
                number: 43,
                state: "open",
            }),
        ]);
        expect(api).toEqual([
            expect.objectContaining({
                merged_at: expect.any(String),
                number: 17,
                state: "closed",
                url: "https://github.com/plotops-demo/api/pull/17",
            }),
        ]);
    });

    it("reports a merged PR's checks as passed", async () => {
        stubSessionStorage();
        const { startGuestSession } = await import("@/features/guest-mode");
        startGuestSession();

        const merged = await fetchFixturePullRequestChecks(
            "plotops-demo/api",
            17
        );
        const open = await fetchFixturePullRequestChecks(
            "plotops-demo/web",
            43
        );

        expect(merged.rollup).toBe("success");
        expect(open.rollup).toBe("failure");
    });

    it("returns no PR for a seeded branch that has none", async () => {
        stubSessionStorage();
        const { startGuestSession } = await import("@/features/guest-mode");
        startGuestSession();

        expect(
            await fetchFixtureBranchPullRequests(
                "plotops-demo/web",
                "feature/FEAT-9-git-fixtures"
            )
        ).toEqual([]);
    });

    it("serves backend commits, files and checks for the API Repository", async () => {
        const commits = await fetchFixtureBranchCommits(
            "plotops-demo/api",
            "feature/TASK-3-guest-seed-dataset"
        );
        const files = await fetchFixturePullRequestFiles(
            "plotops-demo/api",
            15
        );
        const checks = await fetchFixturePullRequestChecks(
            "plotops-demo/api",
            15
        );
        const webChecks = await fetchFixturePullRequestChecks(
            "plotops-demo/web",
            43
        );

        expect(commits[0]!.message).toMatch(/^feat\(api\)/);
        expect(commits[0]!.url).toContain("plotops-demo/api");
        expect(
            files.files.every((file) => file.filename.startsWith("supabase/"))
        ).toBe(true);
        expect(checks.checks.map((check) => check.name)).toContain(
            "API / pgTAP"
        );
        expect(webChecks.checks.map((check) => check.name)).toContain(
            "CI / test"
        );
    });
});
