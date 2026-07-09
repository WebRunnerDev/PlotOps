import { RouterProvider } from "@tanstack/react-router";
import { useAuth } from "@/features/auth";
import { queryClient, router } from "./router";

export function AppRouter() {
    const auth = useAuth();

    if (auth.isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <div className="size-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
            </div>
        );
    }

    return (
        <RouterProvider
            router={router}
            context={{
                queryClient,
                auth: { user: auth.user, isLoading: auth.isLoading },
            }}
        />
    );
}
