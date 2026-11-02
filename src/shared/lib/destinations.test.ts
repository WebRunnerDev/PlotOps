import { describe, expect, it } from "vitest";

import en from "@/app/locales/command/en.json";
import ru from "@/app/locales/command/ru.json";

import {
    type DestinationContext,
    DESTINATIONS,
    resolveDestinationAddress,
    resolveVisibleDestinations,
    resolveVisibleSettingsSections,
    settingsSectionIds,
} from "./destinations";

const context = (
    overrides: Partial<DestinationContext> = {}
): DestinationContext => ({
    boardId: null,
    canManageBoard: false,
    canViewTeam: false,
    isGuest: false,
    projectId: null,
    teamId: null,
    ...overrides,
});

const projectManager = context({
    boardId: "b1",
    canManageBoard: true,
    canViewTeam: true,
    projectId: "p1",
    teamId: "t1",
});

const visibleIds = (input: DestinationContext) =>
    resolveVisibleDestinations(input).map((destination) => destination.id);

describe("resolveVisibleDestinations", () => {
    it("offers only Global and Personal without Team or Project context", () => {
        expect(visibleIds(context())).toEqual([
            "home",
            "dashboard",
            "notifications",
            "about",
            "settingsDrawer",
            "settingsProfile",
            "settingsGithub",
            "settingsAccounts",
        ]);
    });

    it("offers every Destination to a Manager+ inside a Board", () => {
        expect(visibleIds(projectManager)).toEqual(
            DESTINATIONS.map((destination) => destination.id)
        );
    });

    it("hides Project settings from a Viewer but keeps Board, Backlog, CI/CD", () => {
        const ids = visibleIds(
            context({
                boardId: "b1",
                canViewTeam: true,
                projectId: "p1",
                teamId: "t1",
            })
        );
        expect(ids).toEqual(
            expect.arrayContaining(["board", "backlog", "cicd", "team"])
        );
        expect(ids.some((id) => id.startsWith("projectSettings"))).toBe(false);
    });

    it("hides Profile, GitHub and Connected accounts from a guest", () => {
        const ids = visibleIds({ ...projectManager, isGuest: true });
        expect(ids).toContain("settingsDrawer");
        expect(ids).not.toContain("settingsProfile");
        expect(ids).not.toContain("settingsGithub");
        expect(ids).not.toContain("settingsAccounts");
    });

    it("has no Project Destinations without a Project in the URL", () => {
        const ids = visibleIds({
            ...projectManager,
            boardId: null,
            projectId: null,
        });
        expect(
            DESTINATIONS.filter(
                (destination) =>
                    destination.group === "project" &&
                    ids.includes(destination.id)
            )
        ).toEqual([]);
        expect(ids).toContain("teamTasks");
    });

    it("offers CI/CD but not Board or Backlog when no Board is known", () => {
        const ids = visibleIds({ ...projectManager, boardId: null });
        expect(ids).toContain("cicd");
        expect(ids).not.toContain("board");
        expect(ids).not.toContain("backlog");
    });

    it("hides Team Destinations without view access to the Team", () => {
        const ids = visibleIds({ ...projectManager, canViewTeam: false });
        expect(
            ids.some(
                (id) =>
                    DESTINATIONS.find((destination) => destination.id === id)
                        ?.group === "team"
            )
        ).toBe(false);
    });
});

describe("settings sections", () => {
    it("lists section ids per settings page in nav order", () => {
        expect(settingsSectionIds("/settings")).toEqual([
            "drawer",
            "profile",
            "github",
            "accounts",
        ]);
        expect(settingsSectionIds("/projects/$projectId/settings")).toEqual([
            "boards",
            "labels",
            "customFields",
        ]);
        expect(settingsSectionIds("/teams/$teamId/settings")).toEqual([
            "name",
            "members",
        ]);
    });

    it("leaves only Task drawer in personal settings for a guest", () => {
        expect(
            resolveVisibleSettingsSections(
                "/settings",
                context({ isGuest: true })
            ).map((destination) => destination.section)
        ).toEqual(["drawer"]);
    });

    it("shows no Project settings sections to a Viewer", () => {
        expect(
            resolveVisibleSettingsSections(
                "/projects/$projectId/settings",
                context({ canViewTeam: true, projectId: "p1", teamId: "t1" })
            )
        ).toEqual([]);
    });
});

function byId(id: string) {
    const destination = DESTINATIONS.find((item) => item.id === id);
    if (!destination) throw new Error(id);
    return destination;
}

function lookup(locale: unknown, path: string): unknown {
    let node = locale;
    for (const key of path.split(".")) {
        node = (node as Record<string, unknown> | undefined)?.[key];
    }
    return node;
}

describe("resolveDestinationAddress", () => {
    it("fills route params and the settings section", () => {
        expect(
            resolveDestinationAddress(
                byId("projectSettingsLabels"),
                projectManager
            )
        ).toEqual({
            params: { projectId: "p1" },
            search: { section: "labels" },
            to: "/projects/$projectId/settings",
        });
        expect(
            resolveDestinationAddress(byId("backlog"), projectManager)
        ).toEqual({
            params: { boardId: "b1", projectId: "p1" },
            to: "/projects/$projectId/boards/$boardId/backlog",
        });
        expect(resolveDestinationAddress(byId("home"), context())).toEqual({
            params: {},
            to: "/home",
        });
    });

    it("returns null when a required id is missing", () => {
        expect(
            resolveDestinationAddress(byId("teamSettingsMembers"), context())
        ).toBeNull();
    });
});

describe("keywords", () => {
    it("declares a keyword list for every Destination in en and ru", () => {
        for (const destination of DESTINATIONS) {
            for (const locale of [en, ru]) {
                const list = lookup(locale, destination.keywordsKey);
                expect(
                    Array.isArray(list) && list.length > 0,
                    destination.id
                ).toBe(true);
            }
        }
    });
});
