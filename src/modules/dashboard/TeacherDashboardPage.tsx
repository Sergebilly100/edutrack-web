import { useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { apiClient as api } from "@/shared/api/client"
import { fetchTeacherSchedule } from "@/modules/schedule/schedule.api"

type TeacherNotification = {
  id: string
  type: string
  message: string
  created_at: string
}

const formatTime = (dateValue: string) =>
  new Date(dateValue).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  })

const getActiveSchedule = <T extends { start_at: string; end_at: string }>(items: T[], now: Date) =>
  items.find((item) => {
    const start = new Date(item.start_at)
    const end = new Date(item.end_at)
    return now >= start && now <= end
  })

const getNextSchedule = <T extends { start_at: string }>(items: T[], now: Date) =>
  items
    .filter((item) => new Date(item.start_at) > now)
    .sort((a, b) => +new Date(a.start_at) - +new Date(b.start_at))[0]

export default function TeacherDashboardPage() {
  const navigate = useNavigate()

  const scheduleQuery = useQuery({
    queryKey: ["teacher-schedule", "me"],
    queryFn: fetchTeacherSchedule,
  })

  const notificationsQuery = useQuery({
    queryKey: ["notifications", "me", "attendance-rejected"],
    queryFn: () => api.get<TeacherNotification[]>("/notifications/me").then((response) => response.data),
    staleTime: 60_000,
  })

  const schedules = scheduleQuery.data ?? []

  const activeSchedule = useMemo(() => getActiveSchedule(schedules, new Date()), [schedules])
  const nextSchedule = useMemo(() => getNextSchedule(schedules, new Date()), [schedules])

  return (
    <div className="space-y-6 px-4 py-6 md:px-6 md:py-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard enseignant</h1>
        <p className="text-sm text-muted-foreground">Vue rapide des cours du jour et accès au pointage.</p>
      </header>

      {scheduleQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement des créneaux...</p>
      ) : null}

      {scheduleQuery.isError ? (
        <Alert variant="destructive">
          <AlertDescription>Impossible de charger vos créneaux pour le moment.</AlertDescription>
        </Alert>
      ) : null}

      {(notificationsQuery.data ?? []).slice(0, 1).map((notification) => (
        <Alert key={notification.id}>
          <AlertDescription>
            <span className="font-medium">Information sur votre présence. </span>
            {notification.message} Contactez votre direction pour plus d'informations.
          </AlertDescription>
        </Alert>
      ))}

      {activeSchedule ? (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <div className="mb-2 flex items-center gap-2">
            <Badge variant="secondary">En cours</Badge>
            <p className="text-sm font-medium text-green-800">{activeSchedule.subject_name}</p>
          </div>
          <p className="text-sm text-green-700">
            {activeSchedule.class_name} · {formatTime(activeSchedule.start_at)} - {formatTime(activeSchedule.end_at)}
          </p>
        </div>
      ) : null}

      {!activeSchedule && nextSchedule ? (
        <div className="rounded-lg border p-4">
          <p className="text-sm font-medium">Prochain cours</p>
          <p className="text-sm text-muted-foreground">
            {nextSchedule.subject_name} ({nextSchedule.class_name}) à {formatTime(nextSchedule.start_at)}
          </p>
        </div>
      ) : null}

      {!scheduleQuery.isLoading && schedules.length === 0 ? (
        <Alert>
          <AlertDescription>
            Aucun créneau réel trouvé. Le mode démo de pointage est disponible.
          </AlertDescription>
        </Alert>
      ) : null}

      <Button
        type="button"
        className="w-full sm:w-auto"
        onClick={() => {
          navigate("/attendance")
        }}
      >
        Ouvrir le pointage
      </Button>
    </div>
  )
}
