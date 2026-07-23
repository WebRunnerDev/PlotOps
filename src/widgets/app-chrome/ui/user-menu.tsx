import { useNavigate } from "@tanstack/react-router";
import {
    BellIcon,
    LogOutIcon,
    MoonIcon,
    SettingsIcon,
    SunIcon,
    User,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { useTheme } from "@/app/model/theme";
import { useAuth } from "@/features/auth";
import {
    getUserAvatarUrl,
    getUserDisplayName,
    getUserInitials,
} from "@/features/auth/lib/user-display";
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

export function UserMenu() {
    const { i18n, t } = useTranslation("common");
    const { signOut, user } = useAuth();
    const navigate = useNavigate();
    const { theme, toggleTheme } = useTheme();
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);

    const displayName = user ? getUserDisplayName(user) : null;
    const avatarUrl = user ? getUserAvatarUrl(user) : null;
    const initials = displayName ? getUserInitials(displayName) : null;
    const currentLocale =
        locales.find((locale) => i18n.language.startsWith(locale)) ?? "ru";
    const isDark = theme === "dark";

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
                <DropdownMenuTrigger
                    aria-label={t("accountMenu")}
                    className="flex h-8 max-w-48 cursor-pointer items-center gap-2 rounded-md border-0 bg-transparent px-1.5 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
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
                    <span className="hidden truncate text-sm font-medium sm:inline">
                        {displayName}
                    </span>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                    align="end"
                    className="w-56"
                    sideOffset={8}
                >
                    <DropdownMenuGroup>
                        <DropdownMenuLabel>
                            {t("nav.settings")}
                        </DropdownMenuLabel>
                        <DropdownMenuItem
                            className="cursor-pointer"
                            onClick={() => void navigate({ to: "/settings" })}
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
                        <DropdownMenuLabel>{t("switcher")}</DropdownMenuLabel>
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
                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                        <DropdownMenuLabel className="flex items-center gap-2">
                            <BellIcon className="size-3.5" />
                            {t("nav.notifications")}
                        </DropdownMenuLabel>
                        <p className="px-2 py-2 text-sm text-muted-foreground">
                            {t("nav.notificationsEmpty")}
                        </p>
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
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
