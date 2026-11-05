import { useQuery } from "@tanstack/react-query";

import type { GitHubRepo } from "@/features/projects/model/types";

import { GUEST_DEMO_GITHUB_REPOS, useIsGuest } from "@/features/guest-mode";
import { fetchUserRepos } from "@/features/projects/api/github-api";

import { projectKeys } from "./query-keys";

/**
 * The viewer's GitHub repositories for the repo pickers. Guest Mode has no
 * GitHub token, so it lists the fake demo account's repositories instead.
 */
export function useGitHubRepos(
    accessToken: null | string | undefined,
    userId: null | string | undefined
) {
    const guest = useIsGuest();

    return useQuery({
        enabled: guest || Boolean(accessToken && userId),
        queryFn: guest
            ? () => Promise.resolve(guestGitHubRepos())
            : () => fetchUserRepos(accessToken!),
        queryKey: guest
            ? projectKeys.githubRepos("guest")
            : projectKeys.githubRepos(userId ?? ""),
        staleTime: 60_000,
    });
}

function guestGitHubRepos(): GitHubRepo[] {
    return GUEST_DEMO_GITHUB_REPOS.map((repo) => {
        const [owner = "plotops-demo"] = repo.fullName.split("/");
        return {
            default_branch: repo.defaultBranch,
            description: repo.description,
            full_name: repo.fullName,
            html_url: repo.htmlUrl,
            id: repo.id,
            name: repo.name,
            owner: { avatar_url: "", login: owner },
            private: repo.isPrivate,
        };
    });
}
