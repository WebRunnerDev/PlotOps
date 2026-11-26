import { createClient } from "@supabase/supabase-js";

import type { Database } from "../_shared/database.types.ts";

import { parseAllowedOrigins } from "../_shared/cors.ts";
import { createPostgresRateLimiter } from "../_shared/postgres-rate-limit.ts";
import { createGithubBackfillHandler } from "./handler.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

// Service role writes Git links like the webhook does; the caller's rights
// and Repository reads go through the RLS-scoped user client.
const adminClient =
    supabaseUrl && serviceRoleKey
        ? createClient<Database>(supabaseUrl, serviceRoleKey, {
              auth: { autoRefreshToken: false, persistSession: false },
          })
        : null;

Deno.serve(
    createGithubBackfillHandler({
        cors: {
            allowedOrigins: parseAllowedOrigins(
                Deno.env.get("CORS_ALLOWED_ORIGINS")
            ),
            allowHeaders: "authorization, x-client-info, apikey, content-type",
        },
        createServiceClient: () => adminClient,
        createUserClient: (authHeader) => {
            if (!supabaseUrl || !anonKey) return null;
            return createClient<Database>(supabaseUrl, anonKey, {
                auth: { autoRefreshToken: false, persistSession: false },
                global: { headers: { Authorization: authHeader } },
            });
        },
        env: (name) => Deno.env.get(name),
        rateLimiter: createPostgresRateLimiter(
            adminClient
                ? (name, parameters) => adminClient.rpc(name, parameters)
                : null
        ),
    })
);
