import type { ReactNode } from "react"
import { CheckCircle2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type ValidationsView = "todo" | "history"

/** Pastille de compteur d'un onglet : affichée seulement si le nombre est supérieur à 0. */
export function ValidationsTabCount({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <>
      <span aria-hidden="true" className="ml-2 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-amber-100 px-1.5 text-xs font-semibold text-amber-900">
        {count}
      </span>
      <span className="sr-only"> ({count} à traiter)</span>
    </>
  )
}

type ViewSwitchProps = {
  value: ValidationsView
  onChange: (value: ValidationsView) => void
  todoCount: number
  label: string
}

/** Sélecteur segmenté « À traiter · N » / « Historique » à l'intérieur d'un onglet. */
export function ValidationsViewSwitch({ value, onChange, todoCount, label }: ViewSwitchProps) {
  const item = (view: ValidationsView, content: ReactNode) => (
    <Button
      type="button"
      variant="ghost"
      aria-pressed={value === view}
      onClick={() => onChange(view)}
      className={cn(
        "h-10 min-h-10 rounded-md px-4 text-sm font-medium text-muted-foreground",
        value === view && "bg-background text-foreground shadow-sm hover:bg-background"
      )}
    >
      {content}
    </Button>
  )
  return (
    <div role="group" aria-label={label} className="inline-flex w-full gap-1 rounded-lg bg-muted/50 p-1 sm:w-auto">
      {item("todo", todoCount > 0 ? `À traiter · ${todoCount}` : "À traiter")}
      {item("history", "Historique")}
    </div>
  )
}

/** État vide unique et compact d'une vue. */
export function ValidationsCompactEmpty({ title, message }: { title: string; message: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card px-4 py-8 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
        <CheckCircle2 aria-hidden="true" className="h-5 w-5" />
      </span>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="max-w-md text-sm text-muted-foreground">{message}</p>
    </div>
  )
}
