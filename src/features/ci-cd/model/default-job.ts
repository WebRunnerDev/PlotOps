import type { BuildJob } from "@/features/ci-cd/model/types";

/**
 * The job whose log the run dialog opens on: the first failed one (why the run
 * is red), else the first still running or queued (what is happening now),
 * else the first job.
 */
export function pickDefaultJob(
    jobs: readonly BuildJob[]
): BuildJob | undefined {
    return (
        jobs.find((job) => job.status === "failure") ??
        jobs.find((job) => job.status === "running") ??
        jobs.find((job) => job.status === "queued") ??
        jobs[0]
    );
}
