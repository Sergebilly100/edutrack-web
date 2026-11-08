import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"

type ConfirmDeleteButtonProps = {
  label: string
  title: string
  description: string
  isPending?: boolean
  disabled?: boolean
  onConfirm: () => void
}

/** Suppression avec confirmation : titre associé, focus piégé, focus rendu au déclencheur (Radix AlertDialog). */
export function ConfirmDeleteButton({ label, title, description, isPending, disabled, onConfirm }: ConfirmDeleteButtonProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="min-h-12 border-destructive/40 text-destructive hover:bg-destructive/5 hover:text-destructive"
          disabled={disabled || isPending}
        >
          {label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="min-h-12">Annuler</AlertDialogCancel>
          <AlertDialogAction className="min-h-12 bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={onConfirm}>
            Supprimer
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
