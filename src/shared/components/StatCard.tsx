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
  default: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  success: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  warning: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  danger: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
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
        "rounded-xl border border-border/60 bg-card p-5 shadow-card transition hover:shadow-card-hover",
        "dark:bg-slate-900",
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
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          {loading ? (
            <Skeleton className="h-8 w-20" />
          ) : (
            <p className="text-2xl font-semibold tabular-nums">{value}</p>
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
