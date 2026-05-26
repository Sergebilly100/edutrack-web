import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from "react"

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useOfflineGuard } from "@/shared/hooks/useOfflineGuard"

type OfflineGuardProps = {
  // Si la page supporte vraiment l'offline (mutations en queue), passer true.
  // Dans ce cas, OfflineGuard ne bloque rien.
  offlineCapable?: boolean
  // Message affiché en tooltip quand l'action est bloquée.
  message?: string
  children: ReactNode
}

// Wrapper qui désactive son unique enfant (bouton, lien, ou élément interactif)
// quand l'utilisateur est offline ET que la page n'est pas offline-capable.
// Affiche un tooltip explicatif au survol.
//
// Usage :
//   <OfflineGuard>
//     <Button onClick={...}>Créer</Button>
//   </OfflineGuard>
export function OfflineGuard({
  offlineCapable = false,
  message,
  children,
}: OfflineGuardProps) {
  const { isBlocked, blockMessage } = useOfflineGuard(offlineCapable)

  if (!isBlocked) {
    return <>{children}</>
  }

  const child = Children.only(children)
  if (!isValidElement(child)) {
    return <>{children}</>
  }

  const childProps = child.props as {
    disabled?: boolean
    onClick?: (...args: unknown[]) => void
    onSubmit?: (...args: unknown[]) => void
    "aria-disabled"?: boolean
  }

  const disabledChild = cloneElement(child as ReactElement, {
    disabled: true,
    "aria-disabled": true,
    onClick: undefined,
    onSubmit: undefined,
    // Évite que le focus reste sur un élément non-interactif
    tabIndex: childProps.disabled ? undefined : -1,
  })

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        {/* Wrapper span : un bouton disabled ne déclenche pas d'événements pointer,
            donc le tooltip ne s'afficherait pas sans ce span. */}
        <TooltipTrigger asChild>
          <span className="inline-flex">{disabledChild}</span>
        </TooltipTrigger>
        <TooltipContent>{message ?? blockMessage}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
