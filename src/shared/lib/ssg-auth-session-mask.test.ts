import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
    clearSsgAuthSessionMask,
    hasPersistedSupabaseAuthSession,
    PLOTOPS_AUTH_SESSION_HTML_ATTR,
    PLOTOPS_SSG_AUTH_MASK_ID,
    SUPABASE_AUTH_TOKEN_STORAGE_KEY,
} from "./ssg-auth-session-mask";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, "../../..");

function memoryStorage(
    entries: Record<string, string>
): Pick<Storage, "getItem" | "key" | "length"> {
    const keys = Object.keys(entries);
    return {
        getItem: (key) => entries[key] ?? undefined,
        key: (index) => keys[index] ?? undefined,
        length: keys.length,
    };
}

describe("ssg auth session mask", () => {
    it("detects default Supabase Auth localStorage keys with a payload", () => {
        expect(
            SUPABASE_AUTH_TOKEN_STORAGE_KEY.test(
                "sb-ijcelrdcygzyzhcijkhe-auth-token"
            )
        ).toBe(true);

        expect(
            hasPersistedSupabaseAuthSession(
                memoryStorage({
                    "sb-ijcelrdcygzyzhcijkhe-auth-token":
                        '{"access_token":"x"}',
                })
            )
        ).toBe(true);
    });

    it("ignores empty tokens and unrelated keys", () => {
        expect(
            hasPersistedSupabaseAuthSession(
                memoryStorage({
                    "sb-ijcelrdcygzyzhcijkhe-auth-token": "",
                    theme: "dark",
                })
            )
        ).toBe(false);
    });

    it("clears the HTML session flag and mask node", () => {
        const attributes = new Map<string, string>();
        const removed: string[] = [];
        const document_ = {
            documentElement: {
                removeAttribute: (name: string) => {
                    attributes.delete(name);
                },
            },
            querySelector: (selector: string) => {
                if (selector !== `#${PLOTOPS_SSG_AUTH_MASK_ID}`) return;
                return {
                    remove: () => {
                        removed.push(PLOTOPS_SSG_AUTH_MASK_ID);
                    },
                };
            },
        };

        attributes.set(PLOTOPS_AUTH_SESSION_HTML_ATTR, "");
        clearSsgAuthSessionMask(document_ as never);

        expect(attributes.has(PLOTOPS_AUTH_SESSION_HTML_ATTR)).toBe(false);
        expect(removed).toEqual([PLOTOPS_SSG_AUTH_MASK_ID]);
    });

    /**
     * Regression: prerendered LoginForm in `#root` on `/` painted sign-in for
     * returning sessions before Auth boot redirected. SPA `/*` uses spa.html.
     */
    it("ships an early head mask in index.html for persisted Auth sessions", () => {
        const html = readFileSync(path.join(root, "index.html"), "utf8");

        expect(html).toMatch(/data-plotops-auth-session/);
        expect(html).toMatch(/plotops-ssg-auth-mask/);
        expect(html).toContain("^sb-[a-z0-9]+-auth-token$");
        expect(html).toMatch(/id="plotops-ssg-auth-mask"/);
        // Mask must be decided in <head> before #root body paint.
        const headEnd = html.indexOf("</head>");
        const attributeScript = html.indexOf("data-plotops-auth-session");
        expect(attributeScript).toBeGreaterThan(-1);
        expect(attributeScript).toBeLessThan(headEnd);
    });
});
