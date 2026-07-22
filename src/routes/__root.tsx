import type { QueryClient } from "@tanstack/react-query";

import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

import type { AuthContextValue } from "@/features/auth/model/types";

import { cn } from "@/shared";
import { GridPattern } from "@/shared/shadcn";

export type RouterContext = {
    auth: Pick<AuthContextValue, "isLoading" | "user">;
    queryClient: QueryClient;
};

function RootLayout() {
    return (
        <>
            <main className="min-h-screen">
                <div className="min-h-screen [view-transition-name:main-content]">
                    <Outlet />
                </div>
                <GridPattern
                    className={cn(
                        "stroke-grid/40 -z-50 [view-transition-name:page-backdrop]",
                        "mask-[radial-gradient(ellipse_at_center,white,transparent_80%)]"
                    )}
                    height={32}
                    width={32}
                    x={-1}
                    y={-1}
                />
            </main>
            <TanStackRouterDevtools />
        </>
    );
}

export const Route = createRootRouteWithContext<RouterContext>()({
    component: RootLayout,
});
