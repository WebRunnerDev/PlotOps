import { describe, expect, it } from "vitest";

import { resolveNotificationActor } from "./resolve-notification-actor";

describe("resolveNotificationActor", () => {
    it("uses the stored Actor's profile name and avatar", () => {
        expect(
            resolveNotificationActor({
                actorId: "u1",
                metadata: {},
                profile: {
                    avatarUrl: "https://example.test/a.png",
                    firstName: "Ada",
                    lastName: "Lovelace",
                    username: "ada",
                },
            })
        ).toEqual({
            avatarUrl: "https://example.test/a.png",
            id: "u1",
            kind: "user",
            name: "Ada Lovelace",
        });
    });

    it("falls back to the username when names are empty", () => {
        expect(
            resolveNotificationActor({
                actorId: "u1",
                metadata: {},
                profile: { username: "ada" },
            })
        ).toMatchObject({ kind: "user", name: "ada" });
    });

    it("keeps the Actor with an empty name when the profile is not visible", () => {
        expect(
            resolveNotificationActor({ actorId: "u1", metadata: {} })
        ).toEqual({ avatarUrl: null, id: "u1", kind: "user", name: "" });
    });

    it("uses the Mention metadata snapshot when the profile is not visible", () => {
        expect(
            resolveNotificationActor({
                actorId: "u1",
                metadata: {
                    actor: { id: "u1", name: "Sam" },
                    source: "comment",
                },
            })
        ).toMatchObject({ id: "u1", name: "Sam" });
    });

    it("reads the metadata snapshot when no Actor id is stored", () => {
        expect(
            resolveNotificationActor({
                metadata: { actor: { id: "u2", name: " Demo Guest " } },
            })
        ).toEqual({
            avatarUrl: null,
            id: "u2",
            kind: "user",
            name: "Demo Guest",
        });
    });

    it("attributes webhook rows to GitHub", () => {
        expect(
            resolveNotificationActor({
                metadata: { source: "github_webhook" },
            })
        ).toEqual({ kind: "github" });
    });

    it("returns null when nothing identifies the Actor", () => {
        expect(resolveNotificationActor({ metadata: {} })).toBeNull();
    });
});
