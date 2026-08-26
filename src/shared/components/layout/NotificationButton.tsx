import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Bell } from "lucide-react"
import { useLocation, useNavigate } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  getDashboardActionItems,
  resolveDashboardActionItem,
} from "@/modules/dashboard/dashboard.api"
import { actionItemToNotification } from "@/modules/dashboard/dashboard-action-notifications"
import { NotificationsPanel, type NotificationPanelItem } from "@/shared/components/layout/NotificationsPanel"
import { useAuthStore } from "@/shared/store/auth.store"

type NotificationButtonProps = {
  count?: number
  className?: string
}

export function NotificationButton({ count = 0, className }: NotificationButtonProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const user = useAuthStore((state) => state.user)
  const isDashboardRoute = location.pathname === "/dashboard"
  const queryEnabled = user?.role === "director" && !isDashboardRoute
  const actionItemsQuery = useQuery({
    queryKey: ["dashboard", "action-items"],
    queryFn: getDashboardActionItems,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
    retry: false,
    enabled: queryEnabled,
  })
  const notificationItems = useMemo<NotificationPanelItem[]>(
    () => (actionItemsQuery.data ?? []).map(actionItemToNotification),
    [actionItemsQuery.data]
  )
  const resolveItemMutation = useMutation({
    mutationFn: resolveDashboardActionItem,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["dashboard", "action-items"] })
    },
  })
  const visibleCount = isDashboardRoute ? count : notificationItems.length

  const dismissNotification = (id: string) => resolveItemMutation.mutate(id)
  const dismissAllNotifications = () => {
    void Promise.all(notificationItems.map((item) => resolveItemMutation.mutateAsync(item.id)))
  }

  if (user?.role !== "director") {
    return null
  }

  const handleClick = () => {
    if (isDashboardRoute) {
      window.dispatchEvent(new Event("dashboard:mobile-toggle-notifications"))
      return
    }

    setOpen(true)
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Voir les notifications"
        onClick={handleClick}
        className={cn("relative h-9 w-9", className)}
      >
        <Bell className="h-4 w-4" />
        {visibleCount > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-white">
            {visibleCount}
          </span>
        ) : null}
      </Button>

      {!isDashboardRoute ? (
        open ? (
          <NotificationsPanel
            notifications={notificationItems}
            isLoading={actionItemsQuery.isLoading}
            isError={actionItemsQuery.isError}
            onDismiss={dismissNotification}
            onDismissAll={dismissAllNotifications}
            onClose={() => setOpen(false)}
            onNavigate={(href) => {
              setOpen(false)
              navigate(href)
            }}
          />
        ) : null
      ) : null}
    </>
  )
}
