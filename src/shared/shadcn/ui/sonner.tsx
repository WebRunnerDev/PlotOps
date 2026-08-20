import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

import { useTheme } from "@/app/model/theme"
import { cn } from "@/shared/lib/utils"

const toastIconClass = "size-[1.125rem] shrink-0"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme } = useTheme()

  return (
    <Sonner
      theme={theme}
      className="plotops-toaster toaster group"
      closeButton
      position="bottom-right"
      icons={{
        success: <CircleCheckIcon className={toastIconClass} strokeWidth={2.25} />,
        info: <InfoIcon className={toastIconClass} strokeWidth={2.25} />,
        warning: <TriangleAlertIcon className={toastIconClass} strokeWidth={2.25} />,
        error: <OctagonXIcon className={toastIconClass} strokeWidth={2.25} />,
        loading: <Loader2Icon className={cn(toastIconClass, "animate-spin")} strokeWidth={2.25} />,
      }}
      style={
        {
          "--normal-bg": "var(--card)",
          "--normal-text": "var(--foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      visibleToasts={4}
      duration={4500}
      toastOptions={{
        closeButtonAriaLabel: "Dismiss notification",
        classNames: {
          toast: "cn-toast",
          title: "text-ui font-semibold leading-snug",
          description: "text-muted-foreground text-[0.8125rem] leading-snug",
          actionButton:
            "bg-primary text-primary-foreground border border-primary font-medium text-ui",
          cancelButton:
            "bg-muted text-muted-foreground border border-border font-medium text-ui",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
