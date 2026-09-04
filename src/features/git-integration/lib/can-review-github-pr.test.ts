import { describe, expect, it } from "vitest";

import type { ProjectAccessRole } from "@/features/projects/model/access";
import type { Task } from "@/features/tasks/model/types";

import { canReviewGithubPr } from "@/features/git-integration/lib/can-review-github-pr";

const ME = "user-me";
const OTHER = "user-other";

function person(id: string) {
    return { id, name: id };
}

function task(
    partial: Partial<Pick<Task, "archivedAt" | "assignee" | "author">> = {}
) {
    return {
        archivedAt: partial.archivedAt,
        assignee: partial.assignee,
        author: partial.author,
    };
}

describe("canReviewGithubPr", () => {
    const roles: ProjectAccessRole[] = [
        "owner",
        "admin",
        "manager",
        "contributor",
        "viewer",
    ];

    it("denies guests even when Owner", () => {
        expect(
            canReviewGithubPr({
                isGuest: true,
                role: "owner",
                task: task({ author: person(ME) }),
                userId: ME,
            })
        ).toBe(false);
    });

    it("denies archived tasks", () => {
        expect(
            canReviewGithubPr({
                isGuest: false,
                role: "owner",
                task: task({
                    archivedAt: "2026-01-01T00:00:00.000Z",
                    author: person(ME),
                }),
                userId: ME,
            })
        ).toBe(false);
    });

    it("denies missing user or role", () => {
        expect(
            canReviewGithubPr({
                isGuest: false,
                role: "owner",
                task: task({ author: person(ME) }),
                userId: null,
            })
        ).toBe(false);

        expect(
            canReviewGithubPr({
                isGuest: false,
                role: null,
                task: task({ author: person(ME) }),
                userId: ME,
            })
        ).toBe(false);
    });

    it("allows Owner Admin Manager Contributor on any task (no author/assignee gate)", () => {
        const unrelated = task({
            assignee: person(OTHER),
            author: person(OTHER),
        });

        for (const role of [
            "owner",
            "admin",
            "manager",
            "contributor",
        ] as const) {
            expect(
                canReviewGithubPr({
                    isGuest: false,
                    role,
                    task: unrelated,
                    userId: ME,
                })
            ).toBe(true);
        }
    });

    it("denies Viewer for all ownership shapes", () => {
        for (const ownership of [
            task({ author: person(ME) }),
            task({ assignee: person(ME) }),
            task({ author: person(OTHER) }),
        ]) {
            expect(
                canReviewGithubPr({
                    isGuest: false,
                    role: "viewer",
                    task: ownership,
                    userId: ME,
                })
            ).toBe(false);
        }
    });

    it("covers every ProjectAccessRole against unrelated task", () => {
        const unrelated = task({
            assignee: person(OTHER),
            author: person(OTHER),
        });
        const expected: Record<ProjectAccessRole, boolean> = {
            admin: true,
            contributor: true,
            manager: true,
            owner: true,
            viewer: false,
        };

        for (const role of roles) {
            expect(
                canReviewGithubPr({
                    isGuest: false,
                    role,
                    task: unrelated,
                    userId: ME,
                })
            ).toBe(expected[role]);
        }
    });
});
