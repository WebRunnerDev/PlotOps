import { useNavigate, useRouterState } from "@tanstack/react-router";
import {
    BellIcon,
    HomeIcon,
    LogOutIcon,
    MoonIcon,
    SettingsIcon,
    SunIcon,
    User,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { useTheme } from "@/app/model/theme";
import { useAuth } from "@/features/auth";
import {
    getUserAvatarUrl,
    getUserDisplayName,
    getUserInitials,
} from "@/features/auth/lib/user-display";
import { Dock, DockItem, DockSeparator } from "@/shared/shadcn/motion/dock";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/shadcn/ui/avatar";
import { Button } from "@/shared/shadcn/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/shared/shadcn/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/shared/shadcn/ui/dropdown-menu";
import { Spinner } from "@/shared/shadcn/ui/spinner";

const locales = ["ru", "en"] as const;

export function AppDock() {
    const { i18n, t } = useTranslation("common");
    const navigate = useNavigate();
    const pathname = useRouterState({
        select: (state) => state.location.pathname,
    });
    const { theme, toggleTheme } = useTheme();

    const currentLocale =
        locales.find((locale) => i18n.language.startsWith(locale)) ?? "ru";
    const isDark = theme === "dark";

    const isHomeActive = pathname === "/home";
    const isSettingsActive = pathname === "/settings";

    return (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center pb-4 [view-transition-name:app-dock]">
            <div className="pointer-events-auto">
                <Dock>
                    <DockItem
                        active={isHomeActive}
                        aria-label={t("nav.home")}
                        onClick={() => void navigate({ to: "/home" })}
                    >
                        <HomeIcon className="size-5" />
                    </DockItem>

                    <DockDropdownItem
                        label={t("nav.notifications")}
                        menu={
                            <>
                                <DropdownMenuGroup>
                                    <DropdownMenuLabel>
                                        {t("nav.notifications")}
                                    </DropdownMenuLabel>
                                </DropdownMenuGroup>
                                <DropdownMenuSeparator />
                                <p className="px-2 py-3 text-sm text-muted-foreground">
                                    {t("nav.notificationsEmpty")}
                                </p>
                            </>
                        }
                    >
                        <BellIcon className="size-5" />
                    </DockDropdownItem>

                    <DockDropdownItem
                        active={isSettingsActive}
                        label={t("nav.settings")}
                        menu={
                            <>
                                <DropdownMenuGroup>
                                    <DropdownMenuLabel>
                                        {t("nav.settings")}
                                    </DropdownMenuLabel>
                                    <DropdownMenuItem
                                        className="cursor-pointer"
                                        onClick={() =>
                                            void navigate({ to: "/settings" })
                                        }
                                    >
                                        <SettingsIcon />
                                        {t("platformSettings")}
                                    </DropdownMenuItem>
                                </DropdownMenuGroup>
                                <DropdownMenuSeparator />
                                <DropdownMenuRadioGroup
                                    onValueChange={(value) =>
                                        void i18n.changeLanguage(value)
                                    }
                                    value={currentLocale}
                                >
                                    <DropdownMenuLabel>
                                        {t("switcher")}
                                    </DropdownMenuLabel>
                                    {locales.map((locale) => (
                                        <DropdownMenuRadioItem
                                            className="cursor-pointer"
                                            key={locale}
                                            value={locale}
                                        >
                                            {t(locale)}
                                        </DropdownMenuRadioItem>
                                    ))}
                                </DropdownMenuRadioGroup>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    className="cursor-pointer"
                                    onClick={toggleTheme}
                                >
                                    {isDark ? <SunIcon /> : <MoonIcon />}
                                    {isDark ? t("themeLight") : t("themeDark")}
                                </DropdownMenuItem>
                            </>
                        }
                    >
                        <SettingsIcon className="size-5" />
                    </DockDropdownItem>

                    <DockSeparator />
                    <DockAccountItem />
                </Dock>
            </div>
        </div>
    );
}

function DockAccountItem() {
    const { t } = useTranslation("common");
    const { signOut, user } = useAuth();
    const navigate = useNavigate();
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);

    const displayName = user ? getUserDisplayName(user) : null;
    const avatarUrl = user ? getUserAvatarUrl(user) : null;
    const initials = displayName ? getUserInitials(displayName) : null;

    async function handleLogout() {
        setIsLoggingOut(true);
        try {
            await signOut();
            setLogoutDialogOpen(false);
            await navigate({ to: "/sign-in" });
        } catch {
            toast.error(t("logout.error"));
        } finally {
            setIsLoggingOut(false);
        }
    }

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger className="flex h-11 max-w-48 cursor-pointer items-center gap-2 rounded-full border-0 bg-transparent px-2 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
                    <Avatar size="sm">
                        {avatarUrl ? (
                            <AvatarImage
                                alt={displayName ?? ""}
                                src={avatarUrl}
                            />
                        ) : null}
                        <AvatarFallback className="text-meta">
                            {initials ?? <User className="size-3.5" />}
                        </AvatarFallback>
                    </Avatar>
                    <span className="truncate text-sm font-medium">
                        {displayName}
                    </span>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                    align="center"
                    className="w-fit"
                    side="top"
                    sideOffset={10}
                >
                    <DropdownMenuItem
                        className="cursor-pointer"
                        onClick={() => setLogoutDialogOpen(true)}
                        variant="destructive"
                    >
                        <LogOutIcon />
                        {t("logout.signOut")}
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <Dialog onOpenChange={setLogoutDialogOpen} open={logoutDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{t("logout.title")}</DialogTitle>
                        <DialogDescription>
                            {t("logout.description")}
                        </DialogDescription>
                    </DialogHeader>
                    {user?.email ? (
                        <p className="text-sm text-muted-foreground">
                            {t("logout.signedInAs", { email: user.email })}
                        </p>
                    ) : null}
                    <DialogFooter className="gap-2">
                        <Button
                            disabled={isLoggingOut}
                            onClick={() => setLogoutDialogOpen(false)}
                            type="button"
                            variant="outline"
                        >
                            {t("actions.cancel")}
                        </Button>
                        <Button
                            disabled={isLoggingOut}
                            onClick={handleLogout}
                            type="button"
                            variant="destructive"
                        >
                            {isLoggingOut ? (
                                <Spinner className="size-4" />
                            ) : null}
                            {t("logout.action")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

function DockDropdownItem({
    active,
    children,
    label,
    menu,
}: {
    active?: boolean;
    children: ReactNode;
    label: string;
    menu: ReactNode;
}) {
    return (
        <DockItem active={active} aria-label={label}>
            <DropdownMenu>
                <DropdownMenuTrigger className="flex size-full cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
                    {children}
                </DropdownMenuTrigger>
                <DropdownMenuContent
                    align="center"
                    className="w-56"
                    side="top"
                    sideOffset={10}
                >
                    {menu}
                </DropdownMenuContent>
            </DropdownMenu>
        </DockItem>
    );
}
