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
    <div className="bg-background">
      <header className="border-b bg-background md:top-0 md:z-40">
        <div className="flex h-14 items-center justify-between px-4">
          <div>
            <h1 className="text-2xl font-semibold">{title}</h1>
            {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </div>
      </header>
      <OfflineIndicator />
      <main className={cn("mx-auto space-y-6 px-4 py-6", contentClassName)}>{children}</main>
    </div>
  )
}
