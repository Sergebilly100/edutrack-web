import { useId, type ReactNode } from "react"

import { cn } from "@/lib/utils"
import { useOfflineGuard } from "@/shared/hooks/useOfflineGuard"

type OfflineDisabledFieldsetProps = {
  offlineCapable?: boolean
  className?: string
  // Affiche un message d'info au-dessus du fieldset quand bloqué.
  showNotice?: boolean
  notice?: string
  children: ReactNode
}

// Wrapper <fieldset> qui désactive en bloc tous les contrôles internes
// (boutons, inputs, selects, textareas) quand l'utilisateur est offline.
// Préférer ce composant aux <OfflineGuard> individuels pour les panels
// administratifs où la page entière est inutilisable hors ligne.
export function OfflineDisabledFieldset({
  offlineCapable = false,
  className,
  showNotice = true,
  notice,
  children,
}: OfflineDisabledFieldsetProps) {
  const { isBlocked, blockMessage } = useOfflineGuard(offlineCapable)
  const noticeId = useId()

  return (
    <fieldset
      disabled={isBlocked}
      aria-describedby={isBlocked && showNotice ? noticeId : undefined}
      className={cn(
        "min-w-0 border-0 p-0",
        // disabled:opacity ne s'applique pas aux fieldsets natifs - on le force.
        isBlocked && "opacity-70",
        className,
      )}
    >
      {isBlocked && showNotice ? (
        <p
          id={noticeId}
          role="status"
          className="mb-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100"
        >
          {notice ?? blockMessage}
        </p>
      ) : null}
      {children}
    </fieldset>
  )
}
