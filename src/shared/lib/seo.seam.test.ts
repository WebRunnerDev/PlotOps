import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, "../../..");

function read(relativePath: string) {
    return readFileSync(path.join(root, relativePath), "utf8");
}

describe("seo seam", () => {
    it("ships crawl assets in public/", () => {
        expect(read("public/robots.txt")).toMatch(/Sitemap:/);
        expect(read("public/robots.txt")).toMatch(/Allow: \/privacy/);
        expect(read("public/sitemap.xml")).toMatch(
            /<loc>https:\/\/plotops\.webrunner\.dev\/<\/loc>/
        );
        expect(read("public/site.webmanifest")).toMatch(/"name": "PlotOps"/);
    });

    it("includes structured data and noscript fallback in index.html", () => {
        const html = read("index.html");

        expect(html).toMatch(/application\/ld\+json/);
        expect(html).toMatch(/WebApplication/);
        expect(html).toMatch(/<noscript>/);
        expect(html).toMatch(/hreflang="ru"/);
    });

    it("serves landing content at / instead of redirect-only index route", () => {
        const indexRoute = read("src/routes/index.tsx");

        expect(indexRoute).toMatch(/LoginForm/);
        expect(indexRoute).not.toMatch(/to: "\/sign-in"/);
        expect(indexRoute).toMatch(/AuthPageSeo path="\/"/);
    });

    it("exposes marketing intro on auth shell for crawlable product copy", () => {
        const shell = read(
            "src/widgets/auth-page-shell/ui/auth-page-shell.tsx"
        );
        const intro = read(
            "src/widgets/auth-page-shell/ui/auth-marketing-intro.tsx"
        );

        expect(shell).toMatch(/AuthMarketingIntro/);
        expect(intro).toMatch(/<h1/);
        expect(intro).toMatch(/marketing\.features/);
    });

    it("updates head tags per legal document route", () => {
        const legalPage = read("src/features/legal/ui/legal-document-page.tsx");

        expect(legalPage).toMatch(/LegalPageSeo/);
    });

    it("prerenders public routes after build via Playwright", () => {
        const script = read("scripts/prerender.mjs");
        const site = read("src/shared/config/site.ts");
        const packageJson = read("package.json");

        expect(script).toMatch(/playwright/);
        expect(script).toMatch(/data-prerender-ready/);
        expect(script).toContain('"/sign-in"');
        expect(script).toContain('"/privacy"');
        expect(script).toContain('"/terms"');
        expect(site).toMatch(/PLOTOPS_PUBLIC_PATHS/);
        expect(packageJson).toMatch(/scripts\/prerender\.mjs/);
    });

    it("routes prerendered HTML through Cloudflare _redirects", () => {
        const redirects = read("public/_redirects");

        expect(redirects).toMatch(/\/sign-in\s+\/sign-in\/index\.html/);
        expect(redirects).toMatch(/\/\*\s+\/index\.html/);
    });
});
