import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { useAuth } from "@/features/auth";
import {
    getGitHubAccessToken,
    subscribeGitHubAccessToken,
} from "@/features/auth/model/github-token";
import { clearGitQueryCache } from "@/features/git-integration/model/clear-git-query-cache";
import { Button } from "@/shared/shadcn/ui/button";
import { Toaster } from "@/shared/shadcn/ui/sonner";

import { queryClient, router } from "./router";

export function AppRouter() {
    const auth = useAuth();
    const { t } = useTranslation("auth");

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
        if (auth.isLoading) return;
        void router.invalidate();
    }, [auth.isLoading, auth.profileNamesComplete, auth.user]);

    useEffect(() => {
        return subscribeGitHubAccessToken(() => {
            if (!getGitHubAccessToken()) {
                clearGitQueryCache(queryClient);
            }
        });
    }, []);

    if (auth.isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <div className="size-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
            </div>
        );
    }

    if (auth.bootError) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
                <p className="max-w-sm text-center text-ui text-muted-foreground">
                    {t("boot.title")}
                </p>
                <Button onClick={auth.retryBoot} type="button">
                    {t("boot.retry")}
                </Button>
            </div>
        );
    }

    return (
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
    );
}
