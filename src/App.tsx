import { Suspense, lazy, useEffect, useState, type ReactElement } from "react"
import { Navigate, Route, Routes, useSearchParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import axios from "axios"

import { getSmsFeatureSettings } from "@/modules/subscriptions/subscriptions.api"
import { AppShell } from "@/shared/components/layout/AppShell"
import { TeacherTopBar } from "@/shared/components/layout/TeacherTopBar"
import { usePermissions } from "@/shared/hooks/usePermissions"
import { getNavItemsByRole } from "@/shared/components/layout/nav-items"
import { useAutoSync } from "@/shared/hooks/useAutoSync"
import { useRestoreSession } from "@/shared/hooks/useRestoreSession"
import { queryCacheRestorePromise } from "@/shared/api/query-client"
import { isStaffRole, useAuthStore } from "@/shared/store/auth.store"
import { useParentAuthStore } from "@/modules/parent-portal/parent-auth.store"

const AdminPage = lazy(() => import("@/modules/admin/AdminPage"))
const AdminAccountPage = lazy(() => import("@/modules/admin/AdminAccountPage"))
const AdminMaintenancePage = lazy(() => import("@/modules/admin/AdminMaintenancePage"))
const AdminPlansPage = lazy(() => import("@/modules/admin/AdminPlansPage"))
const AdminRevenuePage = lazy(() => import("@/modules/admin/AdminRevenuePage"))
const AdminSchoolDetailPage = lazy(() => import("@/modules/admin/AdminSchoolDetailPage"))
const AdminRevenuSmsPage = lazy(() => import("@/modules/admin/AdminRevenuSmsPage"))
const AdminSmsPage = lazy(() => import("@/modules/admin/AdminSmsPage"))
const AccountPage = lazy(() => import("@/modules/account/AccountPage"))
const FirstLoginPasswordPage = lazy(() => import("@/modules/account/FirstLoginPasswordPage"))
const AttendancePage = lazy(() => import("@/modules/attendance/AttendancePage"))
const DashboardPage = lazy(() => import("@/modules/dashboard/DashboardPage"))
const TeacherDashboardPage = lazy(() => import("@/modules/dashboard/TeacherDashboardPage"))
const ImportPage = lazy(() => import("@/modules/import-export/ImportPage"))
const OnboardingWizard = lazy(() => import("@/modules/onboarding/OnboardingWizard"))
const RoomsPage = lazy(() => import("@/modules/rooms/RoomsPage"))
const SalariesPage = lazy(() => import("@/modules/salaries/SalariesPage"))
const SchedulePage = lazy(() => import("@/modules/schedule/SchedulePage"))
const SettingsPage = lazy(() => import("@/modules/settings/SettingsPage"))
const SubscriptionsPage = lazy(() => import("@/modules/subscriptions/SubscriptionsPage"))
const SubscriptionRevenuePage = lazy(() => import("@/modules/subscriptions/SubscriptionRevenuePage"))
const ParentLoginPage = lazy(() => import("@/modules/parent-portal/ParentLoginPage"))
const ParentPortalLayout = lazy(() => import("@/modules/parent-portal/ParentPortalLayout"))
const ParentFirstLoginPasswordPage = lazy(() => import("@/modules/parent-portal/ParentFirstLoginPasswordPage"))
const ParentDashboardPage = lazy(() => import("@/modules/parent-portal/ParentDashboardPage"))
const ParentSchedulePage = lazy(() => import("@/modules/parent-portal/ParentSchedulePage"))
const ParentAbsenceHistoryPage = lazy(() => import("@/modules/parent-portal/ParentAbsenceHistoryPage"))
const ParentAccountPage = lazy(() => import("@/modules/parent-portal/ParentAccountPage"))
const StudentDetailPage = lazy(() => import("@/modules/students/StudentDetailPage"))
const StudentsPage = lazy(() => import("@/modules/students/StudentsPage"))
const TeacherDetailPage = lazy(() => import("@/modules/teachers/TeacherDetailPage"))
const TeachersPage = lazy(() => import("@/modules/teachers/TeachersPage"))
const ValidationsPage = lazy(() => import("@/modules/validations/ValidationsPage"))
const LoginPage = lazy(() => import("./modules/auth/LoginPage"))
const AdminLoginPage = lazy(() => import("./modules/auth/AdminLoginPage"))
const MaintenancePage = lazy(() => import("./modules/auth/MaintenancePage"))

function DashboardRoute() {
  const [searchParams] = useSearchParams()
  const user = useAuthStore((state) => state.user)
  const setAccessToken = useAuthStore((state) => state.setAccessToken)
  const setUser = useAuthStore((state) => state.setUser)
  const setTenant = useAuthStore((state) => state.setTenant)
  const setPermissions = useAuthStore((state) => state.setPermissions)
  const { refreshPermissions } = usePermissions()

  useEffect(() => {
    const impersonationToken = searchParams.get("impersonation_token")
    if (!impersonationToken) {
      return
    }
    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete("impersonation_token")
    const nextQuery = nextParams.toString()
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash}`
    window.history.replaceState(window.history.state, "", nextUrl)

    const applyImpersonationSession = async (): Promise<void> => {
      try {
        setAccessToken(impersonationToken)

        const meResponse = await axios.get<{
          user: {
            id: string
            role: "director" | "staff" | "teacher" | "super_admin"
            name: string
            phone: string | null
            email: string | null
            profilePhotoUrl: string | null
            mustChangePassword?: boolean
            positionNames?: string[]
            primaryPosition?: string | null
          }
          tenant?: {
            id: string
            status: "trial" | "active" | "past_due" | "canceled" | "suspended"
            trialEndsAt: string | null
          } | null
        }>("/auth/me", {
          baseURL: import.meta.env.VITE_API_URL,
          withCredentials: true,
          headers: {
            Authorization: `Bearer ${impersonationToken}`,
          },
        })

        const tokenPayload = (() => {
          try {
            const parts = impersonationToken.split(".")
            const raw = parts[1] ?? ""
            const normalized = raw.replace(/-/g, "+").replace(/_/g, "/")
            return JSON.parse(atob(normalized)) as { schemaName?: string }
          } catch {
            return {}
          }
        })()
        const schemaName = tokenPayload.schemaName ?? "unknown"

        setUser({
          id: meResponse.data.user.id,
          role: meResponse.data.user.role,
          name: meResponse.data.user.name,
          phone: meResponse.data.user.phone,
          email: meResponse.data.user.email,
          profilePhotoUrl: meResponse.data.user.profilePhotoUrl,
          mustChangePassword: Boolean(meResponse.data.user.mustChangePassword),
          positionNames: Array.isArray(meResponse.data.user.positionNames)
            ? meResponse.data.user.positionNames
            : [],
          primaryPosition: meResponse.data.user.primaryPosition ?? null,
          tenantId: schemaName,
          schemaName,
          plan: "standard",
        })
        setTenant(meResponse.data.tenant ?? null)
        await refreshPermissions()
      } catch {
        setPermissions([])
      }
    }

    void applyImpersonationSession()
  }, [searchParams, setAccessToken, setPermissions, setUser])

  if (user?.role === "teacher") {
    return <TeacherDashboardPage />
  }

  // Directeur et staff partagent le même tableau de bord riche : DashboardPage
  // masque/affiche chaque carte et section selon les permissions du staff
  // (le directeur voit tout). Voir les capacités canView* dans DashboardPage.
  return <DashboardPage />
}

function RoleRedirect() {
  const user = useAuthStore((state) => state.user)
  const permissions = useAuthStore((state) => state.permissions)

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (user.mustChangePassword) {
    return <Navigate to="/account/first-login-password" replace />
  }

  if (user.role === "teacher") {
    return <Navigate to="/attendance" replace />
  }

  if (user.role === "super_admin") {
    return <Navigate to="/admin" replace />
  }

  if (isStaffRole(user.role)) {
    const firstAllowed = getNavItemsByRole(user.role, permissions)[0]?.href
    return <Navigate to={firstAllowed ?? "/dashboard"} replace />
  }

  return <Navigate to="/dashboard" replace />
}

function LoginRoute() {
  const user = useAuthStore((state) => state.user)

  if (user) {
    return <RoleRedirect />
  }

  return <LoginPage />
}

function AdminLoginRoute() {
  const user = useAuthStore((state) => state.user)
  if (user?.role === "super_admin") {
    return <Navigate to="/admin" replace />
  }
  return <AdminLoginPage />
}

function ParentLoginRoute() {
  const parentUser = useParentAuthStore((state) => state.user)
  if (parentUser) {
    return <Navigate to={parentUser.mustChangePassword ? "/parent/first-login-password" : "/parent/dashboard"} replace />
  }
  return <ParentLoginPage />
}

function TeacherShell({ element }: { element: ReactElement }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TeacherTopBar />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-lg px-4 py-4 lg:max-w-4xl lg:py-6">{element}</div>
      </main>
    </div>
  )
}

function AttendanceRoute() {
  const user = useAuthStore((state) => state.user)

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (user.mustChangePassword) {
    return <Navigate to="/account/first-login-password" replace />
  }

  if (user.role === "teacher") {
    return <TeacherShell element={<AttendancePage />} />
  }

  return <AppShell><AttendancePage /></AppShell>
}

function OnboardingRoute() {
  const user = useAuthStore((state) => state.user)

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (user.role === "teacher") {
    return <Navigate to="/attendance" replace />
  }

  return <OnboardingWizard />
}

function NonTeacherShellRoute() {
  const user = useAuthStore((state) => state.user)

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (user.mustChangePassword) {
    return <Navigate to="/account/first-login-password" replace />
  }

  if (user.role === "teacher") {
    return <Navigate to="/attendance" replace />
  }

  return <AppShell />
}

function FirstLoginPasswordRoute() {
  const user = useAuthStore((state) => state.user)

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (!user.mustChangePassword) {
    return <RoleRedirect />
  }

  return <FirstLoginPasswordPage />
}

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="rounded-lg border bg-card p-6">
      <h1 className="text-lg font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Cette section sera branchée dans une tâche dédiée.</p>
    </div>
  )
}

function PermissionRoute({ href, element }: { href: string; element: ReactElement }) {
  const user = useAuthStore((state) => state.user)
  const permissions = useAuthStore((state) => state.permissions)
  const isSubscriptionRoute = href === "/subscriptions" || href === "/subscriptions/revenue"
  const shouldCheckSubscriptionsFeature =
    isSubscriptionRoute && (user?.role === "director" || isStaffRole(user?.role))
  const subscriptionFeatureQuery = useQuery({
    queryKey: ["subscriptions", "feature-settings", "route-guard"],
    queryFn: getSmsFeatureSettings,
    staleTime: 60_000,
    enabled: shouldCheckSubscriptionsFeature,
  })

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (user.role === "super_admin") {
    return element
  }

  const allowed = getNavItemsByRole(user.role, permissions)
  const canAccess = allowed.some((item) => item.href === href)
  if (canAccess) {
    if (shouldCheckSubscriptionsFeature) {
      if (subscriptionFeatureQuery.isLoading) {
        return <SessionLoader />
      }
      if (
        subscriptionFeatureQuery.isSuccess &&
        subscriptionFeatureQuery.data?.monetize_parent_alerts !== true
      ) {
        const fallback = allowed.find((item) => item.href !== "/subscriptions" && item.href !== "/subscriptions/revenue")?.href
        return <Navigate to={fallback ?? "/dashboard"} replace />
      }
    }
    return element
  }

  const fallback = user.role === "teacher" ? "/attendance" : allowed[0]?.href ?? "/dashboard"
  return <Navigate to={fallback} replace />
}

/**
 * Écran de chargement affiché le temps que useRestoreSession tente de
 * récupérer une session existante. Évite le flash de redirect vers /login
 * sur les utilisateurs déjà connectés.
 */
function SessionLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
        <p className="text-sm text-muted-foreground">Chargement…</p>
      </div>
    </div>
  )
}

export default function App() {
  useAutoSync()
  useRestoreSession()

  const isSessionRestored = useAuthStore((state) => state.isSessionRestored)
  const [isQueryCacheReady, setQueryCacheReady] = useState(false)

  // Bloquer le rendu tant que le cache TanStack hydraté depuis IndexedDB
  // n'a pas fini d'écrire les setQueryData. Sans ce gate, les useQuery
  // démarrent avant l'hydratation → pages vides en offline alors que
  // les données sont disponibles dans IndexedDB.
  useEffect(() => {
    let cancelled = false
    void queryCacheRestorePromise.finally(() => {
      if (!cancelled) {
        setQueryCacheReady(true)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Bloquer tout rendu de route tant que la restauration de session n'est pas
  // terminée. Sans ce gate, RoleRedirect voit user=null et redirige vers /login
  // avant même que le cookie refresh ait été tenté.
  if (!isSessionRestored || !isQueryCacheReady) {
    return <SessionLoader />
  }

  return (
    <Suspense fallback={<SessionLoader />}>
      <Routes>
        <Route path="/" element={<LoginRoute />} />
        <Route path="/login" element={<LoginRoute />} />
        <Route path="/admin/login" element={<AdminLoginRoute />} />
        <Route path="/parent/login" element={<ParentLoginRoute />} />
        <Route path="/maintenance" element={<MaintenancePage />} />
        <Route path="/attendance" element={<AttendanceRoute />} />
        <Route path="/onboarding" element={<OnboardingRoute />} />
        <Route path="/account/first-login-password" element={<FirstLoginPasswordRoute />} />

        <Route element={<NonTeacherShellRoute />}>
          <Route path="/dashboard" element={<PermissionRoute href="/dashboard" element={<DashboardRoute />} />} />
          <Route path="/schedule" element={<PermissionRoute href="/schedule" element={<SchedulePage />} />} />
          <Route path="/teachers" element={<PermissionRoute href="/teachers" element={<TeachersPage />} />} />
          <Route path="/teachers/:teacherId" element={<PermissionRoute href="/teachers" element={<TeacherDetailPage />} />} />
          <Route path="/students" element={<PermissionRoute href="/students" element={<StudentsPage />} />} />
          <Route path="/students/:studentId" element={<PermissionRoute href="/students" element={<StudentDetailPage />} />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/admin/schools" element={<AdminPage />} />
          <Route path="/admin/schools/:tenantId" element={<AdminSchoolDetailPage />} />
          <Route path="/admin/revenue" element={<AdminRevenuePage />} />
          <Route path="/admin/plans" element={<AdminPlansPage />} />
          <Route path="/admin/sms" element={<AdminSmsPage />} />
          <Route path="/admin/revenuSms" element={<AdminRevenuSmsPage />} />
          <Route path="/admin/maintenance" element={<AdminMaintenancePage />} />
          <Route path="/admin/account" element={<AdminAccountPage />} />
          <Route path="/import" element={<PermissionRoute href="/import" element={<ImportPage />} />} />
          <Route path="/imports" element={<PermissionRoute href="/import" element={<ImportPage />} />} />
          <Route path="/rooms" element={<PermissionRoute href="/rooms" element={<RoomsPage />} />} />
          <Route path="/salaries" element={<PermissionRoute href="/salaries" element={<SalariesPage />} />} />
          <Route path="/validations" element={<PermissionRoute href="/validations" element={<ValidationsPage />} />} />
          <Route path="/subscriptions" element={<PermissionRoute href="/subscriptions" element={<SubscriptionsPage />} />} />
          <Route path="/subscriptions/revenue" element={<PermissionRoute href="/subscriptions/revenue" element={<SubscriptionRevenuePage />} />} />
          <Route path="/settings" element={<PermissionRoute href="/settings" element={<SettingsPage />} />} />
          <Route path="/account" element={<AccountPage />} />
        </Route>

        <Route path="/parent" element={<ParentPortalLayout />}>
          <Route path="first-login-password" element={<ParentFirstLoginPasswordPage />} />
          <Route path="dashboard" element={<ParentDashboardPage />} />
          <Route path="absences" element={<ParentAbsenceHistoryPage />} />
          <Route path="schedule" element={<ParentSchedulePage />} />
          <Route path="account" element={<ParentAccountPage />} />
        </Route>

        <Route path="*" element={<RoleRedirect />} />
      </Routes>
    </Suspense>
  )
}
