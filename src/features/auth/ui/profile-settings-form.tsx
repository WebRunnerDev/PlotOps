import { type FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { updateProfileNames } from "@/features/auth/api/profile-api";
import { useAuth } from "@/features/auth/model/use-auth";
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

export function ProfileSettingsForm() {
    const { t } = useTranslation("auth");
    const { profile, refreshProfile, user } = useAuth();
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [error, setError] = useState<null | string>(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        setFirstName(profile?.first_name ?? "");
        setLastName(profile?.last_name ?? "");
    }, [profile?.first_name, profile?.last_name]);

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        setError(null);

        if (!user) {
            setError(t("errors.generic"));
            return;
        }

        if (!firstName.trim() || !lastName.trim()) {
            setError(t("errors.namesRequired"));
            return;
        }

        setIsLoading(true);

        try {
            await updateProfileNames({
                firstName,
                lastName,
                userId: user.id,
            });
            await refreshProfile();
            toast.success(t("settings.saved"));
        } catch {
            setError(t("errors.generic"));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Card className="max-w-lg">
            <CardHeader>
                <CardTitle>{t("settings.profileTitle")}</CardTitle>
                <CardDescription>
                    {t("settings.profileDescription")}
                </CardDescription>
            </CardHeader>
            <CardContent>
                {error ? (
                    <Alert className="mb-4" variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                ) : null}

                <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
                    {profile?.username ? (
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="settings-username">
                                {t("username")}
                            </Label>
                            <Input
                                disabled
                                id="settings-username"
                                readOnly
                                value={profile.username}
                            />
                            <p className="text-meta text-muted-foreground">
                                {t("settings.usernameHint")}
                            </p>
                        </div>
                    ) : null}

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="flex min-w-0 flex-col gap-2">
                            <Label htmlFor="settings-first-name">
                                {t("firstName")}
                            </Label>
                            <Input
                                autoComplete="given-name"
                                id="settings-first-name"
                                onChange={(event) =>
                                    setFirstName(event.target.value)
                                }
                                required
                                type="text"
                                value={firstName}
                            />
                        </div>
                        <div className="flex min-w-0 flex-col gap-2">
                            <Label htmlFor="settings-last-name">
                                {t("lastName")}
                            </Label>
                            <Input
                                autoComplete="family-name"
                                id="settings-last-name"
                                onChange={(event) =>
                                    setLastName(event.target.value)
                                }
                                required
                                type="text"
                                value={lastName}
                            />
                        </div>
                    </div>

                    <Button
                        className="w-fit"
                        disabled={isLoading}
                        type="submit"
                    >
                        {isLoading ? t("settings.saving") : t("settings.save")}
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}
