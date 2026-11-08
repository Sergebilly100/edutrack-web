import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export type FigureTone = "default" | "danger" | "success" | "muted"

const toneClass: Record<FigureTone, string> = {
  default: "text-foreground",
  danger: "text-red-700 dark:text-red-300",
  success: "text-green-700 dark:text-green-300",
  muted: "text-muted-foreground",
}

type KeyFigureProps = {
  label: string
  value: ReactNode
  tone?: FigureTone
  /** `boxed` : carte à bordure fine ; `plain` : texte nu (séparé par des filets côté appelant). */
  variant?: "boxed" | "plain"
  hint?: ReactNode
  /** `lg` : grand chiffre des cartes de synthèse. */
  size?: "md" | "lg"
  className?: string
}

/** Bloc de chiffre clé : libellé secondaire au-dessus, valeur en gras. Seule la valeur peut être colorée. */
export function KeyFigure({ label, value, tone = "default", variant = "boxed", hint, size = "md", className }: KeyFigureProps) {
  return (
    <div className={cn("min-w-0", variant === "boxed" && "rounded-lg border bg-card p-4", className)}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={cn("mt-1 font-semibold tabular-nums", size === "lg" ? "text-2xl sm:text-3xl" : "text-xl", toneClass[tone])}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}
