import { Outlet, useRouterState } from "@tanstack/react-router";

import { CommandPalette } from "@/features/command-palette";
import { cn } from "@/shared/lib/utils";
import { AppChrome } from "@/widgets/app-chrome";

export function MainLayoutWidget() {
    return <MainLayoutContent />;
}

function MainLayoutContent() {
    // Use settled location — pending navigations update `location` immediately while
    // home is still painted; flipping layout then strips max-w-5xl for ~1s (board fetch).
    const layoutMode = useRouterState({
        select: (state) => {
            const path =
                state.resolvedLocation?.pathname ?? state.location.pathname;
            // Kanban board only — not backlog / settings / ci-cd / other project pages.
            if (/^\/projects\/[^/]+\/boards\/[^/]+\/?$/.test(path)) {
                return "kanban" as const;
            }
            if (path.startsWith("/projects/")) {
                return "project" as const;
            }
            return "default" as const;
        },
    });

    return (
        <div
            className={cn(
                "w-full",
                layoutMode === "kanban" &&
                    "flex h-dvh flex-col overflow-hidden",
                layoutMode === "project" && "min-h-dvh overflow-y-auto",
                layoutMode === "default" && "min-h-dvh"
            )}
        >
            <AppChrome />
            <CommandPalette />
            {layoutMode === "kanban" ? (
                <div className="min-h-0 flex-1 overflow-hidden">
                    <Outlet />
                </div>
            ) : layoutMode === "project" ? (
                <div className="w-full">
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
