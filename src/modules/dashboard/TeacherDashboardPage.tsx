import { useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { ArrowRight, BookOpenCheck, CalendarDays, Clock3, ClipboardList, Info } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { fetchTeacherAcademicContext } from "@/modules/academic/academic.api"
import TeacherNotificationsPanel from "@/modules/attendance/components/TeacherNotificationsPanel"
import { fetchTeacherSchedule } from "@/modules/schedule/schedule.api"
import { TourGuide } from "@/shared/components/TourGuide"
import { useTourGuide } from "@/shared/hooks/useTourGuide"
import { teacherDashboardTourSteps } from "@/shared/lib/tour-steps"
import { useAuthStore } from "@/shared/store/auth.store"

const formatTime = (dateValue: string) =>
  new Date(dateValue).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })

const formatToday = (date: Date) =>
  new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" }).format(date)

const getActiveSchedule = <T extends { start_at: string; end_at: string }>(items: T[], now: Date) =>
  items.find((item) => now >= new Date(item.start_at) && now <= new Date(item.end_at))

const getFutureSchedules = <T extends { start_at: string }>(items: T[], now: Date) =>
  items
    .filter((item) => new Date(item.start_at) > now)
    .sort((left, right) => +new Date(left.start_at) - +new Date(right.start_at))

export default function TeacherDashboardPage() {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const tour = useTourGuide("teacher-dashboard", true)
  const now = new Date()

  const scheduleQuery = useQuery({ queryKey: ["teacher-schedule", "me"], queryFn: fetchTeacherSchedule })
  const academicQuery = useQuery({ queryKey: ["academic", "teacher-context"], queryFn: fetchTeacherAcademicContext })

  const schedules = scheduleQuery.data ?? []
  const activeSchedule = getActiveSchedule(schedules, now)
  const futureSchedules = getFutureSchedules(schedules, now)
  const nextSchedule = futureSchedules[0]
  const currentPeriod = academicQuery.data?.gradingPeriods.find((period) => period.isCurrent)
  const teachingClasses = academicQuery.data?.classes ?? []
  const focusSchedule = activeSchedule ?? nextSchedule
  const notesUrl = focusSchedule && currentPeriod
    ? `/academic/notes?classId=${encodeURIComponent(focusSchedule.class_id)}&gradingPeriodId=${encodeURIComponent(currentPeriod.id)}`
    : "/academic/notes"

  return (
    <>
      <TourGuide
        steps={teacherDashboardTourSteps}
        run={tour.run}
        stepIndex={tour.stepIndex}
        onStepChange={tour.setStepIndex}
        onFinish={tour.markDone}
      />
    <div className="space-y-6 py-2">
      <header className="flex items-start justify-between gap-3" data-tour="teacher-dashboard-header">
        <div className="space-y-1">
          <p className="text-sm font-medium capitalize text-muted-foreground">{formatToday(now)}</p>
          <h1 className="text-2xl font-semibold tracking-tight">Bonjour, {user?.name?.split(" ")[0] ?? "Professeur"}</h1>
          {/* <p className="text-sm text-muted-foreground">Vos cours et vos saisies à traiter aujourd&apos;hui.</p> */}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button type="button" variant="outline" size="sm" className="min-h-12 text-muted-foreground" onClick={() => tour.restart()} aria-label="Revoir le guide"><Info className="mr-1.5 h-4 w-4" />Guide</Button>
          <TeacherNotificationsPanel />
        </div>
      </header>

      {scheduleQuery.isLoading ? <FocusCourseSkeleton /> : null}
      {scheduleQuery.isError ? <Alert variant="destructive"><AlertDescription className="flex flex-wrap items-center justify-between gap-3"><span>Vos cours ne sont pas disponibles. Vérifiez la connexion puis réessayez.</span><Button type="button" variant="outline" className="min-h-12" onClick={() => void scheduleQuery.refetch()}>Réessayer</Button></AlertDescription></Alert> : null}

      {!scheduleQuery.isLoading && !scheduleQuery.isError ? (
        <Card className="border-0 bg-blue-700 text-blue-50 shadow-sm" data-tour="teacher-dashboard-course">
          <CardContent className="p-5">
            {focusSchedule ? <>
              <div className="flex items-start justify-between gap-4"><div className="min-w-0"><p className="text-sm font-medium text-blue-100">{activeSchedule ? "Cours en cours" : "Prochain cours"}</p><h2 className="mt-1 truncate text-xl font-semibold">{focusSchedule.subject_name}</h2><p className="mt-1 text-sm text-blue-100">{focusSchedule.class_name} · {formatTime(focusSchedule.start_at)} – {formatTime(focusSchedule.end_at)}</p></div><Clock3 className="mt-1 h-5 w-5 shrink-0 text-blue-100" /></div>
              <div className="mt-5 grid gap-2 sm:grid-cols-2"><Button type="button" variant="secondary" className="min-h-12 justify-between" onClick={() => navigate("/attendance")}>{activeSchedule ? "Ouvrir le cours" : "Préparer le cours"}<ArrowRight className="h-4 w-4" /></Button><Button type="button" variant="ghost" className="min-h-12 justify-between text-blue-50 hover:bg-blue-600 hover:text-white" onClick={() => navigate(notesUrl)}>Saisir les notes<ClipboardList className="h-4 w-4" /></Button></div>
            </> : <>
              <div className="flex items-start gap-3"><CalendarDays className="mt-0.5 h-5 w-5" /><div><p className="text-sm font-medium text-blue-100">Journée libre</p><h2 className="mt-1 text-xl font-semibold">Aucun cours aujourd&apos;hui</h2><p className="mt-1 text-sm text-blue-100">Consultez votre planning ou préparez vos prochaines évaluations.</p></div></div>
              <Button type="button" variant="secondary" className="mt-5 min-h-12 w-full justify-between" onClick={() => navigate("/attendance")}>Consulter mes cours<ArrowRight className="h-4 w-4" /></Button>
            </>}
          </CardContent>
        </Card>
      ) : null}

      {!scheduleQuery.isLoading && !scheduleQuery.isError ? <section aria-labelledby="today-courses-title" className="space-y-3"><div className="flex items-end justify-between gap-3"><div><h2 id="today-courses-title" className="text-lg font-semibold">Aujourd&apos;hui</h2><p className="text-sm text-muted-foreground">{schedules.length} cours planifié{schedules.length > 1 ? "s" : ""}</p></div><Button type="button" variant="ghost" className="min-h-12 text-primary" onClick={() => navigate("/attendance")}>Voir le planning</Button></div>{schedules.length > 0 ? <div className="divide-y rounded-lg border bg-card">{schedules.map((schedule) => { const isFocus = schedule.id === focusSchedule?.id; return <Button key={schedule.id} type="button" variant="ghost" className="min-h-16 w-full justify-start gap-3 rounded-none px-4 text-left first:rounded-t-lg last:rounded-b-lg" onClick={() => navigate("/attendance")}><span className="w-12 shrink-0 text-sm font-semibold tabular-nums">{formatTime(schedule.start_at)}</span><span className="min-w-0 flex-1"><span className="block truncate font-medium">{schedule.subject_name}</span><span className="block truncate text-sm font-normal text-muted-foreground">{schedule.class_name}</span></span>{isFocus ? <Badge variant="outline" className="shrink-0 border-blue-200 bg-blue-50 text-blue-700">{activeSchedule ? "En cours" : "À venir"}</Badge> : null}</Button> })}</div> : null}</section> : null}

      <section aria-labelledby="teaching-title" className="space-y-3 border-t pt-5" data-tour="teacher-dashboard-classes"><div className="flex items-end justify-between gap-3"><div><h2 id="teaching-title" className="text-lg font-semibold">Mes classes et périodes</h2><p className="text-sm text-muted-foreground">Accédez directement à la saisie de la période en cours.</p></div>{currentPeriod ? <Badge variant="secondary">{currentPeriod.label}</Badge> : null}</div>{academicQuery.isLoading ? <div className="space-y-2"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div> : null}{academicQuery.isError ? <Alert variant="destructive"><AlertDescription>Impossible de charger vos classes pour le moment.</AlertDescription></Alert> : null}{!academicQuery.isLoading && !academicQuery.isError && teachingClasses.length === 0 ? <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Aucune classe n&apos;est encore attribuée à votre compte.</p> : null}{!academicQuery.isLoading && teachingClasses.length > 0 ? <div className="divide-y rounded-lg border bg-card">{teachingClasses.map((teachingClass) => <Button key={teachingClass.id} type="button" variant="ghost" className="min-h-16 w-full justify-between rounded-none px-4 text-left first:rounded-t-lg last:rounded-b-lg" onClick={() => navigate(`/academic/notes?classId=${encodeURIComponent(teachingClass.id)}${currentPeriod ? `&gradingPeriodId=${encodeURIComponent(currentPeriod.id)}` : ""}`)}><span><span className="block font-medium">{teachingClass.name}</span><span className="mt-0.5 block text-sm font-normal text-muted-foreground">{teachingClass.levelName}</span></span><BookOpenCheck className="h-4 w-4 text-primary" /></Button>)}</div> : null}</section>
    </div>
    </>
  )
}

function FocusCourseSkeleton() {
  return <Card className="border-0 bg-blue-700 shadow-sm"><CardContent className="space-y-3 p-5"><Skeleton className="h-4 w-28 bg-blue-600" /><Skeleton className="h-7 w-48 bg-blue-600" /><Skeleton className="h-4 w-40 bg-blue-600" /><Skeleton className="mt-5 h-12 w-full bg-blue-600" /></CardContent></Card>
}
