import type { ReactNode } from "react"

import { cn } from "@/lib/utils"
import { AideButton } from "@/shared/aide/AideButton"

/** Hauteur commune de tous les contrôles de la zone d'actions. */
export const HEADER_CONTROL_HEIGHT = "h-10 min-h-10"

type PageHeaderProps = {
  title: string
  subtitle?: ReactNode
  /** Fil d'Ariane : remplace le titre visible (le titre reste présent pour les lecteurs d'écran). */
  breadcrumb?: ReactNode
  /** Contrôles de la zone d'actions, dans l'ordre : sélecteurs, actions secondaires, action principale. « Aide » est ajouté en dernier. */
  actions?: ReactNode
  /** Ligne de contexte sous la rangée titre / actions (hors zone d'actions). */
  context?: ReactNode
  /** En-tête collant (dashboard). */
  sticky?: boolean
  /** Masque le bouton « Aide » (aide désactivée dans certains contextes, ex. onboarding). */
  hideAide?: boolean
  /** Repère de visite guidée (data-tour). */
  tourId?: string
  className?: string
}

/**
 * En-tête de page standard : titre et sous-titre à gauche, zone d'actions sur une seule ligne à droite,
 * « Aide » toujours en dernier. Les mentions « Dernier calcul » passent par <HeaderAction note>.
 */
export function PageHeader({ title, subtitle, breadcrumb, actions, context, sticky = false, hideAide = false, tourId, className }: PageHeaderProps) {
  return (
    <header
      data-page-header
      data-tour={tourId}
      className={cn(
        "-mx-4 border-b bg-[var(--surface-chrome)] px-4 backdrop-blur md:-mx-6 md:px-6",
        sticky && "md:sticky md:top-0 md:z-30",
        className
      )}
    >
      <div className="flex flex-col gap-3 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          {breadcrumb ? (
            <>
              <h1 className="sr-only">{title}</h1>
              {breadcrumb}
            </>
          ) : (
            <>
              <h1 className="text-balance text-2xl font-semibold tracking-tight">{title}</h1>
              {subtitle ? <p className="mt-1 max-w-2xl text-sm leading-5 text-muted-foreground">{subtitle}</p> : null}
            </>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2" data-page-header-actions>
          {actions}
          {hideAide ? null : <AideButton className={HEADER_CONTROL_HEIGHT} />}
        </div>
      </div>
      {context ? <div className="pb-4">{context}</div> : null}
    </header>
  )
}

type HeaderActionProps = {
  children: ReactNode
  /** Mention discrète (« Dernier calcul : … ») placée sous ce contrôle, hors de son flux. */
  note?: ReactNode
}

/**
 * Enveloppe d'un contrôle porteur d'une mention. Bureau : la mention est absolue sous le bord droit du contrôle.
 * Étroit : l'enveloppe disparaît (display: contents) et la mention devient une ligne sous toute la rangée d'actions.
 */
export function HeaderAction({ children, note }: HeaderActionProps) {
  if (!note) return <>{children}</>
  return (
    <div className="contents lg:relative lg:block">
      {children}
      <p
        data-header-note
        aria-live="polite"
        className="order-last basis-full text-xs leading-5 text-muted-foreground lg:absolute lg:right-0 lg:top-full lg:mt-1 lg:basis-auto lg:whitespace-nowrap"
      >
        {note}
      </p>
    </div>
  )
}
