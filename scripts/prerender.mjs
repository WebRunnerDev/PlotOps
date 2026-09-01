#!/usr/bin/env node
/**
 * Post-build static prerender for public routes.
 * Paths must stay in sync with PLOTOPS_PUBLIC_PATHS in src/shared/config/site.ts.
 */
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const distDir = path.join(root, "dist");
const previewPort = 4173;
const previewOrigin = `http://127.0.0.1:${previewPort}`;

/** @type {readonly string[]} */
const PUBLIC_PATHS = ["/", "/sign-in", "/sign-up", "/privacy", "/terms"];

const PREVIEW_READY_TIMEOUT_MS = 60_000;
const PAGE_READY_TIMEOUT_MS = 45_000;

/**
 * @param {string} url
 * @param {number} timeoutMs
 */
function waitForServer(url, timeoutMs) {
    return new Promise((resolve, reject) => {
        const started = Date.now();

        const tick = () => {
            const request = http.get(url, (response) => {
                response.resume();
                resolve(undefined);
            });

            request.on("error", () => {
                if (Date.now() - started > timeoutMs) {
                    reject(
                        new Error(
                            `Preview server did not start at ${url} within ${timeoutMs}ms`
                        )
                    );
                    return;
                }

                setTimeout(tick, 250);
            });
        };

        tick();
    });
}

function startPreview() {
    const command = process.platform === "win32" ? "npx.cmd" : "npx";

    return spawn(
        command,
        [
            "vite",
            "preview",
            "--host",
            "127.0.0.1",
            "--port",
            String(previewPort),
            "--strictPort",
        ],
        {
            cwd: root,
            env: process.env,
            stdio: "pipe",
        }
    );
}

/**
 * @param {import('node:child_process').ChildProcess} preview
 */
function stopPreview(preview) {
    if (!preview.killed) {
        preview.kill("SIGTERM");
    }
}

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
    if (process.env.SKIP_PRERENDER === "true") {
        console.log("SKIP_PRERENDER=true — skipping static prerender.");
        return;
    }

    const preview = startPreview();

    const shutdown = () => {
        stopPreview(preview);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);

    try {
        await waitForServer(previewOrigin, PREVIEW_READY_TIMEOUT_MS);

        const browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();

        for (const route of PUBLIC_PATHS) {
            const url =
                route === "/"
                    ? `${previewOrigin}/`
                    : `${previewOrigin}${route}`;

            console.log(`Prerendering ${url}…`);

            await page.goto(url, { waitUntil: "domcontentloaded" });
            await page.waitForSelector('html[data-prerender-ready="true"]', {
                timeout: PAGE_READY_TIMEOUT_MS,
            });

            const html = await page.content();
            const outFile = outputFileForRoute(route);

            await mkdir(path.dirname(outFile), { recursive: true });
            await writeFile(outFile, html, "utf8");

            console.log(`  → ${path.relative(root, outFile)}`);

            await page.evaluate(() => {
                delete document.documentElement.dataset.prerenderReady;
            });
        }

        await browser.close();
        console.log("Prerender complete.");
    } finally {
        shutdown();
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
