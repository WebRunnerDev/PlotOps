import { afterEach, describe, expect, it, vi } from "vitest";

import {
    fetchFixtureBranchCommits,
    fetchFixtureBranchPullRequests,
    fetchFixtureCommitFiles,
    fetchFixturePullRequestCommits,
    fetchFixturePullRequestFiles,
} from "@/features/git-integration/api/fixture-git-api";

afterEach(() => {
    vi.unstubAllGlobals();
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
