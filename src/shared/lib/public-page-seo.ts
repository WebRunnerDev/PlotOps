import i18n from "i18next";

import type { PlotOpsPublicPath } from "@/shared/config/site";

import type { PageSeo } from "./seo";

import { buildAuthPageSeo, buildLegalPageSeo } from "./page-seo-config";

/** Resolves crawl meta for a public route at build time (SSG). */
export function getPublicPageSeo(path: PlotOpsPublicPath): PageSeo {
    const authT = i18n.getFixedT("ru", "auth");
    const legalT = i18n.getFixedT("ru", "legal");

    switch (path) {
        case "/": {
            return buildAuthPageSeo("/", "signInTitle", authT);
        }
        case "/privacy": {
            return buildLegalPageSeo("privacy", legalT);
        }
        case "/sign-in": {
            return buildAuthPageSeo("/sign-in", "signInTitle", authT);
        }
        case "/sign-up": {
            return buildAuthPageSeo("/sign-up", "signUpTitle", authT);
        }
        case "/terms": {
            return buildLegalPageSeo("terms", legalT);
        }
    }
}
