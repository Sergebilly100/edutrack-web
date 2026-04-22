import { useEffect, type ReactElement } from "react"
import { Navigate, Route, Routes, useSearchParams } from "react-router-dom"

import AdminPage from "@/modules/admin/AdminPage"
import AdminAccountPage from "@/modules/admin/AdminAccountPage"
import AdminMaintenancePage from "@/modules/admin/AdminMaintenancePage"
import AdminRevenuePage from "@/modules/admin/AdminRevenuePage"
import AdminSchoolDetailPage from "@/modules/admin/AdminSchoolDetailPage"
import AdminSmsPage from "@/modules/admin/AdminSmsPage"
import AccountPage from "@/modules/account/AccountPage"
import AttendancePage from "@/modules/attendance/AttendancePage"
import AdministrativeDashboardPage from "@/modules/dashboard/AdministrativeDashboardPage"
import DashboardPage from "@/modules/dashboard/DashboardPage"
import TeacherDashboardPage from "@/modules/dashboard/TeacherDashboardPage"
import ImportPage from "@/modules/import-export/ImportPage"
import OnboardingWizard from "@/modules/onboarding/OnboardingWizard"
import RoomsPage from "@/modules/rooms/RoomsPage"
import SalariesPage from "@/modules/salaries/SalariesPage"
import SchedulePage from "@/modules/schedule/SchedulePage"
import SettingsPage from "@/modules/settings/SettingsPage"
import StudentDetailPage from "@/modules/students/StudentDetailPage"
import StudentsPage from "@/modules/students/StudentsPage"
import TeacherDetailPage from "@/modules/teachers/TeacherDetailPage"
import TeachersPage from "@/modules/teachers/TeachersPage"
import { AppShell } from "@/shared/components/layout/AppShell"
import { getNavItemsByRole } from "@/shared/components/layout/nav-items"
import { useAutoSync } from "@/shared/hooks/useAutoSync"
import { useRestoreSession } from "@/shared/hooks/useRestoreSession"
import { useAuthStore } from "@/shared/store/auth.store"
import LoginPage from "./modules/auth/LoginPage"
import MaintenancePage from "./modules/auth/MaintenancePage"
import ComponentsDemoPage from "./modules/dev/ComponentsDemoPage"

function DashboardRoute() {
  const [searchParams] = useSearchParams()
  const user = useAuthStore((state) => state.user)
  const setAccessToken = useAuthStore((state) => state.setAccessToken)

  useEffect(() => {
    const impersonationToken = searchParams.get("impersonation_token")
    if (!impersonationToken) {
      return
    }

    setAccessToken(impersonationToken)
  }, [searchParams, setAccessToken])

  if (user?.role === "teacher") {
    return <TeacherDashboardPage />
  }
  if (user?.role === "secretary") {
    return <AdministrativeDashboardPage />
  }

  return <DashboardPage />
}

function RoleRedirect() {
  const user = useAuthStore((state) => state.user)
  const permissions = useAuthStore((state) => state.permissions)

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (user.role === "teacher") {
    return <Navigate to="/attendance" replace />
  }

  if (user.role === "super_admin") {
    return <Navigate to="/admin" replace />
  }

  if (user.role === "secretary") {
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

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (user.role === "super_admin") {
    return element
  }

  const allowed = getNavItemsByRole(user.role, permissions)
  const canAccess = allowed.some((item) => item.href === href)
  if (canAccess) {
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

  // Bloquer tout rendu de route tant que la restauration de session n'est pas
  // terminée. Sans ce gate, RoleRedirect voit user=null et redirige vers /login
  // avant même que le cookie refresh ait été tenté.
  if (!isSessionRestored) {
    return <SessionLoader />
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />
      <Route path="/maintenance" element={<MaintenancePage />} />
      <Route path="/dev" element={<ComponentsDemoPage />} />

      <Route element={<AppShell />}>
        <Route path="/" element={<RoleRedirect />} />
        <Route path="/dashboard" element={<PermissionRoute href="/dashboard" element={<DashboardRoute />} />} />
        <Route path="/attendance" element={<AttendancePage />} />
        <Route path="/onboarding" element={<OnboardingWizard />} />
        <Route path="/schedule" element={<PermissionRoute href="/schedule" element={<SchedulePage />} />} />
        <Route path="/teachers" element={<PermissionRoute href="/teachers" element={<TeachersPage />} />} />
        <Route path="/teachers/:teacherId" element={<PermissionRoute href="/teachers" element={<TeacherDetailPage />} />} />
        <Route path="/students" element={<PermissionRoute href="/students" element={<StudentsPage />} />} />
        <Route path="/students/:studentId" element={<PermissionRoute href="/students" element={<StudentDetailPage />} />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/admin/schools" element={<AdminPage />} />
        <Route path="/admin/schools/:tenantId" element={<AdminSchoolDetailPage />} />
        <Route path="/admin/revenue" element={<AdminRevenuePage />} />
        <Route path="/admin/sms" element={<AdminSmsPage />} />
        <Route path="/admin/maintenance" element={<AdminMaintenancePage />} />
        <Route path="/admin/account" element={<AdminAccountPage />} />
        <Route path="/import" element={<ImportPage />} />
        <Route path="/imports" element={<ImportPage />} />
        <Route path="/rooms" element={<PermissionRoute href="/rooms" element={<RoomsPage />} />} />
        <Route path="/salaries" element={<SalariesPage />} />
        <Route path="/settings" element={<PermissionRoute href="/settings" element={<SettingsPage />} />} />
        <Route path="/account" element={<AccountPage />} />
      </Route>

      <Route path="*" element={<RoleRedirect />} />
    </Routes>
  )
}
