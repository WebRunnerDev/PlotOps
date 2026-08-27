import type { TeamRow } from "@/features/teams/api/team-members-api";
import type { TeamsProvider } from "@/features/teams/api/teams-provider";

import { getGuestSandbox, writeGuestSandbox } from "@/features/guest-mode";

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

    async deleteTeam() {
        return {
            data: null,
            error: new Error("Deleting teams is not available in Guest Mode"),
        };
    },

    async updateTeam(teamId, name) {
        const sandbox = getGuestSandbox();
        if (!sandbox) {
            return { data: null, error: new Error("No Guest Session") };
        }
        const index = sandbox.teams.findIndex((item) => item.id === teamId);
        if (index === -1) {
            return { data: null, error: new Error("Team not found") };
        }
        const trimmed = name.trim();
        if (trimmed.length === 0) {
            return {
                data: null,
                error: new Error("Team name cannot be empty"),
            };
        }
        const updated = structuredClone(sandbox);
        const now = new Date().toISOString();
        updated.teams[index] = {
            ...updated.teams[index]!,
            name: trimmed,
            updatedAt: now,
        };
        writeGuestSandbox(updated);
        return { data: mapTeam(updated.teams[index]!), error: null };
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
