// Deno Edge runtime resolves https imports; Node/eslint cannot.
// eslint-disable-next-line import-x/no-unresolved -- esm.sh URL for Deno deploy
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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
            return createClient(supabaseUrl, serviceRoleKey, {
                auth: { autoRefreshToken: false, persistSession: false },
            });
        },
        webhookSecret: Deno.env.get("GITHUB_WEBHOOK_SECRET") ?? "",
    })
);
