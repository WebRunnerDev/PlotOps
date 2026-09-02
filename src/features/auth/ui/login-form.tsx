import { Link, useNavigate } from "@tanstack/react-router";
import { type FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import {
    getAuthErrorKey,
    signInWithGitHub,
    signInWithGoogle,
    signInWithPassword,
} from "@/features/auth/api/auth-api";
import {
    AUTH_RATE_LIMIT_COOLDOWN_MS,
    isAuthRateLimited,
} from "@/features/auth/lib/auth-rate-limit";
import { useAuth } from "@/features/auth/model/use-auth";
import {
    GUEST_DEMO_BOARD_ID,
    GUEST_DEMO_PROJECT_ID,
    leaveGuestSession,
    startGuestSession,
} from "@/features/guest-mode";
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

export function LoginForm() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { t } = useTranslation("auth");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<null | string>(null);
    const [oauthLoading, setOauthLoading] =
        useState<OAuthProviderLoading>(null);
    const [isEmailLoading, setIsEmailLoading] = useState(false);
    const [isGuestLoading, setIsGuestLoading] = useState(false);
    const [captchaToken, setCaptchaToken] = useState<null | string>(null);
    const [turnstileResetKey, setTurnstileResetKey] = useState(0);
    const [rateLimitedUntil, setRateLimitedUntil] = useState<null | number>(
        null
    );
    // Wait for AuthProvider + router context before navigating — otherwise
    // /home beforeLoad still sees user=null and bounces back to /sign-in.
    const [awaitingRedirect, setAwaitingRedirect] = useState(false);

    const isBusy = Boolean(oauthLoading) || isEmailLoading || isGuestLoading;
    const isRateLimited =
        rateLimitedUntil != undefined && Date.now() < rateLimitedUntil;
    const turnstileRequired = requiresTurnstileToken();
    const captchaReady = !turnstileRequired || Boolean(captchaToken);

    const clearAuthLoading = () => {
        setIsEmailLoading(false);
        setIsGuestLoading(false);
    };

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
                clearAuthLoading();
                setError(t("errors.generic"));
            });
            return;
        }

        void navigate({ to: "/home" }).catch(() => {
            setAwaitingRedirect(false);
            clearAuthLoading();
            setError(t("errors.generic"));
        });
    }, [awaitingRedirect, navigate, t, user]);

    useEffect(() => {
        if (!awaitingRedirect || user) return;

        const timer = globalThis.setTimeout(() => {
            setAwaitingRedirect(false);
            clearAuthLoading();
            setError(t("errors.sessionTimeout"));
        }, REDIRECT_TIMEOUT_MS);

        return () => {
            globalThis.clearTimeout(timer);
        };
    }, [awaitingRedirect, t, user]);

    const handleOAuthLogin = async (provider: "github" | "google") => {
        setError(null);
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

    const completePasswordSignIn = async (credentials: {
        email: string;
        password: string;
    }) => {
        leaveGuestSession();
        const { error: authError } = await signInWithPassword(
            credentials,
            captchaToken ? { captchaToken } : undefined
        );

        if (authError) {
            handleAuthFailure(authError);
            return false;
        }

        setAwaitingRedirect(true);
        return true;
    };

    const handleEmailLogin = async (event: FormEvent) => {
        event.preventDefault();
        setError(null);
        setIsEmailLoading(true);

        let keepLoadingForRedirect = false;
        try {
            keepLoadingForRedirect = await completePasswordSignIn({
                email,
                password,
            });
        } catch {
            resetTurnstile();
            setError(t("errors.generic"));
        } finally {
            if (!keepLoadingForRedirect) {
                setIsEmailLoading(false);
            }
        }
    };

    const handleGuestLogin = () => {
        setError(null);
        setIsGuestLoading(true);

        try {
            startGuestSession();
            safeRemoveItem("sessionStorage", "plotops_pending_invite");
            void navigate({
                params: {
                    boardId: GUEST_DEMO_BOARD_ID,
                    projectId: GUEST_DEMO_PROJECT_ID,
                },
                to: "/projects/$projectId/boards/$boardId",
            }).catch(() => {
                setIsGuestLoading(false);
                setError(t("errors.generic"));
            });
        } catch {
            setIsGuestLoading(false);
            setError(t("errors.generic"));
        }
    };

    return (
        <Card className="mx-auto w-full min-w-0 max-w-sm">
            <CardHeader className="text-center">
                <CardTitle>{t("signInTitle")}</CardTitle>
                <CardDescription>{t("signInSubtitle")}</CardDescription>
            </CardHeader>

            <CardContent className="flex flex-col gap-6">
                {error ? (
                    <Alert variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                ) : undefined}

                <div className="flex flex-col gap-3">
                    <OAuthSignInButtons
                        disabled={isBusy}
                        loading={oauthLoading}
                        onGitHub={() => void handleOAuthLogin("github")}
                        onGoogle={() => void handleOAuthLogin("google")}
                    />

                    <Button
                        className="w-full"
                        disabled={isBusy}
                        onClick={handleGuestLogin}
                        size="lg"
                        type="button"
                        variant="secondary"
                    >
                        {isGuestLoading ? t("tryDemoLoading") : t("tryDemo")}
                    </Button>
                </div>

                <div className="flex items-center gap-3">
                    <Separator className="flex-1" />
                    <span className="text-meta text-muted-foreground">
                        {t("or")}
                    </span>
                    <Separator className="flex-1" />
                </div>

                <form
                    className="flex flex-col gap-4"
                    onSubmit={handleEmailLogin}
                >
                    <div className="flex flex-col gap-2">
                        <Label htmlFor="email">{t("email")}</Label>
                        <Input
                            autoComplete="email"
                            id="email"
                            onChange={(event) => setEmail(event.target.value)}
                            placeholder={t("emailPlaceholder")}
                            required
                            type="email"
                            value={email}
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <Label htmlFor="password">{t("password")}</Label>
                        <PasswordInput
                            autoComplete="current-password"
                            id="password"
                            onChange={(event) =>
                                setPassword(event.target.value)
                            }
                            placeholder={t("passwordPlaceholder")}
                            required
                            value={password}
                        />
                    </div>

                    <AuthTurnstile
                        action="login"
                        onTokenChange={setCaptchaToken}
                        resetKey={turnstileResetKey}
                    />

                    <Button
                        className="w-full"
                        disabled={isBusy || isRateLimited || !captchaReady}
                        size="lg"
                        type="submit"
                    >
                        {isEmailLoading ? t("signInLoading") : t("signIn")}
                    </Button>
                </form>

                <p className="text-center text-meta text-muted-foreground">
                    {t("links.noAccount")}{" "}
                    <Link
                        className="underline underline-offset-2"
                        to="/sign-up"
                    >
                        {t("links.signUp")}
                    </Link>
                </p>
            </CardContent>
        </Card>
    );
}
