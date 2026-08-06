import type { BoardsProvider } from "@/features/boards/api/boards-provider";

import { guestBoardsProvider } from "@/features/boards/api/guest-boards";
import { supabaseBoardsProvider } from "@/features/boards/api/supabase-boards";

/**
 * Pick the Boards provider for the current session.
 * Guest demos use the local sandbox — no Supabase Auth/Postgres/Realtime.
 */
export function resolveBoardsProvider(isGuest: boolean): BoardsProvider {
    return isGuest ? guestBoardsProvider : supabaseBoardsProvider;
}
