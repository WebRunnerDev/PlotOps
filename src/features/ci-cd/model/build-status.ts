import type { BuildStatus } from "@/features/ci-cd/model/types";

/** Visual tone for neon success/failure accents on the CI screen. */
export type BuildStatusTone = "failure" | "neutral" | "pending" | "success";

/** Row / badge classes — green success, red failure (SPEC Design). */
export function buildStatusAccentClass(status: BuildStatus): string {
    switch (buildStatusTone(status)) {
        case "failure": {
            return "border-red-500/50 bg-red-500/10 text-red-400";
        }
        case "neutral": {
            return "border-border bg-muted/40 text-muted-foreground";
        }
        case "pending": {
            return "border-amber-500/40 bg-amber-500/10 text-amber-300";
        }
        case "success": {
            return "border-emerald-500/50 bg-emerald-500/10 text-emerald-400";
        }
    }
}

export function buildStatusTone(status: BuildStatus): BuildStatusTone {
    switch (status) {
        case "failure": {
            return "failure";
        }
        case "queued": {
            return "neutral";
        }
        case "running": {
            return "pending";
        }
        case "success": {
            return "success";
        }
    }
}
