import { useTranslation } from "react-i18next";

import { PLOTOPS_SITE_NAME, PLOTOPS_SITE_TAGLINE } from "@/shared/config/site";
import { usePageSeo } from "@/shared/lib/use-page-seo";

type AuthPageSeoProperties = {
    /** Canonical path — `/` for landing, `/sign-in`, `/sign-up`. */
    path: "/" | "/sign-in" | "/sign-up";
    titleKey: "signInTitle" | "signUpTitle";
};

export function AuthPageSeo({ path, titleKey }: AuthPageSeoProperties) {
    const { t } = useTranslation("auth");

    usePageSeo({
        description: t("marketing.seoDescription"),
        path,
        title: `${t(titleKey)} — ${PLOTOPS_SITE_NAME} · ${PLOTOPS_SITE_TAGLINE}`,
    });

    return null;
}
