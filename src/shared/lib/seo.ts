import {
    PLOTOPS_OG_IMAGE_URL,
    PLOTOPS_SITE_NAME,
    PLOTOPS_SITE_ORIGIN,
} from "@/shared/config/site";

export type PageSeo = {
    /** Meta description and og:description. */
    description: string;
    /** When true, sets robots to noindex,nofollow. */
    noindex?: boolean;
    /** Path only, e.g. `/sign-in` — joined with site origin for canonical/og:url. */
    path?: string;
    title: string;
};

/** Imperatively sync document head tags for SPA route changes. */
export function applyPageSeo(seo: PageSeo) {
    const path = seo.path ?? "/";
    const canonicalUrl = `${PLOTOPS_SITE_ORIGIN}${path === "/" ? "/" : path}`;
    const robots = seo.noindex ? "noindex, nofollow" : "index, follow";

    document.title = seo.title;
    upsertCanonical(canonicalUrl);
    upsertMeta("name", "description", seo.description);
    upsertMeta("name", "robots", robots);
    upsertMeta("property", "og:type", "website");
    upsertMeta("property", "og:url", canonicalUrl);
    upsertMeta("property", "og:title", seo.title);
    upsertMeta("property", "og:description", seo.description);
    upsertMeta("property", "og:image", PLOTOPS_OG_IMAGE_URL);
    upsertMeta("property", "og:site_name", PLOTOPS_SITE_NAME);
    upsertMeta("name", "twitter:card", "summary_large_image");
    upsertMeta("name", "twitter:title", seo.title);
    upsertMeta("name", "twitter:description", seo.description);
    upsertMeta("name", "twitter:image", PLOTOPS_OG_IMAGE_URL);
}

function upsertCanonical(href: string) {
    let element = document.head.querySelector('link[rel="canonical"]');

    if (!element) {
        element = document.createElement("link");
        element.setAttribute("rel", "canonical");
        document.head.append(element);
    }

    element.setAttribute("href", href);
}

function upsertMeta(
    attribute: "content" | "name" | "property",
    key: string,
    value: string
) {
    const selector =
        attribute === "name"
            ? `meta[name="${key}"]`
            : `meta[property="${key}"]`;
    let element = document.head.querySelector(selector);

    if (!element) {
        element = document.createElement("meta");
        if (attribute === "name") {
            element.setAttribute("name", key);
        } else {
            element.setAttribute("property", key);
        }
        document.head.append(element);
    }

    element.setAttribute("content", value);
}
