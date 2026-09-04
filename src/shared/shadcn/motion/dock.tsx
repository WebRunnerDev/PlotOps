"use client";
// beui.dev/components/motion/dock — PlotOps skin: sharp blueprint chrome

import { motion, useReducedMotion } from "motion/react";
import {
    createContext,
    type ReactNode,
    useContext,
    useId,
    useMemo,
} from "react";

import { SPRING_LAYOUT } from "@/shared/lib/ease";
import { cn } from "@/shared/lib/utils";

type DockContextValue = {
    pillLayoutId: string;
    size: number;
};

const DockContext = createContext<DockContextValue | null>(null);

export interface DockItemProperties {
    active?: boolean;
    "aria-label"?: string;
    children: ReactNode;
    className?: string;
    /** When set, the item renders as a <button>. Omit when children carry their own link or button. */
    onClick?: () => void;
}

export interface DockProperties {
    children: ReactNode;
    className?: string;
    /** Size of each item in px. */
    size?: number;
}

export function Dock({ children, className, size = 44 }: DockProperties) {
    const pillLayoutId = useId();
    const context = useMemo<DockContextValue>(
        () => ({ pillLayoutId, size }),
        [size, pillLayoutId]
    );

    return (
        <DockContext.Provider value={context}>
            <div
                className={cn(
                    "inline-flex h-auto items-end gap-1 border border-border bg-card/90 px-1.5 py-1 shadow-none ring-1 ring-primary/20 backdrop-blur-md",
                    className
                )}
            >
                {children}
            </div>
        </DockContext.Provider>
    );
}

export function DockItem({
    active,
    children,
    className,
    onClick,
    ...rest
}: DockItemProperties) {
    const dock = useContext(DockContext);
    const reduce = useReducedMotion();
    const size = dock?.size ?? 44;
    const pillLayoutId = dock?.pillLayoutId ?? "dock-pill";

    const pill = active ? (
        <motion.span
            className="absolute inset-x-1 bottom-0.5 -z-10 h-0.5 bg-primary"
            layoutId={pillLayoutId}
            transition={reduce ? { duration: 0 } : SPRING_LAYOUT}
        />
    ) : null;
    const sharedStyle = { height: size, width: size };
    const sharedClass = cn(
        "relative flex shrink-0 items-center justify-center text-foreground transition-colors duration-200 ease-[var(--ease-out-quart)]",
        "hover:bg-primary/10 hover:text-primary",
        className
    );

    if (onClick) {
        return (
            <button
                aria-label={rest["aria-label"]}
                aria-pressed={active}
                className={cn(
                    sharedClass,
                    "cursor-pointer border-0 bg-transparent p-0 outline-none",
                    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                )}
                onClick={onClick}
                style={sharedStyle}
                type="button"
            >
                {pill}
                {children}
            </button>
        );
    }

    // Children carry their own link or button (and its accessible name).
    return (
        <div className={sharedClass} style={sharedStyle}>
            {pill}
            {children}
        </div>
    );
}

export function DockSeparator({ className }: { className?: string }) {
    return (
        <span
            aria-hidden
            className={cn("mx-1 h-6 w-px self-center bg-primary/25", className)}
        />
    );
}
