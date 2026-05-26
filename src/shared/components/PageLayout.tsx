import type { ReactNode } from "react"

import { cn } from "@/lib/utils"
import { OfflineIndicator } from "@/shared/components/OfflineIndicator"

type PageLayoutProps = {
  title: string
  subtitle?: string
  actions?: ReactNode
  contentClassName?: string
  // Passer true si toutes les actions critiques de la page passent par
  // useOfflineMutation (queue + sync auto). Sinon le bandeau reste rouge
  // pour prévenir l'utilisateur que ses actions échoueront.
  offlineCapable?: boolean
  children: ReactNode
}

export function PageLayout({ title, subtitle, actions, contentClassName, offlineCapable = false, children }: PageLayoutProps) {
  return (
    <div className="min-h-full bg-background">
      <OfflineIndicator offlineCapable={offlineCapable} />
      <header className="-mx-4 border-b bg-[var(--surface-chrome)] px-4 backdrop-blur md:-mx-6 md:top-0 md:z-40 md:px-6">
        <div className="flex min-h-16 flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:py-3">
          <div className="min-w-0">
            <h1 className="text-balance text-2xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
            {subtitle ? <p className="mt-1 max-w-2xl text-sm leading-5 text-muted-foreground">{subtitle}</p> : null}
          </div>
          {actions ? (
            <div className="flex w-full shrink-0 flex-wrap items-center gap-2 sm:w-auto [&>button]:w-full sm:[&>button]:w-auto [&>a]:w-full sm:[&>a]:w-auto">
              {actions}
            </div>
          ) : null}
        </div>
      </header>
      <main className={cn("mx-auto space-y-5 py-5 sm:space-y-6 sm:py-6", contentClassName)}>{children}</main>
    </div>
  )
}
