import { describe, expect, it, vi } from "vitest";

import { sendResendEmail } from "./resend";

describe("sendResendEmail", () => {
    it("POSTs to Resend with Bearer auth and returns id on success", async () => {
        const fetchImpl = vi.fn(async () =>
            Response.json({ id: "email_123" }, { status: 200 })
        );

        const result = await sendResendEmail(
            "re_test",
            {
                from: "invites@plotops.app",
                html: "<p>hi</p>",
                subject: "Invite",
                text: "hi",
                to: ["dev@example.com"],
            },
            fetchImpl as unknown as typeof fetch
        );

        expect(result).toEqual({ id: "email_123", ok: true });
        expect(fetchImpl).toHaveBeenCalledWith(
            "https://api.resend.com/emails",
            expect.objectContaining({
                headers: expect.objectContaining({
                    Authorization: "Bearer re_test",
                }),
                method: "POST",
            })
        );
    });

    it("returns ok:false with status when Resend errors", async () => {
        const fetchImpl = vi.fn(
            async () => new Response("rate limited", { status: 429 })
        );

        const result = await sendResendEmail(
            "re_test",
            {
                from: "invites@plotops.app",
                html: "<p>hi</p>",
                subject: "Invite",
                text: "hi",
                to: ["dev@example.com"],
            },
            fetchImpl as unknown as typeof fetch
        );

        expect(result).toEqual({
            error: "rate limited",
            ok: false,
            status: 429,
        });
    });
});
