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

type LogoutOfflineGuardDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  pendingCount: number
  onConfirm: () => void
}

/**
 * Dialog de confirmation affiché quand le prof se déconnecte alors qu'il a des
 * actions offline non synchronisées. Conserve la file (rejouée à la prochaine
 * connexion du même prof) plutôt que de la perdre silencieusement.
 *
 * Partagé par les trois points de logout (TeacherTopBar, Sidebar, UserMenu)
 * pour éviter de dupliquer le markup et le wording.
 */
export function LogoutOfflineGuardDialog({
  open,
  onOpenChange,
  pendingCount,
  onConfirm,
}: LogoutOfflineGuardDialogProps) {
  const plural = pendingCount > 1
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {pendingCount} action{plural ? "s" : ""} non synchronisée{plural ? "s" : ""}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {plural ? "Ces actions seront envoyées" : "Cette action sera envoyée"} à votre prochaine
            connexion. Voulez-vous vous déconnecter maintenant ?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Se déconnecter</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
