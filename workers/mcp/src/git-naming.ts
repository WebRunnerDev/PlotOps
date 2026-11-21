/**
 * Git naming an agent should use for a Task so the GitHub webhook auto-links
 * the work (ADR 0035 «Auto-link»): the task key anywhere in the head branch,
 * PR title or body links a PR / branch; in a commit message it links the
 * commit. The names are a suggestion — only the key is load-bearing.
 */

export type GitNaming = {
    branch: string;
    commit_example: string;
    hint: string;
    pr_title: string;
    task_key: string;
};

type NamingSource = {
    task_key: string;
    task_type?: null | string;
    title?: null | string;
};

const MAX_SLUG_LENGTH = 40;

/**
 * `feat/WEB-12-login-form`, `fix/WEB-7-crash-on-save`; a title with no
 * ASCII words (e.g. Cyrillic) yields `feat/WEB-12`.
 */
export function taskGitNaming(task: NamingSource): GitNaming {
    const key = task.task_key;
    const title = (task.title ?? "").trim();
    const prefix = task.task_type === "bug" ? "fix" : "feat";
    const slug = slugify(title);

    return {
        branch: slug ? `${prefix}/${key}-${slug}` : `${prefix}/${key}`,
        commit_example: `${prefix}: <what changed> (${key})`,
        hint: `Include ${key} in the branch name, every commit message and the PR title so PlotOps links them to this task. Keep the repo's own naming style.`,
        pr_title: title ? `${key}: ${title}` : key,
        task_key: key,
    };
}

function slugify(title: string): string {
    const slug = title
        .toLowerCase()
        .replaceAll(/[^a-z0-9]+/g, "-")
        .replaceAll(/^-+|-+$/g, "")
        // `login-2` would read as a task key to the webhook matcher.
        .replaceAll(/([a-z])-(?=\d)/g, "$1");
    if (slug.length <= MAX_SLUG_LENGTH) return slug;

    // One extra char shows whether the cut lands on a word boundary.
    const cut = slug.slice(0, MAX_SLUG_LENGTH + 1);
    const lastDash = cut.lastIndexOf("-");
    return lastDash > 0
        ? cut.slice(0, lastDash)
        : cut.slice(0, MAX_SLUG_LENGTH);
}
