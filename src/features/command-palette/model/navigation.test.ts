import i18next from "i18next";
import { describe, expect, it } from "vitest";

import authEn from "@/app/locales/auth/en.json";
import authRu from "@/app/locales/auth/ru.json";
import boardEn from "@/app/locales/board/en.json";
import boardRu from "@/app/locales/board/ru.json";
import commandEn from "@/app/locales/command/en.json";
import commandRu from "@/app/locales/command/ru.json";
import commonEn from "@/app/locales/common/en.json";
import commonRu from "@/app/locales/common/ru.json";
import {
    type DestinationContext,
    resolveDestinationAddress,
    resolveVisibleDestinations,
} from "@/shared/lib/destinations";

import {
    destinationSearchTerms,
    formatDestinationPath,
    isTaskKeyQuery,
    matchDestinations,
    resolveCommandPaletteGroupOrder,
} from "./navigation";

const projectManager: DestinationContext = {
    boardId: "b1",
    canManageBoard: true,
    canViewTeam: true,
    isGuest: false,
    projectId: "p1",
    teamId: "t1",
};

function createI18n(lng: "en" | "ru") {
    const instance = i18next.createInstance();
    void instance.init({
        initAsync: false,
        lng,
        resources: {
            en: {
                auth: authEn,
                board: boardEn,
                command: commandEn,
                common: commonEn,
            },
            ru: {
                auth: authRu,
                board: boardRu,
                command: commandRu,
                common: commonRu,
            },
        },
    });
    return instance;
}

function search(query: string, uiLanguage: "en" | "ru" = "en") {
    const i18n = createI18n(uiLanguage);
    const translators = [
        i18n.getFixedT("en", "command"),
        i18n.getFixedT("ru", "command"),
    ];
    return matchDestinations(
        resolveVisibleDestinations(projectManager),
        query,
        (destination) => destinationSearchTerms(destination, translators)
    );
}

describe("Navigation search", () => {
    it("“labels” in a Project leads to Project settings → Labels", () => {
        const [hit] = search("labels");
        expect(hit?.id).toBe("projectSettingsLabels");
        if (!hit) return;

        expect(resolveDestinationAddress(hit, projectManager)).toEqual({
            params: { projectId: "p1" },
            search: { section: "labels" },
            to: "/projects/$projectId/settings",
        });
    });

    it.each([
        { query: "webhook", uiLanguage: "en" },
        { query: "webhook", uiLanguage: "ru" },
        { query: "вебхук", uiLanguage: "en" },
        { query: "вебхук", uiLanguage: "ru" },
        { query: "merge", uiLanguage: "ru" },
    ] as const)(
        "“$query” finds Project settings → Boards with UI in $uiLanguage",
        ({ query, uiLanguage }) => {
            expect(
                search(query, uiLanguage).map((destination) => destination.id)
            ).toContain("projectSettingsBoards");
        }
    );

    it("matches every query word against name, parent and keywords", () => {
        expect(
            search("project settings labels").map(
                (destination) => destination.id
            )
        ).toEqual(["projectSettingsLabels"]);
    });

    it("returns every visible Destination for an empty query", () => {
        expect(search("  ")).toEqual(
            resolveVisibleDestinations(projectManager)
        );
    });

    it("never offers Destinations hidden in this context", () => {
        const viewer = { ...projectManager, canManageBoard: false };
        const i18n = createI18n("en");
        const translators = [
            i18n.getFixedT("en", "command"),
            i18n.getFixedT("ru", "command"),
        ];
        expect(
            matchDestinations(
                resolveVisibleDestinations(viewer),
                "labels",
                (destination) =>
                    destinationSearchTerms(destination, translators)
            )
        ).toEqual([]);
    });
});

describe("formatDestinationPath", () => {
    it("joins parent, name and scope", () => {
        expect(
            formatDestinationPath({
                parent: "Project settings",
                scope: "Frontend",
                title: "Labels",
            })
        ).toBe("Project settings › Labels · Frontend");
        expect(
            formatDestinationPath({ scope: "Frontend", title: "Board" })
        ).toBe("Board · Frontend");
    });

    it("is null when it would only repeat the name", () => {
        expect(formatDestinationPath({ title: "Home" })).toBeNull();
    });
});

describe("resolveCommandPaletteGroupOrder", () => {
    it("keeps Navigation → Actions → Tasks → Members → Projects", () => {
        expect(resolveCommandPaletteGroupOrder("labels")).toEqual([
            "navigation",
            "actions",
            "tasks",
            "members",
            "projects",
        ]);
    });

    it("leads with Recent above Navigation on an empty query only", () => {
        expect(resolveCommandPaletteGroupOrder("  ").slice(0, 2)).toEqual([
            "recent",
            "navigation",
        ]);
        expect(resolveCommandPaletteGroupOrder("labels")).not.toContain(
            "recent"
        );
        expect(resolveCommandPaletteGroupOrder("PLT-12")).not.toContain(
            "recent"
        );
    });

    it("lifts Tasks to the top for a Task-key query like PLT-12", () => {
        expect(resolveCommandPaletteGroupOrder("PLT-12")).toEqual([
            "tasks",
            "navigation",
            "actions",
            "members",
            "projects",
        ]);
    });

    it.each(["PLT-12", " plt-7 ", "A1-3"])("%s is a Task key", (query) => {
        expect(isTaskKeyQuery(query)).toBe(true);
    });

    it.each(["PLT", "PLT-", "labels", "12", "PLT-12 fix"])(
        "%s is not a Task key",
        (query) => {
            expect(isTaskKeyQuery(query)).toBe(false);
        }
    );
});
