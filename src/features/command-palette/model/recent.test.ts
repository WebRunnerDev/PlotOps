import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    COMMAND_PALETTE_RECENT_LIMIT,
    type CommandPaletteRecentItem,
    commandPaletteRecentStorageKey,
    pushCommandPaletteRecent,
    readCommandPaletteRecent,
    recordCommandPaletteRecent,
    resolveCommandPaletteRecent,
    resolveCommandPaletteRecentOwner,
    sameDestinationParameters,
} from "./recent";
import { resetCommandPaletteLocalState } from "./reset-command-palette-local-state";

function createMemoryStorage(): Storage {
    const store = new Map<string, string>();
    return {
        clear: () => {
            store.clear();
        },
        getItem: (key: string) => store.get(key) ?? null,
        key: (index: number) => [...store.keys()][index] ?? null,
        get length() {
            return store.size;
        },
        removeItem: (key: string) => {
            store.delete(key);
        },
        setItem: (key: string, value: string) => {
            store.set(key, value);
        },
    };
}

const alice = { kind: "user", userId: "alice" } as const;
const bob = { kind: "user", userId: "bob" } as const;
const guest = { kind: "guest" } as const;

const labels: CommandPaletteRecentItem = {
    id: "projectSettingsLabels",
    kind: "destination",
    params: { projectId: "p1" },
};
const task: CommandPaletteRecentItem = {
    kind: "task",
    projectId: "p1",
    taskId: "t1",
};
const project: CommandPaletteRecentItem = { kind: "project", projectId: "p2" };

describe("pushCommandPaletteRecent", () => {
    it("lifts a re-picked item to the top without a duplicate", () => {
        let list: CommandPaletteRecentItem[] = [];
        for (const item of [labels, task, project]) {
            list = pushCommandPaletteRecent(list, item);
        }
        expect(list).toEqual([project, task, labels]);

        expect(pushCommandPaletteRecent(list, { ...labels })).toEqual([
            labels,
            project,
            task,
        ]);
    });

    it("treats the same Destination in another Project as a separate item", () => {
        const other = { ...labels, params: { projectId: "p9" } };
        expect(pushCommandPaletteRecent([labels], other)).toEqual([
            other,
            labels,
        ]);
    });

    it("keeps at most five, newest first", () => {
        let list: CommandPaletteRecentItem[] = [];
        for (let index = 0; index < 8; index += 1) {
            list = pushCommandPaletteRecent(list, {
                kind: "project",
                projectId: `p${index}`,
            });
        }
        expect(list).toHaveLength(COMMAND_PALETTE_RECENT_LIMIT);
        expect(
            list.map((item) => item.kind === "project" && item.projectId)
        ).toEqual(["p7", "p6", "p5", "p4", "p3"]);
    });
});

describe("Recent storage", () => {
    beforeEach(() => {
        vi.stubGlobal("localStorage", createMemoryStorage());
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("records per owner and never mixes users or the Guest Session", () => {
        recordCommandPaletteRecent(alice, labels);
        recordCommandPaletteRecent(bob, task);
        recordCommandPaletteRecent(guest, project);

        expect(readCommandPaletteRecent(alice)).toEqual([labels]);
        expect(readCommandPaletteRecent(bob)).toEqual([task]);
        expect(readCommandPaletteRecent(guest)).toEqual([project]);
        expect(commandPaletteRecentStorageKey(alice)).not.toBe(
            commandPaletteRecentStorageKey(bob)
        );
    });

    it("re-recording an item moves it to the top in storage", () => {
        recordCommandPaletteRecent(alice, labels);
        recordCommandPaletteRecent(alice, task);
        recordCommandPaletteRecent(alice, labels);

        expect(readCommandPaletteRecent(alice)).toEqual([labels, task]);
    });

    it("is empty after the local-state reset on sign out", () => {
        recordCommandPaletteRecent(alice, labels);
        recordCommandPaletteRecent(bob, task);

        resetCommandPaletteLocalState({ recentOwner: alice });

        expect(readCommandPaletteRecent(alice)).toEqual([]);
        expect(readCommandPaletteRecent(bob)).toEqual([task]);
    });

    it("keeps Recent on a plain palette close", () => {
        recordCommandPaletteRecent(guest, project);
        expect(resetCommandPaletteLocalState()).toEqual({ query: "" });
        expect(readCommandPaletteRecent(guest)).toEqual([project]);
    });

    it("ignores malformed storage", () => {
        localStorage.setItem(commandPaletteRecentStorageKey(alice), "{nope");
        expect(readCommandPaletteRecent(alice)).toEqual([]);

        localStorage.setItem(
            commandPaletteRecentStorageKey(alice),
            JSON.stringify([{ kind: "task" }, project])
        );
        expect(readCommandPaletteRecent(alice)).toEqual([project]);
    });
});

describe("resolveCommandPaletteRecentOwner", () => {
    it("prefers the Guest Session, else the user id, else nobody", () => {
        expect(resolveCommandPaletteRecentOwner(true, "alice")).toEqual(guest);
        expect(resolveCommandPaletteRecentOwner(false, "alice")).toEqual(alice);
        expect(resolveCommandPaletteRecentOwner(false, null)).toBeNull();
    });
});

describe("resolveCommandPaletteRecent", () => {
    it("hides entries that became unavailable and keeps order", () => {
        const hits = resolveCommandPaletteRecent([task, labels, project], {
            destination: (item) =>
                item.id === "projectSettingsLabels" ? null : item,
            project: (item) => item,
            task: () => null,
        });

        expect(hits).toEqual([{ item: project, kind: "project" }]);
    });
});

describe("sameDestinationParameters", () => {
    it("compares route params regardless of key order", () => {
        expect(
            sameDestinationParameters(
                { boardId: "b1", projectId: "p1" },
                Object.fromEntries([
                    ["projectId", "p1"],
                    ["boardId", "b1"],
                ])
            )
        ).toBe(true);
        expect(
            sameDestinationParameters({ projectId: "p1" }, { projectId: "p2" })
        ).toBe(false);
        expect(sameDestinationParameters({}, { teamId: "t1" })).toBe(false);
    });
});
