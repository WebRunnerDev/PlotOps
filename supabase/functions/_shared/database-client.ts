import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "./database.types.ts";

/**
 * A Supabase client typed by the generated schema. A migration that renames a
 * column or an RPC argument then fails `deno check` in CI instead of failing
 * in the deployed function.
 */
export type DatabaseClient = SupabaseClient<Database>;
