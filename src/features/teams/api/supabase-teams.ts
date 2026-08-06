import type { TeamsProvider } from "@/features/teams/api/teams-provider";

import { fetchTeam } from "@/features/teams/api/team-members-api";
import { createTeam, fetchTeams } from "@/features/teams/api/teams-api";

/** Real-account Teams adapter — delegates to existing Supabase APIs. */
export const supabaseTeamsProvider: TeamsProvider = {
    async createTeam(name) {
        const result = await createTeam(name);
        return {
            data: result.data,
            error: result.error ? new Error(result.error.message) : null,
        };
    },

    async fetchTeam(teamId) {
        const result = await fetchTeam(teamId);
        return {
            data: result.data,
            error: result.error ? new Error(result.error.message) : null,
        };
    },

    async fetchTeams() {
        const result = await fetchTeams();
        return {
            data: result.data,
            error: result.error ? new Error(result.error.message) : null,
        };
    },
};
