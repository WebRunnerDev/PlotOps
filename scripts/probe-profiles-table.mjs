/**
 * Feedback loop for "Could not find the table public.profiles" (PGRST205).
 *
 * Uses the Vite-resolved Supabase URL (.env.local overrides .env).
 * GREEN = profiles is in PostgREST schema cache (even if anon is RLS-denied).
 * RED = PGRST205 / table missing from schema cache / unreachable.
 * Secrets are never printed.
 */
import fs from "node:fs";

function load(path) {
    try {
        return Object.fromEntries(
            fs
                .readFileSync(path, "utf8")
                .split(/\r?\n/)
                .filter((line) => line && !line.startsWith("#"))
                .map((line) => {
                    const index = line.indexOf("=");
                    return [line.slice(0, index), line.slice(index + 1)];
                })
        );
    } catch {
        return {};
    }
}

const base = load(".env");
const local = load(".env.local");
const url = (local.VITE_SUPABASE_URL || base.VITE_SUPABASE_URL || "").trim();
const key = (
    local.VITE_SUPABASE_PUBLISHABLE_KEY ||
    base.VITE_SUPABASE_PUBLISHABLE_KEY ||
    ""
).trim();

console.log("loop_target=" + url);

let response;
try {
    response = await fetch(`${url}/rest/v1/profiles?select=id&limit=0`, {
        headers: {
            Authorization: `Bearer ${key}`,
            apikey: key,
        },
    });
} catch (error) {
    console.log("loop_verdict=RED");
    console.log("loop_error=" + error.message);
    process.exit(1);
}

const body = await response.json().catch(() => ({}));
console.log("http_status=" + response.status);
console.log("code=" + (body.code || "<none>"));
console.log("message=" + (body.message || "<none>"));

const isMissingFromSchemaCache =
    body.code === "PGRST205" ||
    (typeof body.message === "string" &&
        body.message.includes("Could not find the table 'public.profiles'"));

if (isMissingFromSchemaCache) {
    console.log("loop_verdict=RED");
    process.exit(1);
}

console.log("loop_verdict=GREEN");
