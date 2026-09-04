import type { ReactNode } from "react";

import { cn } from "@/shared/lib/utils";

type PublicPageShellProperties = {
    children: ReactNode;
    className?: string;
};

/** Centered public-flow pages (invite accept) capped at max-w-md. */
export function PublicPageShell({
    children,
    className,
}: PublicPageShellProperties) {
    return (
        <div
            className={cn(
                "mx-auto flex w-full min-w-0 max-w-md flex-col gap-6 px-4 py-8 sm:py-16",
                "[view-transition-name:main-content]",
                className
            )}
        >
            {children}
        </div>
    );
}
