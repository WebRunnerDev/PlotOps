import { Outlet, useRouterState } from "@tanstack/react-router";
import { motion } from "motion/react";

import { AppDock } from "@/widgets/dock";

function RouteTransition() {
    const pathname = useRouterState({
        select: (state) => state.location.pathname,
    });

    return (
        <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
        >
            <Outlet />
        </motion.div>
    );
}

function MainLayoutContent() {
    return (
        <>
            <div className="mx-auto max-w-5xl p-4 pb-24">
                <RouteTransition />
            </div>
            <AppDock />
        </>
    )
}

export function MainLayoutWidget() {
    return (
        <MainLayoutContent />
    );
}