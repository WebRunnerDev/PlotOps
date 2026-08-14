import { createFileRoute, redirect } from "@tanstack/react-router";

import { isProfileGateRequired, requireAuthSession } from "@/features/auth";
import { hasMainAppAccess, isGuest } from "@/features/guest-mode";
import { supabase } from "@/shared/api/supabase";
import { MainLayoutWidget } from "@/widgets/main-layout/ui/main-layout";

export const Route = createFileRoute("/(main)")({
    beforeLoad: async ({ context, location }) => {
        const guest = isGuest();

        if (!hasMainAppAccess(Boolean(context.auth.user))) {
            throw redirect({ to: "/sign-in" });
        }

        // React `auth.user` alone is not enough — a dead/missing JWT still
        // leaves chrome mounted while queries return empty/401.
        const authGate = await requireAuthSession({
            getUser: async () => {
                const { data, error } = await supabase.auth.getUser();
                return { error, user: data.user };
            },
            isGuest: guest,
            signOutLocal: async () => {
                await supabase.auth.signOut({ scope: "local" });
            },
        });
        if (authGate === "redirect-sign-in") {
            throw redirect({ to: "/sign-in" });
        }

        if (
            context.auth.user &&
            isProfileGateRequired({
                isGuest: guest,
                profileNamesComplete: context.auth.profileNamesComplete,
            })
        ) {
            throw redirect({
                search: {
                    redirect: `${location.pathname}${location.searchStr}`,
                },
                to: "/complete-profile",
            });
        }
    },
    component: RouteComponent,
});

function RouteComponent() {
    return <MainLayoutWidget />;
}
