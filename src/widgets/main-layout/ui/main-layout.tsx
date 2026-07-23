import { Outlet, useRouterState } from "@tanstack/react-router";

import { cn } from "@/shared/lib/utils";
import { AppChrome } from "@/widgets/app-chrome";

export function MainLayoutWidget() {
    return <MainLayoutContent />;
}

function MainLayoutContent() {
    // Use settled location — pending navigations update `location` immediately while
    // home is still painted; flipping layout then strips max-w-5xl for ~1s (board fetch).
    const isBoard = useRouterState({
        select: (state) => {
            const path =
                state.resolvedLocation?.pathname ?? state.location.pathname;
            return path.startsWith("/projects/");
        },
    });

    return (
        <div
            className={cn(
                "w-full",
                isBoard ? "flex h-dvh flex-col overflow-hidden" : "min-h-dvh"
            )}
        >
            <AppChrome />
            {isBoard ? (
                <div className="min-h-0 flex-1 overflow-hidden">
                    <Outlet />
                </div>
            ) : (
                <div className="mx-auto w-full max-w-5xl p-4">
                    <Outlet />
                </div>
            )}
        </div>
    );
}
