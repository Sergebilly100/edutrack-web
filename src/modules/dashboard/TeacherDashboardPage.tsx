import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { ArrowRight, BookOpenCheck, CalendarDays, Clock3, ClipboardList, Info } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { fetchConductTeacherActions, fetchTeacherAcademicContext } from "@/modules/academic/academic.api"
import TeacherNotificationsPanel from "@/modules/attendance/components/TeacherNotificationsPanel"
import { fetchTeacherSchedule } from "@/modules/schedule/schedule.api"
import { getTeacherDayState } from "@/modules/dashboard/teacher-day-state"
import { AideButton } from "@/shared/aide/AideButton"
import { TourGuide } from "@/shared/components/TourGuide"
import { useTourGuide } from "@/shared/hooks/useTourGuide"
import { teacherDashboardTourSteps } from "@/shared/lib/tour-steps"
import { useAuthStore } from "@/shared/store/auth.store"
import { OfflineIndicator } from "@/shared/components/OfflineIndicator"
import { useNetworkStatus } from "@/shared/hooks/useNetworkStatus"
import { InstallPwaCard } from "@/shared/pwa/InstallPwaCard"
import { EmptyState } from "@/shared/components/EmptyState"


const formatTime = (dateValue: string) =>
  new Date(dateValue).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Abidjan" })

const formatToday = (date: Date) =>
  new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Abidjan" }).format(date)

const getCourseStatus = (
  schedule: { start_at: string; end_at: string; attendance_status?: "present" | "absent" | "late" | null },
  now: Date,
) => {
  if (schedule.attendance_status === "absent") {
    return { label: "Absent", className: "border-red-200 bg-red-50 text-red-700" }
  }
  if (now > new Date(schedule.end_at)) {
    return { label: "Terminé", className: "border-green-200 bg-green-50 text-green-700" }
  }
  if (now >= new Date(schedule.start_at)) {
    return { label: "En cours", className: "border-slate-200 bg-slate-50 text-slate-700" }
  }
  return { label: "À venir", className: "border-blue-200 bg-blue-50 text-blue-700" }
}

export default function TeacherDashboardPage() {
  const { isOnline } = useNetworkStatus()
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const tour = useTourGuide("teacher-dashboard", true)
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(interval)
  }, [])

  const businessDate = now.toISOString().slice(0, 10)
  const scheduleQuery = useQuery({
    queryKey: ["teacher-schedule", "me", businessDate],
    queryFn: fetchTeacherSchedule,
    refetchOnMount: "always",
    refetchInterval: isOnline ? 60_000 : false,
  })
  const academicQuery = useQuery({ queryKey: ["academic", "teacher-context"], queryFn: fetchTeacherAcademicContext })
  const conductQuery = useQuery({
    queryKey: ["conduct", "teacher-actions"], queryFn: fetchConductTeacherActions,
    refetchOnMount: "always", refetchOnWindowFocus: "always", refetchInterval: 60_000,
  })

  const schedules = scheduleQuery.data ?? []
  const dayState = getTeacherDayState(schedules, now)
  const currentPeriod = academicQuery.data?.gradingPeriods.find((period) => period.notesEntryOpen)
  const teachingClasses = academicQuery.data?.classes ?? []
  const focusSchedule = dayState.kind === "current" || dayState.kind === "next" ? dayState.schedule : null
  const notesUrl = focusSchedule && currentPeriod
    ? `/academic/notes?classId=${encodeURIComponent(focusSchedule.class_id)}&gradingPeriodId=${encodeURIComponent(currentPeriod.id)}`
    : "/academic/notes"

  return (
    <>
      {!isOnline ? (
        <OfflineIndicator forceState="offline" offlineCapable />
      ) : (
        <OfflineIndicator offlineCapable />
      )}
      <TourGuide
        steps={teacherDashboardTourSteps}
        run={tour.run}
        stepIndex={tour.stepIndex}
        onStepChange={tour.setStepIndex}
        onFinish={tour.markDone}
      />

    <div className="space-y-6">

        <InstallPwaCard
          audience="user"
          headline="Installez IvoirEdu pour pointer plus vite"
          className="!mb-4 !mt-0"
        />

      <header className="flex items-start justify-between gap-3" data-tour="teacher-dashboard-header">
        <div className="space-y-1 !mt-4">
          <div className="text-sm font-medium capitalize text-muted-foreground">
            <Badge variant="outline" className="px-2.5">
              {formatToday(now)}
            </Badge>
          </div>
          {/* <h1 className="text-2xl font-semibold tracking-tight">Bonjour, {user?.name?.split(" ")[0] ?? "Professeur"}</h1> */}
          {/* <p className="text-sm text-muted-foreground">Vos cours et vos saisies à traiter aujourd&apos;hui.</p> */}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <AideButton />
          <span data-tour="teacher-dashboard-notifications"><TeacherNotificationsPanel /></span>
        </div>
      </header>

      {conductQuery.isError ? <Alert variant="destructive"><AlertDescription className="flex flex-wrap items-center justify-between gap-2"><span>Impossible de charger les avis de conduite à renseigner.</span><Button type="button" variant="outline" className="min-h-10" onClick={() => void conductQuery.refetch()}>Réessayer</Button></AlertDescription></Alert> : null}
      {conductQuery.isFetchedAfterMount && (conductQuery.data?.teacherActions.length ?? 0) > 0 ? <section data-tour="teacher-dashboard-conduct" aria-labelledby="conduct-review-actions" className="space-y-2"><h2 id="conduct-review-actions" className="text-lg font-semibold">Conduite à renseigner</h2><div className="divide-y rounded-lg border bg-card">{conductQuery.data!.teacherActions.map((action) => <Button key={`${action.classId}:${action.gradingPeriodId}`} type="button" variant="ghost" className="min-h-14 w-full justify-between rounded-none px-4 text-left" onClick={() => navigate(`/academic/notes?tab=conduite&classId=${encodeURIComponent(action.classId)}&gradingPeriodId=${encodeURIComponent(action.gradingPeriodId)}`)}><span className="min-w-0 truncate">{action.className} · {action.gradingPeriodLabel} : {action.pendingCount} avis à renseigner</span><ArrowRight className="ml-2 h-4 w-4 shrink-0" /></Button>)}</div></section> : null}

      {scheduleQuery.isLoading ? <FocusCourseSkeleton /> : null}
      {scheduleQuery.isError ? <Alert variant="destructive"><AlertDescription className="flex flex-wrap items-center justify-between gap-3"><span>Vos cours ne sont pas disponibles. Vérifiez la connexion puis réessayez.</span><Button type="button" variant="outline" className="min-h-10" onClick={() => void scheduleQuery.refetch()}>Réessayer</Button></AlertDescription></Alert> : null}

      {!scheduleQuery.isLoading && !scheduleQuery.isError ? (
        <Card className="border-0 bg-blue-600 text-blue-50 shadow-sm !mt-2" data-tour="teacher-dashboard-course" role="region" aria-label="Résumé des cours du jour">
          <CardContent className="p-5">
            {focusSchedule ? <>
              <div className="flex items-start justify-between gap-4"><div className="min-w-0"><p className="text-sm font-medium text-blue-100">{dayState.kind === "current" ? "Cours en cours" : "Prochain cours"}</p><h2 className="mt-1 break-words text-xl font-semibold">{focusSchedule.subject_name}</h2><p className="mt-1 text-sm text-blue-100">{focusSchedule.class_name} · {formatTime(focusSchedule.start_at)} – {formatTime(focusSchedule.end_at)}</p></div><Clock3 className="mt-1 h-5 w-5 shrink-0 text-blue-100" /></div>
              <div className="mt-5 grid gap-2 sm:grid-cols-2"><Button type="button" variant="secondary" className="min-h-10 min-w-0 justify-between gap-2 whitespace-normal text-left" onClick={() => navigate("/attendance")}>{dayState.kind === "current" ? "Ouvrir le cours" : "Préparer le cours"}<ArrowRight className="h-4 w-4 shrink-0" /></Button><Button type="button" variant="ghost" className="min-h-10 min-w-0 justify-between gap-2 whitespace-normal text-left text-blue-50 hover:bg-blue-700 hover:text-white" onClick={() => navigate(notesUrl)}>Saisir les notes<ClipboardList className="h-4 w-4 shrink-0" /></Button></div>
            </> : dayState.kind === "finished" ? <>
              <div className="flex items-start gap-3"><CalendarDays className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" /><div><h2 className="text-xl font-semibold">Journée terminée</h2><p className="mt-2 text-sm text-blue-100">{dayState.count === 1 ? "Votre cours prévu aujourd’hui est terminé. Consultez son statut ci-dessous." : `Vos ${dayState.count} cours prévus aujourd’hui sont terminés. Consultez leur statut ci-dessous.`}</p></div></div>
              <Button type="button" variant="secondary" className="mt-5 min-h-10 w-full justify-between gap-2 whitespace-normal text-left" onClick={() => navigate("/attendance")}>Voir le planning<ArrowRight className="h-4 w-4 shrink-0" /></Button>
            </> : <>
              <div className="flex items-start gap-3"><CalendarDays className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" /><div><h2 className="text-xl font-semibold">Journée libre</h2><p className="mt-2 text-sm text-blue-100">Aucun cours prévu aujourd’hui. Consultez votre planning ou préparez vos prochaines évaluations.</p></div></div>
              <Button type="button" variant="secondary" className="mt-5 min-h-10 w-full justify-between" onClick={() => navigate("/attendance")}>Consulter mes cours<ArrowRight className="h-4 w-4" /></Button>
            </>}
          </CardContent>
        </Card>
      ) : null}

      {!scheduleQuery.isLoading && !scheduleQuery.isError ? <section data-tour="teacher-dashboard-today" aria-labelledby="today-courses-title" className="space-y-3"><div className="flex items-end justify-between gap-3"><div><h2 id="today-courses-title" className="text-lg font-semibold">Aujourd&apos;hui</h2><p className="text-xs text-muted-foreground">{schedules.length} cours planifié{schedules.length > 1 ? "s" : ""}</p></div><Button type="button" variant="ghost" className="min-h-10 text-primary" onClick={() => navigate("/attendance")}>Voir le planning</Button></div>{schedules.length > 0 ? <div className="divide-y rounded-lg border bg-card">{schedules.map((schedule) => { const status = getCourseStatus(schedule, now); return <Button key={schedule.id} type="button" variant="ghost" className="min-h-16 w-full justify-start gap-3 rounded-none px-4 text-left first:rounded-t-lg last:rounded-b-lg" onClick={() => navigate("/attendance")}><span className="w-12 shrink-0 text-sm font-semibold tabular-nums">{formatTime(schedule.start_at)}</span><span className="min-w-0 flex-1"><span className="block truncate font-medium">{schedule.subject_name}</span><span className="block truncate text-sm font-normal text-muted-foreground">{schedule.class_name}</span></span><Badge variant="outline" className={`shrink-0 transition-colors duration-200 ${status.className}`}>{status.label}</Badge></Button> })}</div> : <EmptyState title="Aucun cours aujourd’hui" message="Vos cours apparaîtront ici lorsqu’ils seront planifiés." classNameRendu="rounded-lg border border-dashed px-4 py-6" />}</section> : null}

      <section aria-labelledby="teaching-title" className="space-y-3 border-t pt-5" data-tour="teacher-dashboard-classes"><div className="flex items-end justify-between items-baseline gap-1"><div><h2 id="teaching-title" className="text-lg font-semibold">Mes classes et périodes</h2><p className="text-xs text-muted-foreground">Accédez à la saisie de la période en cours.</p></div>{currentPeriod ? <Badge variant="secondary" paddingx="none">{currentPeriod.label}</Badge> : null}</div>{academicQuery.isLoading ? <div className="space-y-2"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div> : null}{academicQuery.isError ? <Alert variant="destructive"><AlertDescription>Impossible de charger vos classes pour le moment.</AlertDescription></Alert> : null}{!academicQuery.isLoading && !academicQuery.isError && teachingClasses.length === 0 ? <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Aucune classe n&apos;est encore attribuée à votre compte.</p> : null}{!academicQuery.isLoading && teachingClasses.length > 0 ? <div className="divide-y rounded-lg border bg-card">{teachingClasses.map((teachingClass) => <Button key={teachingClass.id} type="button" variant="ghost" className="min-h-12 w-full justify-between rounded-none px-4 text-left first:rounded-t-lg last:rounded-b-lg" onClick={() => navigate(`/academic/notes?classId=${encodeURIComponent(teachingClass.id)}${currentPeriod ? `&gradingPeriodId=${encodeURIComponent(currentPeriod.id)}` : ""}`)}><span><span className="block font-medium">{teachingClass.name}</span></span><BookOpenCheck className="h-4 w-4 text-primary" /></Button>)}</div> : null}</section>
    </div>
    </>
  )
}

function FocusCourseSkeleton() {
  return <Card className="border-0 bg-blue-700 shadow-sm"><CardContent className="space-y-3 p-5"><Skeleton className="h-4 w-28 bg-blue-600" /><Skeleton className="h-7 w-48 bg-blue-600" /><Skeleton className="h-4 w-40 bg-blue-600" /><Skeleton className="mt-5 h-12 w-full bg-blue-600" /></CardContent></Card>
}
