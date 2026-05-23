import type { ReactNode } from "react"
import { TriangleAlert } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type Variant = "default" | "destructive"

export type ConfirmActionDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: ReactNode
  consequences?: ReadonlyArray<ReactNode>
  variant?: Variant
  confirmLabel?: string
  cancelLabel?: string
  pendingLabel?: string
  isPending?: boolean
  disabled?: boolean
  onConfirm: () => void
  /** Contenu supplémentaire à insérer entre la description et les conséquences. */
  children?: ReactNode
}

const variantBorder: Record<Variant, string> = {
  default: "border-amber-200 bg-amber-50 text-amber-800",
  destructive: "border-red-200 bg-red-50 text-red-800",
}

export function ConfirmActionDialog({
  open,
  onOpenChange,
  title,
  description,
  consequences,
  variant = "default",
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  pendingLabel,
  isPending = false,
  disabled = false,
  onConfirm,
  children,
}: ConfirmActionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        {children}
        {consequences && consequences.length > 0 ? (
          <div className={`rounded-lg border p-3 text-sm ${variantBorder[variant]}`}>
            <div className="flex items-start gap-2">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="space-y-1">
                <p className="font-medium">Conséquences de cette action :</p>
                <ul className="list-disc space-y-0.5 pl-4">
                  {consequences.map((entry, idx) => (
                    <li key={idx}>{entry}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={variant === "destructive" ? "destructive" : "default"}
            disabled={isPending || disabled}
            onClick={onConfirm}
          >
            {isPending ? (pendingLabel ?? "Traitement...") : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
