import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Bell, BellOff, CheckCheck, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  fetchTeacherNotifications,
  markAllTeacherNotificationsRead,
  markTeacherNotificationRead,
  type TeacherNotificationItem,
} from "@/modules/validations/validations.api"

const QUERY_KEY = ["teacher", "notifications"]

const formatDate = (value: string): string => {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

const notifTypeLabel: Record<string, string> = {
  attendance_rejected: "Présence refusée",
  scan_end_warning: "Scan de fin manquant",
}

export default function TeacherNotificationsPanel() {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchTeacherNotifications,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  })

  const unreadCount = notifications.filter((n) => n.readAt === null).length

  const readMutation = useMutation({
    mutationFn: markTeacherNotificationRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })

  const readAllMutation = useMutation({
    mutationFn: markAllTeacherNotificationsRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })

  const handleReadOne = (notification: TeacherNotificationItem) => {
    if (notification.readAt !== null) return
    readMutation.mutate(notification.id)
  }

  return (
    <div className="relative">
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Mes notifications"
        onClick={() => setOpen((prev) => !prev)}
        className="relative h-9 w-9"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-white">
            {unreadCount}
          </span>
        ) : null}
      </Button>

      {open ? (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      ) : null}

      {open ? (
        <aside
          role="dialog"
          aria-modal="false"
          aria-label="Mes notifications"
          className="absolute right-0 top-11 z-50 w-80 max-h-[70vh] overflow-hidden rounded-lg border bg-popover shadow-xl flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between gap-3 border-b px-3 py-3">
            <div>
              <p className="text-sm font-semibold">Mes notifications</p>
              {unreadCount > 0 ? (
                <p className="text-xs text-muted-foreground">{unreadCount} non lue(s)</p>
              ) : (
                <p className="text-xs text-muted-foreground">Tout est lu</p>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => readAllMutation.mutate()}
                  disabled={readAllMutation.isPending}
                >
                  <CheckCheck className="mr-1 h-3.5 w-3.5" />
                  Tout lire
                </Button>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setOpen(false)}
                aria-label="Fermer"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-16 animate-pulse rounded-lg border bg-muted" />
              ))
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-4 text-center">
                <BellOff className="h-8 w-8 text-muted-foreground/50" />
                <p className="text-xs text-muted-foreground">Aucune notification pour le moment.</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  className={`w-full rounded-lg border p-3 text-left shadow-sm transition-colors hover:bg-muted/50 ${
                    notification.readAt === null ? "border-amber-200 bg-amber-50" : "border-border bg-background"
                  }`}
                  onClick={() => handleReadOne(notification)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={
                            notification.type === "attendance_rejected"
                              ? "border-red-200 bg-red-50 text-red-700 text-[10px]"
                              : "border-amber-200 bg-amber-50 text-amber-700 text-[10px]"
                          }
                        >
                          {notifTypeLabel[notification.type] ?? notification.type}
                        </Badge>
                        {notification.readAt === null ? (
                          <span className="inline-block h-2 w-2 rounded-full bg-amber-500" aria-label="Non lu" />
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground line-clamp-3">{notification.message}</p>
                      <p className="mt-1 text-[10px] text-muted-foreground">{formatDate(notification.createdAt)}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </aside>
      ) : null}
    </div>
  )
}
