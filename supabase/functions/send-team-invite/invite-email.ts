export type InviteEmailFields = {
    email: string;
    inviteUrl: string;
    role: string;
    teamName: string;
};

export type MailDelivery =
    | {
          fromEmail: null;
          reason: "missing_from_email" | "missing_resend_secret";
          send: false;
      }
    | { fromEmail: string; reason: null; send: true };

export function buildInviteEmailHtml(fields: InviteEmailFields): string {
    const { email, inviteUrl, role, teamName } = fields;
    return `<!DOCTYPE html>
<html>
<body>
  <p>You&apos;ve been invited to join <strong>${escapeHtml(teamName)}</strong> on PlotOps as <strong>${escapeHtml(role)}</strong>.</p>
  <p>This invite is for <strong>${escapeHtml(email)}</strong>.</p>
  <p><a href="${escapeAttribute(inviteUrl)}">Accept invite</a></p>
  <p>Or open this link:<br/>${escapeHtml(inviteUrl)}</p>
</body>
</html>`;
}

export function buildInviteEmailText(fields: InviteEmailFields): string {
    const { email, inviteUrl, role, teamName } = fields;
    return [
        `You've been invited to join ${teamName} on PlotOps as ${role}.`,
        `This invite is for ${email}.`,
        `Accept: ${inviteUrl}`,
    ].join("\n");
}

export function buildInviteRedeemUrl(origin: string, token: string): string {
    return `${origin.replace(/\/+$/, "")}/invite/${token}`;
}

/**
 * Canonical app origin for invite redeem links in outbound email.
 * Only `INVITE_APP_ORIGIN` is trusted — never request Origin / body / headers
 * (those are caller-controlled and enable phishing links with invite tokens).
 */
export function resolveInviteAppOrigin(
    inviteAppOrigin: null | string | undefined
): null | string {
    return normalizeOrigin(inviteAppOrigin);
}

export function resolveMailDelivery(input: {
    fromEmail: null | string | undefined;
    resendApiKey: null | string | undefined;
}): MailDelivery {
    const key = input.resendApiKey?.trim() ?? "";
    if (!key) {
        return {
            fromEmail: null,
            reason: "missing_resend_secret",
            send: false,
        };
    }
    const fromEmail = input.fromEmail?.trim() ?? "";
    if (!fromEmail) {
        return {
            fromEmail: null,
            reason: "missing_from_email",
            send: false,
        };
    }
    return { fromEmail, reason: null, send: true };
}

function escapeAttribute(value: string): string {
    return escapeHtml(value).replaceAll("'", "&#39;");
}

function escapeHtml(value: string): string {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
}

function normalizeOrigin(value: null | string | undefined): null | string {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    try {
        const url = new URL(trimmed);
        if (url.protocol !== "http:" && url.protocol !== "https:") {
            return null;
        }
        return url.origin;
    } catch {
        return null;
    }
}
