#!/usr/bin/env node
/**
 * Post-build SSG for public routes via react-dom/server (no browser).
 * Paths must stay in sync with PLOTOPS_PUBLIC_PATHS in src/shared/config/site.ts.
 *
 * Also writes `404.html` — the Vite shell (default title, empty #root) used as
 * the Cloudflare Pages not-found document so authenticated SPA routes do not
 * inherit login SEO from prerendered `/`. Do not add `/* /404.html 200` (or
 * `/* /spa.html 200`) to `_redirects`: Pages pretty-URLs strip `.html` and that
 * catch-all becomes an infinite 308 loop.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const distDir = path.join(root, "dist");
const ssrEntry = path.join(root, "dist-ssr", "render-route.js");

/**
 * @param {string} route
 */
function outputFileForRoute(route) {
    if (route === "/") {
        return path.join(distDir, "index.html");
    }

    return path.join(distDir, route.slice(1), "index.html");
}

async function main() {
    const templatePath = path.join(distDir, "index.html");
    const template = await readFile(templatePath, "utf8");

    // SPA shell before public routes overwrite index.html with login SSG.
    // Top-level 404.html disables Pages' default "serve /" SPA mode and is
    // returned for unknown paths (app routes) without a _redirects catch-all.
    const notFoundPath = path.join(distDir, "404.html");
    await writeFile(notFoundPath, template, "utf8");
    console.log(
        `  → ${path.relative(root, notFoundPath)} (SPA not-found shell)`
    );

    if (process.env.SKIP_PRERENDER === "true") {
        console.log("SKIP_PRERENDER=true — skipping public-route SSG.");
        return;
    }

    const ssg = await import(pathToFileURL(ssrEntry).href);
    const {
        PLOTOPS_PUBLIC_PATHS,
        getSeoForPublicRoute,
        patchPrerenderedHtml,
        renderPublicRoute,
    } = ssg;

    for (const route of PLOTOPS_PUBLIC_PATHS) {
        console.log(`SSG ${route}…`);

        const appHtml = await renderPublicRoute(route);
        const seo = getSeoForPublicRoute(route);
        const html = patchPrerenderedHtml(template, appHtml, seo);
        const outFile = outputFileForRoute(route);

        await mkdir(path.dirname(outFile), { recursive: true });
        await writeFile(outFile, html, "utf8");

        console.log(`  → ${path.relative(root, outFile)}`);
    }

    console.log("SSG complete.");
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
