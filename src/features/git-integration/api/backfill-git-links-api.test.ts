import { describe, expect, it, vi } from "vitest";

vi.mock("@/shared/api/supabase", () => ({ supabase: {} }));

const { parseBackfillGitLinks } = await import("./backfill-git-links-api");

describe("parseBackfillGitLinks", () => {
    it("reads linked count and Repositories GitHub could not be read for", () => {
        expect(
            parseBackfillGitLinks({
                configured: true,
                linked: 3,
                repositories: [
                    { id: "a", status: "synced" },
                    { id: "b", status: "not_installed" },
                    { id: "c", status: "unavailable" },
                ],
            })
        ).toEqual({ configured: true, linked: 3, unavailable: 2 });
    });

    it("treats a malformed body as nothing linked", () => {
        expect(parseBackfillGitLinks(null)).toEqual({
            configured: false,
            linked: 0,
            unavailable: 0,
        });
        expect(
            parseBackfillGitLinks({ linked: -1, repositories: "x" })
        ).toMatchObject({ linked: 0, unavailable: 0 });
    });
});
