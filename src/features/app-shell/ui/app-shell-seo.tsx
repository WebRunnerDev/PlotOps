import { useRouterState } from "@tanstack/react-router";

import { buildAppShellSeo } from "@/shared/lib/page-seo-config";
import { usePageSeo } from "@/shared/lib/use-page-seo";

/** Resets document title/meta after leaving prerendered auth pages. */
export function AppShellSeo() {
    const path = useRouterState({
        select: (state) => state.location.pathname,
    });

    usePageSeo(buildAppShellSeo(path));

    return null;
}
