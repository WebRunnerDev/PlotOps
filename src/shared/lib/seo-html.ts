import {
    PLOTOPS_OG_IMAGE_URL,
    PLOTOPS_SITE_NAME,
    PLOTOPS_SITE_ORIGIN,
} from "@/shared/config/site";

import type { PageSeo } from "./seo";

/** Merges SSG body markup and per-route SEO into the Vite HTML shell. */
export function patchPrerenderedHtml(
    template: string,
    appHtml: string,
    seo: PageSeo
): string {
    const path = seo.path ?? "/";
    const canonicalUrl = canonicalUrlForPath(path);
    const robots = seo.noindex ? "noindex, nofollow" : "index, follow";

    let html = template.replace(
        '<div id="root"></div>',
        `<div id="root">${appHtml}</div>`
    );

    html = html.replace(
        /<title>[^<]*<\/title>/i,
        `<title>${escapeHtml(seo.title)}</title>`
    );

    html = upsertMetaHtml(html, "name", "description", seo.description);
    html = upsertMetaHtml(html, "name", "robots", robots);
    html = upsertMetaHtml(html, "property", "og:type", "website");
    html = upsertMetaHtml(html, "property", "og:url", canonicalUrl);
    html = upsertMetaHtml(html, "property", "og:title", seo.title);
    html = upsertMetaHtml(html, "property", "og:description", seo.description);
    html = upsertMetaHtml(html, "property", "og:image", PLOTOPS_OG_IMAGE_URL);
    html = upsertMetaHtml(html, "property", "og:site_name", PLOTOPS_SITE_NAME);
    html = upsertMetaHtml(html, "name", "twitter:card", "summary_large_image");
    html = upsertMetaHtml(html, "name", "twitter:title", seo.title);
    html = upsertMetaHtml(html, "name", "twitter:description", seo.description);
    html = upsertMetaHtml(html, "name", "twitter:image", PLOTOPS_OG_IMAGE_URL);

    html = upsertLinkHtml(html, "canonical", canonicalUrl);
    html = upsertLinkHtml(html, "alternate", canonicalUrl, "ru");
    html = upsertLinkHtml(html, "alternate", canonicalUrl, "en");
    html = upsertLinkHtml(html, "alternate", canonicalUrl, "x-default");

    return html;
}

function canonicalUrlForPath(path: string): string {
    return `${PLOTOPS_SITE_ORIGIN}${path === "/" ? "/" : path}`;
}

function escapeHtml(value: string): string {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
}

function upsertLinkHtml(
    html: string,
    linkRelationship: string,
    href: string,
    hreflang?: string
): string {
    const hreflangPart = hreflang ? String.raw`\s+hreflang="${hreflang}"` : "";
    const pattern = new RegExp(
        String.raw`<link\s+rel="${linkRelationship}"${hreflangPart}\s+href="[^"]*"\s*/>`,
        "i"
    );
    const tag = hreflang
        ? `<link rel="${linkRelationship}" hreflang="${hreflang}" href="${href}" />`
        : `<link rel="canonical" href="${href}" />`;

    if (pattern.test(html)) {
        return html.replace(pattern, tag);
    }

    return html.replace("</head>", `        ${tag}\n    </head>`);
}

function upsertMetaHtml(
    html: string,
    attribute: "name" | "property",
    key: string,
    content: string
): string {
    const attribute_ = attribute === "name" ? "name" : "property";
    const escapedKey = key.replaceAll(/[$()*+.?[\\\]^{|}]/g, String.raw`\$&`);
    const pattern = new RegExp(
        String.raw`<meta\s+${attribute_}="${escapedKey}"\s+content="[^"]*"\s*/>`,
        "i"
    );
    const tag = `<meta ${attribute_}="${key}" content="${escapeHtml(content)}" />`;

    if (pattern.test(html)) {
        return html.replace(pattern, tag);
    }

    return html.replace("</head>", `        ${tag}\n    </head>`);
}
