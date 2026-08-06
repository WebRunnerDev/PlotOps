import { createFileRoute, redirect } from "@tanstack/react-router";

import {
    GUEST_DEMO_BOARD_ID,
    GUEST_DEMO_PROJECT_ID,
    isGuest,
} from "@/features/guest-mode";

export const Route = createFileRoute("/")({
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
        throw redirect({ to: "/sign-in" });
    },
});
