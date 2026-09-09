import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { AnimatePresence } from "motion/react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { isAuthEntryPath, shouldCoverAuthEntry } from "@/app/auth-entry-cover";
import { useAuth } from "@/features/auth";
import { rewriteAuthEntryLocation } from "@/features/auth/lib/rewrite-auth-entry-location";
import {
    getGitHubAccessToken,
    subscribeGitHubAccessToken,
} from "@/features/auth/model/github-token";
import { clearGitQueryCache } from "@/features/git-integration/model/clear-git-query-cache";
import { safeGetItem } from "@/shared/lib/safe-storage";
import { Toaster } from "@/shared/shadcn/ui/sonner";
import { BootScreen, useBootVisible } from "@/widgets/boot-screen";

import { queryClient, router } from "./router";

export function AppRouter() {
    const auth = useAuth();
    const { t } = useTranslation("auth");
    const showBoot = useBootVisible(auth.isLoading, auth.bootError);
    const [authEntryResolved, setAuthEntryResolved] = useState(false);

    useEffect(() => {
        if (!auth.user) {
            clearGitQueryCache(queryClient);
        }
    }, [auth.user]);

    // Mount the router under the boot cover as soon as auth settled so `/` can
    // redirect to `/home` while BootScreen still paints. AnimatePresence
    // mode=wait previously swapped Boot → Router and flashed LoginForm.
    useEffect(() => {
        if (auth.isLoading || showBoot) return;

        if (!auth.user) {
            setAuthEntryResolved(true);
            return;
        }

        rewriteAuthEntryLocation({
            hasUser: true,
            pendingInviteToken: safeGetItem(
                "sessionStorage",
                "plotops_pending_invite"
            ),
        });

        const releaseIfPastEntry = () => {
            if (!isAuthEntryPath(router.state.location.pathname)) {
                setAuthEntryResolved(true);
            }
        };

        setAuthEntryResolved(false);
        releaseIfPastEntry();
        const unsubscribe = router.subscribe("onResolved", releaseIfPastEntry);
        void router.invalidate().then(releaseIfPastEntry);

        return unsubscribe;
    }, [auth.isLoading, auth.profileNamesComplete, auth.user, showBoot]);

    useEffect(() => {
        return subscribeGitHubAccessToken(() => {
            if (!getGitHubAccessToken()) {
                clearGitQueryCache(queryClient);
            }
        });
    }, []);

    const mountApp = !auth.isLoading && !auth.bootError;
    const showCover = shouldCoverAuthEntry({
        authEntryResolved,
        hasUser: Boolean(auth.user),
        showBoot: showBoot || auth.isLoading,
    });

    if (mountApp && auth.user && !authEntryResolved) {
        rewriteAuthEntryLocation({
            hasUser: true,
            pendingInviteToken: safeGetItem(
                "sessionStorage",
                "plotops_pending_invite"
            ),
        });
    }

    return (
        <>
            {mountApp ? (
                <QueryClientProvider client={queryClient}>
                    <RouterProvider
                        context={{
                            auth: {
                                isLoading: auth.isLoading,
                                profileNamesComplete: auth.profileNamesComplete,
                                user: auth.user,
                            },
                            queryClient,
                        }}
                        router={router}
                    />
                    <Toaster />
                </QueryClientProvider>
            ) : null}

            <AnimatePresence>
                {showCover ? (
                    <BootScreen
                        className="fixed inset-0 z-100"
                        error={
                            auth.bootError
                                ? {
                                      message:
                                          auth.bootErrorReason === "oauth"
                                              ? t("boot.oauthFailed")
                                              : t("boot.title"),
                                      onRetry: auth.retryBoot,
                                      retryLabel: t("boot.retry"),
                                  }
                                : undefined
                        }
                        key={auth.bootError ? "boot-error" : "boot"}
                    />
                ) : null}
            </AnimatePresence>
        </>
    );
}
