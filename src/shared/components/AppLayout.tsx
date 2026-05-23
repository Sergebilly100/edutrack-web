import { useEffect, useMemo, useState, type ReactNode } from "react"
import { BookOpen, CalendarDays, GraduationCap, LayoutDashboard, Menu, Shield, UserCheck, X } from "lucide-react"
import { NavLink, useLocation } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ThemeToggle } from "@/shared/components/ThemeToggle"
import { useStudentLabels, type StudentLabels } from "@/shared/hooks/useStudentLabel"
import { type AuthRole, useAuthStore } from "@/shared/store/auth.store"

type LayoutItem = {
  to: string
  label: string
  icon: typeof LayoutDashboard
  roles?: AuthRole[]
}

const buildLayoutItems = (labels: StudentLabels): LayoutItem[] => [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/attendance", label: "Pointage", icon: CalendarDays, roles: ["teacher"] },
  { to: "/teachers", label: "Profs", icon: UserCheck, roles: ["director", "staff", "super_admin"] },
  { to: "/students", label: labels.plural, icon: GraduationCap, roles: ["director", "staff", "super_admin"] },
  { to: "/schedule", label: "EDT", icon: CalendarDays, roles: ["director", "staff", "super_admin"] },
  { to: "/imports", label: "Imports", icon: BookOpen, roles: ["director", "staff", "super_admin"] },
  { to: "/admin", label: "Admin", icon: Shield, roles: ["super_admin"] },
]

const buildRouteLabels = (labels: StudentLabels): Record<string, string> => ({
  "/dashboard": "Dashboard",
  "/teachers": "Profs",
  "/students": labels.plural,
  "/schedule": "Emploi du temps",
  "/imports": "Imports",
  "/attendance": "Pointage",
  "/admin": "Admin",
  "/onboarding": "Onboarding",
})

const navItemClassName =
  "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition hover:bg-muted"

type AppLayoutProps = {
  children: ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation()
  const user = useAuthStore((state) => state.user)
  const studentLabels = useStudentLabels()
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  const layoutItems = useMemo(() => buildLayoutItems(studentLabels), [studentLabels])
  const routeLabels = useMemo(() => buildRouteLabels(studentLabels), [studentLabels])

  const availableItems = useMemo(() => {
    if (!user) {
      return []
    }

    return layoutItems.filter((item) => {
      if (!item.roles) {
        return true
      }

      return item.roles.includes(user.role)
    })
  }, [user, layoutItems])

  const activeLabel = routeLabels[location.pathname] ?? "EduTrack"

  useEffect(() => {
    setMobileSidebarOpen(false)
  }, [location.pathname])

  return (
    <div className="min-h-screen bg-background">
      <div
        className={cn(
          "fixed inset-0 z-40 bg-slate-950/45 transition-opacity md:hidden",
          mobileSidebarOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={() => setMobileSidebarOpen(false)}
      />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r bg-card px-4 py-5 transition-transform md:translate-x-0",
          mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between">
          <NavLink to="/dashboard" className="text-base font-semibold tracking-tight">
            EduTrack CI
          </NavLink>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileSidebarOpen(false)}
            aria-label="Fermer le menu"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <nav className="mt-6 space-y-1">
          {availableItems.map((item) => {
            const Icon = item.icon

            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(navItemClassName, isActive ? "bg-primary/10 text-primary" : "text-muted-foreground")
                }
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </NavLink>
            )
          })}
        </nav>

        <div className="mt-auto rounded-lg border p-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium">{user?.name ?? "Utilisateur"}</p>
              <p className="text-xs capitalize text-muted-foreground">
                {user?.role === "staff"
                  ? "staff"
                  : user?.role?.replace("_", " ") ?? "Rôle"}
              </p>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </aside>

      <div className="pb-16 md:pb-0 md:pl-64">
        <header className="border-b bg-background px-4 py-3 md:hidden">
          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="Ouvrir le menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <p className="text-sm font-semibold">{activeLabel}</p>
            <ThemeToggle />
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6 md:py-8">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 px-2 py-2 backdrop-blur md:hidden">
        <ul className="grid grid-cols-4 gap-1">
          {availableItems.slice(0, 4).map((item) => {
            const Icon = item.icon

            return (
              <li key={`mobile-${item.to}`}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      "flex flex-col items-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-medium transition",
                      isActive ? "bg-primary/10 text-primary" : "text-muted-foreground"
                    )
                  }
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </NavLink>
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}
