import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";

import { getPageTransitionTypes } from "@/shared/lib/page-transitions";

import { routeTree } from "./routeTree.gen";

export const queryClient = new QueryClient();

export const router = createRouter({
    context: {
        auth: undefined!,
        queryClient,
    },
    defaultViewTransition: {
        types: getPageTransitionTypes,
    },
    routeTree,
});

declare module "@tanstack/react-router" {
    interface Register {
        router: typeof router;
    }
}
