import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

import { requireAuthSession } from "@/features/auth";
import { isGuest } from "@/features/guest-mode";
import { supabase } from "@/shared/api/supabase";

/**
 * Re-check Auth on every settled location under main chrome.
 * Parent `beforeLoad` alone is not enough — sibling navigations often reuse
 * the layout match without re-running it, so a dead JWT left the shell up.
 */
export function AuthSessionGuard() {
    const navigate = useNavigate();
    const pathname = useRouterState({
        select: (state) =>
            state.resolvedLocation?.pathname ?? state.location.pathname,
    });
    const generationReference = useRef(0);

    useEffect(() => {
        if (isGuest()) {
            return;
        }

        const generation = ++generationReference.current;
        const abort = new AbortController();

        void (async () => {
            const gate = await requireAuthSession({
                getUser: async () => {
                    const { data, error } = await supabase.auth.getUser();
                    return { error, user: data.user };
                },
                isGuest: false,
                signOutLocal: async () => {
                    await supabase.auth.signOut({ scope: "local" });
                },
            });

            if (abort.signal.aborted) return;
            if (generation !== generationReference.current) return;
            if (gate !== "redirect-sign-in") return;

            await navigate({ replace: true, to: "/sign-in" });
        })();

        return () => {
            abort.abort();
        };
    }, [navigate, pathname]);

    return null;
}
