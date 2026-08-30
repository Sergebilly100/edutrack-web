import { create } from "zustand"

import { resetInstallCardDismiss } from "@/shared/pwa/install-dismiss"
import { useOfflineStore } from "@/shared/store/offline.store"

export type AuthRole = "director" | "staff" | "teacher" | "super_admin"

export const isStaffRole = (role: AuthRole | undefined): role is "staff" => role === "staff"

export type AuthUser = {
  id: string
  name: string
  role: AuthRole
  phone: string | null
  email: string | null
  profilePhotoUrl: string | null
  mustChangePassword: boolean
  positionNames?: string[]
  primaryPosition?: string | null
  tenantId: string
  schemaName: string
  plan: string
}

export type TenantStatus = "trial" | "active" | "past_due" | "canceled" | "suspended"

export type AuthTenant = {
  id: string
  status: TenantStatus
  trialEndsAt: string | null
}

export type PermissionKey =
  | "teachers.view"
  | "teachers.create"
  | "teachers.edit"
  | "teachers.block"
  | "teachers.documents"
  | "teachers.ranking.view"
  | "teachers.attendance.view"
  | "teachers.password.reset"
  | "students.view"
  | "students.create"
  | "students.edit"
  | "students.documents"
  | "students.excuse"
  | "schedule.view"
  | "schedule.edit"
  | "attendance.view"
  | "attendance.mark_students"
  | "salary.view"
  | "salary.compute"
  | "salary.mark_paid"
  | "salary.export"
  | "validations.view"
  | "validations.approve"
  | "validations.reject"
  | "rooms.view"
  | "rooms.create"
  | "rooms.edit"
  | "rooms.delete"
  | "school_years.view"
  | "school_years.edit"
  | "class_decisions.view"
  | "class_decisions.validate"
  | "conduct.finalize"
  | "report_cards.view"
  | "report_cards.publish"
  | "enrollments.view"
  | "enrollments.create"
  | "enrollments.edit"
  | "enrollments.confirm_payment"
  | "tuition.view"
  | "tuition.edit"
  | "tuition.grant_discount"
  | "payments.view"
  | "payments.record"
  | "payments.cancel"
  | "risk_alerts.edit"
  | "financial_alerts.edit"
  | "subscription_plans.view"
  | "subscription_plans.edit"
  | "classes.view"
  | "classes.create"
  | "classes.edit"
  | "classes.delete"
  | "import.students"
  | "import.teachers"
  | "import.schedule"
  | "settings.positions"
  | "settings.school"
  | "settings.sms_templates"
  | "subscriptions.view"
  | "subscriptions.create"
  | "subscriptions.edit"
  | "subscriptions.renew"
  | "subscriptions.cancel"
  | "subscriptions.password.reset"
  | "subscriptions.revenue"

type AuthState = {
  user: AuthUser | null
  tenant: AuthTenant | null
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
  setTenant: (tenant: AuthTenant | null) => void
  setAccessToken: (accessToken: string | null) => void
  setRefreshToken: (refreshToken: string | null) => void
  setSessionRestored: () => void
  setPermissions: (permissions: PermissionKey[]) => void
  logout: (options?: { keepOfflineQueue?: boolean }) => void
}

const AUTH_SNAPSHOT_KEY = "edutrack-auth-snapshot-v1"
const AUTH_SNAPSHOT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

type AuthSnapshot = {
  version: 1
  savedAt: number
  user: AuthUser
  tenant: AuthTenant | null
  permissions: PermissionKey[]
}

const isBrowser = typeof window !== "undefined"

export function readAuthSnapshot(): AuthSnapshot | null {
  if (!isBrowser) return null

  try {
    const raw = window.localStorage.getItem(AUTH_SNAPSHOT_KEY)
    if (!raw) return null

    const snapshot = JSON.parse(raw) as AuthSnapshot
    if (
      snapshot.version !== 1 ||
      !snapshot.user ||
      Date.now() - snapshot.savedAt > AUTH_SNAPSHOT_MAX_AGE_MS
    ) {
      window.localStorage.removeItem(AUTH_SNAPSHOT_KEY)
      return null
    }

    return snapshot
  } catch {
    window.localStorage.removeItem(AUTH_SNAPSHOT_KEY)
    return null
  }
}

const writeAuthSnapshot = (state: Pick<AuthState, "user" | "tenant" | "permissions">) => {
  if (!isBrowser) return

  if (!state.user) {
    window.localStorage.removeItem(AUTH_SNAPSHOT_KEY)
    return
  }

  const snapshot: AuthSnapshot = {
    version: 1,
    savedAt: Date.now(),
    user: state.user,
    tenant: state.tenant,
    permissions: state.permissions,
  }

  try {
    window.localStorage.setItem(AUTH_SNAPSHOT_KEY, JSON.stringify(snapshot))
  } catch {
    // Le snapshot améliore le mode offline, mais ne doit jamais bloquer l'app.
  }
}

export const useAuthStore = create<AuthState>()((setState) => ({
  user: null,
  tenant: null,
  permissions: [],
  accessToken: null,
  refreshToken: null,
  isSessionRestored: false,
  setUser: (user) =>
    setState((state) => {
      const next = { ...state, user }
      writeAuthSnapshot(next)
      return { user }
    }),
  setTenant: (tenant) =>
    setState((state) => {
      const next = { ...state, tenant }
      writeAuthSnapshot(next)
      return { tenant }
    }),
  setAccessToken: (accessToken) => setState({ accessToken }),
  setRefreshToken: (refreshToken) => setState({ refreshToken }),
  setSessionRestored: () => setState({ isSessionRestored: true }),
  setPermissions: (permissions) =>
    setState((state) => {
      const next = { ...state, permissions }
      writeAuthSnapshot(next)
      return { permissions }
    }),
    // la redirection après logout est gérée dans App.tsx en écoutant les changements de user dans le store auth, et elle redirige vers la page de login classique pour les enseignants et les admins
  logout: (options?: { keepOfflineQueue?: boolean }) =>
    setState(() => {
      resetInstallCardDismiss()
      // Ne purger la queue offline que lors d'un logout volontaire.
      // Lors d'une session expirée (401), on garde la queue pour la rejouer
      // après reconnexion - sinon les actions offline d'un prof (check-in,
      // QR, pointage) sont perdues si sa session expire avant le retour réseau.
      if (!options?.keepOfflineQueue) {
        useOfflineStore.getState().clearQueue()
      }
      if (isBrowser) {
        window.localStorage.removeItem(AUTH_SNAPSHOT_KEY)
      }
      return { user: null, tenant: null, permissions: [], accessToken: null, refreshToken: null }
    }),
}))
