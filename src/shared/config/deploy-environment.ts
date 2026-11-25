/**
 * Which Cloudflare Pages branch this bundle was built from. `vite.config.ts`
 * copies `CF_PAGES_BRANCH` into `VITE_DEPLOY_BRANCH` at build time; it is empty
 * outside Cloudflare (local dev, tests, CI).
 *
 * Every Pages build, previews included, talks to the production Supabase
 * project, so a preview build works on real data.
 */
export const PRODUCTION_BRANCH = "main";

export function isPreviewBranch(branch: unknown): branch is string {
    return (
        typeof branch === "string" &&
        branch !== "" &&
        branch !== PRODUCTION_BRANCH
    );
}

const deployBranch: unknown = import.meta.env.VITE_DEPLOY_BRANCH;

/** Branch name of a preview build; `undefined` for production and local builds. */
export const PREVIEW_BRANCH: string | undefined = isPreviewBranch(deployBranch)
    ? deployBranch
    : undefined;
