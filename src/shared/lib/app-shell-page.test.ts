import { describe, expect, it } from "vitest";

import { PLOTOPS_SITE_NAME, PLOTOPS_SITE_TAGLINE } from "@/shared/config/site";

import {
    parseAppShellPath,
    resolveAppShellDocumentTitle,
} from "./app-shell-page";

const labels = {
    about: "About",
    accountSettings: "Platform settings",
    backlog: "Backlog",
    board: "Board",
    cicd: "CI/CD",
    completeProfile: "Complete your profile",
    dashboard: "Dashboard",
    home: "Home",
    invite: "Team invite",
    notFound: "Page not found",
    notifications: "Notifications",
    settings: "Settings",
};

describe("parseAppShellPath", () => {
    it("parses board and backlog routes", () => {
        expect(parseAppShellPath("/projects/proj-1/boards/board-9/")).toEqual({
            boardId: "board-9",
            kind: "board",
            projectId: "proj-1",
        });
        expect(
            parseAppShellPath("/projects/proj-1/boards/board-9/backlog")
        ).toEqual({
            boardId: "board-9",
            kind: "backlog",
            projectId: "proj-1",
        });
    });

    it("parses project, team, and static app routes", () => {
        expect(parseAppShellPath("/home")).toEqual({ kind: "home" });
        expect(parseAppShellPath("/projects/proj-1/ci-cd")).toEqual({
            kind: "ci-cd",
            projectId: "proj-1",
        });
        expect(parseAppShellPath("/teams/team-1/settings")).toEqual({
            kind: "team-settings",
            teamId: "team-1",
        });
        expect(parseAppShellPath("/projects/proj-1/tasks/TASK-12")).toEqual({
            kind: "task",
            projectId: "proj-1",
            taskKey: "TASK-12",
        });
    });
});

describe("resolveAppShellDocumentTitle", () => {
    it("keeps the marketing title when labels are omitted", () => {
        expect(resolveAppShellDocumentTitle("/home")).toBe(
            `${PLOTOPS_SITE_NAME} — ${PLOTOPS_SITE_TAGLINE}`
        );
    });

    it("uses the board name once it is known", () => {
        expect(
            resolveAppShellDocumentTitle("/projects/p/boards/b", {
                entities: { boardName: "Engineering" },
                labels,
            })
        ).toBe(`Engineering — ${PLOTOPS_SITE_NAME}`);
    });

    it("prefixes an open task key onto the board title", () => {
        expect(
            resolveAppShellDocumentTitle("/projects/p/boards/b", {
                entities: { boardName: "Engineering", taskKey: "TASK-12" },
                labels,
            })
        ).toBe(`TASK-12 · Engineering — ${PLOTOPS_SITE_NAME}`);
    });

    it("names backlog, CI/CD, and settings from the current entity", () => {
        expect(
            resolveAppShellDocumentTitle("/projects/p/boards/b/backlog", {
                entities: { boardName: "Engineering" },
                labels,
            })
        ).toBe(`Engineering · Backlog — ${PLOTOPS_SITE_NAME}`);
        expect(
            resolveAppShellDocumentTitle("/projects/p/ci-cd", {
                entities: { projectName: "PlotOps App" },
                labels,
            })
        ).toBe(`PlotOps App · CI/CD — ${PLOTOPS_SITE_NAME}`);
        expect(
            resolveAppShellDocumentTitle("/teams/t/settings", {
                entities: { teamName: "Acme" },
                labels,
            })
        ).toBe(`Acme · Settings — ${PLOTOPS_SITE_NAME}`);
    });

    it("falls back to the section label before the entity name loads", () => {
        expect(
            resolveAppShellDocumentTitle("/projects/p/boards/b", { labels })
        ).toBe(`Board — ${PLOTOPS_SITE_NAME}`);
        expect(resolveAppShellDocumentTitle("/home", { labels })).toBe(
            `Home — ${PLOTOPS_SITE_NAME}`
        );
    });
});
