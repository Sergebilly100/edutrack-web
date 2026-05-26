import { useNetworkStatus } from "@/shared/hooks/useNetworkStatus"

export type OfflineGuardState = {
  isOnline: boolean
  // true si l'utilisateur est offline ET la page n'accepte PAS la mise en queue.
  // Les composants doivent désactiver leurs actions quand isBlocked.
  isBlocked: boolean
  // Message standardisé à afficher en tooltip.
  blockMessage: string
}

export function useOfflineGuard(offlineCapable = false): OfflineGuardState {
  const { isOnline } = useNetworkStatus()
  const isBlocked = !isOnline && !offlineCapable

  return {
    isOnline,
    isBlocked,
    blockMessage: "Action indisponible hors ligne - reconnectez-vous pour continuer.",
  }
}
