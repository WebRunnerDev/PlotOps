export type ResendEmailPayload = {
    from: string;
    html: string;
    subject: string;
    text: string;
    to: string[];
};

export type ResendSendResult =
    { error: string; ok: false; status: number } | { id: string; ok: true };

/**
 * Send one email via Resend HTTP API.
 * Inject `fetch` for tests; Deno Edge uses global fetch.
 */
export async function sendResendEmail(
    apiKey: string,
    payload: ResendEmailPayload,
    fetchImpl: typeof fetch = fetch
): Promise<ResendSendResult> {
    const response = await fetchImpl("https://api.resend.com/emails", {
        body: JSON.stringify(payload),
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        },
        method: "POST",
    });

    if (!response.ok) {
        const body = await response.text();
        return {
            error: body || response.statusText || "resend_failed",
            ok: false,
            status: response.status,
        };
    }

    let id = "";
    try {
        const json = (await response.json()) as { id?: string };
        id = json.id ?? "";
    } catch {
        id = "";
    }

    return { id, ok: true };
}
