/**
 * Release step: checks that the PlotOps Supabase project holds every Edge
 * Function secret a feature needs. Reads the JSON of `supabase secrets list`
 * from stdin and uses only the secret names (values are digests anyway and
 * are never printed). Exits 1 when a required secret is missing or an
 * optional feature is only half configured.
 *
 *   supabase secrets list -o json | node scripts/edge-secrets.ts
 *
 * Every name a function reads with `env("…")` / `Deno.env.get("…")` must be
 * listed in `EDGE_SECRET_FEATURES`; `edge-secrets.test.ts` fails otherwise.
 */
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export type EdgeSecretFeature = {
    /**
     * `required`: every secret must be set. `optional`: the feature may be
     * off, but then every secret is unset — a partial set fails.
     */
    need: "optional" | "required";
    /** What the feature does, or why it is off. */
    note: string;
    secrets: string[];
    title: string;
};

export const EDGE_SECRET_FEATURES: EdgeSecretFeature[] = [
    {
        need: "required",
        note: "Set by Supabase for every project.",
        secrets: [
            "SUPABASE_URL",
            "SUPABASE_ANON_KEY",
            "SUPABASE_SERVICE_ROLE_KEY",
        ],
        title: "Supabase system",
    },
    {
        need: "required",
        note: "github-webhook: Task sync from GitHub App events (docs/github-webhook-setup.md §1).",
        secrets: ["GITHUB_WEBHOOK_SECRET"],
        title: "GitHub webhook",
    },
    {
        need: "required",
        note: "github-app-status and github-backfill: App status in Project Settings, Refresh links in the drawer (docs/github-webhook-setup.md §5).",
        secrets: ["GITHUB_APP_ID", "GITHUB_APP_PRIVATE_KEY"],
        title: "GitHub App API",
    },
    {
        need: "optional",
        note: "Install link slug; read from GET /app when unset.",
        secrets: ["GITHUB_APP_SLUG"],
        title: "GitHub App slug",
    },
    {
        need: "required",
        note: "send-team-invite: CAPTCHA on every invite send.",
        secrets: ["TURNSTILE_SECRET_KEY"],
        title: "Turnstile",
    },
    {
        need: "optional",
        note: "Extra CORS origins, e.g. preview deploys.",
        secrets: ["CORS_ALLOWED_ORIGINS"],
        title: "Extra CORS origins",
    },
    {
        need: "optional",
        note: "Off on purpose (ADR 0038): invites go out as copied links.",
        secrets: ["RESEND_API_KEY", "INVITE_FROM_EMAIL", "INVITE_APP_ORIGIN"],
        title: "Invite email (Resend)",
    },
];

export type EdgeSecretsReport = {
    lines: string[];
    ok: boolean;
};

export function checkEdgeSecrets(
    setNames: Iterable<string>,
    features: EdgeSecretFeature[] = EDGE_SECRET_FEATURES
): EdgeSecretsReport {
    const set = new Set(setNames);
    const lines: string[] = [];
    let ok = true;

    for (const feature of features) {
        const missing = feature.secrets.filter((name) => !set.has(name));
        const present = feature.secrets.length - missing.length;

        if (missing.length === 0) {
            lines.push(`ok    ${feature.title}`);
        } else if (feature.need === "required") {
            ok = false;
            lines.push(
                `FAIL  ${feature.title}: missing ${missing.join(", ")} — ${feature.note}`
            );
        } else if (present === 0) {
            lines.push(`off   ${feature.title} — ${feature.note}`);
        } else {
            ok = false;
            lines.push(
                `FAIL  ${feature.title}: partly set, missing ${missing.join(", ")} — set all or none`
            );
        }
    }

    return { lines, ok };
}

/** Names from `supabase secrets list -o json` (`[{ name, value, … }]`). */
export function parseSecretNames(raw: string): string[] {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
        throw new TypeError(
            "Expected a JSON array from `supabase secrets list -o json`."
        );
    }
    return parsed.flatMap((entry) =>
        entry &&
        typeof entry === "object" &&
        typeof (entry as { name?: unknown }).name === "string"
            ? [(entry as { name: string }).name]
            : []
    );
}

async function main() {
    let raw = "";
    for await (const chunk of process.stdin) raw += String(chunk);
    const names = parseSecretNames(raw);
    const report = checkEdgeSecrets(names);
    for (const line of report.lines) console.log(line);
    if (!report.ok) {
        console.error(
            "\nEdge Function secrets are incomplete. Set them with `npx supabase secrets set NAME=… --project-ref <ref>` (docs/SUPABASE.md#edge-function-secrets)."
        );
        process.exitCode = 1;
    }
}

if (
    process.argv[1] &&
    path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
    try {
        await main();
    } catch (error) {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
    }
}
