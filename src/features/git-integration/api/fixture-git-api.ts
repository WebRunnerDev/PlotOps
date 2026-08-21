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

const FIXTURE_AUTHOR = {
    avatar_url: null as null | string,
    login: "demo-guest",
    name: "Demo Guest",
};

/**
 * Canned GitHub-shaped data for Guest Mode.
 * Guest sessions have no provider_token — never call GitHub REST from here.
 */
export async function fetchFixtureBranchCommits(
    repoFullName: string,
    branchName: string
): Promise<GitCommit[]> {
    const short = branchSlug(branchName);

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
    const branchCommits = await fetchFixtureBranchCommits(repoFullName, "main");
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
 * Odd PR numbers include a failing lint check so rollup demos failure.
 */
export async function fetchFixturePullRequestChecks(
    repoFullName: string,
    prNumber: number
): Promise<PullRequestChecksResult> {
    const sha = "c0ffee1a2b3c4d5e6f708192a3b4c5d6e7f8091a";
    const base = `https://github.com/${repoFullName}`;
    const failing = prNumber % 2 === 1;

    const checks = [
        {
            completedAt: "2026-07-28T14:25:00.000Z",
            conclusion: "success" as const,
            detailsUrl: `${base}/actions/runs/1`,
            htmlUrl: `${base}/runs/1`,
            id: 1,
            name: "CI / test",
            startedAt: "2026-07-28T14:22:00.000Z",
            status: "completed" as const,
        },
        failing
            ? {
                  completedAt: "2026-07-28T14:24:00.000Z",
                  conclusion: "failure" as const,
                  detailsUrl: `${base}/actions/runs/2`,
                  htmlUrl: `${base}/runs/2`,
                  id: 2,
                  name: "CI / lint",
                  startedAt: "2026-07-28T14:22:30.000Z",
                  status: "completed" as const,
              }
            : {
                  completedAt: null,
                  conclusion: null,
                  detailsUrl: `${base}/actions/runs/2`,
                  htmlUrl: `${base}/runs/2`,
                  id: 2,
                  name: "CI / lint",
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
    void repoFullName;
    void prNumber;

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

function branchSlug(branchName: string): string {
    const last = branchName.split("/").at(-1);
    return last && last.length > 0 ? last : branchName;
}

/** Stable fake PR number from branch name — same branch ⇒ same PR. */
function fixturePrNumber(branchName: string): number {
    let hash = 0;
    for (const char of branchName) {
        hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
    }
    return 1000 + (hash % 9000);
}
