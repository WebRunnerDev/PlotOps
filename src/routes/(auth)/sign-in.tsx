import { createFileRoute, redirect } from "@tanstack/react-router";

import { LoginForm, requireAuthSession } from "@/features/auth";
import {
    GUEST_DEMO_BOARD_ID,
    GUEST_DEMO_PROJECT_ID,
    isGuest,
} from "@/features/guest-mode";
import { supabase } from "@/shared/api/supabase";
import { AuthPageShell } from "@/widgets/auth-page-shell";

export const Route = createFileRoute("/(auth)/sign-in")({
    beforeLoad: async ({ context }) => {
        // Stale React `auth.user` after local sign-out must not bounce back to
        // /home — confirm a live Auth session before leaving sign-in.
        if (context.auth.user) {
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
            if (gate === "ok") {
                throw redirect({ to: "/home" });
            }
        }
        if (isGuest()) {
            throw redirect({
                params: {
                    boardId: GUEST_DEMO_BOARD_ID,
                    projectId: GUEST_DEMO_PROJECT_ID,
                },
                to: "/projects/$projectId/boards/$boardId",
            });
        }
    },
    component: SignInPage,
});

function SignInPage() {
    return (
        <AuthPageShell>
            <LoginForm />
        </AuthPageShell>
    );
}
