import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { isGuest } from "@/features/guest-mode";
import { resolveTeamsProvider } from "@/features/teams/api/resolve-teams-provider";
import { teamKeys } from "@/features/teams/model/query-keys";

export function useCreateTeam() {
    const queryClient = useQueryClient();
    const provider = resolveTeamsProvider(isGuest());

    return useMutation({
        mutationFn: async (name: string) => {
            const { data, error } = await provider.createTeam(name);
            if (error) throw error;
            if (!data) throw new Error("Could not create team");
            return data;
        },
        onSuccess: (team) => {
            queryClient.invalidateQueries({ queryKey: teamKeys.list() });
            queryClient.setQueryData(teamKeys.detail(team.id), team);
        },
    });
}

export function useTeams() {
    const provider = resolveTeamsProvider(isGuest());

    return useQuery({
        queryFn: async () => {
            const { data, error } = await provider.fetchTeams();
            if (error) throw error;
            return data ?? [];
        },
        queryKey: teamKeys.list(),
    });
}
