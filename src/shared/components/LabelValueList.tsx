import type { ReactNode } from "react"

import { cn } from "@/lib/utils"
import type { FigureTone } from "@/shared/components/KeyFigure"

export type LabelValueRow = {
  key: string
  label: ReactNode
  value: ReactNode
  tone?: FigureTone
  /** Ligne en gras (total intermédiaire). */
  strong?: boolean
  /** Ligne mise en évidence (fond léger) : à n'utiliser qu'une fois par liste. */
  highlight?: boolean
  /** Filet au-dessus de la ligne. */
  separated?: boolean
}

const toneClass: Record<FigureTone, string> = {
  default: "text-foreground",
  danger: "text-red-700 dark:text-red-300",
  success: "text-green-700 dark:text-green-300",
  muted: "text-muted-foreground",
}

/** Liste « libellé / valeur » alignée à droite, utilisée pour les décomptes financiers. */
export function LabelValueList({ rows, className }: { rows: ReadonlyArray<LabelValueRow>; className?: string }) {
  return (
    <dl className={cn("overflow-hidden rounded-lg border bg-card", className)}>
      {rows.map((row) => (
        <div
          key={row.key}
          className={cn(
            "flex items-center justify-between gap-4 px-4 py-2.5 text-sm",
            row.separated && "border-t",
            row.highlight && "bg-blue-50 dark:bg-blue-950/40",
          )}
        >
          <dt className={cn(row.strong || row.highlight ? "font-semibold text-foreground" : "text-muted-foreground")}>{row.label}</dt>
          <dd className={cn("text-right tabular-nums", row.strong || row.highlight ? "font-semibold" : "font-medium", toneClass[row.tone ?? "default"])}>{row.value}</dd>
        </div>
      ))}
    </dl>
  )
}
