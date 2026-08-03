import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createTeam, fetchTeams } from "@/features/teams/api/teams-api";
import { teamKeys } from "@/features/teams/model/query-keys";

export function useCreateTeam() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (name: string) => {
            const { data, error } = await createTeam(name);
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
    return useQuery({
        queryFn: async () => {
            const { data, error } = await fetchTeams();
            if (error) throw error;
            return data ?? [];
        },
        queryKey: teamKeys.list(),
    });
}
