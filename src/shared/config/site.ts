/** Production origin — used for canonical URLs, sitemap, and Open Graph. */
export const PLOTOPS_SITE_ORIGIN = "https://plotops.webrunner.dev";

export const PLOTOPS_SITE_NAME = "PlotOps";

/** Default `<title>` suffix and Open Graph site name. */
export const PLOTOPS_SITE_TAGLINE = "Git-native project tracker";

/** Shared OG/Twitter preview image (absolute URL). */
export const PLOTOPS_OG_IMAGE_URL = `${PLOTOPS_SITE_ORIGIN}/PlotOps.png`;

/** Public routes included in sitemap.xml and allowed in robots.txt. */
export const PLOTOPS_PUBLIC_PATHS = [
    "/",
    "/sign-in",
    "/sign-up",
    "/privacy",
    "/terms",
] as const;

export type PlotOpsPublicPath = (typeof PLOTOPS_PUBLIC_PATHS)[number];
