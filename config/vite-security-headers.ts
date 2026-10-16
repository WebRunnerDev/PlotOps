import type { Plugin, ResolvedConfig } from "vite";

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const HEADERS_FILE = "_headers";

type HeaderRule = {
    headers: [name: string, value: string][];
    pattern: RegExp;
};

/**
 * Parse the Cloudflare Pages `_headers` subset we use: an unindented URL
 * pattern (`*` splat) followed by indented `Name: value` lines.
 */
export function parseHeadersFile(source: string): HeaderRule[] {
    const rules: HeaderRule[] = [];
    for (const line of source.split(/\r?\n/)) {
        if (!line.trim() || line.trimStart().startsWith("#")) continue;
        if (/^\s/.test(line)) {
            const separator = line.indexOf(":");
            const rule = rules.at(-1);
            if (separator === -1 || !rule) continue;
            rule.headers.push([
                line.slice(0, separator).trim(),
                line.slice(separator + 1).trim(),
            ]);
            continue;
        }
        const escaped = line
            .trim()
            .replaceAll(/[.+?^${}()|[\]\\]/g, String.raw`\$&`)
            .replaceAll("*", ".*");
        rules.push({ headers: [], pattern: new RegExp(`^${escaped}$`) });
    }
    return rules;
}

export function renderHeadersTemplate(
    template: string,
    supabaseUrl: string | undefined
): string {
    const { origin, wsOrigin } = supabaseOrigins(supabaseUrl);
    return template
        .replaceAll("__SUPABASE_WS_ORIGIN__", wsOrigin)
        .replaceAll("__SUPABASE_ORIGIN__", origin);
}

/**
 * Fills Supabase origins into `dist/_headers` after build and applies the
 * same headers in `vite preview`, so e2e sees what Cloudflare Pages serves.
 */
export function securityHeaders(): Plugin {
    let config: ResolvedConfig;

    return {
        configResolved(resolved) {
            config = resolved;
        },
        configurePreviewServer(server) {
            const file = path.resolve(
                server.config.root,
                server.config.build.outDir,
                HEADERS_FILE
            );
            const rules = parseHeadersFile(readFileSync(file, "utf8"));
            server.middlewares.use((request, response, next) => {
                const pathname = new URL(request.url ?? "/", "http://local")
                    .pathname;
                for (const rule of rules) {
                    if (!rule.pattern.test(pathname)) continue;
                    for (const [name, value] of rule.headers) {
                        response.setHeader(name, value);
                    }
                }
                next();
            });
        },
        name: "plotops-security-headers",
        writeBundle() {
            const file = path.resolve(
                config.root,
                config.build.outDir,
                HEADERS_FILE
            );
            const rendered = renderHeadersTemplate(
                readFileSync(file, "utf8"),
                config.env.VITE_SUPABASE_URL
            );
            writeFileSync(file, rendered, "utf8");
        },
    };
}

/** `https://x.supabase.co` → origins for img/connect (`https:` + `wss:`). */
export function supabaseOrigins(supabaseUrl?: string): {
    origin: string;
    wsOrigin: string;
} {
    if (!supabaseUrl?.trim()) {
        throw new Error(
            "VITE_SUPABASE_URL is required to build CSP in _headers"
        );
    }
    const url = new URL(supabaseUrl.trim());
    const wsProtocol = url.protocol === "http:" ? "ws:" : "wss:";
    return {
        origin: url.origin,
        wsOrigin: `${wsProtocol}//${url.host}`,
    };
}
