import { LanguageSwitcher } from "@/widgets/header/ui/language-switcher";
import { ThemeToggle } from "@/widgets/header/ui/theme-toggle";
import { AccountMenu } from "@/widgets/header/ui/account-menu";
import { Separator } from "@/shared/shadcn/ui/separator";

export function Header() {
    return (
        <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-sm">
            <div className="flex h-11 items-center justify-between gap-4 px-4">
                <AccountMenu />

                <div className="flex items-center gap-1">
                    <LanguageSwitcher />
                    <Separator className="mx-1 h-5" orientation="vertical" />
                    <ThemeToggle />
                </div>
            </div>
        </header>
    );
}
