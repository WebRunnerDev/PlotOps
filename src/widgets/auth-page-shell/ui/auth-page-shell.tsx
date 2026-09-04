import type { ReactNode } from "react";

import { AuthLanguageSwitcher } from "@/features/auth";
import { cn } from "@/shared/lib/utils";

import { AuthMarketingIntro } from "./auth-marketing-intro";
import { AuthOpenSourceFooter } from "./auth-open-source-footer";

type AuthPageShellProperties = {
    children: ReactNode;
    className?: string;
};

/**
 * Full-bleed blueprint shell — asymmetric brand / form split on desktop,
 * stacked on mobile. Signature surface for sign-in, sign-up, complete-profile.
 */
export function AuthPageShell({
    children,
    className,
}: AuthPageShellProperties) {
    return (
        <div
            className={cn(
                "relative flex min-h-dvh w-full min-w-0 flex-col overflow-x-hidden bg-auth-atmosphere px-4 py-10 sm:px-6 sm:py-14 lg:px-10 lg:py-16",
                "[view-transition-name:main-content]",
                className
            )}
        >
            <div className="absolute top-4 right-4 z-10 sm:top-6 sm:right-6 motion-reveal [animation-delay:600ms]">
                <AuthLanguageSwitcher />
            </div>

            <div className="relative z-10 mx-auto flex w-full min-w-0 max-w-6xl flex-1 flex-col justify-center gap-10 lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,22rem)] lg:items-center lg:gap-x-16 lg:gap-y-12 xl:gap-x-24">
                <AuthMarketingIntro className="lg:self-center lg:pr-4" />

                <div className="flex w-full min-w-0 flex-col items-stretch gap-8 sm:mx-auto sm:max-w-sm lg:mx-0 lg:max-w-none lg:justify-self-end">
                    {children}
                    <AuthOpenSourceFooter className="sm:max-w-none" />
                </div>
            </div>
        </div>
    );
}
