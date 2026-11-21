import type {
    BuildJob,
    BuildLogLine,
    ProjectBuild,
} from "@/features/ci-cd/model/types";

import { stripAnsi } from "@/features/ci-cd/model/parse-job-log";

/**
 * File name for a downloaded job log: `<repo>-<workflow>-<job>-<sha>.log`,
 * every part reduced to characters safe on any file system.
 */
export function jobLogFileName(
    build: Pick<ProjectBuild, "commitSha" | "repositoryName" | "workflowName">,
    job: Pick<BuildJob, "name">
): string {
    const repo = build.repositoryName.split("/").pop() ?? "";
    const parts = [repo, build.workflowName, job.name, build.commitSha]
        .map((part) => slug(part))
        .filter((part) => part.length > 0);
    return `${parts.length > 0 ? parts.join("-") : "job"}.log`;
}

/**
 * The console's lines as plain text — what Copy and Download hand over.
 * ANSI colour codes are dropped; they are noise outside a terminal.
 */
export function jobLogText(lines: readonly BuildLogLine[]): string {
    if (lines.length === 0) return "";
    return `${lines.map((line) => stripAnsi(line.text)).join("\n")}\n`;
}

function slug(value: string): string {
    return value
        .toLowerCase()
        .replaceAll(/[^\p{L}\p{N}._]+/gu, "-")
        .replaceAll(/^[-.]+|-+$/g, "")
        .slice(0, 60)
        .replace(/-+$/, "");
}
