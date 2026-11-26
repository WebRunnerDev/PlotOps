import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../../../src/shared/api/database.types.ts";
import type { McpEnv as McpEnvironment } from "./env.ts";

/**
 * The caller's Supabase client, typed by the generated schema, so a renamed
 * column or RPC argument fails `npm run typecheck` instead of failing in prod.
 */
export type UserSupabase = SupabaseClient<Database>;

export function createUserClient(
    environment: McpEnvironment,
    accessToken: string
): UserSupabase {
    return createClient<Database>(
        environment.SUPABASE_URL,
        environment.SUPABASE_PUBLISHABLE_KEY,
        {
            auth: {
                autoRefreshToken: false,
                detectSessionInUrl: false,
                persistSession: false,
            },
            global: {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            },
        }
    );
}
