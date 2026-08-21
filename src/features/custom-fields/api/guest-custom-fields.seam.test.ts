import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { guestCustomFieldsProvider } from "@/features/custom-fields/api/guest-custom-fields";
import { resolveCustomFieldsProvider } from "@/features/custom-fields/api/resolve-custom-fields-provider";

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

beforeEach(() => {
    stubSessionStorage();
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
});

describe("guest custom fields provider", () => {
    it("create / rename / appliesTo / copy / delete + values", async () => {
        const { getGuestSandbox, startGuestSession } =
            await import("@/features/guest-mode");

        startGuestSession();
        const sandbox = getGuestSandbox()!;
        const projectId = sandbox.projects[0]!.id;
        const otherProjectId = sandbox.projects[1]!.id;
        const bugTask = sandbox.tasks.find((task) => task.type === "bug")!;

        const provider = resolveCustomFieldsProvider(true);
        expect(provider).toBe(guestCustomFieldsProvider);

        const created = await provider.createProjectCustomField(projectId, {
            appliesTo: ["bug"],
            name: "Expected",
        });
        expect(created).toMatchObject({
            appliesTo: ["bug"],
            name: "Expected",
            projectId,
        });

        await provider.updateProjectCustomField(created.id, {
            appliesTo: ["bug", "feature"],
            name: "Expected result",
        });

        let listed = await provider.fetchProjectCustomFields(projectId);
        expect(listed.find((field) => field.id === created.id)).toMatchObject({
            appliesTo: ["bug", "feature"],
            name: "Expected result",
        });

        await provider.upsertTaskCustomFieldValue(
            bugTask.id,
            created.id,
            "  boom  "
        );
        let values = await provider.fetchTaskCustomFieldValues(bugTask.id);
        expect(values.find((row) => row.fieldId === created.id)?.value).toBe(
            "boom"
        );

        await provider.upsertTaskCustomFieldValue(bugTask.id, created.id, "  ");
        values = await provider.fetchTaskCustomFieldValues(bugTask.id);
        expect(values.some((row) => row.fieldId === created.id)).toBe(false);

        const copied = await provider.copyProjectCustomField(
            created.id,
            otherProjectId!
        );
        const copiedId = copied.id;
        const otherList = await provider.fetchProjectCustomFields(
            otherProjectId!
        );
        expect(otherList.some((field) => field.id === copiedId)).toBe(true);
        expect(otherList.some((field) => field.id === created.id)).toBe(false);

        await provider.deleteProjectCustomField(created.id);
        listed = await provider.fetchProjectCustomFields(projectId);
        expect(listed.some((field) => field.id === created.id)).toBe(false);
    });

    it("enforces ≤10 definitions per Project", async () => {
        const { getGuestSandbox, startGuestSession } =
            await import("@/features/guest-mode");

        startGuestSession();
        const projectId = getGuestSandbox()!.projects[0]!.id;
        const provider = resolveCustomFieldsProvider(true);

        // Seed already has one on the git project — fill to 10 then reject.
        const existing = await provider.fetchProjectCustomFields(projectId);
        for (let index = existing.length; index < 10; index += 1) {
            await provider.createProjectCustomField(projectId, {
                appliesTo: ["task"],
                name: `Extra ${index}`,
            });
        }

        await expect(
            provider.createProjectCustomField(projectId, {
                appliesTo: ["task"],
                name: "Overflow",
            })
        ).rejects.toMatchObject({
            code: "P0001",
            message: expect.stringContaining("at most 10"),
        });
    });
});
