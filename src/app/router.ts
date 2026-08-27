import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";

import { getPageTransitionTypes } from "@/shared/lib/page-transitions";

import { routeTree } from "./routeTree.gen";

export const queryClient = new QueryClient();

export const router = createRouter({
    context: {
        // Safe placeholder until RouterProvider merges the real Auth slice.
        // A missing auth object makes beforeLoad throw on `.user` if load runs
        // before mount (e.g. invalidate during auth boot).
        auth: {
            isLoading: true,
            profileNamesComplete: false,
            user: null,
        },
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
