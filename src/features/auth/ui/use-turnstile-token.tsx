import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { type ReactNode, useCallback, useRef } from "react";

import { useTheme } from "@/app/model/theme";
import {
    isTurnstileConfigured,
    turnstileSiteKey,
} from "@/features/auth/lib/turnstile-config";

/** Resolves a fresh single-use token, or null when Turnstile is off / unsolved. */
export type TurnstileTokenGetter = () => Promise<null | string>;

const TOKEN_TIMEOUT_MS = 30_000;

/**
 * Turnstile for non-form actions (e.g. invite email sends): render `widget`
 * near the trigger and `await getToken()` right before each server call.
 * Tokens are single-use, so the widget re-solves after every take — loops
 * (bulk invites) simply await the next token.
 */
export function useTurnstileToken(action: string): {
    getToken: TurnstileTokenGetter;
    widget: ReactNode;
} {
    const { theme } = useTheme();
    const reference = useRef<TurnstileInstance>(undefined);

    const getToken = useCallback<TurnstileTokenGetter>(async () => {
        const instance = reference.current;
        if (!instance) return null;
        try {
            return await instance.getResponsePromise(TOKEN_TIMEOUT_MS);
        } catch {
            return null;
        } finally {
            instance.reset();
        }
    }, []);

    const widget = isTurnstileConfigured() ? (
        <div className="flex w-full min-w-0 justify-center [&_.cf-turnstile]:w-full">
            <Turnstile
                className="w-full"
                id={`turnstile-${action}`}
                options={{
                    action,
                    appearance: "interaction-only",
                    size: "flexible",
                    theme: theme === "dark" ? "dark" : "light",
                }}
                ref={reference}
                siteKey={turnstileSiteKey()}
            />
        </div>
    ) : null;

    return { getToken, widget };
}
