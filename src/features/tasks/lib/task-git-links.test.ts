import { describe, expect, it } from "vitest";

import type {
    TaskGitLink,
    TaskPullRequest,
} from "@/features/tasks/model/types";

import {
    applyGitLinkChange,
    applyGitLinkDetails,
    findGitLink,
    gitLinkActivityView,
    gitLinkRestoreChange,
    gitTabRepositories,
    groupGitLinksByRepository,
    linkedGitLinks,
    pickDefaultRepositoryId,
    planAttachPr,
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
    id: "link-web",
    pr: pr(12, "merged"),
    repositoryId: WEB.id,
};
const apiLink: TaskGitLink = {
    branchName: "feature/TASK-1-api",
    id: "link-api",
    pr: pr(7, "open"),
    repositoryId: API.id,
};
/** A hotfix PR in the same Repository as `webLink` (ADR 0036). */
const webHotfix: TaskGitLink = {
    branchName: "hotfix/TASK-1",
    id: "link-web-hotfix",
    pr: pr(13, "open"),
    repositoryId: WEB.id,
};

const at = (link: TaskGitLink) => ({
    linkId: link.id,
    repositoryId: link.repositoryId,
});

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
            grouped.flatMap((entry) => entry.links.map((l) => l.pr?.number))
        ).toEqual([12, 7]);
        expect(grouped[2]?.links).toEqual([]);
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

describe("Task with two PRs in one Repository (#352)", () => {
    const links = [webLink, apiLink, webHotfix];

    it("shows one drawer row per Git link, Project order then oldest first", () => {
        expect(
            linkedGitLinks([WEB, API], links).map(({ link }) => link.id)
        ).toEqual([webLink.id, webHotfix.id, apiLink.id]);
    });

    it("counts every PR in the badge", () => {
        expect(taskPrBadge({ gitLinks: links })).toMatchObject({
            kind: "aggregate",
            mergedCount: 1,
            prCount: 3,
            state: "open",
        });
    });

    it("changes only the addressed Git link", () => {
        const next = applyGitLinkChange(links, at(webHotfix), {
            pr: pr(13, "merged"),
        });
        expect(next[0]).toBe(webLink);
        expect(next[2]).toEqual({ ...webHotfix, pr: pr(13, "merged") });
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
                    { branchName: "a", id: "l-a", repositoryId: WEB.id },
                    { branchName: "b", id: "l-b", repositoryId: API.id },
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
            gitLinks: [
                webLink,
                { branchName: "x", id: "l-x", repositoryId: API.id },
            ],
        });
        expect(badge).toMatchObject({ kind: "aggregate", prCount: 1 });
    });
});

describe("Create branch / PR Repository choice", () => {
    it("defaults to the last Repository this viewer chose on the Board", () => {
        expect(pickDefaultRepositoryId([API, DOCS], DOCS.id)).toBe(DOCS.id);
    });

    it("falls back to the first offered Repository", () => {
        expect(pickDefaultRepositoryId([API, DOCS])).toBe(API.id);
        expect(pickDefaultRepositoryId([API, DOCS], WEB.id)).toBe(API.id);
        expect(pickDefaultRepositoryId([], WEB.id)).toBeUndefined();
    });
});

describe("findGitLink / planAttachPr (+ Link menu)", () => {
    const branchOnly: TaskGitLink = {
        branchName: "feature/TASK-1-b",
        id: "link-b",
        repositoryId: WEB.id,
    };
    const links = [webLink, branchOnly];

    it("finds a branch or PR the Repository already holds", () => {
        expect(
            findGitLink(links, WEB.id, { branchName: "feature/TASK-1-b" })
        ).toBe(branchOnly);
        expect(findGitLink(links, WEB.id, { prNumber: 12 })).toBe(webLink);
        expect(findGitLink(links, API.id, { prNumber: 12 })).toBeUndefined();
    });

    it("refuses a PR the Task already holds in that Repository", () => {
        expect(planAttachPr(links, WEB.id, { number: 12 })).toEqual({
            kind: "duplicate",
            link: webLink,
        });
    });

    it("joins a PR to the branch-only Git link on its head", () => {
        expect(
            planAttachPr(links, WEB.id, {
                headRef: "feature/TASK-1-b",
                number: 20,
            })
        ).toEqual({ kind: "join", link: branchOnly });
    });

    it("adds a new Git link for any other PR", () => {
        expect(
            planAttachPr(links, WEB.id, { headRef: "other", number: 20 })
        ).toEqual({ kind: "new" });
        expect(planAttachPr(links, API.id, { number: 12 })).toEqual({
            kind: "new",
        });
    });
});

describe("applyGitLinkChange", () => {
    it("appends a Git link for a new id, even in a linked Repository", () => {
        expect(
            applyGitLinkChange(
                [webLink],
                { linkId: "new", repositoryId: WEB.id },
                { branchName: "feat/x" }
            )
        ).toEqual([
            webLink,
            {
                branchName: "feat/x",
                id: "new",
                pr: undefined,
                repositoryId: WEB.id,
            },
        ]);
    });

    it("removes a Git link left with neither branch nor PR", () => {
        expect(
            applyGitLinkChange([webLink, apiLink], at(webLink), {
                branchName: null,
                pr: null,
            })
        ).toEqual([apiLink]);
        expect(
            applyGitLinkChange(
                [],
                { linkId: "new", repositoryId: WEB.id },
                { branchName: " " }
            )
        ).toEqual([]);
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
            at(webLink),
            { branchName: null, pr: null }
        );
        expect(next).toEqual({
            branchName: apiLink.branchName,
            gitLinks: [apiLink],
            pr: apiLink.pr,
        });
    });

    it("patches only the single-repo view without a target", () => {
        expect(
            applyGitLinkDetails(
                { gitLinks: [apiLink], pr: apiLink.pr },
                undefined,
                { pr: null }
            )
        ).toEqual({ pr: undefined });
    });

    it("leaves Git fields alone for a non-Git change", () => {
        expect(
            applyGitLinkDetails({ gitLinks: [apiLink] }, at(apiLink), {})
        ).toEqual({});
    });
});

describe("gitLinkActivityView", () => {
    it("reads branch / PR from the changed Git link", () => {
        const task = {
            branchName: webLink.branchName,
            gitLinks: [webLink, apiLink, webHotfix],
            pr: webLink.pr,
        };
        expect(gitLinkActivityView(task, webHotfix.id)).toMatchObject({
            branchName: webHotfix.branchName,
            pr: webHotfix.pr,
        });
        expect(gitLinkActivityView(task, "new")).toMatchObject({
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

describe("Undo after unlink", () => {
    it.each([
        ["the whole Git link", { branchName: null, pr: null }],
        ["the branch", { branchName: null }],
        ["the PR", { pr: null }],
    ] as const)(
        "unlinking %s then Undo restores branch and PR",
        (_, change) => {
            const before = [webLink, webHotfix];
            const unlinked = applyGitLinkChange(before, at(webHotfix), change);
            const restored = applyGitLinkChange(
                unlinked,
                at(webHotfix),
                gitLinkRestoreChange(before[1])
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
