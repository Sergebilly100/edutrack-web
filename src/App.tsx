import { useEffect, type ReactNode } from "react"
import { useQuery } from "@tanstack/react-query"
import { BrowserRouter, NavLink, Navigate, Route, Routes, useLocation, useSearchParams } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import { Toaster } from "@/components/ui/toaster"
import AdminPage from "@/modules/admin/AdminPage"
import { getTenants } from "@/modules/admin/admin.api"
import AttendancePage from "@/modules/attendance/AttendancePage"
import DashboardPage from "@/modules/dashboard/DashboardPage"
import TeacherDashboardPage from "@/modules/dashboard/TeacherDashboardPage"
import ImportPage from "@/modules/import-export/ImportPage"
import OnboardingWizard from "@/modules/onboarding/OnboardingWizard"
import SchedulePage from "@/modules/schedule/SchedulePage"
import StudentsPage from "@/modules/students/StudentsPage"
import TeachersPage from "@/modules/teachers/TeachersPage"
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
  const showHeader = Boolean(user) && location.pathname !== "/"

  const summaryQuery = useQuery({
    queryKey: ["admin", "menu-summary"],
    queryFn: () => getTenants({ page: 1, limit: 1 }),
    enabled: user?.role === "super_admin",
    staleTime: 30_000,
  })

  const churnCount = summaryQuery.data?.summary.churnRiskTenants ?? 0

  return (
    <>
      {showHeader ? (
        <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
            <div className="flex items-center gap-4">
              <NavLink to="/dashboard" className="text-sm font-medium text-muted-foreground hover:text-foreground">
                Dashboard
              </NavLink>
              {user?.role !== "teacher" ? (
                <>
                  <NavLink to="/teachers" className="text-sm font-medium text-muted-foreground hover:text-foreground">
                    Profs
                  </NavLink>
                  <NavLink to="/students" className="text-sm font-medium text-muted-foreground hover:text-foreground">
                    Élèves
                  </NavLink>
                </>
              ) : null}
              {user?.role === "teacher" ? (
                <NavLink to="/attendance" className="text-sm font-medium text-muted-foreground hover:text-foreground">
                  Pointage
                </NavLink>
              ) : null}
              {user?.role === "super_admin" ? (
                <NavLink to="/admin" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
                  <span>Admin</span>
                  {churnCount > 0 ? <Badge className="animate-pulse bg-red-600 text-white">{churnCount}</Badge> : null}
                </NavLink>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">{user?.name}</p>
          </div>
        </header>
      ) : null}
      {children}
    </>
  )
}

export default function App() {
  useAutoSync()

  return (
    <BrowserRouter>
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
      <Toaster />
    </BrowserRouter>
  )
}
