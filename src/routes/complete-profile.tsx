import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import {
    CompleteProfileForm,
    isProfileGateRequired,
    useAuth,
} from "@/features/auth";
import { isGuest } from "@/features/guest-mode";
import { AuthPageShell } from "@/widgets/auth-page-shell";

type CompleteProfileSearch = {
    redirect?: string;
};

export const Route = createFileRoute("/complete-profile")({
    beforeLoad: ({ context }) => {
        // Guest Sessions have no Supabase user — ADR 0015 gate does not apply.
        if (isGuest() && !context.auth.user) {
            throw redirect({ to: "/home" });
        }
        if (!context.auth.user) {
            throw redirect({ to: "/sign-in" });
        }
        if (
            !isProfileGateRequired({
                isGuest: isGuest(),
                profileNamesComplete: context.auth.profileNamesComplete,
            })
        ) {
            throw redirect({ to: "/home" });
        }
    },
    component: CompleteProfilePage,
    validateSearch: (
        search: Record<string, unknown>
    ): CompleteProfileSearch => ({
        redirect:
            typeof search.redirect === "string" ? search.redirect : undefined,
    }),
});

function CompleteProfilePage() {
    const { redirect: redirectTo } = Route.useSearch();
    const navigate = useNavigate();
    const { profileNamesComplete, user } = useAuth();

    // beforeLoad does not re-run when Auth context flips after a late profile
    // fetch — leave the gate as soon as names are known to be complete.
    useEffect(() => {
        if (!user) return;
        if (
            isProfileGateRequired({
                isGuest: isGuest(),
                profileNamesComplete,
            })
        ) {
            return;
        }
        const nextPath =
            redirectTo?.startsWith("/") && !redirectTo.startsWith("//")
                ? redirectTo
                : "/home";
        if (nextPath.startsWith("/invite/")) {
            const token = nextPath.slice("/invite/".length);
            void navigate({ params: { token }, to: "/invite/$token" });
            return;
        }
        void navigate({ to: nextPath });
    }, [navigate, profileNamesComplete, redirectTo, user]);

    return (
        <AuthPageShell>
            <CompleteProfileForm redirectTo={redirectTo} />
        </AuthPageShell>
    );
}
