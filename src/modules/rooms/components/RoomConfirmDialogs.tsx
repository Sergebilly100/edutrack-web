import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import type { RoomListItem } from "../rooms.api"

type RoomDeleteDialogProps = {
  room: RoomListItem | null
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

export function RoomDeleteDialog({ room, onOpenChange, onConfirm }: RoomDeleteDialogProps) {
  return (
    <AlertDialog
      open={Boolean(room)}
      onOpenChange={(open) => {
        if (!open) onOpenChange(false)
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer cette salle ?</AlertDialogTitle>
          <AlertDialogDescription>
            Cette action est définitive. La suppression sera refusée si la salle est utilisée dans un créneau.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Supprimer</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

type RoomQrRegenerateDialogProps = {
  room: RoomListItem | null
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

export function RoomQrRegenerateDialog({ room, onOpenChange, onConfirm }: RoomQrRegenerateDialogProps) {
  return (
    <AlertDialog
      open={Boolean(room)}
      onOpenChange={(open) => {
        if (!open) onOpenChange(false)
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Régénérer le QR code de salle ?</AlertDialogTitle>
          <AlertDialogDescription>
            Cette action remplace immédiatement le QR code actuel de{" "}
            <span className="font-medium">{room?.name ?? "la salle"}</span>. Le QR imprimé dans la salle devra être
            remplacé pour éviter les scans invalides.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Régénérer le QR</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

type RoomEditConfirmDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

export function RoomEditConfirmDialog({ open, onOpenChange, onConfirm }: RoomEditConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirmer la modification de la salle</AlertDialogTitle>
          <AlertDialogDescription>
            Cette modification peut impacter les emplois du temps (EDT) et la cohérence des cours planifiés. Vérifiez
            les informations avant de continuer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Confirmer la modification</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
