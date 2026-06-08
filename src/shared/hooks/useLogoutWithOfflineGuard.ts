import { useCallback, useState } from "react"

import { useOfflineStore } from "@/shared/store/offline.store"

/**
 * Options passées à la fonction de logout effective fournie par le composant.
 * `keepOfflineQueue` est `true` quand le prof se déconnecte alors qu'il a des
 * actions offline en attente : on conserve la file pour la rejouer à sa
 * prochaine connexion (les items sont taggés par ownerId, donc ré-attribués au
 * bon prof même sur appareil partagé).
 */
export type LogoutExecutorOptions = { keepOfflineQueue: boolean }

type UseLogoutWithOfflineGuard = {
  /** Nombre d'actions offline en attente (0 → logout direct sans dialog). */
  pendingCount: number
  /** true quand le dialog de confirmation doit être affiché. */
  confirmOpen: boolean
  /** Ouvre/ferme le dialog (branché sur AlertDialog.onOpenChange). */
  setConfirmOpen: (open: boolean) => void
  /**
   * Point d'entrée du bouton « Se déconnecter ». S'il reste des actions
   * offline → ouvre le dialog de confirmation. Sinon → logout immédiat
   * (purge la file, comportement historique pour une session sans travail
   * en attente).
   */
  requestLogout: () => void
  /** Confirme la déconnexion depuis le dialog en CONSERVANT la file offline. */
  confirmLogout: () => void
}

/**
 * Garde anti-perte de données au logout volontaire.
 *
 * Avant ce hook, cliquer « Se déconnecter » purgeait silencieusement la file
 * offline : un prof ayant pointé hors ligne perdait ses check-in / scans QR /
 * appels élèves sans avertissement. Désormais, si la file n'est pas vide, on
 * demande confirmation et on conserve la file (rejouée à la reconnexion).
 *
 * @param performLogout  séquence de logout propre au composant (appel API,
 *                        reset store, queryClient.clear, navigation…). Reçoit
 *                        `keepOfflineQueue` à transmettre au logout du store.
 */
export function useLogoutWithOfflineGuard(
  performLogout: (options: LogoutExecutorOptions) => void
): UseLogoutWithOfflineGuard {
  const pendingCount = useOfflineStore((state) => state.queue.length)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const requestLogout = useCallback(() => {
    if (pendingCount > 0) {
      setConfirmOpen(true)
      return
    }
    performLogout({ keepOfflineQueue: false })
  }, [pendingCount, performLogout])

  const confirmLogout = useCallback(() => {
    setConfirmOpen(false)
    performLogout({ keepOfflineQueue: true })
  }, [performLogout])

  return {
    pendingCount,
    confirmOpen,
    setConfirmOpen,
    requestLogout,
    confirmLogout,
  }
}
