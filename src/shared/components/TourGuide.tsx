import { useEffect, useId, useRef, useState } from "react"
import { Joyride, STATUS, ACTIONS, EVENTS, type EventData, type Controls, type TooltipRenderProps } from "react-joyride"
import { X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import type { AideStep } from "@/shared/aide/aide.types"
import { canView } from "@/shared/aide/aide-registry"
import { fixedBottomInset, resolveTourAnchor, stickyTopOffset } from "@/shared/aide/tour-anchor"
import { useAideViewer } from "@/shared/aide/useAide"

// ── Infobulle de visite (composants shadcn uniquement) ────────────────────────

function TourTooltip({ step, index, size, isLastStep, backProps, primaryProps, closeProps, tooltipProps }: TooltipRenderProps) {
  const titleId = useId()
  const contentId = useId()
  const containerRef = useRef<HTMLDivElement>(null)

  // Le focus suit l'infobulle à chaque étape (lecteur d'écran et clavier).
  useEffect(() => {
    containerRef.current?.focus()
  }, [index])

  return (
    <div
      {...tooltipProps}
      ref={containerRef}
      tabIndex={-1}
      aria-labelledby={step.title ? titleId : undefined}
      aria-describedby={contentId}
      className="w-80 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-background p-4 shadow-lg outline-none"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground" aria-live="polite">
          Étape {index + 1} sur {size}
        </p>
        <Button
          {...closeProps}
          type="button"
          variant="outline"
          size="icon"
          className="-mr-2 -mt-2 h-12 w-12 shrink-0 rounded-full border-2 border-foreground/40 bg-muted text-foreground hover:bg-muted"
          aria-label="Fermer la visite"
          title="Fermer la visite"
        >
          <X className="h-6 w-6" strokeWidth={2.5} aria-hidden="true" />
        </Button>
      </div>
      {step.title ? (
        <h3 id={titleId} className="mb-1 text-base font-semibold leading-snug text-foreground">
          {step.title as string}
        </h3>
      ) : null}
      <p id={contentId} className="max-h-[40vh] overflow-y-auto text-sm leading-relaxed text-muted-foreground">
        {step.content as string}
      </p>
      <div className="mt-4 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          {index > 0 ? (
            <Button {...backProps} type="button" variant="outline" className="min-h-12 flex-1" aria-label="Étape précédente" title="Étape précédente">
              Précédent
            </Button>
          ) : null}
          <Button
            {...primaryProps}
            type="button"
            className={cn("min-h-12 flex-1")}
            aria-label={isLastStep ? "Terminer la visite" : "Étape suivante"}
            title={isLastStep ? "Terminer la visite" : "Étape suivante"}
          >
            {isLastStep ? "Terminer" : "Suivant"}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Composant de visite ───────────────────────────────────────────────────────

type TourGuideProps = {
  steps: AideStep[]
  run: boolean
  stepIndex: number
  onStepChange: (index: number) => void
  onFinish: () => void
}

const targetExists = (step: AideStep) => {
  if (typeof step.target !== "string") return true
  return resolveTourAnchor(step.target) !== null
}

/** La cible est recalculée à chaque étape : zone trop haute → en-tête ; élément masqué → étape ignorée. */
const withAnchor = (step: AideStep): AideStep =>
  typeof step.target === "string"
    ? { ...step, target: (() => resolveTourAnchor(step.target as string)) as unknown as AideStep["target"] }
    : step

const prefersReducedMotion = () =>
  typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches

export function TourGuide({ steps, run, stepIndex, onStepChange, onFinish }: TourGuideProps) {
  const viewer = useAideViewer()
  const [activeSteps, setActiveSteps] = useState<AideStep[]>([])

  // Les étapes sans cible (ou interdites pour ce profil) sont retirées AVANT le démarrage :
  // le compteur « Étape X sur N » reste juste.
  useEffect(() => {
    if (!run) {
      setActiveSteps([])
      return
    }
    const usable = steps.filter((step) => canView(step, viewer) && targetExists(step))
    if (usable.length === 0) {
      toast({ title: "Rien à montrer ici pour le moment", description: "Les éléments de cette visite ne sont pas affichés sur l'écran." })
      onFinish()
      return
    }
    setActiveSteps(usable.map(withAnchor))
    // Seul le démarrage fige la liste d'étapes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run])

  const handleEvent = (data: EventData, _controls: Controls) => {
    const { status, type, index, action } = data

    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      onFinish()
      return
    }

    // Cible disparue en cours de route (ex. onglet changé) → étape suivante.
    if (type === EVENTS.TARGET_NOT_FOUND) {
      onStepChange(index + 1)
      return
    }

    // Croix, Échap ou clic hors de l'infobulle → fermer la visite.
    if (type === EVENTS.STEP_AFTER && action === ACTIONS.CLOSE) {
      onFinish()
      return
    }

    // Mode contrôlé : on avance uniquement sur STEP_AFTER pour éviter les appels multiples.
    if (type === EVENTS.STEP_AFTER) {
      if (action === ACTIONS.NEXT || action === ACTIONS.GO) onStepChange(index + 1)
      else if (action === ACTIONS.PREV) onStepChange(index - 1)
    }
  }

  const reduceMotion = prefersReducedMotion()
  // L'infobulle ne doit passer ni sous l'en-tête collant du haut, ni sous une barre figée en bas (menu du portail parent).
  const topInset = run ? stickyTopOffset() : 20
  const bottomInset = run ? fixedBottomInset() : 0
  const margin = { top: topInset, bottom: bottomInset + 12, left: 8, right: 8 }

  return (
    <Joyride
      steps={activeSteps}
      run={run && activeSteps.length > 0}
      stepIndex={stepIndex}
      continuous
      scrollToFirstStep
      tooltipComponent={TourTooltip}
      floatingOptions={{ flipOptions: { padding: margin }, shiftOptions: { padding: margin } }}
      onEvent={handleEvent}
      locale={{ back: "Précédent", close: "Fermer", last: "Terminer", next: "Suivant", skip: "Quitter" }}
      options={{
        overlayColor: "hsl(var(--foreground) / 0.35)",
        overlayClickAction: "close",
        dismissKeyAction: "close",
        spotlightRadius: 10,
        zIndex: 9000,
        scrollDuration: reduceMotion ? 0 : 300,
        scrollOffset: topInset,
        buttons: ["back", "close", "primary", "skip"],
      }}
    />
  )
}
