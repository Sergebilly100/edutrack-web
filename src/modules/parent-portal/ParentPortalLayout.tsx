import { useEffect } from "react"
import { Link, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { Bell, BookOpenCheck, CalendarDays, CalendarX2, Home, LogOut, Moon, Sun, UserCircle2 } from "lucide-react"

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
        <div className="mx-auto flex h-20 w-full max-w-3xl items-center justify-between px-4 lg:max-w-5xl">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15">
              <BookOpenCheck className="h-7 w-7" />
            </div>
            <div>
              <p className="text-lg font-semibold leading-tight">EduTrack CI</p>
              <p className="text-xs text-muted-foreground leading-tight">{schoolInfoQuery.data?.name ?? "Votre école"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* <Button
              type="button"
              variant="ghost"
              size="icon"
              className="relative h-11 w-11 rounded-full"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-background" />
            </Button> */}
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
            <div className="hidden h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary sm:flex">
              {user.phone?.slice(-2) ?? "PA"}
            </div>
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

      <main className="mx-auto w-full max-w-3xl px-4 py-4 pb-28 lg:max-w-5xl lg:pb-8">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur-sm lg:static lg:bg-background">
        <div className="mx-auto grid h-14 w-full max-w-3xl grid-cols-4 px-2 lg:max-w-5xl">
          {tabs.map((tab) => {
            const active = location.pathname === tab.href
            const Icon = tab.icon
            return (
              <Link
                key={tab.href}
                to={tab.href}
                className={cn(
                  "flex flex-col items-center text-center justify-center gap-0.5 rounded-xl py-1.5 transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className={cn("h-5 w-5", active && "fill-primary/10")} />
                <span className="text-xs">{tab.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
