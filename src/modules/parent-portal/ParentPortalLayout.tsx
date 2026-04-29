import { Link, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { fetchParentSchoolInfo } from "@/modules/parent-portal/parent.api"
import { useParentAuthStore } from "@/modules/parent-portal/parent-auth.store"

const tabs = [
  { href: "/parent/dashboard", label: "Accueil" },
  { href: "/parent/absences", label: "Absences" },
  { href: "/parent/account", label: "Mon compte" },
]

export default function ParentPortalLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const user = useParentAuthStore((state) => state.user)
  const logout = useParentAuthStore((state) => state.logout)
  const schoolInfoQuery = useQuery({
    queryKey: ["parent", "school-info"],
    queryFn: fetchParentSchoolInfo,
  })

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
    <div className="min-h-screen bg-background pb-24 text-base">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-3xl items-center justify-between px-4">
          <div>
            <p className="text-base font-semibold">EduTrack</p>
            <p className="text-base text-muted-foreground">{schoolInfoQuery.data?.name ?? "Votre école"}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-12 px-4 text-base"
            onClick={() => {
              logout()
              navigate("/parent/login", { replace: true })
            }}
          >
            Déconnexion
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-4">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background">
        <div className="mx-auto grid h-16 w-full max-w-3xl grid-cols-3 gap-2 px-3 py-2">
          {tabs.map((tab) => {
            const active = location.pathname === tab.href
            return (
              <Link
                key={tab.href}
                to={tab.href}
                className={cn(
                  "flex h-12 items-center justify-center rounded-lg border px-2 text-base font-medium",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-foreground"
                )}
              >
                {tab.label}
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
