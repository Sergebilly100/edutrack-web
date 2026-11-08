import type { ComponentPropsWithoutRef, ReactNode } from "react"

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { getInitials } from "@/shared/utils/avatar"

type DetailDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  subtitle?: ReactNode
  /** Nom dont on affiche les initiales dans l'en-tête. */
  initialsOf?: string
  /** Pastilles de statut, affichées à droite du titre. */
  badges?: ReactNode
  footer?: ReactNode
  size?: "md" | "lg" | "xl"
  onCloseAutoFocus?: ComponentPropsWithoutRef<typeof DialogContent>["onCloseAutoFocus"]
  children: ReactNode
}

const sizeClass = { md: "sm:max-w-xl", lg: "sm:max-w-2xl", xl: "sm:max-w-3xl" } as const

/**
 * Coque commune des fenêtres de détail : en-tête, corps à défilement unique, pied fixe.
 * Plein écran sur mobile ; le piégeage du focus, Échap et le retour du focus viennent de Radix.
 */
export function DetailDialog({ open, onOpenChange, title, subtitle, initialsOf, badges, footer, size = "lg", onCloseAutoFocus, children }: DetailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onCloseAutoFocus={onCloseAutoFocus}
        className={cn(
          "flex h-[100dvh] max-h-[100dvh] w-full max-w-none flex-col gap-0 rounded-none p-0",
          "sm:h-auto sm:max-h-[90vh] sm:rounded-lg",
          sizeClass[size],
        )}
      >
        <div className="flex items-start gap-4 border-b px-5 py-4 pr-12 sm:px-6">
          {initialsOf ? (
            <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
              {getInitials(initialsOf)}
            </span>
          ) : null}
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-xl leading-tight">{title}  {badges ?  badges : null} </DialogTitle>
            {subtitle ? <DialogDescription className="mt-1">{subtitle}</DialogDescription> : <DialogDescription className="sr-only">{title}</DialogDescription>}
          </div>
        </div>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        {footer ? <div className="flex flex-col-reverse gap-2 border-t px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 [&_button]:min-h-10">{footer}</div> : null}
      </DialogContent>
    </Dialog>
  )
}
