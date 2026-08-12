import type { ReactNode } from "react";

import { cn } from "@/shared/lib/utils";

type AuthPageShellProperties = {
    children: ReactNode;
    className?: string;
};

/** Centered shell for sign-in, sign-up, and complete-profile at 375px+. */
export function AuthPageShell({
    children,
    className,
}: AuthPageShellProperties) {
    return (
        <div
            className={cn(
                "flex min-h-[60vh] w-full min-w-0 items-center justify-center px-4 py-8 sm:py-12",
                className
            )}
        >
            {children}
        </div>
    );
}
