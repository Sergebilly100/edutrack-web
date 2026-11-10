import { useEffect } from "react"
import { HelpCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { AidePanel } from "./AidePanel"
import { useAideStore } from "./aide.store"
import { useAide, useHasRouter } from "./useAide"

const isTypingTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
}

const hasOtherDialogOpen = () =>
  Boolean(document.querySelector('[role="dialog"][data-state="open"]:not([data-aide-panel]), [role="alertdialog"][data-state="open"]'))

function AideButtonInner({ className, compact = false }: { className?: string; compact?: boolean }) {
  const { entry, tourId, available, viewer, showBadge, hideBadges, markOpened, setHideBadges } = useAide()
  const panelOpen = useAideStore((state) => state.panelOpen)
  const setPanelOpen = useAideStore((state) => state.setPanelOpen)
  const requestTour = useAideStore((state) => state.requestTour)

  const openPanel = () => {
    setPanelOpen(true)
    markOpened()
  }

  // Raccourci « ? » : ouvre l'aide de la page courante.
  useEffect(() => {
    if (!available) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "?" || event.ctrlKey || event.metaKey || event.altKey) return
      if (isTypingTarget(event.target) || hasOtherDialogOpen()) return
      event.preventDefault()
      setPanelOpen(true)
      markOpened()
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [available, markOpened, setPanelOpen])

  // La page change : le panneau de la page précédente se ferme.
  useEffect(() => () => setPanelOpen(false), [setPanelOpen])

  if (!available) return null

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size={compact ? "icon" : "default"}
        className={cn("relative min-h-12", compact && "h-12 w-12 shrink-0", className)}
        title={compact ? "Aide de la page" : undefined}
        onClick={openPanel}
        aria-label="Ouvrir l'aide de la page"
        aria-keyshortcuts="?"
        data-aide-button
      >
        <HelpCircle aria-hidden="true" />
        {compact ? null : "Aide"}
        {showBadge ? (
          <>
            <span aria-hidden="true" className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-primary" />
            <span className="sr-only">nouveau</span>
          </>
        ) : null}
      </Button>
      <AidePanel
        open={panelOpen}
        onOpenChange={setPanelOpen}
        entry={entry}
        viewer={viewer}
        tourId={tourId}
        hideBadges={hideBadges}
        onHideBadgesChange={setHideBadges}
        onStartTour={(id) => {
          setPanelOpen(false)
          requestTour(id)
        }}
      />
    </>
  )
}

/** Bouton « Aide » unique de la page. Affiché seulement si la page a une aide ou une visite. Sans Router : rien. */
export function AideButton({ className, compact = false }: { className?: string; compact?: boolean }) {
  const hasRouter = useHasRouter()
  if (!hasRouter) return null
  return <AideButtonInner className={className} compact={compact} />
}
