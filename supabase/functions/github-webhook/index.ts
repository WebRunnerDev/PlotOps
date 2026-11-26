import { createClient } from "@supabase/supabase-js";

import type { Database } from "../_shared/database.types.ts";

import { parseAllowedOrigins } from "../_shared/cors.ts";
import { createWebhookHandler } from "./handler.ts";

// GitHub calls server-to-server; CORS only matters for stray browser calls.
Deno.serve(
    createWebhookHandler({
        cors: {
            allowedOrigins: parseAllowedOrigins(
                Deno.env.get("CORS_ALLOWED_ORIGINS")
            ),
            allowHeaders:
                "authorization, x-client-info, apikey, content-type, x-hub-signature-256, x-github-event, x-github-delivery",
        },
        createServiceClient: () => {
            const supabaseUrl = Deno.env.get("SUPABASE_URL");
            const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
            if (!supabaseUrl || !serviceRoleKey) return null;
            return createClient<Database>(supabaseUrl, serviceRoleKey, {
                auth: { autoRefreshToken: false, persistSession: false },
            });
        },
        webhookSecret: Deno.env.get("GITHUB_WEBHOOK_SECRET") ?? "",
    })
);
