import type {
    GitCommit,
    GitPrFile,
    GitPullRequest,
    PullRequestChecksResult,
    PullRequestCommitsResult,
    PullRequestFilesResult,
} from "@/features/git-integration/api/github-git-api";

import { textReferencesTaskKey } from "@/features/git-integration/lib/extract-task-key";
import { mapCheckRollup } from "@/features/git-integration/lib/map-check-rollup";
import { getGuestSandbox } from "@/features/guest-mode";

const FIXTURE_AUTHOR = {
    avatar_url: null as null | string,
    login: "demo-guest",
    name: "Demo Guest",
};

/**
 * Which canned dataset a repository gets. «Web + API» (ADR 0035) has a
 * frontend and a backend Repository, so every fixture below reads per
 * Repository: a `…/api` repo serves backend commits, files and checks.
 */
type FixtureFlavor = "api" | "web";

/**
 * Canned GitHub-shaped data for Guest Mode.
 * Guest sessions have no provider_token — never call GitHub REST from here.
 */
export async function fetchFixtureBranchCommits(
    repoFullName: string,
    branchName: string
): Promise<GitCommit[]> {
    const short = branchSlug(branchName);

    if (fixtureFlavor(repoFullName) === "api") {
        return [
            {
                author: {
                    ...FIXTURE_AUTHOR,
                    date: "2026-07-28T11:48:00.000Z",
                },
                message: `feat(api): RPC and RLS policy for ${short}`,
                sha: "a91f0c3e5b7d9f1a3c5e7091b2d4f6a8c0e2f4a6",
                url: `https://github.com/${repoFullName}/commit/a91f0c3e5b7d9f1a3c5e7091b2d4f6a8c0e2f4a6`,
            },
            {
                author: {
                    ...FIXTURE_AUTHOR,
                    date: "2026-07-27T15:12:00.000Z",
                },
                message: `test(api): pgTAP coverage for ${short}`,
                sha: "5eed5eed0a1b2c3d4e5f60718293a4b5c6d7e8f9",
                url: `https://github.com/${repoFullName}/commit/5eed5eed0a1b2c3d4e5f60718293a4b5c6d7e8f9`,
            },
        ];
    }

    return [
        {
            author: {
                ...FIXTURE_AUTHOR,
                date: "2026-07-28T14:22:00.000Z",
            },
            message: `feat: polish ${short} for portfolio demo`,
            sha: "c0ffee1a2b3c4d5e6f708192a3b4c5d6e7f8091a",
            url: `https://github.com/${repoFullName}/commit/c0ffee1a2b3c4d5e6f708192a3b4c5d6e7f8091a`,
        },
        {
            author: {
                ...FIXTURE_AUTHOR,
                date: "2026-07-27T09:05:00.000Z",
            },
            message: `chore: wire tests for ${short}`,
            sha: "bada55e1f2a3b4c5d6e7f8091a2b3c4d5e6f7081",
            url: `https://github.com/${repoFullName}/commit/bada55e1f2a3b4c5d6e7f8091a2b3c4d5e6f7081`,
        },
        {
            author: {
                ...FIXTURE_AUTHOR,
                date: "2026-07-26T16:40:00.000Z",
            },
            message: `feat: scaffold ${short}`,
            sha: "deadbeef0123456789abcdef0123456789abcdef",
            url: `https://github.com/${repoFullName}/commit/deadbeef0123456789abcdef0123456789abcdef`,
        },
    ];
}

export async function fetchFixtureBranchPullRequests(
    repoFullName: string,
    branchName: string
): Promise<GitPullRequest[]> {
    // A seeded Git link in this Repository answers for its branch: its PR,
    // or none at all for a branch that has no PR yet.
    const linked = findSandboxGitLink(repoFullName, { branchName });
    if (linked) {
        if (!linked.pr) return [];
        const merged = linked.pr.state === "merged";
        return [
            {
                body: "Canned pull request for the Guest Mode walkthrough. No GitHub API calls.",
                created_at: "2026-07-27T10:00:00.000Z",
                draft: false,
                head_ref: branchName,
                mergeable: linked.pr.state === "open" ? true : null,
                merged_at: merged ? "2026-07-29T09:30:00.000Z" : null,
                number: linked.pr.number,
                state: linked.pr.state === "open" ? "open" : "closed",
                title: `${linked.taskKey}: ${branchSlug(branchName)}`,
                updated_at: "2026-07-28T14:30:00.000Z",
                url: linked.pr.url,
            },
        ];
    }

    const number = fixturePrNumber(branchName);
    const title = `Demo: ${branchName}`;

    return [
        {
            body: "Canned pull request for the Guest Mode walkthrough. No GitHub API calls.",
            created_at: "2026-07-27T10:00:00.000Z",
            draft: false,
            head_ref: branchName,
            mergeable: true,
            merged_at: null,
            number,
            state: "open",
            title,
            updated_at: "2026-07-28T14:30:00.000Z",
            url: `https://github.com/${repoFullName}/pull/${number}`,
        },
    ];
}

export async function fetchFixtureCommitBySha(
    repoFullName: string,
    sha: string
): Promise<GitCommit> {
    const normalized = sha.toLowerCase();
    const branchCommits = await fetchFixtureBranchCommits(
        repoFullName,
        fixtureFlavor(repoFullName) === "api" ? "develop" : "main"
    );
    const match = branchCommits.find((commit) =>
        commit.sha.startsWith(normalized)
    );
    if (match) return match;

    return {
        author: {
            ...FIXTURE_AUTHOR,
            date: "2026-07-28T14:22:00.000Z",
        },
        message: "TASK-1: linked fixture commit",
        sha:
            normalized.length >= 40
                ? normalized
                : `${normalized}000000000000000000000000000`.slice(0, 40),
        url: `https://github.com/${repoFullName}/commit/${normalized}`,
    };
}

export async function fetchFixtureCommitFiles(
    repoFullName: string,
    sha: string
): Promise<PullRequestFilesResult> {
    const normalized = sha.toLowerCase();
    const all = await fetchFixturePullRequestFiles(repoFullName, 1);

    if (fixtureFlavor(repoFullName) === "api") {
        return {
            files: all.files.filter((file) =>
                normalized.startsWith("5eed")
                    ? file.filename.startsWith("supabase/tests")
                    : !file.filename.startsWith("supabase/tests")
            ),
            truncated: false,
        };
    }

    if (normalized.startsWith("bada55")) {
        return {
            files: all.files.filter((file) =>
                file.filename.includes("guest-session")
            ),
            truncated: false,
        };
    }

    if (normalized.startsWith("deadbeef")) {
        return { files: [], truncated: false };
    }

    return {
        files: all.files.filter((file) => file.filename.includes("login-form")),
        truncated: false,
    };
}

/**
 * Canned check runs for Guest Mode — mix of CI + a fake agent check.
 * Odd PR numbers include a failing lint check so rollup demos failure,
 * unless the sandbox says that PR is merged.
 */
export async function fetchFixturePullRequestChecks(
    repoFullName: string,
    prNumber: number
): Promise<PullRequestChecksResult> {
    const api = fixtureFlavor(repoFullName) === "api";
    const sha = api
        ? "a91f0c3e5b7d9f1a3c5e7091b2d4f6a8c0e2f4a6"
        : "c0ffee1a2b3c4d5e6f708192a3b4c5d6e7f8091a";
    const base = `https://github.com/${repoFullName}`;
    // A merged PR passed its checks; otherwise odd numbers demo a failure.
    const merged =
        findSandboxGitLink(repoFullName, { prNumber })?.pr?.state === "merged";
    const failing = !merged && prNumber % 2 === 1;
    const testName = api ? "API / pgTAP" : "CI / test";
    const lintName = api ? "API / deno check" : "CI / lint";

    const checks = [
        {
            completedAt: "2026-07-28T14:25:00.000Z",
            conclusion: "success" as const,
            detailsUrl: `${base}/actions/runs/1`,
            htmlUrl: `${base}/runs/1`,
            id: 1,
            name: testName,
            startedAt: "2026-07-28T14:22:00.000Z",
            status: "completed" as const,
        },
        failing || merged
            ? {
                  completedAt: "2026-07-28T14:24:00.000Z",
                  conclusion: failing
                      ? ("failure" as const)
                      : ("success" as const),
                  detailsUrl: `${base}/actions/runs/2`,
                  htmlUrl: `${base}/runs/2`,
                  id: 2,
                  name: lintName,
                  startedAt: "2026-07-28T14:22:30.000Z",
                  status: "completed" as const,
              }
            : {
                  completedAt: null,
                  conclusion: null,
                  detailsUrl: `${base}/actions/runs/2`,
                  htmlUrl: `${base}/runs/2`,
                  id: 2,
                  name: lintName,
                  startedAt: "2026-07-28T14:22:30.000Z",
                  status: "in_progress" as const,
              },
        {
            completedAt: "2026-07-28T14:26:00.000Z",
            conclusion: "success" as const,
            detailsUrl: `${base}/pull/${prNumber}/checks`,
            htmlUrl: `${base}/runs/3`,
            id: 3,
            name: "PlotOps Agent Review",
            startedAt: "2026-07-28T14:23:00.000Z",
            status: "completed" as const,
        },
        {
            completedAt: "2026-07-28T14:23:00.000Z",
            conclusion: "success" as const,
            detailsUrl: `${base}/pull/${prNumber}/checks`,
            htmlUrl: `${base}/runs/4`,
            id: 4,
            name: "Bugbot",
            startedAt: "2026-07-28T14:22:10.000Z",
            status: "completed" as const,
        },
    ];

    return {
        checks,
        rollup: mapCheckRollup(checks),
        sha,
        truncated: false,
    };
}

export async function fetchFixturePullRequestCommits(
    repoFullName: string,
    prNumber: number
): Promise<PullRequestCommitsResult> {
    void prNumber;
    const commits = await fetchFixtureBranchCommits(repoFullName, "demo-pr");
    return { commits, truncated: false };
}

export async function fetchFixturePullRequestFiles(
    repoFullName: string,
    prNumber: number
): Promise<PullRequestFilesResult> {
    void prNumber;

    if (fixtureFlavor(repoFullName) === "api") {
        return { files: apiFixtureFiles(repoFullName), truncated: false };
    }

    const files: GitPrFile[] = [
        {
            additions: 12,
            blob_url:
                "https://github.com/demo/plotops/blob/demo/login-form.tsx",
            deletions: 3,
            filename: "src/features/auth/ui/login-form.tsx",
            patch: [
                "@@ -40,8 +40,17 @@ export function LoginForm() {",
                "   return (",
                "     <form onSubmit={handleSubmit}>",
                '+      <Button type="button" variant="secondary" onClick={handleGuest}>',
                "+        Try demo",
                "+      </Button>",
                '       <Button type="submit">Sign in with GitHub</Button>',
                "     </form>",
                "   );",
            ].join("\n"),
            previous_filename: undefined,
            status: "modified",
        },
        {
            additions: 6,
            blob_url:
                "https://github.com/demo/plotops/blob/demo/guest-session.ts",
            deletions: 0,
            filename: "src/features/guest-mode/lib/guest-session.ts",
            patch: [
                "@@ -0,0 +1,6 @@",
                "+export function isGuest() {",
                "+  return sessionStorage.getItem('plotops-guest') === '1';",
                "+}",
            ].join("\n"),
            previous_filename: undefined,
            status: "added",
        },
    ];

    return { files, truncated: false };
}

/** Commits whose message mentions the task key (guest demo smart commits). */
export async function fetchFixtureTaskKeyCommits(
    repoFullName: string,
    taskKey: string
): Promise<GitCommit[]> {
    const branchCommits = await fetchFixtureBranchCommits(
        repoFullName,
        `feature/${taskKey}-demo`
    );

    return branchCommits.some((commit) =>
        textReferencesTaskKey(commit.message, taskKey)
    )
        ? branchCommits.map((commit, index) =>
              index === 0
                  ? {
                        ...commit,
                        message: `${taskKey}: ${commit.message}`,
                    }
                  : commit
          )
        : [
              {
                  author: {
                      ...FIXTURE_AUTHOR,
                      date: "2026-07-28T14:22:00.000Z",
                  },
                  message: `${taskKey}: guest demo smart commit`,
                  sha: "c0ffee1a2b3c4d5e6f708192a3b4c5d6e7f8091a",
                  url: `https://github.com/${repoFullName}/commit/c0ffee1a2b3c4d5e6f708192a3b4c5d6e7f8091a`,
              },
          ];
}

function apiFixtureFiles(repoFullName: string): GitPrFile[] {
    const blob = `https://github.com/${repoFullName}/blob/demo`;
    return [
        {
            additions: 14,
            blob_url: `${blob}/supabase/migrations/20260727_guest_demo.sql`,
            deletions: 2,
            filename: "supabase/migrations/20260727_guest_demo.sql",
            patch: [
                "@@ -0,0 +1,14 @@",
                "+create function public.guest_demo_builds(p_project_id uuid)",
                "+returns setof public.builds",
                "+language sql",
                "+stable",
                "+as $$",
                "+  select * from public.builds where project_id = p_project_id;",
                "+$$;",
            ].join("\n"),
            previous_filename: undefined,
            status: "added",
        },
        {
            additions: 9,
            blob_url: `${blob}/supabase/tests/guest_demo_test.sql`,
            deletions: 0,
            filename: "supabase/tests/guest_demo_test.sql",
            patch: [
                "@@ -0,0 +1,9 @@",
                "+select plan(2);",
                "+select has_function('public', 'guest_demo_builds', array['uuid']);",
                "+select is_empty($$ select * from public.guest_demo_builds(gen_random_uuid()) $$);",
                "+select * from finish();",
            ].join("\n"),
            previous_filename: undefined,
            status: "added",
        },
    ];
}

function branchSlug(branchName: string): string {
    const last = branchName.split("/").at(-1);
    return last && last.length > 0 ? last : branchName;
}

/**
 * The Guest sandbox Git link in this Repository that matches — by branch or
 * by PR number — if a Task holds one, so seeded links show their real PR.
 */
function findSandboxGitLink(
    repoFullName: string,
    match: { branchName: string } | { prNumber: number }
):
    | undefined
    | {
          pr?: {
              number: number;
              state: "closed" | "merged" | "open";
              url: string;
          };
          taskKey: string;
      } {
    const sandbox = getGuestSandbox();
    if (!sandbox) return undefined;
    const repositoryIds = new Set(
        sandbox.projects.flatMap((project) =>
            project.repositories
                .filter((repo) => repo.fullName === repoFullName)
                .map((repo) => repo.id)
        )
    );
    if (repositoryIds.size === 0) return undefined;
    for (const task of sandbox.tasks) {
        const link = task.gitLinks?.find(
            (item) =>
                repositoryIds.has(item.repositoryId) &&
                ("branchName" in match
                    ? item.branchName === match.branchName
                    : item.pr?.number === match.prNumber)
        );
        if (link) return { pr: link.pr, taskKey: task.key };
    }
    return undefined;
}

function fixtureFlavor(repoFullName: string): FixtureFlavor {
    return repoFullName.toLowerCase().endsWith("/api") ? "api" : "web";
}

/** Stable fake PR number from branch name — same branch ⇒ same PR. */
function fixturePrNumber(branchName: string): number {
    let hash = 0;
    for (const char of branchName) {
        hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
    }
    return 1000 + (hash % 9000);
}
