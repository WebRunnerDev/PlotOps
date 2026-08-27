import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

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

describe("task quick-add chips seam", () => {
    it("exposes Type, Priority, Assignee, and Labels chips", () => {
        const chips = readFileSync(
            path.join(dirname, "task-quick-add-chips.tsx"),
            "utf8"
        );

        expect(chips).toMatch(/data-task-quick-add-chips/);
        expect(chips).toMatch(/taskType\./);
        expect(chips).toMatch(/priority\./);
        expect(chips).toMatch(/fields\.memberNone/);
        expect(chips).toMatch(/fields\.labels/);
        expect(chips).not.toMatch(/allowCreate/);
    });

    it("loads assignee options via useProjectPeople (guest-safe)", () => {
        const chips = readFileSync(
            path.join(dirname, "task-quick-add-chips.tsx"),
            "utf8"
        );

        // useProjectMembers is disabled in Guest — assignee chips must not
        // rebuild people from members/owner alone or Demo Guest disappears.
        expect(chips).toMatch(/useProjectPeople/);
        expect(chips).not.toMatch(/useProjectMembers/);
        expect(chips).not.toMatch(/useProjectOwnerProfile/);
    });
});

describe("guest quick-add assignee people", () => {
    beforeEach(() => {
        stubSessionStorage();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.resetModules();
    });

    it("includes Demo Guest in project people for assignee pickers", async () => {
        const { getGuestSandbox, GUEST_SEED_ACTOR_ID, startGuestSession } =
            await import("@/features/guest-mode");
        const { listGuestProjectPeople } =
            await import("@/features/projects/api/guest-project-people");

        startGuestSession();
        const projectId = getGuestSandbox()!.projects[0]!.id;
        const people = listGuestProjectPeople(projectId);

        expect(people.some((person) => person.id === GUEST_SEED_ACTOR_ID)).toBe(
            true
        );
        expect(people.some((person) => person.name === "Demo Guest")).toBe(
            true
        );
    });
});
