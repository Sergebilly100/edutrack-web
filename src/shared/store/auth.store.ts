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

export type PermissionKey =
  | "teachers.view"
  | "teachers.create"
  | "teachers.edit"
  | "teachers.block"
  | "teachers.documents"
  | "students.view"
  | "students.create"
  | "students.edit"
  | "students.documents"
  | "schedule.view"
  | "schedule.edit"
  | "attendance.view"
  | "attendance.mark_students"
  | "salary.view"
  | "salary.compute"
  | "salary.mark_paid"
  | "salary.export"
  | "settings.positions"
  | "settings.school"

type AuthState = {
  user: AuthUser | null
  permissions: PermissionKey[]
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
  setPermissions: (permissions: PermissionKey[]) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()((setState) => ({
  user: null,
  permissions: [],
  accessToken: null,
  refreshToken: null,
  isSessionRestored: false,
  setUser: (user) => setState({ user }),
  setAccessToken: (accessToken) => setState({ accessToken }),
  setRefreshToken: (refreshToken) => setState({ refreshToken }),
  setSessionRestored: () => setState({ isSessionRestored: true }),
  setPermissions: (permissions) => setState({ permissions }),
  logout: () =>
    setState({ user: null, permissions: [], accessToken: null, refreshToken: null }),
}))
