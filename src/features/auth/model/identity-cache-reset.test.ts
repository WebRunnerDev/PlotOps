import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { createIdentityCacheReset } from "./identity-cache-reset";

const PROJECTS_KEY = ["projects", "list"] as const;

function setup() {
    const queryClient = new QueryClient();
    let guest = false;
    const reset = createIdentityCacheReset({
        isGuest: () => guest,
        queryClient,
    });
    return {
        hasCachedProjects: () =>
            queryClient.getQueryData(PROJECTS_KEY) !== undefined,
        reset,
        seedProjects: (owner: string) => {
            queryClient.setQueryData(PROJECTS_KEY, [{ owner }]);
        },
        setGuest: (value: boolean) => {
            guest = value;
        },
    };
}

describe("createIdentityCacheReset", () => {
    it("keeps the cache when boot restores a user (first sync only records)", () => {
        const { hasCachedProjects, reset, seedProjects } = setup();
        seedProjects("A");

        reset.sync("user-a");

        expect(hasCachedProjects()).toBe(true);
    });

    it("keeps the cache on token refresh (same user id again)", () => {
        const { hasCachedProjects, reset, seedProjects } = setup();
        reset.sync("user-a");
        seedProjects("A");

        reset.sync("user-a");
        reset.sync("user-a");

        expect(hasCachedProjects()).toBe(true);
    });

    it("clears when the user signs out", () => {
        const { hasCachedProjects, reset, seedProjects } = setup();
        reset.sync("user-a");
        seedProjects("A");

        reset.sync(null);

        expect(hasCachedProjects()).toBe(false);
    });

    it("clears when another user signs in (A → B)", () => {
        const { hasCachedProjects, reset, seedProjects } = setup();
        reset.sync("user-a");
        seedProjects("A");

        reset.sync("user-b");

        expect(hasCachedProjects()).toBe(false);
    });

    it("clears when a user signs in after a signed-out boot", () => {
        const { hasCachedProjects, reset, seedProjects } = setup();
        reset.sync(null);
        seedProjects("anon");

        reset.sync("user-a");

        expect(hasCachedProjects()).toBe(false);
    });

    it("clears when a Guest signs in to an account (guest → A)", () => {
        const { hasCachedProjects, reset, seedProjects, setGuest } = setup();
        setGuest(true);
        reset.sync(null);
        seedProjects("guest");

        // AuthProvider leaves the Guest Session before applying the user.
        setGuest(false);
        reset.sync("user-a");

        expect(hasCachedProjects()).toBe(false);
    });

    it("treats a user as the identity even while a stale Guest flag remains", () => {
        const { hasCachedProjects, reset, seedProjects, setGuest } = setup();
        setGuest(true);
        reset.sync(null);
        seedProjects("guest");

        reset.sync("user-a");
        expect(hasCachedProjects()).toBe(false);

        seedProjects("A");
        setGuest(false);
        reset.sync("user-a");
        expect(hasCachedProjects()).toBe(true);
    });

    it("clears when an account holder starts the demo (A → guest)", () => {
        const { hasCachedProjects, reset, seedProjects, setGuest } = setup();
        reset.sync("user-a");
        seedProjects("A");

        reset.sync(null);
        seedProjects("anon");
        setGuest(true);
        reset.sync(null);

        expect(hasCachedProjects()).toBe(false);
    });

    it("keeps the Guest cache on sandbox writes, clears on Leave demo", () => {
        const { hasCachedProjects, reset, seedProjects, setGuest } = setup();
        setGuest(true);
        reset.sync(null);
        seedProjects("guest");

        reset.sync(null);
        expect(hasCachedProjects()).toBe(true);

        setGuest(false);
        reset.sync(null);
        expect(hasCachedProjects()).toBe(false);
    });

    it("clears only once per change when several sources report it", () => {
        const { hasCachedProjects, reset, seedProjects } = setup();
        reset.sync("user-a");
        seedProjects("A");

        // signOut() and the SIGNED_OUT event both report the change.
        reset.sync(null);
        seedProjects("anon");
        reset.sync(null);

        expect(hasCachedProjects()).toBe(true);
    });
});
