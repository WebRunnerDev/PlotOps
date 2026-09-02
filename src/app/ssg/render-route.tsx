import "@/app/ssg/ssr-globals";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
    createRequestHandler,
    renderRouterToString,
    RouterServer,
} from "@tanstack/react-router/ssr/server";

import type { PageSeo } from "@/shared/lib/seo";

import { createAppRouter } from "@/app/create-app-router";
import { initSsgI18n } from "@/app/ssg/i18n";
import { SsgAuthProvider } from "@/app/ssg/ssg-auth-provider";
import {
    PLOTOPS_SITE_ORIGIN,
    type PlotOpsPublicPath,
} from "@/shared/config/site";
import { getPublicPageSeo } from "@/shared/lib/public-page-seo";

initSsgI18n();

export function getSeoForPublicRoute(path: PlotOpsPublicPath): PageSeo {
    return getPublicPageSeo(path);
}

export {
    PLOTOPS_PUBLIC_PATHS,
    type PlotOpsPublicPath,
} from "@/shared/config/site";

export async function renderPublicRoute(
    path: PlotOpsPublicPath
): Promise<string> {
    const queryClient = new QueryClient();
    const url = `${PLOTOPS_SITE_ORIGIN}${path === "/" ? "/" : path}`;
    const request = new Request(url);

    const handler = createRequestHandler({
        createRouter: () => {
            const router = createAppRouter(queryClient);
            router.update({
                context: {
                    ...router.options.context,
                    auth: {
                        isLoading: false,
                        profileNamesComplete: false,
                        user: null,
                    },
                },
            });
            return router;
        },
        request,
    });

    const response = await handler(({ responseHeaders, router }) =>
        renderRouterToString({
            children: (
                <QueryClientProvider client={queryClient}>
                    <SsgAuthProvider>
                        <RouterServer router={router} />
                    </SsgAuthProvider>
                </QueryClientProvider>
            ),
            responseHeaders,
            router,
        })
    );

    if (!response.ok) {
        throw new Error(
            `SSG render failed for ${path} (${response.status} ${response.statusText})`
        );
    }

    const raw = await response.text();
    return raw.replace(/^<!DOCTYPE html>/i, "");
}

export { patchPrerenderedHtml } from "@/shared/lib/seo-html";
