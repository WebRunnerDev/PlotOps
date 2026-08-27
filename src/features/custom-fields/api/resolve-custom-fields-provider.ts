import type { CustomFieldsProvider } from "@/features/custom-fields/api/custom-fields-provider";

import { guestCustomFieldsProvider } from "@/features/custom-fields/api/guest-custom-fields";
import { supabaseCustomFieldsProvider } from "@/features/custom-fields/api/supabase-custom-fields";

/**
 * Pick the custom fields provider for the current session.
 * Guest demos use the local sandbox — no Supabase Auth/Postgres/Realtime.
 */
export function resolveCustomFieldsProvider(
    isGuest: boolean
): CustomFieldsProvider {
    return isGuest ? guestCustomFieldsProvider : supabaseCustomFieldsProvider;
}
