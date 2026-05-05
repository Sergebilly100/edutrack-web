import { createPortal } from "react-dom"
import { MessageSquareText, TriangleAlert, X } from "lucide-react"

import { Button } from "@/components/ui/button"

export type NotificationPanelItem = {
  id: string
  title: string
  message: string
  meta: string
  tone: "warning" | "info" | "success" | "danger"
}

const notificationToneClass: Record<NotificationPanelItem["tone"], string> = {
  warning: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100",
  info: "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-100",
  success: "border-green-200 bg-green-50 text-green-800 dark:border-green-900/50 dark:bg-green-950/40 dark:text-green-100",
  danger: "border-red-200 bg-red-50 text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100",
}

export function NotificationsPanel({
  notifications,
  onDismiss,
  onDismissAll,
  onClose,
  isLoading = false,
  isError = false,
}: {
  notifications: NotificationPanelItem[]
  onDismiss: (id: string) => void
  onDismissAll: () => void
  onClose: () => void
  isLoading?: boolean
  isError?: boolean
}) {
  if (typeof document === "undefined") {
    return null
  }

  return createPortal(
    <div className="!m-0 fixed inset-0 z-[1000] bg-black/30 backdrop-blur-sm transition-all" onClick={onClose}>
      <aside
        role="dialog"
        aria-modal="false"
        aria-labelledby="notifications-panel-title"
        className="fixed inset-x-3 bottom-auto top-14 z-[1001] max-h-[82vh] overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-xl md:inset-x-auto md:bottom-auto md:right-8 md:top-14 md:w-[calc(100vw-1.5rem)] md:max-w-md bg-[var(--stat-default-bg)] text-[var(--stat-default-fg)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b px-3 py-3">
          <div>
            <p id="notifications-panel-title" className="text-sm font-semibold">Notifications</p>
            <p className="text-xs text-muted-foreground">
              {notifications.length === 0 ? "" : `${notifications.length} point(s) à suivre`}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {notifications.length > 0 ? (
              <Button type="button" variant="ghost" size="sm" onClick={onDismissAll}>
                Tout marquer comme traité
              </Button>
            ) : null}
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={onClose} aria-label="Fermer les notifications">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="max-h-[62vh] space-y-2 overflow-y-auto p-3 md:max-h-[70vh]">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-20 animate-pulse rounded-lg border bg-muted" />
            ))
          ) : isError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100">
              Impossible de charger les notifications.
            </div>
          ) : notifications.length === 0 ? (
            <div className="rounded-lg border border-dashed p-2 text-center text-xs text-muted-foreground">
              Tout est à jour. <br />
              Les nouvelles alertes reviendront ici dès qu'une action sera nécessaire.
            </div>
          ) : (
            notifications.map((notification) => (
              <div key={notification.id} className="rounded-lg border bg-background p-3 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border ${notificationToneClass[notification.tone]}`}>
                    {notification.tone === "warning" || notification.tone === "danger" ? (
                      <TriangleAlert className="h-4 w-4" />
                    ) : (
                      <MessageSquareText className="h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{notification.title}</p>
                    <p className="mt-1 text-sm leading-5 text-muted-foreground">{notification.message}</p>
                    <p className="mt-2 text-xs font-medium text-muted-foreground">{notification.meta}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={() => onDismiss(notification.id)}
                    aria-label="Masquer cette notification"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </aside>
    </div>,
    document.body
  )
}
