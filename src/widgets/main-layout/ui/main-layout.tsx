import { Outlet, useRouterState } from "@tanstack/react-router";

import { AppShellSeo } from "@/features/app-shell/ui/app-shell-seo";
import { CommandPalette } from "@/features/command-palette";
import { cn } from "@/shared/lib/utils";
import { TopBar } from "@/widgets/top-bar";

import { AuthSessionGuard } from "./auth-session-guard";

export function MainLayoutWidget() {
    return <MainLayoutContent />;
}

function MainLayoutContent() {
    // Use settled location — pending navigations update `location` immediately while
    // home is still painted; flipping layout then strips max-w-6xl for ~1s (board fetch).
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
                // overflow-x-clip clips horizontal bleed without a scroll
                // container, so TopBar `sticky top-0` still sticks to the viewport.
                // `hidden` would compute a sticky containing block and unstick the bar.
                "w-full overflow-x-clip",
                layoutMode === "kanban" &&
                    "flex h-dvh flex-col overflow-hidden",
                layoutMode === "project" && "min-h-dvh",
                layoutMode === "default" && "min-h-dvh"
            )}
        >
            <AppShellSeo />
            <AuthSessionGuard />
            <TopBar />
            <CommandPalette />
            {layoutMode === "kanban" ? (
                <div className="min-h-0 flex-1 overflow-hidden [view-transition-name:main-content]">
                    <Outlet />
                </div>
            ) : layoutMode === "project" ? (
                <div className="w-full [view-transition-name:main-content]">
                    <Outlet />
                </div>
            ) : (
                <div className="mx-auto w-full max-w-6xl [view-transition-name:main-content]">
                    <Outlet />
                </div>
            )}
        </div>
    );
}
