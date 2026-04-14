import { useEffect, useMemo, useState } from "react"
import { Navigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"

import TeacherFlow, { type TeacherSchedule } from "@/modules/attendance/TeacherFlow"
import { fetchTeacherSchedule } from "@/modules/schedule/schedule.api"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useAuthStore } from "@/shared/store/auth.store"

const getActiveSchedule = (schedules: TeacherSchedule[], now: Date) => {
  return schedules.find((schedule) => {
    const start = new Date(schedule.start_at)
    const end = new Date(schedule.end_at)
    return now >= start && now <= end
  })
}

const getNextSchedule = (schedules: TeacherSchedule[], now: Date) => {
  return schedules
    .filter((schedule) => new Date(schedule.start_at) > now)
    .sort((a, b) => +new Date(a.start_at) - +new Date(b.start_at))[0]
}

const formatTime = (dateValue: string) =>
  new Date(dateValue).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  })

export default function AttendancePage() {
  const user = useAuthStore((state) => state.user)

  const scheduleQuery = useQuery({
    queryKey: ["teacher-schedule", "me"],
    queryFn: fetchTeacherSchedule,
  })

  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null)

  const schedules = scheduleQuery.data ?? []

  const activeSchedule = useMemo(() => {
    return getActiveSchedule(schedules, new Date())
  }, [schedules])

  const nextSchedule = useMemo(() => {
    return getNextSchedule(schedules, new Date())
  }, [schedules])

  useEffect(() => {
    if (selectedScheduleId) {
      return
    }

    if (activeSchedule) {
      setSelectedScheduleId(activeSchedule.id)
      return
    }

    if (schedules.length > 0) {
      setSelectedScheduleId(schedules[0].id)
    }
  }, [activeSchedule, schedules, selectedScheduleId])

  const selectedSchedule = schedules.find((schedule) => schedule.id === selectedScheduleId) ?? null

  if (!user) {
    return <Navigate to="/" replace />
  }

  if (user.role !== "teacher") {
    return (
      <div className="p-4 md:p-6">
        <Alert variant="destructive">
          <AlertDescription>Cette page est réservée aux enseignants.</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="space-y-6 px-4 py-6 md:px-6 md:py-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Pointage enseignant</h1>
        <p className="text-sm text-muted-foreground">
          Suivez le parcours : présence, scan salle, appel.
        </p>
      </header>

      {scheduleQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement de l'emploi du temps...</p>
      ) : null}

      {scheduleQuery.isError ? (
        <Alert variant="destructive">
          <AlertDescription>Impossible de charger l'emploi du temps du jour.</AlertDescription>
        </Alert>
      ) : null}

      {!scheduleQuery.isLoading && schedules.length === 0 ? (
        <Alert>
          <AlertDescription>Aucun cours planifié aujourd'hui.</AlertDescription>
        </Alert>
      ) : null}

      {!scheduleQuery.isLoading && schedules.length > 0 && !activeSchedule ? (
        <Alert>
          <AlertDescription>
            Aucun cours en ce moment.
            {nextSchedule
              ? ` Prochain cours : ${nextSchedule.subject_name} à ${formatTime(nextSchedule.start_at)}.`
              : ""}
          </AlertDescription>
        </Alert>
      ) : null}

      {schedules.length > 0 ? (
        <div className="space-y-3 rounded-lg border border-border p-4">
          <p className="text-sm font-medium">Créneaux du jour</p>
          <div className="flex flex-wrap gap-2">
            {schedules.map((schedule) => {
              const isSelected = schedule.id === selectedScheduleId
              const isCurrent = activeSchedule?.id === schedule.id

              return (
                <Button
                  key={schedule.id}
                  type="button"
                  size="sm"
                  variant={isSelected ? "default" : "outline"}
                  onClick={() => setSelectedScheduleId(schedule.id)}
                >
                  {schedule.subject_name} ({formatTime(schedule.start_at)})
                  {isCurrent ? <Badge className="ml-2" variant="secondary">En cours</Badge> : null}
                </Button>
              )
            })}
          </div>
        </div>
      ) : null}

      {selectedSchedule ? <TeacherFlow schedule={selectedSchedule} /> : null}
    </div>
  )
}
