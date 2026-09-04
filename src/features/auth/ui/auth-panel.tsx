import type { ReactNode } from "react";

import { cn } from "@/shared/lib/utils";

type AuthPanelProperties = {
    children: ReactNode;
    className?: string;
    description?: string;
    title: string;
};

/**
 * Terminal-on-blueprint panel for auth forms — interaction chrome, not a
 * generic marketing card.
 */
export function AuthPanel({
    children,
    className,
    description,
    title,
}: AuthPanelProperties) {
    return (
        <section
            className={cn(
                "mx-auto w-full min-w-0 max-w-sm border border-border bg-card/90 shadow-none ring-1 ring-primary/25 backdrop-blur-sm motion-reveal [animation-delay:480ms]",
                className
            )}
        >
            <header className="flex min-w-0 items-center gap-2.5 border-b border-border/80 px-4 py-3">
                <span aria-hidden className="size-1.5 shrink-0 bg-primary" />
                <h2 className="min-w-0 truncate font-mono text-meta text-foreground">
                    {title}
                </h2>
            </header>

            <div className="flex flex-col gap-6 px-4 py-5 sm:px-5">
                {description ? (
                    <p className="text-ui text-muted-foreground wrap-break-word">
                        {description}
                    </p>
                ) : null}
                {children}
            </div>
        </section>
    );
}
