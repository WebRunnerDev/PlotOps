import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { useAuth } from "@/features/auth";
import { Button } from "@/shared/shadcn/ui/button";

import { queryClient, router } from "./router";

export function AppRouter() {
    const auth = useAuth();
    const { t } = useTranslation("auth");

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
        </QueryClientProvider>
    );
}
