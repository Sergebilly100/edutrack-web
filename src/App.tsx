import { Suspense, lazy, useEffect, useState, type ReactElement } from "react"
import { Navigate, NavLink, Outlet, Route, Routes, useLocation, useSearchParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import axios from "axios"

import { getSmsFeatureSettings } from "@/modules/subscriptions/subscriptions.api"
import { FINANCE_PATHS, getFinancePathFromLegacyTab } from "@/modules/finance/finance.routes"
import { useEndOfYearReviewStatus } from "@/modules/class-decisions/useEndOfYearReviewStatus"
import { AppShell } from "@/shared/components/layout/AppShell"
import { TeacherTopBar } from "@/shared/components/layout/TeacherTopBar"
import { usePermissions } from "@/shared/hooks/usePermissions"
import { getNavItemsByRole } from "@/shared/components/layout/nav-items"
import { useAutoSync } from "@/shared/hooks/useAutoSync"
import { useRestoreSession } from "@/shared/hooks/useRestoreSession"
import { queryCacheRestorePromise } from "@/shared/api/query-client"
import { isStaffRole, useAuthStore, type PermissionKey } from "@/shared/store/auth.store"
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
const ParentReportCardsPage = lazy(() => import("@/modules/parent-portal/ParentReportCardsPage"))
const ParentSchedulePage = lazy(() => import("@/modules/parent-portal/ParentSchedulePage"))
const ParentAbsenceHistoryPage = lazy(() => import("@/modules/parent-portal/ParentAbsenceHistoryPage"))
const ParentAccountPage = lazy(() => import("@/modules/parent-portal/ParentAccountPage"))
const ParentPaymentsPage = lazy(() => import("@/modules/parent-portal/ParentPaymentsPage"))
const StudentDetailPage = lazy(() => import("@/modules/students/StudentDetailPage"))
const StudentsPage = lazy(() => import("@/modules/students/StudentsPage"))
const TeacherDetailPage = lazy(() => import("@/modules/teachers/TeacherDetailPage"))
const TeachersPage = lazy(() => import("@/modules/teachers/TeachersPage"))
const SchoolYearsPage = lazy(() => import("@/modules/academic/SchoolYearsPage"))
const LevelsPage = lazy(() => import("@/modules/academic/LevelsPage"))
const ClassesPage = lazy(() => import("@/modules/academic/ClassesPage"))
const SubjectsPage = lazy(() => import("@/modules/academic/SubjectsPage"))
const NotesPage = lazy(() => import("@/modules/academic/NotesPage"))
const CalculationPage = lazy(() => import("@/modules/academic/CalculationPage"))
const ConductPage = lazy(() => import("@/modules/academic/ConductPage"))
const ReportCardsPage = lazy(() => import("@/modules/academic/ReportCardsPage"))
const ClassDecisionsPage = lazy(() => import("@/modules/class-decisions/ClassDecisionsPage"))
const EnrollmentsPage = lazy(() => import("@/modules/enrollments/EnrollmentsPage"))
const NewEnrollmentPage = lazy(() => import("@/modules/enrollments/NewEnrollmentPage"))
const EnrollmentDocumentsPage = lazy(() => import("@/modules/enrollments/EnrollmentDocumentsPage"))
const EnrollmentPaymentPage = lazy(() => import("@/modules/enrollments/EnrollmentPaymentPage"))
const FinancePage = lazy(() => import("@/modules/finance/FinancePage"))
const ValidationsPage = lazy(() => import("@/modules/validations/ValidationsPage"))
const LoginPage = lazy(() => import("./modules/auth/LoginPage"))
const AdminLoginPage = lazy(() => import("./modules/auth/AdminLoginPage"))
const MaintenancePage = lazy(() => import("./modules/auth/MaintenancePage"))
const MarketingHomePage = lazy(() => import("@/modules/marketing/MarketingHomePage"))

const MAIN_DOMAIN_HOSTS = new Set([
  "ivoiredu.ci",
  "www.ivoiredu.ci",
  "dev.ivoiredu.novatrixsys.com",
])

const getPublicSiteHosts = (): Set<string> => {
  const configuredHosts = (import.meta.env.VITE_PUBLIC_SITE_HOSTS ?? "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean)

  return new Set([...MAIN_DOMAIN_HOSTS, ...configuredHosts])
}

const isMainPublicDomain = (): boolean => {

  if (import.meta.env.DEV) return true

  return getPublicSiteHosts().has(window.location.hostname.toLowerCase())

}

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
    return <Navigate to="/dashboard" replace />
  }

  // c'est un peu redondant avec la route /admin, mais ça garantit que même si un super_admin tape manuellement /dashboard ou /schedule
  //  il sera redirigé vers l'interface admin complète et pas vers une interface limitée par erreur
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

function HomeRoute() {
  if (isMainPublicDomain()) {
    return <MarketingHomePage />
  }

  return <LoginRoute />
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
  // Le shell porte le seul défilement de l’espace professeur. La hauteur
  // dynamique suit la zone réellement visible de Chrome Android (barres du
  // navigateur comprises) et évite un second scroll sur le document.
  const location = useLocation()
  const isAcademicWorkspace = location.pathname === "/academic/calculation" || location.pathname.includes("/academic/students/")

  return (
    <div className="flex h-dvh min-w-0 flex-col overflow-hidden bg-background">
      <TeacherTopBar />
      {!isAcademicWorkspace ? <TeacherNavigation variant="desktop" /> : null}
      <main className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
        <div className="mx-auto w-full min-w-0 max-w-lg px-4 py-4 lg:max-w-4xl lg:py-6">{element}</div>
      </main>
      {!isAcademicWorkspace ? <TeacherNavigation variant="mobile" /> : null}
    </div>
  )
}

function TeacherNavigation({ variant }: { variant: "desktop" | "mobile" }) {
  const user = useAuthStore((state) => state.user)
  const permissions = useAuthStore((state) => state.permissions)
  const items = getNavItemsByRole(user?.role, permissions)

  const mobileItems = items.filter((item) =>
    item.href === "/dashboard" || item.href === "/attendance" || item.href === "/academic/notes" || item.href === "/account",
  )

  if (variant === "desktop") {
    return (
      <nav aria-label="Navigation professeur" className="hidden shrink-0 border-b bg-[var(--surface-chrome)] md:block">
        <div className="flex min-h-12 gap-1 overflow-x-auto px-3 py-1">
          {items.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.href}
                to={item.href}
                className={({ isActive }) =>
                  `relative flex min-h-12 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-medium transition-colors ${
                    isActive ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground"
                  }`
                }
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            )
          })}
        </div>
      </nav>
    )
  }

  return (
    <nav aria-label="Navigation professeur mobile" className="z-40 w-full min-w-0 shrink-0 border-t bg-background/95 px-2 pb-[env(safe-area-inset-bottom)] pt-1 backdrop-blur md:hidden">
      <div className="mx-auto grid w-full min-w-0 max-w-lg grid-cols-4">
        {mobileItems.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.href}
              to={item.href}
              className={({ isActive }) =>
                `relative flex min-h-14 min-w-0 flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium transition-colors ${
                  isActive ? "text-primary after:absolute after:inset-x-5 after:top-0 after:h-0.5 after:rounded-full after:bg-primary" : "text-muted-foreground hover:text-foreground"
                }`
              }
            >
              <Icon className="h-4 w-4" />
              <span className="max-w-full truncate">{item.label}</span>
            </NavLink>
          )
        })}
      </div>
    </nav>
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

function DashboardEntryRoute() {
  const user = useAuthStore((state) => state.user)

  if (!user) return <Navigate to="/login" replace />
  if (user.mustChangePassword) return <Navigate to="/account/first-login-password" replace />
  if (user.role === "super_admin") return <Navigate to="/admin" replace />
  if (user.role === "teacher") return <TeacherShell element={<DashboardRoute />} />

  return <AppShell><DashboardRoute /></AppShell>
}

function OnboardingRoute() {
  const user = useAuthStore((state) => state.user)

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (user.role === "teacher") {
    return <Navigate to="/dashboard" replace />
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

export function TeacherAcademicShellRoute() {
  const user = useAuthStore((state) => state.user)

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (user.mustChangePassword) {
    return <Navigate to="/account/first-login-password" replace />
  }

  if (user.role === "teacher") {
    return <TeacherShell element={<Outlet />} />
  }

  return <AppShell />
}

function AccountRoute() {
  const user = useAuthStore((state) => state.user)

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (user.mustChangePassword) {
    return <Navigate to="/account/first-login-password" replace />
  }

  if (user.role === "teacher") {
    return <TeacherShell element={<AccountPage />} />
  }

  if (user.role === "super_admin") {
    return <Navigate to="/admin/account" replace />
  }

  return <AppShell><AccountPage /></AppShell>
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

function PermissionRoute({
  href,
  element,
  requiredAnyPermissions,
}: {
  href: string
  element: ReactElement
  requiredAnyPermissions?: PermissionKey[]
}) {
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
  const canAccess = allowed.some((item) => item.href.split("?")[0] === href)
  const hasRequiredPermission =
    !isStaffRole(user.role) ||
    !requiredAnyPermissions ||
    requiredAnyPermissions.some((permission) => permissions.includes(permission))
  if (canAccess && hasRequiredPermission) {
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

  const fallback = user.role === "teacher" ? "/dashboard" : allowed[0]?.href ?? "/dashboard"
  return <Navigate to={fallback} replace />
}

function AcademicIndexRoute() {
  const user = useAuthStore((state) => state.user)
  const permissions = useAuthStore((state) => state.permissions)

  if (user?.role === "director" || permissions.includes("school_years.view")) {
    return <Navigate to="/academic/school-years" replace />
  }
  return <Navigate to="/academic/classes" replace />
}

function FinanceLegacyRoute() {
  const [searchParams] = useSearchParams()
  return <Navigate to={getFinancePathFromLegacyTab(searchParams.get("tab"))} replace />
}

function EndOfYearAccessRoute() {
  const statusQuery = useEndOfYearReviewStatus()

  if (statusQuery.isLoading) {
    return <SessionLoader />
  }
  if (statusQuery.data?.visible !== true) {
    return <Navigate to="/dashboard" replace />
  }
  return <ClassDecisionsPage />
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
        <Route path="/" element={<HomeRoute />} />
        <Route path="/site" element={<MarketingHomePage />} />
        <Route path="/login" element={<LoginRoute />} />
        <Route path="/admin/login" element={<AdminLoginRoute />} />
        <Route path="/parent/login" element={<ParentLoginRoute />} />
        <Route path="/maintenance" element={<MaintenancePage />} />
        <Route path="/attendance" element={<AttendanceRoute />} />
        <Route path="/onboarding" element={<OnboardingRoute />} />
        <Route path="/account/first-login-password" element={<FirstLoginPasswordRoute />} />

        <Route path="/dashboard" element={<DashboardEntryRoute />} />

        <Route element={<NonTeacherShellRoute />}>
          <Route path="/schedule" element={<PermissionRoute href="/schedule" element={<SchedulePage />} />} />
          <Route path="/teachers" element={<PermissionRoute href="/teachers" element={<TeachersPage />} />} />
          <Route path="/teachers/:teacherId" element={<PermissionRoute href="/teachers" element={<TeacherDetailPage />} />} />
          <Route path="/students" element={<PermissionRoute href="/students" element={<StudentsPage />} />} />
          <Route path="/students/:studentId" element={<PermissionRoute href="/students" element={<StudentDetailPage />} />} />
          <Route path="/academic" element={<PermissionRoute href="/academic" element={<AcademicIndexRoute />} />} />
          <Route path="/academic/school-years" element={<PermissionRoute href="/academic" requiredAnyPermissions={["school_years.view"]} element={<SchoolYearsPage />} />} />
          <Route path="/academic/levels" element={<PermissionRoute href="/academic" requiredAnyPermissions={["classes.view"]} element={<LevelsPage />} />} />
          <Route path="/academic/classes" element={<PermissionRoute href="/academic" requiredAnyPermissions={["classes.view"]} element={<ClassesPage />} />} />
          <Route path="/academic/subjects" element={<PermissionRoute href="/academic" requiredAnyPermissions={["classes.view"]} element={<SubjectsPage />} />} />
          <Route path="/academic/completion" element={<PermissionRoute href="/academic/report-cards" requiredAnyPermissions={["report_cards.view"]} element={<Navigate replace to="/academic/report-cards" />} />} />
          <Route path="/academic/report-cards" element={<PermissionRoute href="/academic/report-cards" requiredAnyPermissions={["report_cards.view", "report_cards.publish"]} element={<ReportCardsPage />} />} />
          <Route path="/end-of-year" element={<PermissionRoute href="/end-of-year" requiredAnyPermissions={["class_decisions.view"]} element={<EndOfYearAccessRoute />} />} />
          <Route path="/enrollments" element={<PermissionRoute href="/enrollments" requiredAnyPermissions={["enrollments.view"]} element={<EnrollmentsPage />} />} />
          <Route path="/enrollments/new" element={<PermissionRoute href="/enrollments" requiredAnyPermissions={["enrollments.create"]} element={<NewEnrollmentPage />} />} />
          <Route path="/enrollments/:enrollmentId/edit" element={<PermissionRoute href="/enrollments" requiredAnyPermissions={["enrollments.edit", "students.edit"]} element={<NewEnrollmentPage />} />} />
          <Route path="/enrollments/students/:studentId/documents" element={<PermissionRoute href="/enrollments" requiredAnyPermissions={["enrollments.view", "enrollments.edit"]} element={<EnrollmentDocumentsPage />} />} />
          <Route path="/enrollments/:enrollmentId/payment" element={<PermissionRoute href="/enrollments" requiredAnyPermissions={["enrollments.confirm_payment"]} element={<EnrollmentPaymentPage />} />} />
          <Route path="/finance" element={<FinanceLegacyRoute />} />
          <Route path={FINANCE_PATHS.dashboard} element={<PermissionRoute href={FINANCE_PATHS.dashboard} requiredAnyPermissions={["payments.view"]} element={<FinancePage view="dashboard" />} />} />
          <Route path={FINANCE_PATHS.entry} element={<PermissionRoute href={FINANCE_PATHS.entry} requiredAnyPermissions={["payments.record"]} element={<FinancePage view="entry" />} />} />
          <Route path={FINANCE_PATHS.history} element={<PermissionRoute href={FINANCE_PATHS.history} requiredAnyPermissions={["payments.view"]} element={<FinancePage view="history" />} />} />
          <Route path={FINANCE_PATHS.journal} element={<PermissionRoute href={FINANCE_PATHS.journal} requiredAnyPermissions={["payments.view"]} element={<FinancePage view="journal" />} />} />
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
        </Route>

        <Route element={<TeacherAcademicShellRoute />}>
          <Route path="/academic/notes" element={<NotesPage />} />
          <Route path="/academic/calculation" element={<CalculationPage />} />
          <Route path="/academic/conduct" element={<Navigate to="/academic/notes" replace />} />
          <Route path="/academic/conduct/decision" element={<ConductPage view="decision" />} />
        </Route>

        <Route path="/account" element={<AccountRoute />} />

        <Route path="/parent" element={<ParentPortalLayout />}>
          <Route path="first-login-password" element={<ParentFirstLoginPasswordPage />} />
          <Route path="dashboard" element={<ParentDashboardPage />} />
          <Route path="absences" element={<ParentAbsenceHistoryPage />} />
          <Route path="schedule" element={<ParentSchedulePage />} />
          <Route path="payments" element={<ParentPaymentsPage />} />
          <Route path="report-cards" element={<ParentReportCardsPage />} />
          <Route path="account" element={<ParentAccountPage />} />
        </Route>

        <Route path="*" element={<RoleRedirect />} />
      </Routes>
    </Suspense>
  )
}
