import { Outlet, useRouterState } from "@tanstack/react-router";
import { motion } from "motion/react";

import { cn } from "@/shared/lib/utils";
import { AppDock } from "@/widgets/dock";

export function MainLayoutWidget() {
    return <MainLayoutContent />;
}

function MainLayoutContent() {
    const pathname = useRouterState({
        select: (state) => state.location.pathname,
    });
    const isBoard = pathname.startsWith("/projects/");

    return (
        <>
            <div
                className={cn(
                    "w-full",
                    isBoard
                        ? "flex h-dvh flex-col overflow-hidden"
                        : "mx-auto max-w-5xl p-4 pb-24",
                )}
            >
                {isBoard ? (
                    <div className="min-h-0 flex-1 overflow-hidden">
                        <RouteTransition />
                    </div>
                ) : (
                    <RouteTransition />
                )}
            </div>
            <AppDock />
        </>
    );
}

function RouteTransition() {
    const pathname = useRouterState({
        select: (state) => state.location.pathname,
    });

    return (
        <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="h-full min-h-0"
            initial={{ opacity: 0, y: 8 }}
            key={pathname}
            transition={{ duration: 0.2, ease: "easeOut" }}
        >
            <Outlet />
        </motion.div>
    );
}
