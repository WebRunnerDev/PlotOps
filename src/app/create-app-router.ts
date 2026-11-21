import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";

import { getPageTransitionTypes } from "@/shared/lib/page-transitions";

import { RouteErrorFallback } from "./route-error-fallback";
import { routeTree } from "./routeTree.gen";

export function createAppRouter(queryClient: QueryClient) {
    return createRouter({
        context: {
            auth: {
                isLoading: true,
                profileNamesComplete: false,
                user: null,
            },
            queryClient,
        },
        defaultErrorComponent: RouteErrorFallback,
        defaultViewTransition: {
            types: getPageTransitionTypes,
        },
        routeTree,
    });
}

declare module "@tanstack/react-router" {
    interface Register {
        router: ReturnType<typeof createAppRouter>;
    }
}
