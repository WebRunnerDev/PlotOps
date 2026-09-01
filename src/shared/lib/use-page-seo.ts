import { useEffect } from "react";

import { applyPageSeo, type PageSeo } from "./seo";

/** Keeps `<head>` in sync when navigating between public SPA routes. */
export function usePageSeo(seo: PageSeo) {
    useEffect(() => {
        applyPageSeo(seo);
    }, [seo.description, seo.noindex, seo.path, seo.title]);
}
