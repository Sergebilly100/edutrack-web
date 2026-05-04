import type { ReactNode } from "react"

import { cn } from "@/lib/utils"
import { OfflineIndicator } from "@/shared/components/OfflineIndicator"

type PageLayoutProps = {
  title: string
  subtitle?: string
  actions?: ReactNode
  contentClassName?: string
  children: ReactNode
}

export function PageLayout({ title, subtitle, actions, contentClassName, children }: PageLayoutProps) {
  return (
    <div className="min-h-full bg-background">
      <OfflineIndicator />
      <header className="-mx-4 border-b bg-[var(--surface-chrome)] px-4 backdrop-blur md:-mx-6 md:top-0 md:z-40 md:px-6">
        <div className="flex min-h-16 flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
            {subtitle ? <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      </header>
      <main className={cn("mx-auto space-y-5 py-5 sm:space-y-6 sm:py-6", contentClassName)}>{children}</main>
    </div>
  )
}
