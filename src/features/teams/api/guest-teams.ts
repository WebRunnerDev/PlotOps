import type { TeamRow } from "@/features/teams/api/team-members-api";
import type { TeamsProvider } from "@/features/teams/api/teams-provider";

import { getGuestSandbox } from "@/features/guest-mode";

function mapTeam(team: {
    createdAt: string;
    id: string;
    name: string;
    ownerId: string;
    updatedAt: string;
}): TeamRow {
    return {
        created_at: team.createdAt,
        id: team.id,
        name: team.name,
        owner_id: team.ownerId,
        updated_at: team.updatedAt,
    };
}

/** Guest Mode Teams adapter — reads the local sandbox; never calls Supabase. */
export const guestTeamsProvider: TeamsProvider = {
    async createTeam() {
        return {
            data: null,
            error: new Error("Creating teams is not available in Guest Mode"),
        };
    },

    async fetchTeam(teamId) {
        const sandbox = getGuestSandbox();
        if (!sandbox) {
            return { data: null, error: new Error("No Guest Session") };
        }
        const team = sandbox.teams.find((item) => item.id === teamId);
        if (!team) {
            return { data: null, error: new Error("Team not found") };
        }
        return { data: mapTeam(team), error: null };
    },

    async fetchTeams() {
        const sandbox = getGuestSandbox();
        if (!sandbox) {
            return { data: null, error: new Error("No Guest Session") };
        }
        const teams = [...sandbox.teams]
            .toSorted(
                (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)
            )
            .map((team) => mapTeam(team));
        return { data: teams, error: null };
    },
};
