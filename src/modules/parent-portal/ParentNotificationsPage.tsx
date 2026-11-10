import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Bell, CheckCheck, ChevronRight, ReceiptText } from "lucide-react"
import { useNavigate } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/shared/components/EmptyState"
import { QueryErrorState } from "@/shared/components/QueryErrorState"
import {
  listParentNotifications,
  markAllParentNotificationsRead,
  markParentNotificationRead,
  type ParentNotification,
} from "./parent.api"

const formatDateTime = (value: string) => new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium", timeStyle: "short",
}).format(new Date(value))

export default function ParentNotificationsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const notificationsQuery = useQuery({ queryKey: ["parent", "notifications"], queryFn: listParentNotifications })
  const refreshNotifications = () => queryClient.invalidateQueries({ queryKey: ["parent", "notifications"] })
  const markReadMutation = useMutation({ mutationFn: markParentNotificationRead, onSuccess: refreshNotifications })
  const markAllMutation = useMutation({ mutationFn: markAllParentNotificationsRead, onSuccess: refreshNotifications })
  const notifications = notificationsQuery.data?.notifications ?? []

  const openNotification = (notification: ParentNotification) => {
    if (!notification.readAt) markReadMutation.mutate(notification.id)
    if (notification.studentId) {
      navigate(`/parent/payments?student=${encodeURIComponent(notification.studentId)}`)
    }
  }

  return (
    <div className="animate-fade-in space-y-5 py-5 sm:py-6">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b pb-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
          <p className="mt-1 text-sm text-muted-foreground">Les relances et informations qui concernent vos enfants.</p>
        </div>
        {notifications.some((notification) => !notification.readAt) ? <Button type="button" variant="outline" className="min-h-11" disabled={markAllMutation.isPending} onClick={() => markAllMutation.mutate()}><CheckCheck className="mr-2 h-4 w-4" />Tout marquer comme lu</Button> : null}
      </header>

      {notificationsQuery.isLoading ? <div className="space-y-3"><div className="h-20 animate-pulse rounded-lg border bg-muted" /><div className="h-20 animate-pulse rounded-lg border bg-muted" /></div> : null}
      {notificationsQuery.isError ? <QueryErrorState message="Impossible de charger vos notifications." onRetry={() => void notificationsQuery.refetch()} /> : null}
      {!notificationsQuery.isLoading && !notificationsQuery.isError && notifications.length === 0 ? <EmptyState icon={Bell} title="Aucune notification" message="Les nouvelles relances de l’établissement apparaîtront ici." /> : null}
      {notifications.length > 0 ? <section className="space-y-2" aria-label="Liste des notifications" data-tour="parent-notifications-list">{notifications.map((notification) => <button key={notification.id} type="button" className={`w-full rounded-lg border p-4 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${notification.readAt ? "bg-card" : "bg-blue-50/70 dark:bg-blue-950/20"}`} onClick={() => openNotification(notification)}><span className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"><ReceiptText className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><span className="font-semibold">Rappel de scolarité</span>{!notification.readAt ? <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-800">Nouveau</Badge> : null}</span><span className="mt-1 block text-sm text-muted-foreground">{notification.message}</span><span className="mt-2 block text-xs text-muted-foreground">{notification.studentName ? `${notification.studentName} · ` : ""}{formatDateTime(notification.createdAt)}</span></span><ChevronRight className="mt-3 h-4 w-4 shrink-0 text-muted-foreground" /></span></button>)}</section> : null}
    </div>
  )
}
