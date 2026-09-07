import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { AnimatePresence } from "motion/react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { useAuth } from "@/features/auth";
import {
    getGitHubAccessToken,
    subscribeGitHubAccessToken,
} from "@/features/auth/model/github-token";
import { clearGitQueryCache } from "@/features/git-integration/model/clear-git-query-cache";
import { Toaster } from "@/shared/shadcn/ui/sonner";
import { BootScreen, useBootVisible } from "@/widgets/boot-screen";

import { queryClient, router } from "./router";

export function AppRouter() {
    const auth = useAuth();
    const { t } = useTranslation("auth");
    const showBoot = useBootVisible(auth.isLoading, auth.bootError);

    useEffect(() => {
        if (!auth.user) {
            clearGitQueryCache(queryClient);
        }
    }, [auth.user]);

    // RouterProvider updates context, but beforeLoad does not re-run unless
    // we invalidate — so session loss mid-route must kick the auth gates
    // (e.g. `/(main)` → `/sign-in` when no Auth user and no Guest Session).
    // Skip while auth is still booting: this effect runs before the
    // `auth.isLoading` early return that mounts RouterProvider, and an early
    // invalidate would load matches with the createRouter placeholder context.
    useEffect(() => {
        if (auth.isLoading || showBoot) return;
        void router.invalidate();
    }, [auth.isLoading, auth.profileNamesComplete, auth.user, showBoot]);

    useEffect(() => {
        return subscribeGitHubAccessToken(() => {
            if (!getGitHubAccessToken()) {
                clearGitQueryCache(queryClient);
            }
        });
    }, []);

    return (
        <AnimatePresence mode="wait">
            {showBoot ? (
                <BootScreen
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
            ) : (
                <QueryClientProvider client={queryClient} key="app">
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
            )}
        </AnimatePresence>
    );
}
