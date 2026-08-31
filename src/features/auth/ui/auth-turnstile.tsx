import { Turnstile } from "@marsidev/react-turnstile";

import {
    isTurnstileConfigured,
    turnstileSiteKey,
} from "@/features/auth/lib/turnstile-config";

type AuthTurnstileProperties = {
    action: "login" | "signup";
    onTokenChange: (token: null | string) => void;
    /** Increment to force a fresh widget (e.g. after failed submit). */
    resetKey?: number;
};

export function AuthTurnstile({
    action,
    onTokenChange,
    resetKey = 0,
}: AuthTurnstileProperties) {
    if (!isTurnstileConfigured()) {
        return null;
    }

    return (
        <Turnstile
            key={resetKey}
            onError={() => onTokenChange(null)}
            onExpire={() => onTokenChange(null)}
            onSuccess={onTokenChange}
            options={{ action }}
            siteKey={turnstileSiteKey()}
        />
    );
}

export function requiresTurnstileToken(): boolean {
    return isTurnstileConfigured();
}
