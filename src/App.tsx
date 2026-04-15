import { useEffect } from "react"
import { Navigate, Route, Routes, useSearchParams } from "react-router-dom"

import AdminPage from "@/modules/admin/AdminPage"
import AttendancePage from "@/modules/attendance/AttendancePage"
import DashboardPage from "@/modules/dashboard/DashboardPage"
import TeacherDashboardPage from "@/modules/dashboard/TeacherDashboardPage"
import ImportPage from "@/modules/import-export/ImportPage"
import OnboardingWizard from "@/modules/onboarding/OnboardingWizard"
import SchedulePage from "@/modules/schedule/SchedulePage"
import StudentsPage from "@/modules/students/StudentsPage"
import TeacherDetailPage from "@/modules/teachers/TeacherDetailPage"
import TeachersPage from "@/modules/teachers/TeachersPage"
import { AppShell } from "@/shared/components/layout/AppShell"
import { useAutoSync } from "@/shared/hooks/useAutoSync"
import { useAuthStore } from "@/shared/store/auth.store"
import LoginPage from "./modules/auth/LoginPage"
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

  return <DashboardPage />
}

function RoleRedirect() {
  const user = useAuthStore((state) => state.user)

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (user.role === "teacher") {
    return <Navigate to="/attendance" replace />
  }

  if (user.role === "super_admin") {
    return <Navigate to="/admin" replace />
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

export default function App() {
  useAutoSync()

  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />
      <Route path="/dev" element={<ComponentsDemoPage />} />

      <Route element={<AppShell />}>
        <Route path="/" element={<RoleRedirect />} />
        <Route path="/dashboard" element={<DashboardRoute />} />
        <Route path="/attendance" element={<AttendancePage />} />
        <Route path="/onboarding" element={<OnboardingWizard />} />
        <Route path="/schedule" element={<SchedulePage />} />
        <Route path="/teachers" element={<TeachersPage />} />
        <Route path="/teachers/:teacherId" element={<TeacherDetailPage />} />
        <Route path="/students" element={<StudentsPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/import" element={<ImportPage />} />
        <Route path="/imports" element={<ImportPage />} />
        <Route path="/salaries" element={<PlaceholderPage title="Salaires" />} />
        <Route path="/settings" element={<PlaceholderPage title="Paramètres" />} />
      </Route>

      <Route path="*" element={<RoleRedirect />} />
    </Routes>
  )
}
