import { AlertTriangle, RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type QueryErrorStateProps = {
  /** Relance la requête concernée uniquement (ex: query.refetch). */
  onRetry?: () => void
  /** Message court affiché sous le titre. */
  message?: string
  title?: string
  isRetrying?: boolean
  className?: string
}

/**
 * Encart d'erreur isolé pour un bloc dont la requête a échoué.
 *
 * Objectif : une requête en erreur dégrade uniquement son propre bloc, sans
 * bloquer le rendu des autres sections de la page. À utiliser dans le `<CardContent>`
 * d'un bloc au lieu de masquer/skeletoniser indéfiniment.
 */
export function QueryErrorState({
  onRetry,
  message = "Impossible de charger ces données pour le moment.",
  title = "Données indisponibles",
  isRetrying = false,
  className,
}: QueryErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-center",
        className
      )}
    >
      <AlertTriangle className="h-5 w-5 text-amber-600" aria-hidden="true" />
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{message}</p>
      </div>
      {onRetry ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-10"
          onClick={onRetry}
          disabled={isRetrying}
        >
          <RefreshCw className={cn("mr-2 h-4 w-4", isRetrying && "animate-spin")} aria-hidden="true" />
          {isRetrying ? "Nouvelle tentative…" : "Réessayer"}
        </Button>
      ) : null}
    </div>
  )
}
