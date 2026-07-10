import { Header } from "@/widgets/header/ui/header";
import { Outlet, useRouterState } from "@tanstack/react-router";
import { motion } from "motion/react";

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
            <Header />
            <div className="mx-auto max-w-5xl p-4">
                <RouteTransition />
            </div>
        </>
    )
}

export function MainLayoutWidget() {
    return (
        <MainLayoutContent />
    );
}