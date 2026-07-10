import { createFileRoute, redirect } from "@tanstack/react-router";

import { ProjectsPage } from "@/features/projects";

export const Route = createFileRoute("/(main)/home")({
    beforeLoad: ({ context }) => {
        if (!context.auth.user) {
            throw redirect({ to: "/sign-in" });
        }
    },
    component: ProjectsPage,
});
