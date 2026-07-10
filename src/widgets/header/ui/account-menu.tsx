import { Link, useNavigate } from "@tanstack/react-router";
import { LogOutIcon, SettingsIcon, User } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { useAuth } from "@/features/auth";
import {
    getUserAvatarUrl,
    getUserDisplayName,
    getUserInitials,
} from "@/features/auth/lib/user-display";
import {
    Avatar,
    AvatarFallback,
    AvatarImage,
} from "@/shared/shadcn/ui/avatar";
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
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/shared/shadcn/ui/dropdown-menu";
import { Spinner } from "@/shared/shadcn/ui/spinner";

export function AccountMenu() {
    const { t } = useTranslation("common");
    const { user, signOut } = useAuth();
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
                <DropdownMenuTrigger
                    render={
                        <Button
                            aria-label={t("accountMenu")}
                            className="rounded-full"
                            size="icon-sm"
                            type="button"
                            variant="ghost"
                        />
                    }
                >
                    <Avatar size="sm">
                        {avatarUrl ? (
                            <AvatarImage alt={displayName ?? ""} src={avatarUrl} />
                        ) : null}
                        <AvatarFallback className="text-meta">
                            {initials ?? <User />}
                        </AvatarFallback>
                    </Avatar>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem render={<Link to="/settings" />}>
                        <SettingsIcon />
                        {t("platformSettings")}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        variant="destructive"
                        onClick={() => setLogoutDialogOpen(true)}
                    >
                        <LogOutIcon />
                        {t("logout.action")}
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
                            {isLoggingOut ? <Spinner className="size-4" /> : null}
                            {t("logout.action")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
