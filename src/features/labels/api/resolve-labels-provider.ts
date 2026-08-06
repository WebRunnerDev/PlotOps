import type { LabelsProvider } from "@/features/labels/api/labels-provider";

import { guestLabelsProvider } from "@/features/labels/api/guest-labels";
import { supabaseLabelsProvider } from "@/features/labels/api/supabase-labels";

/**
 * Pick the Labels provider for the current session.
 * Guest demos use the local sandbox — no Supabase Auth/Postgres/Realtime.
 */
export function resolveLabelsProvider(isGuest: boolean): LabelsProvider {
    return isGuest ? guestLabelsProvider : supabaseLabelsProvider;
}
