import { describe, expect, it } from "vitest";

import { guestBoardsProvider } from "@/features/boards/api/guest-boards";
import { resolveBoardsProvider } from "@/features/boards/api/resolve-boards-provider";
import { supabaseBoardsProvider } from "@/features/boards/api/supabase-boards";

describe("resolveBoardsProvider", () => {
    it("routes guest sessions through the local sandbox boards provider", () => {
        expect(resolveBoardsProvider(true)).toBe(guestBoardsProvider);
    });

    it("routes signed-in non-guest sessions through Supabase boards", () => {
        expect(resolveBoardsProvider(false)).toBe(supabaseBoardsProvider);
    });
});
