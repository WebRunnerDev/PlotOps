import { useTranslation } from "react-i18next";

import { PREVIEW_BRANCH } from "@/shared/config/deploy-environment";

/**
 * Shown on Cloudflare Pages branch previews, which run unreviewed code against
 * the production database. Click-through, so it never blocks the UI under it.
 */
export function PreviewBanner({
    branch = PREVIEW_BRANCH,
}: {
    branch?: string;
}) {
    const { t } = useTranslation("common");

    if (!branch) return null;

    return (
        <div className="pointer-events-none fixed inset-x-0 bottom-3 z-110 flex justify-center px-3">
            <p
                className="bg-destructive max-w-full rounded-xl px-3 py-1 text-center text-xs text-balance font-medium text-white shadow-lg"
                role="status"
            >
                {t("previewBanner", { branch })}
            </p>
        </div>
    );
}
