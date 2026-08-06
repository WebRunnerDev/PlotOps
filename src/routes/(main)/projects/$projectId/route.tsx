import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { hasMainAppAccess } from "@/features/guest-mode";

export const Route = createFileRoute("/(main)/projects/$projectId")({
    beforeLoad: ({ context }) => {
        if (!hasMainAppAccess(Boolean(context.auth.user))) {
            throw redirect({ to: "/sign-in" });
        }
    },
    component: ProjectLayout,
});

function ProjectLayout() {
    return (
        <div className="h-full min-h-0">
            <Outlet />
        </div>
    );
}
