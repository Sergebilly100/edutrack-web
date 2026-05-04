import type { ReactNode } from "react"
import { Info } from "lucide-react"

import { cn } from "@/lib/utils"

type ContextualHelpProps = {
  title: string
  children: ReactNode
  className?: string
  tone?: "info" | "warning"
}

const toneClassName: Record<NonNullable<ContextualHelpProps["tone"]>, string> = {
  info: "border-[var(--help-info-border)] bg-[var(--help-info-bg)] text-[var(--help-info-fg)]",
  warning: "border-[var(--help-warning-border)] bg-[var(--help-warning-bg)] text-[var(--help-warning-fg)]",
}

export function ContextualHelp({ title, children, className, tone = "info" }: ContextualHelpProps) {
  return (
    <aside className={cn("rounded-lg border p-3 text-sm shadow-sm", toneClassName[tone], className)}>
      <div className="flex items-start gap-2.5">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <div className="min-w-0 space-y-1">
          <p className="font-semibold leading-5">{title}</p>
          <div className="leading-5 opacity-90">{children}</div>
        </div>
      </div>
    </aside>
  )
}
