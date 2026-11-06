/**
 * Task key matching lives with the Edge Functions so the drawer and the
 * webhook / backfill never disagree on what counts as a key (ADR 0035).
 */
export {
    extractTaskKeysFromText,
    textReferencesTaskKey,
} from "../../../../supabase/functions/_shared/task-key.ts";
