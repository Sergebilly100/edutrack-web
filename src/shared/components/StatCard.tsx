import type { ReactNode } from "react"
import { ArrowDownRight, ArrowUpRight } from "lucide-react"

import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

export interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: ReactNode
  trend?: { value: number; label: string }
  variant?: "default" | "success" | "warning" | "danger"
  onClick?: () => void
  loading?: boolean
}

const variantClasses: Record<NonNullable<StatCardProps["variant"]>, string> = {
  default: "bg-[var(--stat-default-bg)] text-[var(--stat-default-fg)]",
  success: "bg-[var(--stat-success-bg)] text-[var(--stat-success-fg)]",
  warning: "bg-[var(--stat-warning-bg)] text-[var(--stat-warning-fg)]",
  danger: "bg-[var(--stat-danger-bg)] text-[var(--stat-danger-fg)]",
}

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  variant = "default",
  onClick,
  loading = false,
}: StatCardProps) {
  const clickable = typeof onClick === "function"
  const trendPositive = (trend?.value ?? 0) >= 0

  return (
    <article
      className={cn(
        "rounded-lg border border-border/70 bg-[var(--surface-panel)] p-4 shadow-sm transition hover:border-primary/30 hover:shadow-card",
        "sm:p-5",
        clickable ? "cursor-pointer focus-visible:outline-none focus-visible:shadow-focus" : ""
      )}
      onClick={onClick}
      onKeyDown={(event) => {
        if (!clickable) {
          return
        }

        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onClick?.()
        }
      }}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase text-muted-foreground sm:text-sm sm:normal-case">{title}</p>
          {loading ? (
            <Skeleton className="h-8 w-20" />
          ) : (
            <p className="text-xl font-semibold tabular-nums tracking-tight sm:text-2xl">{value}</p>
          )}
        </div>
        <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", variantClasses[variant])}>
          {icon}
        </div>
      </div>

      <div className="mt-3 min-h-5">
        {loading ? <Skeleton className="h-4 w-32" /> : null}
        {!loading && trend ? (
          <p className="flex items-center gap-1 text-xs">
            {trendPositive ? (
              <ArrowUpRight className="h-3.5 w-3.5 text-green-600" />
            ) : (
              <ArrowDownRight className="h-3.5 w-3.5 text-red-600" />
            )}
            <span className={trendPositive ? "text-green-600" : "text-red-600"}>
              {trendPositive ? "+" : ""}
              {trend.value}%
            </span>
            <span className="text-muted-foreground">{trend.label}</span>
          </p>
        ) : null}
        {!loading && !trend && subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
      </div>
    </article>
  )
}
