import { describe, expect, it } from "vitest";

import type { ProjectAccessRole } from "@/features/projects/model/access";
import type { Task } from "@/features/tasks/model/types";

import { canWriteGithubPr } from "@/features/git-integration/lib/can-write-github-pr";

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

describe("canWriteGithubPr", () => {
    const roles: ProjectAccessRole[] = [
        "owner",
        "admin",
        "manager",
        "contributor",
        "viewer",
    ];

    it("denies guests even when Owner", () => {
        expect(
            canWriteGithubPr({
                isGuest: true,
                role: "owner",
                task: task({ author: person(ME) }),
                userId: ME,
            })
        ).toBe(false);
    });

    it("denies archived tasks", () => {
        expect(
            canWriteGithubPr({
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
            canWriteGithubPr({
                isGuest: false,
                role: "owner",
                task: task({ author: person(ME) }),
                userId: null,
            })
        ).toBe(false);

        expect(
            canWriteGithubPr({
                isGuest: false,
                role: null,
                task: task({ author: person(ME) }),
                userId: ME,
            })
        ).toBe(false);
    });

    it("allows Owner and Admin on any task", () => {
        for (const role of ["owner", "admin"] as const) {
            expect(
                canWriteGithubPr({
                    isGuest: false,
                    role,
                    task: task({
                        assignee: person(OTHER),
                        author: person(OTHER),
                    }),
                    userId: ME,
                })
            ).toBe(true);
        }
    });

    it("allows Manager and Contributor only when author or assignee", () => {
        for (const role of ["manager", "contributor"] as const) {
            expect(
                canWriteGithubPr({
                    isGuest: false,
                    role,
                    task: task({ author: person(ME) }),
                    userId: ME,
                })
            ).toBe(true);

            expect(
                canWriteGithubPr({
                    isGuest: false,
                    role,
                    task: task({ assignee: person(ME) }),
                    userId: ME,
                })
            ).toBe(true);

            expect(
                canWriteGithubPr({
                    isGuest: false,
                    role,
                    task: task({
                        assignee: person(OTHER),
                        author: person(OTHER),
                    }),
                    userId: ME,
                })
            ).toBe(false);

            expect(
                canWriteGithubPr({
                    isGuest: false,
                    role,
                    task: task(),
                    userId: ME,
                })
            ).toBe(false);
        }
    });

    it("denies Viewer for all ownership shapes", () => {
        for (const ownership of [
            task({ author: person(ME) }),
            task({ assignee: person(ME) }),
            task({ author: person(OTHER) }),
        ]) {
            expect(
                canWriteGithubPr({
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
            contributor: false,
            manager: false,
            owner: true,
            viewer: false,
        };

        for (const role of roles) {
            expect(
                canWriteGithubPr({
                    isGuest: false,
                    role,
                    task: unrelated,
                    userId: ME,
                })
            ).toBe(expected[role]);
        }
    });
});
