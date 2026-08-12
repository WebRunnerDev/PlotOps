// Deno Edge runtime resolves https imports; Node/eslint cannot.
// eslint-disable-next-line import-x/no-unresolved -- esm.sh URL for Deno deploy
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

import {
    buildInviteEmailHtml,
    buildInviteEmailText,
    buildInviteRedeemUrl,
    resolveInviteAppOrigin,
    resolveMailDelivery,
} from "./invite-email.ts";
import { sendResendEmail } from "./resend.ts";

const corsHeaders = {
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Origin": "*",
};

type InviteRow = {
    email: null | string;
    kind: string;
    role: string;
    status: string;
    team_id: string;
    teams: null | { name: string } | { name: string }[];
    token: string;
};

Deno.serve(async (request) => {
    if (request.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    if (request.method !== "POST") {
        return json({ error: "method_not_allowed" }, 405);
    }

    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
        return json({ error: "unauthorized" }, 401);
    }

    let body: { inviteId?: unknown };
    try {
        body = (await request.json()) as typeof body;
    } catch {
        return json({ error: "invalid_json" }, 400);
    }

    const inviteId =
        typeof body.inviteId === "string" ? body.inviteId.trim() : "";
    if (!inviteId) {
        return json({ error: "invite_id_required" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !anonKey) {
        console.error(JSON.stringify({ reason: "missing_supabase_env" }));
        return json({ error: "server_misconfigured" }, 500);
    }

    const supabase = createClient(supabaseUrl, anonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { headers: { Authorization: authHeader } },
    });

    const {
        data: { user },
        error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
        return json({ error: "unauthorized" }, 401);
    }

    const { data: invite, error: inviteError } = await supabase
        .from("team_invites")
        .select("email, kind, role, status, team_id, token, teams(name)")
        .eq("id", inviteId)
        .maybeSingle();

    if (inviteError) {
        console.error(
            JSON.stringify({
                error: inviteError.message,
                inviteId,
                reason: "invite_load_failed",
            })
        );
        return json({ error: "invite_load_failed" }, 500);
    }

    if (!invite) {
        return json({ error: "invite_not_found" }, 404);
    }

    const row = invite as InviteRow;

    if (row.kind !== "email") {
        return json({ error: "not_email_invite", skipped: true }, 400);
    }

    if (row.status !== "pending") {
        return json({ error: "invite_not_pending" }, 400);
    }

    if (!row.email?.trim() || !row.token) {
        return json({ error: "invite_incomplete" }, 400);
    }

    const delivery = resolveMailDelivery({
        fromEmail: Deno.env.get("INVITE_FROM_EMAIL"),
        resendApiKey: Deno.env.get("RESEND_API_KEY"),
    });

    const toEmail = row.email.trim();

    if (!delivery.send) {
        // Never log inviteUrl/token — Edge Function logs may leave the request path.
        console.log(
            JSON.stringify({
                inviteId,
                reason: delivery.reason,
                skipped: true,
                to: toEmail,
                userId: user.id,
            })
        );
        return json({
            ok: true,
            reason: delivery.reason,
            skipped: true,
        });
    }

    const origin = resolveInviteAppOrigin(Deno.env.get("INVITE_APP_ORIGIN"));
    const inviteUrl = origin ? buildInviteRedeemUrl(origin, row.token) : null;
    if (!origin || !inviteUrl) {
        return json({ error: "origin_required" }, 400);
    }

    const teamName = teamNameFrom(row.teams) ?? "a team";
    const fields = {
        email: toEmail,
        inviteUrl,
        role: row.role,
        teamName,
    };

    const resendKey = Deno.env.get("RESEND_API_KEY")!.trim();
    const result = await sendResendEmail(resendKey, {
        from: delivery.fromEmail,
        html: buildInviteEmailHtml(fields),
        subject: `Join ${teamName} on PlotOps`,
        text: buildInviteEmailText(fields),
        to: [toEmail],
    });

    if (!result.ok) {
        console.error(
            JSON.stringify({
                error: result.error,
                inviteId,
                reason: "resend_failed",
                status: result.status,
            })
        );
        return json({ error: "send_failed" }, 502);
    }

    console.log(
        JSON.stringify({
            emailId: result.id,
            inviteId,
            ok: true,
            to: fields.email,
            userId: user.id,
        })
    );

    return json({ emailId: result.id, ok: true });
});

function json(body: unknown, status = 200): Response {
    return Response.json(body, {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status,
    });
}

function teamNameFrom(
    value: null | undefined | { name: string } | { name: string }[]
): null | string {
    if (!value) return null;
    const row = Array.isArray(value) ? value[0] : value;
    const name = row?.name?.trim();
    return name && name.length > 0 ? name : null;
}
