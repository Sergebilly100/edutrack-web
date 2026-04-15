import { useEffect, type ReactNode } from "react"
import { Navigate, Route, Routes, useLocation, useSearchParams } from "react-router-dom"
import AdminPage from "@/modules/admin/AdminPage"
import AttendancePage from "@/modules/attendance/AttendancePage"
import DashboardPage from "@/modules/dashboard/DashboardPage"
import TeacherDashboardPage from "@/modules/dashboard/TeacherDashboardPage"
import ImportPage from "@/modules/import-export/ImportPage"
import OnboardingWizard from "@/modules/onboarding/OnboardingWizard"
import SchedulePage from "@/modules/schedule/SchedulePage"
import StudentsPage from "@/modules/students/StudentsPage"
import TeachersPage from "@/modules/teachers/TeachersPage"
import { AppLayout } from "@/shared/components/AppLayout"
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

function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation()
  const user = useAuthStore((state) => state.user)
  const shouldUseLayout = Boolean(user) && location.pathname !== "/" && location.pathname !== "/dev"

  if (!shouldUseLayout) {
    return <>{children}</>
  }

  return <AppLayout>{children}</AppLayout>
}

export default function App() {
  useAutoSync()

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/attendance" element={<AttendancePage />} />
        <Route path="/onboarding" element={<OnboardingWizard />} />
        <Route path="/imports" element={<ImportPage />} />
        <Route path="/schedule" element={<SchedulePage />} />
        <Route path="/teachers" element={<TeachersPage />} />
        <Route path="/students" element={<StudentsPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/dashboard" element={<DashboardRoute />} />
        <Route path="/dev" element={<ComponentsDemoPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  )
}
