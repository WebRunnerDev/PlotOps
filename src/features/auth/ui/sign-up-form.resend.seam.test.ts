import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

function readForm() {
    return readFileSync(path.join(dirname, "sign-up-form.tsx"), "utf8");
}

describe("SignUpForm captcha resend", () => {
    it("refreshes Turnstile after a consumed signup token", () => {
        const source = readForm();
        const signup = source.slice(
            source.indexOf(
                "const { data, error: authError } = await signUpWithPassword"
            ),
            source.indexOf("keepLoadingForRedirect = true")
        );

        expect(signup).toMatch(
            /identities\?\.length[\s\S]*resetTurnstile\(\)[\s\S]*userAlreadyRegistered/
        );
        expect(signup).toMatch(
            /resetTurnstile\(\);\s*setAwaitingConfirmation\(true\)/
        );
    });

    it("sends a fresh captcha token from the check-email screen", () => {
        const source = readForm();
        const resend = source.slice(
            source.indexOf("const handleResend"),
            source.indexOf("if (awaitingConfirmation)")
        );
        const confirmation = source.slice(
            source.indexOf("if (awaitingConfirmation)"),
            source.indexOf('description={t("signUpSubtitle")}')
        );

        expect(resend).toMatch(
            /resendSignupConfirmation\(\s*email,\s*captchaToken \? \{ captchaToken \} : undefined\s*\)/
        );
        expect(resend).toMatch(/resetTurnstile\(\);\s*setResendMessage/);
        expect(confirmation).toMatch(/<AuthTurnstile/);
        expect(confirmation).toMatch(/action="signup"/);
        expect(confirmation).toMatch(
            /disabled=\{isResending \|\| isRateLimited \|\| !captchaReady\}/
        );
    });
});
