import { createFileRoute, useRouter } from "@tanstack/react-router";
import {
    ArrowLeft,
    GitBranch,
    Link2,
    type LucideIcon,
    PanelRight,
    UserRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import {
    ConnectedAccountsSettings,
    DEMO_ACCOUNT_BADGE_I18N_KEY,
    demoAccountBadgeVisible,
    GitHubIntegrationSettings,
    ProfileSettingsForm,
} from "@/features/auth";
import { useIsGuest } from "@/features/guest-mode";
import { TaskDrawerSettings } from "@/features/tasks";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/shadcn/ui/badge";
import { Button } from "@/shared/shadcn/ui/button";

export const Route = createFileRoute("/(main)/settings")({
    component: SettingsPage,
});

type SettingsSection = "accounts" | "drawer" | "github" | "profile";

const SECTION_ICONS = {
    accounts: Link2,
    drawer: PanelRight,
    github: GitBranch,
    profile: UserRound,
} as const satisfies Record<SettingsSection, LucideIcon>;

function SettingsPage() {
    const { t } = useTranslation("common");
    const { t: tAuth } = useTranslation("auth");
    const router = useRouter();
    const guest = useIsGuest();
    const showDemoBadge = demoAccountBadgeVisible(guest);

    const navItems = useMemo(() => {
        const items: {
            id: SettingsSection;
            label: string;
            visible: boolean;
        }[] = [
            {
                id: "drawer",
                label: t("uiSettings.title"),
                visible: true,
            },
            {
                id: "profile",
                label: tAuth("settings.profileTitle"),
                visible: !guest,
            },
            {
                id: "github",
                label: tAuth("settings.githubIntegration.title"),
                visible: !guest,
            },
            {
                id: "accounts",
                label: tAuth("settings.connectedAccountsTitle"),
                visible: !guest,
            },
        ];
        return items.filter((item) => item.visible);
    }, [guest, t, tAuth]);

    const [section, setSection] = useState<SettingsSection>("drawer");

    useEffect(() => {
        if (!navItems.some((item) => item.id === section) && navItems[0]) {
            setSection(navItems[0].id);
        }
    }, [navItems, section]);

    const activeSection =
        navItems.find((item) => item.id === section)?.id ??
        navItems[0]?.id ??
        "drawer";

    return (
        <div className="relative mx-auto flex h-full w-full min-w-0 max-w-6xl flex-col gap-8 overflow-y-auto px-4 py-8 sm:gap-10 sm:py-10">
            <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 -top-8 h-72 bg-auth-atmosphere opacity-80 sm:-top-10 sm:h-96"
            />

            <header className="relative flex min-w-0 flex-col gap-5 motion-reveal sm:gap-6">
                <Button
                    className="w-fit shrink-0 text-muted-foreground"
                    onClick={() => router.history.back()}
                    size="sm"
                    type="button"
                    variant="ghost"
                >
                    <ArrowLeft data-icon="inline-start" />
                    {t("back")}
                </Button>

                <div className="flex min-w-0 flex-col gap-3 sm:gap-4">
                    <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                        <p className="font-mono text-meta text-primary uppercase tracking-[0.14em]">
                            {t("settingsEyebrow")}
                        </p>
                        {showDemoBadge ? (
                            <Badge
                                className="font-mono tracking-wide uppercase"
                                title={t("guest.demoAccountHint")}
                                variant="outline"
                            >
                                {t(DEMO_ACCOUNT_BADGE_I18N_KEY)}
                            </Badge>
                        ) : null}
                    </div>
                    <h1 className="min-w-0 text-h1 text-balance wrap-break-word text-foreground">
                        {t("platformSettings")}
                    </h1>
                    <div aria-hidden className="h-px w-14 bg-primary/70" />
                    <p className="max-w-xl text-body text-muted-foreground">
                        {guest
                            ? t("guest.demoAccountHint")
                            : t("settingsDescription")}
                    </p>
                </div>
            </header>

            <div className="relative grid min-w-0 gap-8 lg:grid-cols-[13.5rem_minmax(0,1fr)] lg:gap-12 xl:grid-cols-[15rem_minmax(0,1fr)]">
                {navItems.length > 1 ? (
                    <nav
                        aria-label={t("platformSettings")}
                        className="motion-reveal min-w-0 [animation-delay:120ms] lg:sticky lg:top-4 lg:self-start"
                    >
                        <ul className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
                            {navItems.map((item, index) => {
                                const active = item.id === activeSection;
                                const Icon = SECTION_ICONS[item.id];
                                return (
                                    <li
                                        className="shrink-0 lg:w-full"
                                        key={item.id}
                                    >
                                        <button
                                            aria-current={
                                                active ? "page" : undefined
                                            }
                                            className={cn(
                                                "group flex w-full min-w-0 items-center gap-2.5 border border-transparent px-3 py-2.5 text-left transition-[color,background-color,border-color,transform] duration-300 ease-(--ease-out-expo)",
                                                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                                                active
                                                    ? "border-border bg-card text-foreground shadow-[inset_3px_0_0_0_var(--primary)]"
                                                    : "text-muted-foreground hover:border-border/80 hover:bg-muted/40 hover:text-foreground"
                                            )}
                                            onClick={() => setSection(item.id)}
                                            style={{
                                                transitionDelay: `${index * 40}ms`,
                                            }}
                                            type="button"
                                        >
                                            <Icon
                                                aria-hidden
                                                className={cn(
                                                    "size-3.5 shrink-0 transition-transform duration-300 ease-(--ease-out-expo)",
                                                    active
                                                        ? "text-primary"
                                                        : "text-muted-foreground group-hover:translate-x-0.5 group-hover:text-primary"
                                                )}
                                            />
                                            <span className="min-w-0 flex-1 truncate text-ui">
                                                {item.label}
                                            </span>
                                            <span
                                                className={cn(
                                                    "font-mono text-meta tabular-nums",
                                                    active
                                                        ? "text-primary/80"
                                                        : "text-muted-foreground"
                                                )}
                                            >
                                                {String(index + 1).padStart(
                                                    2,
                                                    "0"
                                                )}
                                            </span>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    </nav>
                ) : null}

                <div className="mx-auto flex w-full min-w-0 max-w-2xl flex-col gap-8 lg:mx-0 lg:max-w-none">
                    {activeSection === "drawer" ? (
                        <div className="motion-reveal [animation-delay:180ms]">
                            <TaskDrawerSettings />
                        </div>
                    ) : null}
                    {guest ? null : (
                        <>
                            {activeSection === "profile" ? (
                                <div className="motion-reveal [animation-delay:180ms]">
                                    <ProfileSettingsForm />
                                </div>
                            ) : null}
                            {activeSection === "github" ? (
                                <div className="motion-reveal [animation-delay:180ms]">
                                    <GitHubIntegrationSettings />
                                </div>
                            ) : null}
                            {activeSection === "accounts" ? (
                                <div className="motion-reveal [animation-delay:180ms]">
                                    <ConnectedAccountsSettings />
                                </div>
                            ) : null}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
