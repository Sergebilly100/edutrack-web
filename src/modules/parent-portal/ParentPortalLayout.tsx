import { useEffect } from "react"
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { CalendarDays, CalendarX2, GraduationCap, Home, LogOut, Moon, Sun, UserCircle2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { logout as logoutRequest } from "@/modules/auth/auth.api"
import { fetchParentSchoolInfo } from "@/modules/parent-portal/parent.api"
import { useParentAuthStore } from "@/modules/parent-portal/parent-auth.store"
import { useTheme } from "@/shared/hooks/useTheme"

const tabs = [
  { href: "/parent/dashboard", label: "Accueil", icon: Home },
  { href: "/parent/absences", label: "Absences", icon: CalendarX2 },
  { href: "/parent/schedule", label: "EDT", icon: CalendarDays },
  { href: "/parent/account", label: "Mon compte", icon: UserCircle2 },
]

export default function ParentPortalLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { resolvedTheme, setTheme } = useTheme()
  const user = useParentAuthStore((state) => state.user)
  const logout = useParentAuthStore((state) => state.logout)
  const schoolInfoQuery = useQuery({
    queryKey: ["parent", "school-info"],
    queryFn: fetchParentSchoolInfo,
    enabled: Boolean(user),
  })

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "auto"
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  if (!user) {
    return <Navigate to="/parent/login" replace />
  }
  if (user.mustChangePassword && location.pathname !== "/parent/first-login-password") {
    return <Navigate to="/parent/first-login-password" replace />
  }
  if (!user.mustChangePassword && location.pathname === "/parent/first-login-password") {
    return <Navigate to="/parent/dashboard" replace />
  }

  return (
    <div className="min-h-screen bg-background text-base">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 w-full max-w-3xl items-center justify-between px-4 lg:max-w-5xl">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary shadow-sm">
              <GraduationCap className="h-4 w-4 text-primary-foreground" strokeWidth={2} />
            </div>
            <div>
              <p className="text-sm font-bold leading-tight tracking-tight">IvoirEdu</p>
              <p className="text-xs text-muted-foreground leading-tight">{schoolInfoQuery.data?.name ?? "Votre école"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-11 w-11 rounded-full"
              aria-label={resolvedTheme === "dark" ? "Passer en thème clair" : "Passer en thème sombre"}
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            >
              <Sun className="h-4 w-4 rotate-0 scale-100 transition-transform dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" />
            </Button>
            
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-11 w-11 rounded-full"
              aria-label="Se déconnecter"
              onClick={async () => {
                try {
                  await logoutRequest()
                } finally {
                  logout()
                  navigate("/parent/login", { replace: true })
                }
              }}
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 pb-28 lg:max-w-5xl lg:pb-8">
        <Outlet />
      </main>

      <nav
        aria-label="Navigation principale"
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur-sm lg:static lg:bg-background"
      >
        <div className="mx-auto grid h-14 w-full max-w-3xl grid-cols-4 px-2 lg:max-w-5xl">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <NavLink
                key={tab.href}
                to={tab.href}
                className={({ isActive }) =>
                  cn(
                    "flex min-h-[44px] flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className={cn("h-5 w-5", isActive && "fill-primary/10")} />
                    <span className="text-xs">{tab.label}</span>
                  </>
                )}
              </NavLink>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
