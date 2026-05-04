import { useQueryClient } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import { logout } from "@/modules/auth/auth.api"
import { LogoutIcon } from "@/shared/components/icons"
import { ThemeToggle } from "@/shared/components/ThemeToggle"
import { useAuthStore } from "@/shared/store/auth.store"

export function TeacherTopBar() {
  const user = useAuthStore((state) => state.user)
  const logoutStore = useAuthStore((state) => state.logout)
  const queryClient = useQueryClient()

  const handleLogout = async () => {
    try {
      await logout()
    } finally {
      logoutStore()
      queryClient.clear()
    }
  }

  return (
    <header className="sticky top-0 z-40 h-14 border-b bg-[var(--surface-chrome)] backdrop-blur">
      <div className="grid h-full grid-cols-[auto_1fr_auto] items-center gap-2 px-4">
        <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-[11px] font-semibold text-primary shadow-sm">
          ET
        </div>

        <div className="min-w-0 text-center">
          <p className="truncate text-sm font-semibold leading-tight">{user?.name ?? "Professeur"}</p>
          <p className="text-[11px] font-medium text-muted-foreground">Espace professeur</p>
        </div>

        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Button type="button" variant="ghost" size="icon" onClick={() => void handleLogout()} aria-label="Se déconnecter">
            <LogoutIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  )
}
