import type { ReactNode } from "react";

import { AuthLanguageSwitcher } from "@/features/auth";
import { cn } from "@/shared/lib/utils";

import { AuthOpenSourceFooter } from "./auth-open-source-footer";

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
                "relative flex min-h-[60vh] w-full min-w-0 flex-col items-center justify-center gap-6 px-4 py-8 sm:py-12",
                className
            )}
        >
            <div className="absolute top-4 right-4">
                <AuthLanguageSwitcher />
            </div>
            {children}
            <AuthOpenSourceFooter />
        </div>
    );
}
