import { Eye, EyeOff } from "lucide-react";
import { type ComponentProps, useState } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/shadcn/ui/button";
import { Input } from "@/shared/shadcn/ui/input";

type PasswordInputProperties = ComponentProps<typeof Input>;

export function PasswordInput({
    className,
    ...properties
}: PasswordInputProperties) {
    const { t } = useTranslation("auth");
    const [visible, setVisible] = useState(false);

    return (
        <div className="relative">
            <Input
                {...properties}
                className={cn("pr-9", className)}
                type={visible ? "text" : "password"}
            />
            <Button
                aria-label={visible ? t("hidePassword") : t("showPassword")}
                aria-pressed={visible}
                className="absolute top-1/2 right-0.5 -translate-y-1/2"
                onClick={() => setVisible((current) => !current)}
                size="icon-sm"
                type="button"
                variant="ghost"
            >
                {visible ? <EyeOff /> : <Eye />}
            </Button>
        </div>
    );
}
