import type { TeamRow } from "@/features/teams/api/team-members-api";

/**
 * Narrow Teams data seam for Guest vs Supabase resolution.
 * Happy-path reads (+ create Team) — invites/membership stay on their own APIs.
 */
export type TeamsProvider = {
    createTeam(name: string): Promise<{
        data: null | TeamRow;
        error: Error | null;
    }>;
    deleteTeam(teamId: string): Promise<{
        data: null | { id: string };
        error: Error | null;
    }>;
    fetchTeam(teamId: string): Promise<{
        data: null | TeamRow;
        error: Error | null;
    }>;
    fetchTeams(): Promise<{
        data: null | TeamRow[];
        error: Error | null;
    }>;
};
