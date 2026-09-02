import { Link, useNavigate } from "@tanstack/react-router";
import { type FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import {
    getAuthErrorKey,
    resendSignupConfirmation,
    signInWithGitHub,
    signInWithGoogle,
    signUpWithPassword,
} from "@/features/auth/api/auth-api";
import {
    AUTH_RATE_LIMIT_COOLDOWN_MS,
    isAuthRateLimited,
} from "@/features/auth/lib/auth-rate-limit";
import { meetsPasswordPolicy } from "@/features/auth/lib/password-policy";
import { useAuth } from "@/features/auth/model/use-auth";
import { leaveGuestSession } from "@/features/guest-mode";
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
import { Separator } from "@/shared/shadcn/ui/separator";

import { AuthTurnstile, requiresTurnstileToken } from "./auth-turnstile";
import {
    type OAuthProviderLoading,
    OAuthSignInButtons,
} from "./oauth-sign-in-buttons";
import { PasswordInput } from "./password-input";

const REDIRECT_TIMEOUT_MS = 8000;

type SignUpFormProperties = {
    initialEmail?: string;
};

export function SignUpForm({ initialEmail = "" }: SignUpFormProperties) {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { t } = useTranslation("auth");
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [email, setEmail] = useState(initialEmail);
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState<null | string>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [oauthLoading, setOauthLoading] =
        useState<OAuthProviderLoading>(null);
    const [isResending, setIsResending] = useState(false);
    const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
    const [awaitingRedirect, setAwaitingRedirect] = useState(false);
    const [resendMessage, setResendMessage] = useState<null | string>(null);
    const [captchaToken, setCaptchaToken] = useState<null | string>(null);
    const [turnstileResetKey, setTurnstileResetKey] = useState(0);
    const [rateLimitedUntil, setRateLimitedUntil] = useState<null | number>(
        null
    );

    const isBusy = isLoading || Boolean(oauthLoading);
    const isRateLimited =
        rateLimitedUntil != undefined && Date.now() < rateLimitedUntil;
    const turnstileRequired = requiresTurnstileToken();
    const captchaReady = !turnstileRequired || Boolean(captchaToken);

    const resetTurnstile = () => {
        setCaptchaToken(null);
        setTurnstileResetKey((key) => key + 1);
    };

    const handleAuthFailure = (
        authError: Parameters<typeof getAuthErrorKey>[0]
    ) => {
        if (isAuthRateLimited(authError)) {
            setRateLimitedUntil(Date.now() + AUTH_RATE_LIMIT_COOLDOWN_MS);
        }
        resetTurnstile();
        setError(t(getAuthErrorKey(authError)));
    };

    useEffect(() => {
        if (rateLimitedUntil == undefined || Date.now() >= rateLimitedUntil) {
            return;
        }

        const remainingMs = rateLimitedUntil - Date.now();
        const timer = globalThis.setTimeout(() => {
            setRateLimitedUntil(null);
        }, remainingMs);

        return () => {
            globalThis.clearTimeout(timer);
        };
    }, [rateLimitedUntil]);

    useEffect(() => {
        if (!awaitingRedirect || !user) return;

        const pendingInvite = safeGetItem(
            "sessionStorage",
            "plotops_pending_invite"
        );
        if (pendingInvite) {
            safeRemoveItem("sessionStorage", "plotops_pending_invite");
            void navigate({
                params: { token: pendingInvite },
                to: "/invite/$token",
            }).catch(() => {
                setAwaitingRedirect(false);
                setIsLoading(false);
                setError(t("errors.generic"));
            });
            return;
        }

        void navigate({ to: "/home" }).catch(() => {
            setAwaitingRedirect(false);
            setIsLoading(false);
            setError(t("errors.generic"));
        });
    }, [awaitingRedirect, navigate, t, user]);

    useEffect(() => {
        if (!awaitingRedirect || user) return;

        const timer = globalThis.setTimeout(() => {
            setAwaitingRedirect(false);
            setIsLoading(false);
            setError(t("errors.sessionTimeout"));
        }, REDIRECT_TIMEOUT_MS);

        return () => {
            globalThis.clearTimeout(timer);
        };
    }, [awaitingRedirect, t, user]);

    const handleOAuthSignUp = async (provider: "github" | "google") => {
        setError(null);
        setResendMessage(null);
        leaveGuestSession();
        setOauthLoading(provider);

        try {
            const { error: authError } =
                provider === "github"
                    ? await signInWithGitHub()
                    : await signInWithGoogle();
            if (authError) setError(t(getAuthErrorKey(authError)));
        } finally {
            setOauthLoading(null);
        }
    };

    const handleSignUp = async (event: FormEvent) => {
        event.preventDefault();
        setError(null);
        setResendMessage(null);

        if (!firstName.trim() || !lastName.trim()) {
            setError(t("errors.namesRequired"));
            return;
        }

        if (password !== confirmPassword) {
            setError(t("errors.passwordMismatch"));
            return;
        }

        if (!meetsPasswordPolicy(password)) {
            setError(t("errors.weakPassword"));
            return;
        }

        setIsLoading(true);

        leaveGuestSession();

        let keepLoadingForRedirect = false;
        try {
            const { data, error: authError } = await signUpWithPassword(
                {
                    email,
                    firstName,
                    lastName,
                    password,
                },
                captchaToken ? { captchaToken } : undefined
            );

            if (authError) {
                handleAuthFailure(authError);
                return;
            }

            // With confirmations on, an existing email may return a user with no identities.
            if (data.user && (data.user.identities?.length ?? 0) === 0) {
                setError(t("errors.userAlreadyRegistered"));
                return;
            }

            // Confirm-email ON: no session until the link is clicked.
            if (!data.session) {
                setAwaitingConfirmation(true);
                return;
            }

            keepLoadingForRedirect = true;
            setAwaitingRedirect(true);
        } catch {
            resetTurnstile();
            setError(t("errors.generic"));
        } finally {
            if (!keepLoadingForRedirect) {
                setIsLoading(false);
            }
        }
    };

    const handleResend = async () => {
        setError(null);
        setResendMessage(null);
        setIsResending(true);

        const { error: resendError } = await resendSignupConfirmation(email);

        setIsResending(false);

        if (resendError) {
            handleAuthFailure(resendError);
            return;
        }

        setResendMessage(t("checkEmail.resent"));
    };

    if (awaitingConfirmation) {
        return (
            <Card className="mx-auto w-full min-w-0 max-w-sm">
                <CardHeader className="text-center">
                    <CardTitle>{t("checkEmail.title")}</CardTitle>
                    <CardDescription>
                        {t("checkEmail.description", { email })}
                    </CardDescription>
                </CardHeader>

                <CardContent className="flex flex-col gap-4">
                    {error ? (
                        <Alert variant="destructive">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    ) : undefined}

                    {resendMessage ? (
                        <Alert>
                            <AlertDescription>{resendMessage}</AlertDescription>
                        </Alert>
                    ) : undefined}

                    <Button
                        className="w-full"
                        disabled={isResending}
                        onClick={() => void handleResend()}
                        size="lg"
                        type="button"
                        variant="outline"
                    >
                        {isResending
                            ? t("checkEmail.resendLoading")
                            : t("checkEmail.resend")}
                    </Button>

                    <p className="text-center text-meta text-muted-foreground">
                        <Link
                            className="underline underline-offset-2"
                            to="/sign-in"
                        >
                            {t("links.backToSignIn")}
                        </Link>
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="mx-auto w-full min-w-0 max-w-sm">
            <CardHeader className="text-center">
                <CardTitle>{t("signUpTitle")}</CardTitle>
                <CardDescription>{t("signUpSubtitle")}</CardDescription>
            </CardHeader>

            <CardContent className="flex flex-col gap-6">
                {error ? (
                    <Alert variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                ) : undefined}

                <OAuthSignInButtons
                    disabled={isBusy}
                    loading={oauthLoading}
                    onGitHub={() => void handleOAuthSignUp("github")}
                    onGoogle={() => void handleOAuthSignUp("google")}
                />

                <div className="flex items-center gap-3">
                    <Separator className="flex-1" />
                    <span className="text-meta text-muted-foreground">
                        {t("or")}
                    </span>
                    <Separator className="flex-1" />
                </div>

                <form className="flex flex-col gap-4" onSubmit={handleSignUp}>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="flex min-w-0 flex-col gap-2">
                            <Label htmlFor="sign-up-first-name">
                                {t("firstName")}
                            </Label>
                            <Input
                                autoComplete="given-name"
                                id="sign-up-first-name"
                                onChange={(event) =>
                                    setFirstName(event.target.value)
                                }
                                placeholder={t("firstNamePlaceholder")}
                                required
                                type="text"
                                value={firstName}
                            />
                        </div>
                        <div className="flex min-w-0 flex-col gap-2">
                            <Label htmlFor="sign-up-last-name">
                                {t("lastName")}
                            </Label>
                            <Input
                                autoComplete="family-name"
                                id="sign-up-last-name"
                                onChange={(event) =>
                                    setLastName(event.target.value)
                                }
                                placeholder={t("lastNamePlaceholder")}
                                required
                                type="text"
                                value={lastName}
                            />
                        </div>
                    </div>

                    <div className="flex flex-col gap-2">
                        <Label htmlFor="sign-up-email">{t("email")}</Label>
                        <Input
                            autoComplete="email"
                            id="sign-up-email"
                            onChange={(event) => setEmail(event.target.value)}
                            placeholder={t("emailPlaceholder")}
                            required
                            type="email"
                            value={email}
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <Label htmlFor="sign-up-password">
                            {t("password")}
                        </Label>
                        <PasswordInput
                            autoComplete="new-password"
                            id="sign-up-password"
                            onChange={(event) =>
                                setPassword(event.target.value)
                            }
                            placeholder={t("passwordPlaceholder")}
                            required
                            value={password}
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <Label htmlFor="sign-up-confirm">
                            {t("confirmPassword")}
                        </Label>
                        <PasswordInput
                            autoComplete="new-password"
                            id="sign-up-confirm"
                            onChange={(event) =>
                                setConfirmPassword(event.target.value)
                            }
                            placeholder={t("passwordPlaceholder")}
                            required
                            value={confirmPassword}
                        />
                    </div>

                    <AuthTurnstile
                        action="signup"
                        onTokenChange={setCaptchaToken}
                        resetKey={turnstileResetKey}
                    />

                    <Button
                        className="w-full"
                        disabled={isBusy || isRateLimited || !captchaReady}
                        size="lg"
                        type="submit"
                    >
                        {isLoading ? t("signUpLoading") : t("signUp")}
                    </Button>
                </form>

                <p className="text-center text-meta text-muted-foreground">
                    {t("links.hasAccount")}{" "}
                    <Link
                        className="underline underline-offset-2"
                        to="/sign-in"
                    >
                        {t("links.signIn")}
                    </Link>
                </p>
            </CardContent>
        </Card>
    );
}
