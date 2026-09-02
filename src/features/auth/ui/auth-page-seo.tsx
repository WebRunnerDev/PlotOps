import { useTranslation } from "react-i18next";

import { buildAuthPageSeo } from "@/shared/lib/page-seo-config";
import { usePageSeo } from "@/shared/lib/use-page-seo";

type AuthPageSeoProperties = {
    /** Canonical path — `/` for landing, `/sign-in`, `/sign-up`. */
    path: "/" | "/sign-in" | "/sign-up";
    titleKey: "signInTitle" | "signUpTitle";
};

export function AuthPageSeo({ path, titleKey }: AuthPageSeoProperties) {
    const { t } = useTranslation("auth");

    usePageSeo(buildAuthPageSeo(path, titleKey, t));

    return null;
}
