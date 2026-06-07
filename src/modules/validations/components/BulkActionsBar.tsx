import { Check, Clock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

export type BulkValidateAction = "approve_planned" | "approve_actual"

type BulkActionsBarProps = {
  selectedCount: number
  onClearSelection: () => void
  onBulkAction: (action: BulkValidateAction) => void
  isLoading?: boolean
  hasActualMinutes?: boolean
}

export function BulkActionsBar({
  selectedCount,
  onClearSelection,
  onBulkAction,
  isLoading = false,
  hasActualMinutes = true,
}: BulkActionsBarProps) {
  if (selectedCount === 0) return null

  return (
    <div className="fixed bottom-6 left-1/2 z-50 w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 md:left-[calc(50%+8rem)] md:w-[calc(100%-18rem)] md:max-w-2xl animate-in slide-in-from-bottom-4 duration-200">
      <div className="flex items-center justify-between gap-4 rounded-xl border bg-background/95 px-4 py-3 shadow-xl backdrop-blur-sm ring-1 ring-border">
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="secondary" className="h-7 px-3 text-sm font-medium">
            {selectedCount} sélectionné{selectedCount > 1 ? "s" : ""}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearSelection}
            disabled={isLoading}
          >
            Annuler
          </Button>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            className="border-green-200 bg-green-50 text-green-700 hover:bg-green-100 dark:border-green-900/50 dark:bg-green-950/40 dark:text-green-300"
            onClick={() => onBulkAction("approve_planned")}
            disabled={isLoading}
          >
            <Check className="mr-1.5 h-4 w-4" />
            Accorder le prévu
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-300"
            onClick={() => onBulkAction("approve_actual")}
            disabled={isLoading || !hasActualMinutes}
            title={!hasActualMinutes ? "Certaines présences n'ont pas de durée effectuée" : undefined}
          >
            <Clock className="mr-1.5 h-4 w-4" />
            Accorder l'effectué
          </Button>
        </div>
      </div>
    </div>
  )
}

