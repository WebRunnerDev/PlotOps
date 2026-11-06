import { describe, expect, it } from "vitest";

import type {
    TaskGitLink,
    TaskPullRequest,
} from "@/features/tasks/model/types";

import {
    applyGitLinkChange,
    applyGitLinkDetails,
    gitLinkActivityView,
    gitLinkRestoreChange,
    gitTabRepositories,
    groupGitLinksByRepository,
    pickDefaultRepositoryId,
    repositoriesAcceptingGitLink,
    repositoriesWithoutGitLink,
    taskPrBadge,
} from "./task-git-links";

const WEB = { fullName: "acme/web", id: "repo-web" };
const API = { fullName: "acme/api", id: "repo-api" };
const DOCS = { fullName: "acme/docs", id: "repo-docs" };

function pr(number: number, state: TaskPullRequest["state"]): TaskPullRequest {
    return { number, state, url: `https://github.com/acme/x/pull/${number}` };
}

const webLink: TaskGitLink = {
    branchName: "feature/TASK-1-web",
    pr: pr(12, "merged"),
    repositoryId: WEB.id,
};
const apiLink: TaskGitLink = {
    branchName: "feature/TASK-1-api",
    pr: pr(7, "open"),
    repositoryId: API.id,
};

describe("Task with a PR in two Repositories", () => {
    const links = [webLink, apiLink];

    it("shows both PRs in the drawer, grouped by Repository", () => {
        const grouped = groupGitLinksByRepository([WEB, API, DOCS], links);
        expect(grouped.map((entry) => entry.repository.id)).toEqual([
            WEB.id,
            API.id,
            DOCS.id,
        ]);
        expect(
            grouped
                .filter((entry) => entry.link)
                .map((entry) => entry.link?.pr?.number)
        ).toEqual([12, 7]);
        expect(grouped[2]?.link).toBeUndefined();
    });

    it("collapses into one aggregate badge", () => {
        const badge = taskPrBadge({ gitLinks: links, pr: webLink.pr });
        expect(badge).toMatchObject({
            kind: "aggregate",
            mergedCount: 1,
            prCount: 2,
            state: "open",
        });
        expect(
            badge?.kind === "aggregate"
                ? badge.entries.map((entry) => entry.repositoryId)
                : []
        ).toEqual([WEB.id, API.id]);
    });
});

describe("taskPrBadge", () => {
    it("keeps the single-PR badge for one Git link", () => {
        expect(taskPrBadge({ gitLinks: [apiLink], pr: apiLink.pr })).toEqual({
            kind: "single",
            pr: apiLink.pr,
        });
    });

    it("has no badge without a PR", () => {
        expect(taskPrBadge({})).toBeUndefined();
        expect(
            taskPrBadge({
                gitLinks: [
                    { branchName: "a", repositoryId: WEB.id },
                    { branchName: "b", repositoryId: API.id },
                ],
            })
        ).toBeUndefined();
    });

    it("is merged when every PR merged and closed when none open", () => {
        const merged = taskPrBadge({
            gitLinks: [webLink, { ...apiLink, pr: pr(7, "merged") }],
        });
        expect(merged).toMatchObject({ mergedCount: 2, state: "merged" });
        const closed = taskPrBadge({
            gitLinks: [webLink, { ...apiLink, pr: pr(7, "closed") }],
        });
        expect(closed).toMatchObject({ mergedCount: 1, state: "closed" });
    });

    it("counts only Git links with a PR", () => {
        const badge = taskPrBadge({
            gitLinks: [webLink, { branchName: "x", repositoryId: API.id }],
        });
        expect(badge).toMatchObject({ kind: "aggregate", prCount: 1 });
    });
});

describe("Create branch / PR Repository choice", () => {
    it("never offers a Repository the Task already has a Git link for", () => {
        const offered = repositoriesWithoutGitLink([WEB, API, DOCS], [webLink]);
        expect(offered.map((repository) => repository.id)).toEqual([
            API.id,
            DOCS.id,
        ]);
        expect(
            repositoriesWithoutGitLink([WEB, API], [webLink, apiLink])
        ).toEqual([]);
    });

    it("defaults to the last Repository this viewer chose on the Board", () => {
        expect(pickDefaultRepositoryId([API, DOCS], DOCS.id)).toBe(DOCS.id);
    });

    it("falls back to the first offered Repository", () => {
        expect(pickDefaultRepositoryId([API, DOCS])).toBe(API.id);
        // Last choice already has a Git link → not offered.
        expect(pickDefaultRepositoryId([API, DOCS], WEB.id)).toBe(API.id);
        expect(pickDefaultRepositoryId([], WEB.id)).toBeUndefined();
    });

    it("offers the only Repository without a choice", () => {
        expect(repositoriesWithoutGitLink([WEB])).toEqual([WEB]);
        expect(pickDefaultRepositoryId([WEB])).toBe(WEB.id);
    });
});

describe("applyGitLinkChange", () => {
    it("appends a Git link for a new Repository", () => {
        expect(
            applyGitLinkChange([webLink], API.id, { branchName: "feat/x" })
        ).toEqual([
            webLink,
            { branchName: "feat/x", pr: undefined, repositoryId: API.id },
        ]);
    });

    it("updates only the Git link of that Repository", () => {
        const next = applyGitLinkChange([webLink, apiLink], API.id, {
            pr: pr(7, "merged"),
        });
        expect(next[0]).toBe(webLink);
        expect(next[1]).toEqual({ ...apiLink, pr: pr(7, "merged") });
    });

    it("removes a Git link left with neither branch nor PR", () => {
        expect(
            applyGitLinkChange([webLink, apiLink], WEB.id, {
                branchName: null,
                pr: null,
            })
        ).toEqual([apiLink]);
        expect(applyGitLinkChange([], WEB.id, { branchName: " " })).toEqual([]);
    });
});

describe("applyGitLinkDetails", () => {
    it("re-derives the single-repo view from gitLinks[0]", () => {
        const next = applyGitLinkDetails(
            {
                branchName: webLink.branchName,
                gitLinks: [webLink, apiLink],
                pr: webLink.pr,
            },
            WEB.id,
            { branchName: null, pr: null }
        );
        expect(next).toEqual({
            branchName: apiLink.branchName,
            gitLinks: [apiLink],
            pr: apiLink.pr,
        });
    });

    it("targets the only Git link when no Repository is given", () => {
        const next = applyGitLinkDetails(
            { gitLinks: [apiLink], pr: apiLink.pr },
            undefined,
            { pr: null }
        );
        expect(next.gitLinks).toEqual([
            {
                branchName: apiLink.branchName,
                pr: undefined,
                repositoryId: API.id,
            },
        ]);
    });

    it("leaves Git fields alone for a non-Git change", () => {
        expect(
            applyGitLinkDetails({ gitLinks: [apiLink] }, API.id, {})
        ).toEqual({});
    });
});

describe("gitLinkActivityView", () => {
    it("reads branch / PR from the changed Repository", () => {
        const task = {
            branchName: webLink.branchName,
            gitLinks: [webLink, apiLink],
            pr: webLink.pr,
        };
        expect(gitLinkActivityView(task, API.id)).toMatchObject({
            branchName: apiLink.branchName,
            pr: apiLink.pr,
        });
        expect(gitLinkActivityView(task, DOCS.id)).toMatchObject({
            branchName: undefined,
            pr: undefined,
        });
        expect(gitLinkActivityView(task)).toBe(task);
    });
});

describe("gitTabRepositories", () => {
    it("loads Git data for Repositories with a Git link", () => {
        expect(
            gitTabRepositories([WEB, API], [apiLink]).map(
                (entry) => entry.repository.id
            )
        ).toEqual([API.id]);
    });

    it("loads every Repository while the Task has no Git link", () => {
        expect(
            gitTabRepositories([WEB, API]).map((entry) => entry.repository.id)
        ).toEqual([WEB.id, API.id]);
    });
});

describe("repositoriesAcceptingGitLink (+ Link menu)", () => {
    const branchOnly: TaskGitLink = {
        branchName: "feature/TASK-1-api",
        repositoryId: API.id,
    };

    it("offers a branch only where the Git link has none", () => {
        expect(
            repositoriesAcceptingGitLink(
                [WEB, API, DOCS],
                [webLink, branchOnly],
                "branch"
            )
        ).toEqual([DOCS]);
    });

    it("offers a PR only where the Git link has none, in Project order", () => {
        expect(
            repositoriesAcceptingGitLink(
                [WEB, API, DOCS],
                [webLink, branchOnly],
                "pr"
            )
        ).toEqual([API, DOCS]);
    });

    it("offers every Repository while the Task has no Git link", () => {
        expect(
            repositoriesAcceptingGitLink([WEB, API], undefined, "branch")
        ).toEqual([WEB, API]);
    });
});

describe("Undo after unlink", () => {
    it.each([
        ["the whole Git link", { branchName: null, pr: null }],
        ["the branch", { branchName: null }],
        ["the PR", { pr: null }],
    ] as const)(
        "unlinking %s then Undo restores branch and PR",
        (_, change) => {
            const before = [webLink];
            const unlinked = applyGitLinkChange(before, WEB.id, change);
            const restored = applyGitLinkChange(
                unlinked,
                WEB.id,
                gitLinkRestoreChange(before[0])
            );

            expect(restored).toEqual(before);
        }
    );

    it("no previous Git link clears both fields", () => {
        expect(gitLinkRestoreChange()).toEqual({
            branchName: null,
            pr: null,
        });
    });
});
