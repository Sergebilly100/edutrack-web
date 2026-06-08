import { useCallback } from "react"
import { useQueryClient } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import { logout } from "@/modules/auth/auth.api"
import { LogoutIcon } from "@/shared/components/icons"
import { LogoutOfflineGuardDialog } from "@/shared/components/LogoutOfflineGuardDialog"
import { OfflineQueueBadge } from "@/shared/components/OfflineQueueBadge"
import { ThemeToggle } from "@/shared/components/ThemeToggle"
import {
  useLogoutWithOfflineGuard,
  type LogoutExecutorOptions,
} from "@/shared/hooks/useLogoutWithOfflineGuard"
import { useAuthStore } from "@/shared/store/auth.store"
import { GraduationCap } from "lucide-react"

export function TeacherTopBar() {
  const user = useAuthStore((state) => state.user)
  const logoutStore = useAuthStore((state) => state.logout)
  const queryClient = useQueryClient()

  const performLogout = useCallback(
    async ({ keepOfflineQueue }: LogoutExecutorOptions) => {
      try {
        await logout()
      } finally {
        logoutStore({ keepOfflineQueue })
        queryClient.clear()
      }
    },
    [logoutStore, queryClient]
  )

  const { confirmOpen, setConfirmOpen, pendingCount, requestLogout, confirmLogout } =
    useLogoutWithOfflineGuard((options) => void performLogout(options))

  return (
    <header className="sticky top-0 z-40 h-14 border-b bg-[var(--surface-chrome)] backdrop-blur">
      <div className="grid h-full grid-cols-[auto_1fr_auto] items-center gap-2 px-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary shadow-sm">
              <img src="/logo.png" alt="logo-ivoiredu" />
            </div>
            <div>
              <p className="text-sm font-bold leading-tight tracking-tight">IvoirEdu</p>
              <p className="text-xs text-muted-foreground leading-tight">Professeur</p>
            </div>
          </div>

        <div className="min-w-0 text-center">
          <p className="truncate text-sm font-semibold leading-tight">{user?.name ?? "Professeur"}</p>
        </div>

        <div className="flex items-center gap-1">
          <OfflineQueueBadge />
          <ThemeToggle />
          <Button type="button" variant="ghost" size="icon" onClick={requestLogout} aria-label="Se déconnecter">
            <LogoutIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <LogoutOfflineGuardDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        pendingCount={pendingCount}
        onConfirm={confirmLogout}
      />
    </header>
  )
}
