// Masquage de la carte d'installation « pour la session courante ».
// On utilise sessionStorage : la carte reste masquée tant que la session de
// navigation dure, et réapparaît à la prochaine connexion (le flag est aussi
// effacé explicitement au logout pour couvrir un re-login dans le même onglet).

const KEY = "ivoiredu-install-card-dismissed"

const isBrowser = typeof window !== "undefined"

export const isInstallCardDismissed = (): boolean => {
  if (!isBrowser) return false
  try {
    return window.sessionStorage.getItem(KEY) === "1"
  } catch {
    return false
  }
}

export const dismissInstallCard = (): void => {
  if (!isBrowser) return
  try {
    window.sessionStorage.setItem(KEY, "1")
  } catch {
    /* sessionStorage indisponible : on ignore, la carte restera visible */
  }
}

export const resetInstallCardDismiss = (): void => {
  if (!isBrowser) return
  try {
    window.sessionStorage.removeItem(KEY)
  } catch {
    /* no-op */
  }
}
