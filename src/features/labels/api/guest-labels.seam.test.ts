import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { guestLabelsProvider } from "@/features/labels/api/guest-labels";
import { resolveLabelsProvider } from "@/features/labels/api/resolve-labels-provider";

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

describe("guest labels provider happy path", () => {
    it("create / rename / recolor / move / delete persist in sandbox", async () => {
        const { getGuestSandbox, startGuestSession } =
            await import("@/features/guest-mode");

        startGuestSession();
        const sandbox = getGuestSandbox()!;
        const projectId = sandbox.projects[0]!.id;
        const otherProjectId = sandbox.projects[1]!.id;
        expect(otherProjectId).toBeDefined();

        const provider = resolveLabelsProvider(true);
        expect(provider).toBe(guestLabelsProvider);

        const created = await provider.createProjectLabel(
            projectId,
            "Guest Label",
            "blue"
        );
        expect(created).toMatchObject({
            color: "blue",
            name: "Guest Label",
            projectId,
        });

        await provider.updateProjectLabel(created.id, {
            name: "Guest Label Renamed",
        });
        await provider.updateProjectLabel(created.id, {
            color: "red",
            custom_color: null,
        });

        let listed = await provider.fetchProjectLabels(projectId);
        expect(listed.find((label) => label.id === created.id)).toMatchObject({
            color: "red",
            name: "Guest Label Renamed",
        });

        await provider.moveProjectLabel(created.id, otherProjectId!);
        listed = await provider.fetchProjectLabels(projectId);
        expect(listed.some((label) => label.id === created.id)).toBe(false);
        const movedList = await provider.fetchProjectLabels(otherProjectId!);
        expect(movedList.some((label) => label.id === created.id)).toBe(true);

        await provider.deleteProjectLabel(created.id);
        const afterDelete = await provider.fetchProjectLabels(otherProjectId!);
        expect(afterDelete.some((label) => label.id === created.id)).toBe(
            false
        );

        vi.resetModules();
        const refreshed = await import("@/features/guest-mode");
        const after = refreshed.getGuestSandbox()!;
        expect(after.labels.some((label) => label.id === created.id)).toBe(
            false
        );
    });
});
