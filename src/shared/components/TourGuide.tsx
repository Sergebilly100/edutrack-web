import { Joyride, STATUS, ACTIONS, EVENTS, type Step, type EventData, type Controls, type TooltipRenderProps } from "react-joyride"

// ── Custom tooltip ────────────────────────────────────────────────────────────

function TourTooltip({
  step,
  index,
  size,
  backProps,
  primaryProps,
  skipProps,
  tooltipProps,
}: TooltipRenderProps) {
  return (
    <div
      {...tooltipProps}
      className="w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-background p-5 shadow-2xl"
    >
      {/* Header */}
      <div className="mb-3">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-primary/70">
            {index + 1} / {size}
          </span>
          <button
            {...skipProps}
            className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            Passer le tour
          </button>
        </div>
        {step.title ? (
          <h3 className="text-base font-semibold leading-snug text-foreground">
            {step.title as string}
          </h3>
        ) : null}
      </div>

      {/* Content */}
      <p className="text-sm leading-relaxed text-muted-foreground">
        {step.content as string}
      </p>

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex gap-1.5">
          {Array.from({ length: size }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === index
                  ? "w-4 bg-primary"
                  : "w-1.5 bg-muted-foreground/30"
              }`}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          {index > 0 ? (
            <button
              {...backProps}
              className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted transition-colors"
            >
              ← Préc.
            </button>
          ) : null}
          <button
            {...primaryProps}
            className="rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            {index === size - 1 ? "Terminer" : "Suivant →"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── TourGuide component ───────────────────────────────────────────────────────

type TourGuideProps = {
  steps: Step[]
  run: boolean
  stepIndex: number
  onStepChange: (index: number) => void
  onFinish: () => void
}

export function TourGuide({ steps, run, stepIndex, onStepChange, onFinish }: TourGuideProps) {
  const handleEvent = (data: EventData, _controls: Controls) => {
    const { status, type, index, action } = data

    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      onFinish()
      return
    }

    // Cible introuvable dans le DOM (ex: élément dans un onglet inactif) → sauter
    if (type === EVENTS.TARGET_NOT_FOUND) {
      onStepChange(index + 1)
      return
    }

    // Clic sur l'overlay → annuler le tour
    if (type === EVENTS.STEP_AFTER && action === ACTIONS.CLOSE) {
      onFinish()
      return
    }

    // En mode contrôlé, on avance uniquement sur STEP_AFTER pour éviter les
    // appels multiples (TOOLTIP, STEP_BEFORE, etc. émettent aussi des events).
    if (type === EVENTS.STEP_AFTER) {
      if (action === ACTIONS.NEXT || action === ACTIONS.GO) {
        onStepChange(index + 1)
      } else if (action === ACTIONS.PREV) {
        onStepChange(index - 1)
      }
    }
  }

  return (
    <Joyride
      steps={steps}
      run={run}
      stepIndex={stepIndex}
      continuous
      scrollToFirstStep
      tooltipComponent={TourTooltip}
      onEvent={handleEvent}
      options={{
        overlayColor: "rgba(0,0,0,0.35)",
        overlayClickAction: "close",
        spotlightRadius: 10,
        zIndex: 9000,
        buttons: ["back", "close", "primary", "skip"],
      }}
    />
  )
}
