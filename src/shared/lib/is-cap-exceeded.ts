/** Hints raised by the cap triggers in `*_membership_and_project_caps.sql`. */
const CAP_HINTS = [
    "team_memberships_cap",
    "team_projects_cap",
    "teams_owned_cap",
] as const;

export type CapHint = (typeof CAP_HINTS)[number];

/**
 * A cap trigger rejection (ADR 0032). The triggers raise P0001, which many
 * other checks share, so the `hint` is what identifies the cap. The caps are
 * mirrored client-side, making this the backstop for races and for writes that
 * skipped the UI gate — pass `hint` to match one specific cap.
 */
export function isCapExceeded(error: unknown, hint?: CapHint): boolean {
    if (typeof error !== "object" || error === null) return false;
    const candidate = error as { code?: unknown; hint?: unknown };
    if (candidate.code !== "P0001") return false;
    if (typeof candidate.hint !== "string") return false;
    return hint === undefined
        ? CAP_HINTS.includes(candidate.hint as CapHint)
        : candidate.hint === hint;
}
