import { useNavigate, useRouter } from "@tanstack/react-router";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { updateProfileNames } from "@/features/auth/api/profile-api";
import { mergeCompleteProfilePrefill } from "@/features/auth/lib/complete-profile-prefill";
import { splitFullName } from "@/features/auth/lib/user-display";
import { useAuth } from "@/features/auth/model/use-auth";
import { safeGetItem, safeRemoveItem } from "@/shared/lib/safe-storage";
import { Alert, AlertDescription } from "@/shared/shadcn/ui/alert";
import { Button } from "@/shared/shadcn/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/shared/shadcn/ui/card";
import { Input } from "@/shared/shadcn/ui/input";
import { Label } from "@/shared/shadcn/ui/label";

type CompleteProfileFormProperties = {
    redirectTo?: string;
};

type FieldErrors = {
    firstName?: string;
    lastName?: string;
};

export function CompleteProfileForm({
    redirectTo,
}: CompleteProfileFormProperties) {
    const { t } = useTranslation("auth");
    const navigate = useNavigate();
    const router = useRouter();
    const { profile, refreshProfile, signOut, user } = useAuth();

    const prefill = useMemo(() => {
        if (profile?.first_name || profile?.last_name) {
            return {
                firstName: profile.first_name?.trim() ?? "",
                lastName: profile.last_name?.trim() ?? "",
            };
        }

        const githubName = user?.user_metadata?.name;
        if (typeof githubName === "string" && githubName.trim()) {
            return splitFullName(githubName);
        }

        return { firstName: "", lastName: "" };
    }, [profile, user]);

    const [firstName, setFirstName] = useState(prefill.firstName);
    const [lastName, setLastName] = useState(prefill.lastName);
    const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
    const [formError, setFormError] = useState<null | string>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSigningOut, setIsSigningOut] = useState(false);

    useEffect(() => {
        setFirstName(
            (current) =>
                mergeCompleteProfilePrefill(
                    { firstName: current, lastName: "" },
                    prefill
                ).firstName
        );
        setLastName(
            (current) =>
                mergeCompleteProfilePrefill(
                    { firstName: "", lastName: current },
                    prefill
                ).lastName
        );
    }, [prefill]);

    const handleSignOut = async () => {
        setFormError(null);
        setIsSigningOut(true);
        try {
            await signOut();
            await navigate({ to: "/sign-in" });
        } catch {
            setFormError(t("errors.generic"));
            setIsSigningOut(false);
        }
    };

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        setFormError(null);

        if (!user) {
            setFormError(t("errors.generic"));
            return;
        }

        const nextErrors: FieldErrors = {};
        if (!firstName.trim()) {
            nextErrors.firstName = t("errors.firstNameRequired");
        }
        if (!lastName.trim()) {
            nextErrors.lastName = t("errors.lastNameRequired");
        }
        if (nextErrors.firstName || nextErrors.lastName) {
            setFieldErrors(nextErrors);
            return;
        }

        setFieldErrors({});
        setIsLoading(true);

        try {
            await updateProfileNames({
                firstName,
                lastName,
                userId: user.id,
            });
            await refreshProfile();
            const nextPath = resolvePostSavePath(redirectTo);
            if (nextPath.startsWith("/invite/")) {
                const token = nextPath.slice("/invite/".length);
                await navigate({ params: { token }, to: "/invite/$token" });
                return;
            }
            router.history.push(nextPath);
        } catch {
            setFormError(t("errors.generic"));
            setIsLoading(false);
        }
    };

    return (
        <Card className="mx-auto w-full max-w-sm">
            <CardHeader className="text-center">
                <CardTitle>{t("completeProfile.title")}</CardTitle>
                <CardDescription>
                    {t("completeProfile.description")}
                </CardDescription>
            </CardHeader>

            <CardContent className="flex flex-col gap-6">
                {formError ? (
                    <Alert variant="destructive">
                        <AlertDescription>{formError}</AlertDescription>
                    </Alert>
                ) : null}

                <form
                    className="flex flex-col gap-4"
                    noValidate
                    onSubmit={handleSubmit}
                >
                    <div className="flex flex-col gap-2">
                        <Label htmlFor="complete-first-name">
                            {t("firstName")}
                        </Label>
                        <Input
                            aria-invalid={Boolean(fieldErrors.firstName)}
                            autoComplete="given-name"
                            id="complete-first-name"
                            onChange={(event) => {
                                setFirstName(event.target.value);
                                if (fieldErrors.firstName) {
                                    setFieldErrors((current) => ({
                                        ...current,
                                        firstName: undefined,
                                    }));
                                }
                            }}
                            placeholder={t("firstNamePlaceholder")}
                            type="text"
                            value={firstName}
                        />
                        {fieldErrors.firstName ? (
                            <p className="text-meta text-destructive">
                                {fieldErrors.firstName}
                            </p>
                        ) : null}
                    </div>

                    <div className="flex flex-col gap-2">
                        <Label htmlFor="complete-last-name">
                            {t("lastName")}
                        </Label>
                        <Input
                            aria-invalid={Boolean(fieldErrors.lastName)}
                            autoComplete="family-name"
                            id="complete-last-name"
                            onChange={(event) => {
                                setLastName(event.target.value);
                                if (fieldErrors.lastName) {
                                    setFieldErrors((current) => ({
                                        ...current,
                                        lastName: undefined,
                                    }));
                                }
                            }}
                            placeholder={t("lastNamePlaceholder")}
                            type="text"
                            value={lastName}
                        />
                        {fieldErrors.lastName ? (
                            <p className="text-meta text-destructive">
                                {fieldErrors.lastName}
                            </p>
                        ) : null}
                    </div>

                    <Button
                        className="w-full"
                        disabled={isLoading || isSigningOut}
                        type="submit"
                    >
                        {isLoading
                            ? t("completeProfile.saving")
                            : t("completeProfile.save")}
                    </Button>
                </form>

                <Button
                    className="w-full"
                    disabled={isLoading || isSigningOut}
                    onClick={() => void handleSignOut()}
                    type="button"
                    variant="ghost"
                >
                    {t("completeProfile.signOut")}
                </Button>
            </CardContent>
        </Card>
    );
}

function resolvePostSavePath(redirectTo?: string): string {
    const pendingInvite = safeGetItem(
        "sessionStorage",
        "plotops_pending_invite"
    );
    if (pendingInvite) {
        safeRemoveItem("sessionStorage", "plotops_pending_invite");
        return `/invite/${pendingInvite}`;
    }

    if (redirectTo?.startsWith("/") && !redirectTo.startsWith("//")) {
        return redirectTo;
    }

    return "/home";
}
