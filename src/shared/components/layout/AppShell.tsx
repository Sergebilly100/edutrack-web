import { useState, type ReactNode } from "react"
import { Navigate, Outlet } from "react-router-dom"

import { BottomNav } from "@/shared/components/layout/BottomNav"
import { MobileDrawer } from "@/shared/components/layout/MobileDrawer"
import { Sidebar } from "@/shared/components/layout/Sidebar"
import { TopBar } from "@/shared/components/layout/TopBar"
import { useAuthStore } from "@/shared/store/auth.store"

interface AppShellProps {
  children?: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const isAuthenticated = Boolean(useAuthStore((state) => state.user))

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r md:flex" />

      <TopBar onMenuClick={() => setDrawerOpen(true)} />
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      <main className="pb-16 md:pb-0 md:pl-64">
        <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">{children ?? <Outlet />}</div>
      </main>

      <BottomNav />
    </div>
  )
}
