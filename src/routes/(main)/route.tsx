import { createFileRoute, redirect } from "@tanstack/react-router";

import { MainLayoutWidget } from "@/widgets/main-layout/ui/main-layout";

export const Route = createFileRoute("/(main)")({
    beforeLoad: ({ context, location }) => {
        if (!context.auth.user) {
            throw redirect({ to: "/sign-in" });
        }

        if (!context.auth.profileNamesComplete) {
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
