import { create } from "zustand"

export type AuthRole = "director" | "secretary" | "teacher" | "super_admin"

export type AuthUser = {
  id: string
  name: string
  role: AuthRole
  phone: string | null
  email: string | null
  tenantId: string
  schemaName: string
  plan: string
}

type AuthState = {
  user: AuthUser | null
  accessToken: string | null
  /**
   * refreshToken est toujours null en pratique : le backend envoie le refresh token
   * exclusivement via cookie HttpOnly (invisible à JS). Ce champ est conservé pour
   * compatibilité avec les appels existants (LoginPage, client.ts).
   */
  refreshToken: string | null
  /**
   * Passe à true une fois que la tentative de restauration de session au démarrage
   * est terminée (succès ou échec). Tant que false, l'app affiche un loader et
   * ne redirige pas vers /login.
   */
  isSessionRestored: boolean
  setUser: (user: AuthUser | null) => void
  setAccessToken: (accessToken: string | null) => void
  setRefreshToken: (refreshToken: string | null) => void
  setSessionRestored: () => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()((setState) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isSessionRestored: false,
  setUser: (user) => setState({ user }),
  setAccessToken: (accessToken) => setState({ accessToken }),
  setRefreshToken: (refreshToken) => setState({ refreshToken }),
  setSessionRestored: () => setState({ isSessionRestored: true }),
  logout: () =>
    setState({ user: null, accessToken: null, refreshToken: null }),
}))
