import type { ReactNode } from "react"

import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

/** Pourcentage entier borné à 0–100 ; 0 si le dénominateur est nul ou invalide. */
export const toPercent = (part: number, whole: number): number => {
  if (!Number.isFinite(part) || !Number.isFinite(whole) || whole <= 0) return 0
  return Math.min(100, Math.max(0, Math.round((part / whole) * 100)))
}

type ProgressMeterProps = {
  percent: number
  label: string
  caption?: ReactNode
  aside?: ReactNode
  className?: string
}

/** Barre de progression avec légende sous la barre (texte à gauche, information annexe à droite). */
export function ProgressMeter({ percent, label, caption, aside, className }: ProgressMeterProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <Progress value={percent} aria-label={label} className="h-2" />
      {caption || aside ? (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span>{caption}</span>
          {aside ? <span>{aside}</span> : null}
        </div>
      ) : null}
    </div>
  )
}
