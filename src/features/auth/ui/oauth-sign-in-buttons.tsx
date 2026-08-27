import { useTranslation } from "react-i18next";

import { Button } from "@/shared/shadcn/ui/button";

export type OAuthProviderLoading = "github" | "google" | null;

type OAuthSignInButtonsProperties = {
    disabled: boolean;
    loading: OAuthProviderLoading;
    onGitHub: () => void;
    onGoogle: () => void;
};

export function OAuthSignInButtons({
    disabled,
    loading,
    onGitHub,
    onGoogle,
}: OAuthSignInButtonsProperties) {
    const { t } = useTranslation("auth");

    return (
        <div className="flex flex-col gap-3">
            <Button
                className="w-full"
                disabled={disabled}
                onClick={onGitHub}
                size="lg"
                type="button"
                variant="outline"
            >
                {loading === "github"
                    ? t("githubRedirecting")
                    : t("githubSignIn")}
            </Button>

            <Button
                className="w-full"
                disabled={disabled}
                onClick={onGoogle}
                size="lg"
                type="button"
                variant="outline"
            >
                {loading === "google"
                    ? t("googleRedirecting")
                    : t("googleSignIn")}
            </Button>
        </div>
    );
}
