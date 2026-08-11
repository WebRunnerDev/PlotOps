import type { QueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

import type { AuthContextValue } from "@/features/auth/model/types";

import { cn } from "@/shared";
import { GridPattern } from "@/shared/shadcn";
import { NotFoundPage } from "@/widgets/not-found";

export type RouterContext = {
    auth: Pick<AuthContextValue, "isLoading" | "profileNamesComplete" | "user">;
    queryClient: QueryClient;
};

function RootChrome({ children }: { children: ReactNode }) {
    return (
        <>
            <main className="min-h-screen">
                <div className="min-h-screen [view-transition-name:main-content]">
                    {children}
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

function RootLayout() {
    return (
        <RootChrome>
            <Outlet />
        </RootChrome>
    );
}

function RootNotFound() {
    return (
        <RootChrome>
            <NotFoundPage />
        </RootChrome>
    );
}

export const Route = createRootRouteWithContext<RouterContext>()({
    component: RootLayout,
    notFoundComponent: RootNotFound,
});
