import { createFileRoute, redirect } from "@tanstack/react-router";

import { LoginForm } from "@/features/auth";
import {
    GUEST_DEMO_BOARD_ID,
    GUEST_DEMO_PROJECT_ID,
    isGuest,
} from "@/features/guest-mode";
import { AuthPageShell } from "@/widgets/auth-page-shell";

export const Route = createFileRoute("/(auth)/sign-in")({
    beforeLoad: ({ context }) => {
        if (context.auth.user) {
            throw redirect({ to: "/home" });
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
