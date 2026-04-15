import { AlertCircle, Info, TriangleAlert, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface AlertBannerProps {
  type: "warning" | "error" | "info"
  title: string
  message: string
  action?: { label: string; onClick: () => void }
  onDismiss?: () => void
}

const typeStyles: Record<AlertBannerProps["type"], string> = {
  warning: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100",
  error: "border-red-200 bg-red-50 text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-100",
  info: "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-100",
}

const icons: Record<AlertBannerProps["type"], typeof Info> = {
  warning: TriangleAlert,
  error: AlertCircle,
  info: Info,
}

export function AlertBanner({ type, title, message, action, onDismiss }: AlertBannerProps) {
  const Icon = icons[type]

  return (
    <div className={cn("animate-slide-down rounded-xl border p-4 shadow-card", typeStyles[type])}>
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{title}</p>
          <p className="mt-1 text-sm opacity-90">{message}</p>
        </div>
        {onDismiss ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-md hover:bg-black/5 dark:hover:bg-white/10"
            onClick={onDismiss}
            aria-label="Fermer l'alerte"
          >
            <X className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
      {action ? (
        <div className="mt-3">
          <Button type="button" size="sm" variant="secondary" onClick={action.onClick}>
            {action.label}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
