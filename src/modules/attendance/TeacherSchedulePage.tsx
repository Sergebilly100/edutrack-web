import { useEffect, useMemo, useState } from "react"
import { Navigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"

import { teacherScheduleApi, type ScheduleSlot } from "@/modules/attendance/attendance.api"
import CourseCard from "@/modules/attendance/components/CourseCard"
import DayPicker, { startOfWeekMonday, toDateKey } from "@/modules/attendance/components/DayPicker"
import TeacherCheckInFlow from "@/modules/attendance/components/TeacherCheckInFlow"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/shared/components/EmptyState"
import { OfflineIndicator } from "@/shared/components/OfflineIndicator"
import { InstallPwaCard } from "@/shared/pwa/InstallPwaCard"
import { TourGuide } from "@/shared/components/TourGuide"
import { useTourGuide } from "@/shared/hooks/useTourGuide"
import { teacherAppTourSteps } from "@/shared/lib/tour-steps"
import { CalendarIcon } from "@/shared/components/icons"
import { useNetworkStatus } from "@/shared/hooks/useNetworkStatus"
import { useAuthStore } from "@/shared/store/auth.store"
import { useRollCallStore } from "@/shared/store/rollCall.store"
import { Badge } from "@/components/ui/badge"

// JS getDay() : 0=Dim → remap ISO 1=Lun … 6=Sam, 7=Dim
const getDayOfWeek = (date: Date) => {
  const day = date.getDay()
  return day === 0 ? 7 : day
}

const formatDateRange = (start: Date, end: Date) => {
  const formatter = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short" })
  return `${formatter.format(start)} au ${formatter.format(end)}`
}

const formatSelectedDate = (date: Date) =>
  new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "2-digit",
  }).format(date)

const sortByTime = (left: ScheduleSlot, right: ScheduleSlot) =>
  `${left.start_time}-${left.end_time}`.localeCompare(`${right.start_time}-${right.end_time}`)

const getDefaultTeachingDate = () => {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  if (date.getDay() === 0) {
    date.setDate(date.getDate() + 1)
  }
  return date
}

const getCurrentMonthKey = (date = new Date()) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  return `${year}-${month}`
}

export default function TeacherSchedulePage() {
  const user = useAuthStore((state) => state.user)
  const { isOnline } = useNetworkStatus()
  const tour = useTourGuide("teacher-app", true)

  const [selectedDate, setSelectedDate] = useState(getDefaultTeachingDate)
  const [activeSlot, setActiveSlot] = useState<ScheduleSlot | null>(null)
  // true quand le flux est ouvert en mode « correction de l'appel » (étape 3 directe).
  const [editingRollCall, setEditingRollCall] = useState(false)
  // Tick horloge : force un re-render périodique pour que les états dépendant de
  // l'heure (statut des cours, auto-fermeture du bouton « Terminer le cours ») se
  // mettent à jour sans interaction. Sans ce minuteur, le bouton restait affiché
  // bien après l'heure prévue tant que la page n'était pas rechargée.
  const [nowTick, setNowTick] = useState(() => Date.now())
  useEffect(() => {
    const interval = setInterval(() => setNowTick(Date.now()), 60_000)
    return () => clearInterval(interval)
  }, [])

  const selectedDateKey = toDateKey(selectedDate)
  const currentMonth = useMemo(() => getCurrentMonthKey(), [])

  /**
   * ── FIX créneaux infinis ────────────────────────────────────────────────
   *
   * Ancienne version (bug) :
   *   queryKey: ["teacher-schedule", "week"]  ← jamais invalidé
   *   queryFn: getMyScheduleWeek()            ← sans argument de date
   *   → backend résolvait la période active d'AUJOURD'HUI dans tous les cas
   *   → naviguer vers une autre semaine n'invalidait pas le cache
   *   → si la semaine naviguée n'est pas couverte par la période active d'aujourd'hui
   *     les créneaux d'aujourd'hui s'affichaient quand même à l'infini
   *
   * Correction :
   *   queryKey: ["teacher-schedule", "week", selectedDateKey]
   *   → React Query refetch automatiquement quand selectedDate change
   *   queryFn: getMyScheduleWeek(selectedDateKey)
   *   → backend résout la période active POUR LA DATE SÉLECTIONNÉE
   *   → si aucune période ne couvre cette date → résultat [] → EmptyState
   */
  const scheduleQuery = useQuery({
    queryKey: ["teacher-schedule", "week", selectedDateKey],
    queryFn: () => teacherScheduleApi.getMyScheduleWeek(selectedDateKey),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
  })

  const attendanceQuery = useQuery({
    queryKey: ["teacher-attendance", selectedDateKey],
    queryFn: () => teacherScheduleApi.getMyAttendanceForDate(selectedDateKey),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
  })

  const complianceQuery = useQuery({
    queryKey: ["teacher-compliance", currentMonth],
    queryFn: () => teacherScheduleApi.getMyCompliance(currentMonth),
    staleTime: 1000 * 60,
    gcTime: 1000 * 60 * 30,
  })

  const attendanceBySchedule = useMemo(() => {
    return new Map((attendanceQuery.data ?? []).map((entry) => [entry.schedule_id, entry]))
  }, [attendanceQuery.data])

  // Permet de marquer un créneau comme « terminé » (flowState = "done") quand :
  // - soit l'enseignant a déjà effectué une action de pointage indiquant la fin du cours (checked_out_at, student_rollcall_done ou room_scan_end_at non null)
  // - soit l'heure de fin du cours est dépassée depuis plus de 30 minutes (pour éviter les oublis de l'enseignant à la fin du cours)
  const markFlowDone = useRollCallStore((state) => state.markDone)

  const selectedDayOfWeek = getDayOfWeek(selectedDate)
  const defaultTeachingDate = useMemo(() => getDefaultTeachingDate(), [])

  const daySlots = useMemo(() => {
    return (scheduleQuery.data ?? [])
      .filter((slot) => slot.day_of_week === selectedDayOfWeek)
      .map((slot) => ({ ...slot, date: selectedDateKey }))
      .sort(sortByTime)
  }, [scheduleQuery.data, selectedDateKey, selectedDayOfWeek])

  useEffect(() => {
    const now = new Date()

    for (const slot of daySlots) {
      const flowState = useRollCallStore.getState().getFlowState(slot.id, selectedDateKey)
      if (flowState !== "ready_to_finish" && flowState !== "ready_to_finish_without_rollcall") {
        continue
      }

      const attendance = attendanceBySchedule.get(slot.id)
      if (attendance?.checked_out_at || attendance?.room_scan_end_at) {
        markFlowDone(slot.id, selectedDateKey)
        continue
      }

      const [hours, minutes] = slot.end_time.split(":")
      const endDate = new Date(selectedDate)
      endDate.setHours(Number(hours) || 0, Number(minutes) || 0, 0, 0)
      const autoCloseAt = new Date(endDate.getTime() + 30 * 60 * 1000)
      if (now > autoCloseAt) {
        markFlowDone(slot.id, selectedDateKey)
      }
    }
    // nowTick : relance cette vérification à chaque tick d'horloge (60s) pour que
    // l'auto-fermeture s'applique à l'heure dite sans rechargement.
  }, [attendanceBySchedule, daySlots, markFlowDone, selectedDate, selectedDateKey, nowTick])

  /**
   * Les points highlighted dans le DayPicker = jours de la semaine affichée
   * qui ont au moins 1 cours dans la période active de cette semaine.
   * Si la semaine n'a pas de période → scheduleQuery.data = [] → aucun highlight.
   */
  const highlightDates = useMemo(() => {
    const weekStart = startOfWeekMonday(selectedDate)
    const days = Array.from({ length: 6 }, (_, index) => {
      const day = new Date(weekStart)
      day.setDate(weekStart.getDate() + index)
      day.setHours(0, 0, 0, 0)
      return day
    })
    const daySet = new Set((scheduleQuery.data ?? []).map((slot) => slot.day_of_week))
    return days.filter((day) => daySet.has(getDayOfWeek(day)))
  }, [scheduleQuery.data, selectedDate])

  const weekStart = startOfWeekMonday(selectedDate)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 5) // samedi

  if (!user) return <Navigate to="/" replace />

  if (user.role !== "teacher") {
    return (
      <Alert variant="destructive">
        <AlertDescription>Cette page est réservée aux enseignants.</AlertDescription>
      </Alert>
    )
  }

  return (
    <>
      <TourGuide
        steps={teacherAppTourSteps}
        run={tour.run}
        stepIndex={tour.stepIndex}
        onStepChange={tour.setStepIndex}
        onFinish={tour.markDone}
      />
    <div className="space-y-4 pb-4" data-testid="teacher-schedule-page">

      {!isOnline ? (
        <OfflineIndicator forceState="offline" offlineCapable />
      ) : (
        <OfflineIndicator offlineCapable />
      )}

      <InstallPwaCard
        audience="user"
        headline="Installez IvoirEdu pour pointer plus vite"
        className="!mb-4 !mt-0"
      />

      <header className="rounded-lg border bg-card p-4 shadow-sm !mt-0" data-tour="teacher-app-header">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">Aujourd'hui et semaine</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Mon planning</h1>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span className="font-medium">Semaine du {formatDateRange(weekStart, weekEnd)}</span>
          <span aria-hidden="true">
            <Badge variant="outline" className="border-muted-200 bg-muted-3 00 text-muted-700">{formatSelectedDate(selectedDate)}</Badge>
          </span>
        </div>
      </header>

      <header className="rounded-lg border bg-card p-4 shadow-sm" data-tour="teacher-app-compliance">
          {complianceQuery.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-3 w-full rounded-full" />
              <Skeleton className="h-4 w-32" />
            </div>
          ) : complianceQuery.isError ? (
            <Alert variant="destructive">
              <AlertDescription>Impossible de charger votre taux de conformité.</AlertDescription>
            </Alert>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium mb-2">Taux de conformité du mois</p>
                <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">
                  {Math.round(complianceQuery.data?.complianceRate ?? 0)}%
                </Badge>
              </div>
              <Progress value={complianceQuery.data?.complianceRate ?? 0} />
            </>
          )}
      </header>

      <div data-tour="teacher-app-daypicker">
        <DayPicker
          selectedDate={selectedDate}
          onChange={setSelectedDate}
          highlightDates={highlightDates}
        />
      </div>

      {scheduleQuery.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-[108px] rounded-lg" />
          ))}
        </div>
      ) : null}

      {scheduleQuery.isError ? (
        <Alert variant="destructive">
          <AlertDescription>Impossible de charger votre planning. Vérifiez la connexion, puis réessayez.</AlertDescription>
        </Alert>
      ) : null}

      {!scheduleQuery.isLoading && attendanceQuery.isError ? (
        <Alert variant="destructive">
          <AlertDescription>Impossible de charger vos statuts de pointage. Les cours restent visibles, mais les badges peuvent être incomplets.</AlertDescription>
        </Alert>
      ) : null}

      {!scheduleQuery.isLoading && !scheduleQuery.isError && daySlots.length === 0 ? (
        <EmptyState
          icon={CalendarIcon}
          title="Pas de cours ce jour"
          description="Aucun créneau actif pour ce jour. Sélectionnez un autre jour de la semaine."
          action={
            toDateKey(selectedDate) !== toDateKey(defaultTeachingDate)
              ? { label: "Revenir au prochain jour de cours", onClick: () => setSelectedDate(defaultTeachingDate) }
              : undefined
          }
        />
      ) : null}

      {!scheduleQuery.isLoading && daySlots.length > 0 ? (
        <ul className="space-y-2" data-testid="teacher-schedule-list" data-tour="teacher-app-courses">
          {daySlots.map((slot) => (
            <CourseCard
              key={slot.id}
              slot={slot}
              attendance={attendanceBySchedule.get(slot.id)}
              onStartCourse={(s) => { setEditingRollCall(false); setActiveSlot(s) }}
              onEditRollCall={(s) => { setEditingRollCall(true); setActiveSlot(s) }}
            />
          ))}
        </ul>
      ) : null}

      {activeSlot ? (
        <TeacherCheckInFlow
          open={Boolean(activeSlot)}
          slot={activeSlot}
          editRollCall={editingRollCall}
          onClose={() => { setActiveSlot(null); setEditingRollCall(false) }}
        />
      ) : null}
    </div>
    </>
  )
}
