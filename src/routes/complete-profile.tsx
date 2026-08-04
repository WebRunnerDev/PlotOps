import { createFileRoute, redirect } from "@tanstack/react-router";

import {
    CompleteProfileForm,
    isGuestSession,
    isProfileGateRequired,
} from "@/features/auth";

type CompleteProfileSearch = {
    redirect?: string;
};

export const Route = createFileRoute("/complete-profile")({
    beforeLoad: ({ context }) => {
        if (!context.auth.user) {
            throw redirect({ to: "/sign-in" });
        }
        if (
            !isProfileGateRequired({
                isGuest: isGuestSession(context.auth.user),
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

    return (
        <div className="flex min-h-[60vh] items-center justify-center px-4">
            <CompleteProfileForm redirectTo={redirectTo} />
        </div>
    );
}
