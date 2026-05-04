import { useEffect, useState, type ReactNode } from "react"
import { Bell, RefreshCw } from "lucide-react"
import { Navigate, Outlet, useLocation } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { TooltipProvider } from "@/components/ui/tooltip"
import { DesktopSidebar, MobileMenuButton, MobileSidebar } from "@/shared/components/layout/Sidebar"
import { useAuthStore } from "@/shared/store/auth.store"

interface AppShellProps {
  children?: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const user = useAuthStore((state) => state.user)
  const location = useLocation()
  const [mobileAlertsCount, setMobileAlertsCount] = useState(0)
  const [mobileIsRefreshing, setMobileIsRefreshing] = useState(false)
  const isDashboardRoute = location.pathname === "/dashboard"

  useEffect(() => {
    if (!isDashboardRoute) {
      setMobileAlertsCount(0)
      setMobileIsRefreshing(false)
      return
    }

    const onHeaderState = (event: Event) => {
      const customEvent = event as CustomEvent<{ activeAlertsCount: number; isRefreshing: boolean }>
      setMobileAlertsCount(customEvent.detail?.activeAlertsCount ?? 0)
      setMobileIsRefreshing(customEvent.detail?.isRefreshing ?? false)
    }

    window.addEventListener("dashboard:mobile-header-state", onHeaderState)
    return () => window.removeEventListener("dashboard:mobile-header-state", onHeaderState)
  }, [isDashboardRoute])

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (user.role === "teacher") {
    return <Navigate to="/attendance" replace />
  }

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex h-screen overflow-hidden bg-[var(--surface-base)]">
        <DesktopSidebar />
        <MobileSidebar />

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[var(--surface-base)]">
          <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-[var(--surface-chrome)] px-4 backdrop-blur lg:hidden">
            <MobileMenuButton />
            <span className="truncate text-sm font-semibold">EduTrack CI</span>
            {isDashboardRoute ? (
              <div className="ml-auto flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Voir les notifications"
                  onClick={() => window.dispatchEvent(new Event("dashboard:mobile-toggle-notifications"))}
                  className="relative h-9 w-9"
                >
                  <Bell className="h-4 w-4" />
                  {mobileAlertsCount > 0 ? (
                    <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-white">
                      {mobileAlertsCount}
                    </span>
                  ) : null}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Mettre à jour les données"
                  disabled={mobileIsRefreshing}
                  onClick={() => window.dispatchEvent(new Event("dashboard:mobile-refresh"))}
                  className="h-9 w-9"
                >
                  <RefreshCw className={mobileIsRefreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
                </Button>
              </div>
            ) : null}
          </header>

          <main className="flex-1 overflow-y-auto px-4 pb-4 pt-0 md:px-6 md:pb-6 md:pt-0">
            <div key={location.pathname} className="route-surface min-h-full">
              {children ?? <Outlet />}
            </div>
          </main>
        </div>
      </div>
    </TooltipProvider>
  )
}
