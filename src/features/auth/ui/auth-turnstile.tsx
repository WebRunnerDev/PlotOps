import { Turnstile } from "@marsidev/react-turnstile";

import { useTheme } from "@/app/model/theme";
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
    const { theme } = useTheme();

    if (!isTurnstileConfigured()) {
        return null;
    }

    return (
        <div className="flex w-full min-w-0 justify-center [&_.cf-turnstile]:w-full">
            <Turnstile
                key={resetKey}
                className="w-full"
                id={`turnstile-${action}`}
                onError={() => onTokenChange(null)}
                onExpire={() => onTokenChange(null)}
                onSuccess={onTokenChange}
                options={{
                    action,
                    appearance: "interaction-only",
                    size: "flexible",
                    theme: theme === "dark" ? "dark" : "light",
                }}
                siteKey={turnstileSiteKey()}
            />
        </div>
    );
}

export function requiresTurnstileToken(): boolean {
    return isTurnstileConfigured();
}
