import { useEffect, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import axios from "axios"
import { ChevronDown, ChevronUp, ListFilter } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { EmptyState } from "@/shared/components/EmptyState"
import { AcademicContextFilters } from "@/shared/components/AcademicContextFilters"
import { DependentSelect } from "@/shared/components/DependentSelect"
import { FilterBar } from "@/shared/components/FilterBar"
import { ResetFiltersButton } from "@/shared/components/ResetFiltersButton"
import { PageLayout } from "@/shared/components/PageLayout"
import { currentReviewPeriodId } from "@/shared/lib/academic-context"
import { useToast } from "@/components/ui/use-toast"
import { completionPercent, evaluationStatus, todayInAbidjan } from "./evaluation-review.logic"
import { fetchEvaluationReview, fetchReviewOptions, fetchSpontaneousReview, remindEvaluationTeacher } from "./evaluation-review.api"

const displayDate = (date: string | null) => date ? new Date(`${date}T00:00:00`).toLocaleDateString("fr-FR") : "Sans date"
const displayAdjustment = (value: number) => new Intl.NumberFormat("fr-FR", { signDisplay: "always", maximumFractionDigits: 3 }).format(value)

function ReviewPagination({ label, plural, total, page, pageSize, onPageChange, onPageSizeChange }: {
  label: string; plural: string; total: number; page: number; pageSize: number
  onPageChange: (page: number) => void; onPageSizeChange?: (size: number) => void
}) {
  const [targetPage, setTargetPage] = useState(String(page))
  useEffect(() => setTargetPage(String(page)), [page])
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const first = total ? (page - 1) * pageSize + 1 : 0
  const last = Math.min(page * pageSize, total)
  return <nav aria-label={`Pagination des ${plural}`} className="space-y-3 border-t pt-4">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <p className="text-sm text-muted-foreground">{first.toLocaleString("fr-FR")}–{last.toLocaleString("fr-FR")} sur {total.toLocaleString("fr-FR")} {total === 1 ? label : plural}</p>
      {onPageSizeChange ? <div className="space-y-1"><Label htmlFor="spontaneous-page-size">Élèves par page</Label>
        <Select value={String(pageSize)} onValueChange={(value) => onPageSizeChange(Number(value))}>
          <SelectTrigger id="spontaneous-page-size" className="h-10 w-24"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="20">20</SelectItem><SelectItem value="50">50</SelectItem></SelectContent>
        </Select></div> : null}
    </div>
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" className="min-h-10" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Précédent</Button>
      <span className="min-w-24 text-center text-sm">Page {page} sur {totalPages}</span>
      <Button variant="outline" className="min-h-10" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>Suivant</Button>
      {totalPages > 2 ? <form className="flex items-center gap-2 sm:ml-auto" onSubmit={(event) => {
        event.preventDefault()
        const target = Number(targetPage)
        if (Number.isInteger(target) && target >= 1 && target <= totalPages) onPageChange(target)
      }}><Label htmlFor={`page-target-${plural}`} className="whitespace-nowrap">Aller à la page</Label>
        <Input id={`page-target-${plural}`} type="number" min={1} max={totalPages} value={targetPage} onChange={(event) => setTargetPage(event.target.value)} className="h-10 w-20" />
        <Button type="submit" variant="outline" className="min-h-10">Aller</Button>
      </form> : null}
    </div>
  </nav>
}

export default function EvaluationReviewPage() {
  const [renderedAt, setRenderedAt] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setRenderedAt(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const scheduledSectionRef = useRef<HTMLDivElement>(null)
  const spontaneousSectionRef = useRef<HTMLElement>(null)
  const [year, setYear] = useState("")
  const [period, setPeriod] = useState("")
  const [level, setLevel] = useState("")
  const [classId, setClassId] = useState("")
  const [subject, setSubject] = useState("")
  const [teacher, setTeacher] = useState("")
  const [sort, setSort] = useState<"delay" | "teacher" | "class">("delay")
  const [view, setView] = useState("scheduled")
  const [page, setPage] = useState(1)
  const [spontaneousPage, setSpontaneousPage] = useState(1)
  const [spontaneousPageSize, setSpontaneousPageSize] = useState(20)
  const [openId, setOpenId] = useState<string | null>(null)
  const [openStudentId, setOpenStudentId] = useState<string | null>(null)
  const [studentSearchInput, setStudentSearchInput] = useState("")
  const [studentSearch, setStudentSearch] = useState("")

  const yearsQuery = useQuery({ queryKey: ["evaluation-review", "years"], queryFn: () => fetchReviewOptions({}) })
  const activeYear = yearsQuery.data?.schoolYears.find((item) => item.active)
  const schoolYearId = year || activeYear?.id || ""
  const calendarQuery = useQuery({ queryKey: ["evaluation-review", "calendar", schoolYearId],
    queryFn: () => fetchReviewOptions({ schoolYearId }), enabled: Boolean(schoolYearId) })
  const availablePeriods = calendarQuery.data?.gradingPeriods ?? []
  const gradingPeriodId = availablePeriods.some((item) => item.id === period) ? period : currentReviewPeriodId(availablePeriods)
  const optionsQuery = useQuery({ queryKey: ["evaluation-review", "options", schoolYearId, gradingPeriodId, level, classId, subject],
    queryFn: () => fetchReviewOptions({ schoolYearId, gradingPeriodId, levelId: level || undefined,
      classId: classId || undefined, subjectId: subject || undefined }), enabled: Boolean(gradingPeriodId) })
  const options = optionsQuery.data
  const resultQuery = useQuery({
    queryKey: ["evaluation-review", "list", schoolYearId, gradingPeriodId, level, classId, subject, teacher, sort, page],
    queryFn: () => fetchEvaluationReview({ schoolYearId, gradingPeriodId, levelId: level || undefined,
      classId: classId || undefined, subjectId: subject || undefined, teacherId: teacher || undefined, sort, page }),
    enabled: view === "scheduled" && optionsQuery.isSuccess && !optionsQuery.isFetching,
  })
  const spontaneousQuery = useQuery({
    queryKey: ["evaluation-review", "spontaneous", schoolYearId, gradingPeriodId, level, classId, subject, teacher, studentSearch, spontaneousPage, spontaneousPageSize],
    queryFn: () => fetchSpontaneousReview({ schoolYearId, gradingPeriodId, levelId: level || undefined,
      classId: classId || undefined, subjectId: subject || undefined, teacherId: teacher || undefined,
      studentSearch: studentSearch || undefined, page: spontaneousPage, pageSize: spontaneousPageSize }),
    enabled: view === "spontaneous" && optionsQuery.isSuccess && !optionsQuery.isFetching,
  })
  const result = resultQuery.data
  const spontaneous = spontaneousQuery.data
  const remindMutation = useMutation({
    mutationFn: remindEvaluationTeacher,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["evaluation-review", "list"] })
      toast({ title: "Relance envoyée au professeur" })
    },
    onError: (error) => {
      const message = axios.isAxiosError(error) && typeof error.response?.data?.error === 'string'
        ? error.response.data.error : "Impossible d’envoyer la relance. Réessayez."
      toast({ title: "Relance non envoyée", description: message, variant: "destructive" })
    },
  })
  const resetPage = () => { setPage(1); setSpontaneousPage(1); setOpenId(null); setOpenStudentId(null); setStudentSearch(""); setStudentSearchInput("") }
  const applyStudentSearch = (value: string) => { setStudentSearch(value.trim()); setSpontaneousPage(1); setOpenStudentId(null) }
  const goToScheduledPage = (next: number) => { setPage(next); setOpenId(null); scheduledSectionRef.current?.scrollIntoView?.({ block: "start" }) }
  const goToSpontaneousPage = (next: number) => { setSpontaneousPage(next); setOpenStudentId(null); spontaneousSectionRef.current?.scrollIntoView?.({ block: "start" }) }
  const changeYear = (value: string) => { setYear(value); setPeriod(""); setLevel(""); setClassId(""); setSubject(""); setTeacher(""); resetPage() }
  const changePeriod = (value: string) => { setPeriod(value); setLevel(""); setClassId(""); setSubject(""); setTeacher(""); resetPage() }
  const changeLevel = (value: string) => { setLevel(value); setClassId(""); setSubject(""); setTeacher(""); resetPage() }
  const changeClass = (value: string) => { setClassId(value); setSubject(""); setTeacher(""); resetPage() }
  const changeSubject = (value: string) => { setSubject(value); setTeacher(""); resetPage() }

  return <PageLayout title="Suivi des évaluations et notes" subtitle="Consultez les évaluations saisies et les notes des élèves." >
    <section aria-label="Filtres" className="space-y-4 rounded-lg border bg-card p-4 sm:p-6">
      <AcademicContextFilters yearIdPrefix="review" showPeriod allowAllYears={false}
        years={(yearsQuery.data?.schoolYears ?? []).map((item) => ({ ...item, status: item.active ? "active" as const : "closed" as const }))}
        yearId={schoolYearId} activeYear={activeYear ? { ...activeYear, status: "active" } : undefined}
        onYearChange={changeYear} yearDisabled={yearsQuery.isLoading}
        periods={availablePeriods.map((item) => ({ id: item.id, label: item.isFuture ? `${item.label} (à venir)` : item.label }))}
        periodId={gradingPeriodId} onPeriodChange={changePeriod}
        periodDisabled={!availablePeriods.length || calendarQuery.isFetching} />
      <FilterBar className="lg:grid-cols-2 xl:grid-cols-4">
      <DependentSelect id="review-niveau" label="Niveau" value={level} options={options?.levels ?? []}
        dependsOn={{ field: "year", value: schoolYearId }} allLabel="Tous" loading={optionsQuery.isFetching}
        disabled={!gradingPeriodId || !options?.levels.length} onValueChange={changeLevel} />
      <DependentSelect id="review-classe" label="Classe" value={classId} options={options?.classes ?? []}
        dependsOn={{ field: "level", value: level }} allLabel="Tous" loading={optionsQuery.isFetching}
        disabled={!options?.classes.length} onValueChange={changeClass} />
      <DependentSelect id="review-matière" label="Matière" value={subject} options={options?.subjects ?? []}
        dependsOn={{ field: "class", value: classId }} allLabel="Tous" loading={optionsQuery.isFetching}
        disabled={!options?.subjects.length} onValueChange={changeSubject} />
      <DependentSelect id="review-professeur" label="Professeur" value={teacher} options={options?.teachers ?? []}
        dependsOn={{ field: "subject", value: subject }} allLabel="Tous" loading={optionsQuery.isFetching}
        disabled={!options?.teachers.length} onValueChange={(value) => { setTeacher(value); resetPage() }} />
      </FilterBar>
      <ResetFiltersButton active={Boolean(year || period || level || classId || subject || teacher || studentSearch)}
        onReset={() => { changeYear(""); setStudentSearch(""); setStudentSearchInput("") }} />
    </section>
    {yearsQuery.isError || calendarQuery.isError || optionsQuery.isError || (view === "scheduled" ? resultQuery.isError : spontaneousQuery.isError) ? <Alert variant="destructive"><AlertDescription>Impossible de charger les évaluations. Réessayez dans un instant.</AlertDescription></Alert> : null}
    {!schoolYearId && !yearsQuery.isLoading ? <EmptyState title="Aucune année scolaire" description="Créez une année scolaire pour consulter les évaluations." /> : null}
    {schoolYearId && !gradingPeriodId && !calendarQuery.isLoading ? <EmptyState title="Aucune période configurée" description="Configurez une période pour cette année scolaire." /> : null}
    <Tabs value={view} onValueChange={setView} className="space-y-4">
      <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto bg-muted/80">
        <TabsTrigger value="scheduled" className="min-h-12 whitespace-nowrap">Évaluations programmées</TabsTrigger>
        <TabsTrigger value="spontaneous" className="min-h-12 whitespace-nowrap">Notes spontanées</TabsTrigger>
      </TabsList>
      <TabsContent ref={scheduledSectionRef} value="scheduled" className="space-y-4">
    {yearsQuery.isLoading || calendarQuery.isLoading || optionsQuery.isLoading || resultQuery.isLoading || resultQuery.isFetching ? <div aria-label="Chargement des évaluations" className="space-y-3"><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /></div> : null}
    {result && !resultQuery.isFetching ? <>
      <section aria-label="Synthèse" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {([
          ["Évaluations programmées", result.summary.evaluations],
          ["Notes saisies", result.summary.grades],
          ["Notes manquantes", result.summary.missing],
        ] as const).map(([label, value]) => <Card key={label}><CardContent className="p-4 sm:p-5">
          <strong className="block text-3xl font-semibold tabular-nums">{value}</strong>
          <span className="text-sm text-muted-foreground">{label}</span>
        </CardContent></Card>)}
        <Card><CardContent className="space-y-2 p-4 sm:p-5">
          <strong className="block text-3xl font-semibold tabular-nums">{completionPercent(result.summary.grades, result.summary.grades + result.summary.missing)} %</strong>
          <span className="text-sm text-muted-foreground">Complétion</span>
          <Progress value={completionPercent(result.summary.grades, result.summary.grades + result.summary.missing)}
            aria-label="Complétion des notes" aria-valuenow={completionPercent(result.summary.grades, result.summary.grades + result.summary.missing)} aria-valuemin={0} aria-valuemax={100} />
        </CardContent></Card>
      </section>
      <div className="flex flex-col gap-3 rounded-lg border bg-muted/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <ListFilter aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div><Label htmlFor="evaluation-sort" className="text-sm font-semibold text-foreground">Trier et regrouper</Label>
            <p className="mt-0.5 text-sm text-muted-foreground">{sort === "delay" ? "Les saisies les plus en retard apparaissent en premier." : `Évaluations regroupées par ${sort === "teacher" ? "professeur" : "classe"}.`}</p>
          </div>
        </div>
        <div className="w-full shrink-0 sm:w-52">
          <Select value={sort} onValueChange={(value: "delay" | "teacher" | "class") => { setSort(value); setPage(1); setOpenId(null) }}>
            <SelectTrigger id="evaluation-sort" className="min-h-12 border-blue-300 bg-background font-semibold text-foreground shadow-sm transition-colors hover:border-blue-500 hover:bg-blue-50 focus:ring-2 focus:ring-primary dark:hover:bg-blue-950/40"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="delay">Retard</SelectItem><SelectItem value="teacher">Professeur</SelectItem><SelectItem value="class">Classe</SelectItem></SelectContent>
          </Select>
        </div>
      </div>
      {result.items.length === 0 ? <EmptyState title="Aucune évaluation" description="Aucune évaluation ne correspond aux filtres sélectionnés." /> :
        <section aria-label="Évaluations" className="space-y-3">{result.items.map((evaluation, index) => {
          const open = openId === evaluation.id
          const entered = evaluation.enteredCount ?? evaluation.notes.filter((note) => note.score !== null).length
          const expected = evaluation.expectedCount ?? evaluation.notes.length
          const status = evaluationStatus(evaluation, result.policy ?? { graceDays: 7, lateDays: 14 }, todayInAbidjan())
          const group = sort === "teacher" ? evaluation.teacher.name : sort === "class" ? evaluation.class.name : null
          const previousGroup = index > 0 ? (sort === "teacher" ? result.items[index - 1]?.teacher.name : result.items[index - 1]?.class.name) : null
          const lastReminder = evaluation.lastReminderAt ? new Date(evaluation.lastReminderAt) : null
          const remindedRecently = lastReminder !== null && renderedAt - lastReminder.getTime() < 24 * 60 * 60 * 1000
          const badgeClass = status.state === "complete" ? "border-green-200 bg-green-50 text-green-700" :
            status.state === "late" ? "border-red-200 bg-red-50 text-red-700" :
            status.state === "expected" ? "border-amber-200 bg-amber-50 text-amber-700" :
            "border-slate-200 bg-slate-50 text-slate-700"
          return <div key={evaluation.id} className="space-y-3">
            {group && group !== previousGroup ? <h3 className="pt-2 text-base font-semibold">{group}</h3> : null}
            <article className="rounded-lg border bg-card p-4 shadow-sm transition-[background-color,border-color,box-shadow] duration-150 hover:border-blue-300 hover:bg-blue-50/40 hover:shadow-md focus-within:border-blue-400 focus-within:shadow-sm dark:hover:bg-blue-950/20 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <Button variant="ghost" className="h-auto min-h-12 min-w-0 flex-1 justify-between gap-3 whitespace-normal px-2 text-left hover:bg-blue-100/70 focus-visible:bg-blue-100/70 dark:hover:bg-blue-900/30 dark:focus-visible:bg-blue-900/30" aria-expanded={open}
              aria-controls={`notes-${evaluation.id}`} onClick={() => setOpenId(open ? null : evaluation.id)}>
              <span className="min-w-0"><span className="block font-semibold">{evaluation.label?.trim() || `${evaluation.subject.name} — ${evaluation.class.name}`}</span>
                <span className="block text-sm font-normal text-muted-foreground">{evaluation.class.name} · {evaluation.teacher.name} · {displayDate(evaluation.date)} · Coefficient {evaluation.coefficient}</span></span>
              <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-primary">
                <span className="hidden md:inline">{open ? "Masquer les notes" : "Voir les notes"}</span>
                {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </span>
            </Button>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={badgeClass}>{status.label}</Badge>
              {status.canRemind ? <Button type="button" variant="outline" className="min-h-12" disabled={remindedRecently || remindMutation.isPending}
                onClick={() => remindMutation.mutate(evaluation.id)}>{remindMutation.isPending && remindMutation.variables === evaluation.id ? "Envoi…" : "Relancer"}</Button> : null}
            </div>
            </div>
            <div className="mt-3 flex items-center gap-3"><Progress value={completionPercent(entered, expected)} aria-label={`Progression des notes de ${evaluation.label}`} aria-valuenow={completionPercent(entered, expected)} aria-valuemin={0} aria-valuemax={100} className="flex-1" />
              <span className="shrink-0 text-sm font-medium tabular-nums">{entered}/{expected} notes</span></div>
            {lastReminder && !Number.isNaN(lastReminder.getTime()) ? <p className="mt-2 text-xs text-muted-foreground">Dernière relance : {lastReminder.toLocaleString("fr-FR", { timeZone: "Africa/Abidjan", dateStyle: "short", timeStyle: "short" })}{remindedRecently ? " · nouvelle relance possible après 24 h" : ""}</p> : null}
            {open ? <div id={`notes-${evaluation.id}`} className="mt-4 border-t pt-3">
              {evaluation.notes.length === 0 ? <EmptyState title="Aucun élève dans cette classe" description="Aucun élève rattaché à cette classe pour l’année sélectionnée." classNameRendu="py-6" /> :
                <div className="divide-y">{evaluation.notes.map((note) => <div key={note.studentId} className="grid gap-1 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-4">
                  <div className="min-w-0"><span className="font-medium">{note.studentName}</span>{note.comment ? <p className="mt-1 text-muted-foreground">{note.comment}</p> : null}</div>
                  <span className="tabular-nums sm:text-right">{note.score === null ? "Note manquante" : `${note.score} / ${note.maxScore}`}</span>
                </div>)}</div>}
            </div> : null}
          </article></div>
        })}</section>}
      <ReviewPagination label="évaluation" plural="évaluations" total={result.total} page={page} pageSize={result.pageSize}
        onPageChange={goToScheduledPage} />
    </> : null}
      </TabsContent>
      <TabsContent value="spontaneous" className="space-y-4">
    {gradingPeriodId ? <section ref={spontaneousSectionRef} aria-label="Notes spontanées" className="space-y-4">
      <div><h2 className="text-xl font-medium">Notes spontanées</h2>
        {spontaneous && !spontaneousQuery.isFetching ? <p className="mt-1 text-sm text-muted-foreground">{spontaneous.totalNotes} ajustement{spontaneous.totalNotes > 1 ? "s" : ""} pour {spontaneous.totalStudents} élève{spontaneous.totalStudents > 1 ? "s" : ""}</p> : null}</div>
      <form role="search" aria-label="Rechercher dans les notes spontanées" className="flex flex-col gap-2 sm:flex-row sm:items-end" onSubmit={(event) => { event.preventDefault(); applyStudentSearch(studentSearchInput) }}>
        <div className="min-w-0 flex-1 space-y-2"><Label htmlFor="spontaneous-student-search">Rechercher un élève</Label>
          <Input id="spontaneous-student-search" value={studentSearchInput} maxLength={80} placeholder="Nom, prénom ou matricule" onChange={(event) => setStudentSearchInput(event.target.value)} />
        </div>
        <div className="flex gap-2"><Button type="submit" className="min-h-10">Rechercher</Button>
          {studentSearch ? <Button type="button" variant="outline" className="min-h-10" onClick={() => { setStudentSearchInput(""); applyStudentSearch("") }}>Effacer</Button> : null}</div>
      </form>
      {spontaneousQuery.isLoading || spontaneousQuery.isFetching ? <div aria-label="Chargement des notes spontanées" className="space-y-3"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div> : null}
      {spontaneous && !spontaneousQuery.isFetching ? <>
      {spontaneous.students.length === 0 ? <EmptyState title={studentSearch ? "Aucun élève trouvé" : "Aucune note spontanée"}
        description={studentSearch ? "Essayez un autre nom ou matricule, ou effacez la recherche." : "Aucun élève n’a reçu de note spontanée pour cette sélection."} /> :
        <div className="divide-y rounded-lg border bg-card">{spontaneous.students.map((student) => {
          const open = openStudentId === student.id
          const noteCount = student.subjects.reduce((count, item) => count + item.notes.length, 0)
          const classes = [...new Set(student.subjects.flatMap((item) => item.notes.map((note) => note.className)))]
          return <article key={student.id} className="transition-colors duration-150 hover:bg-blue-50/70 focus-within:bg-blue-50/70 dark:hover:bg-blue-950/20 dark:focus-within:bg-blue-950/20">
          <h3><Button variant="ghost" className="h-auto min-h-14 w-full justify-between gap-3 rounded-none px-4 py-3 text-left hover:bg-transparent" aria-expanded={open}
            aria-controls={`spontaneous-notes-${student.id}`} onClick={() => setOpenStudentId(open ? null : student.id)}>
            <span className="min-w-0"><span className="block truncate font-semibold">{student.name}</span>
              <span className="block text-xs font-normal text-muted-foreground">{classes.join(", ")}{student.matricule ? ` · ${student.matricule}` : ""} · {noteCount} note{noteCount > 1 ? "s" : ""} · {student.subjects.length} matière{student.subjects.length > 1 ? "s" : ""}</span></span>
            {open ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
          </Button></h3>
          {open ? <div id={`spontaneous-notes-${student.id}`} className="space-y-4 border-t px-4 pb-4 pt-3">{student.subjects.map((subjectItem) => <div key={subjectItem.id}>
            <h4 className="text-sm font-medium">{subjectItem.name}</h4>
            <div className="mt-1 divide-y">{subjectItem.notes.map((note) => <div key={note.evaluationId} className="grid gap-1 py-2 text-sm sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-x-5">
              <span className="font-semibold tabular-nums">{displayAdjustment(note.adjustment)} point{Math.abs(note.adjustment) > 1 ? "s" : ""}</span>
              <div><span>{displayDate(note.date)} · {note.teacher.name}</span><span className="text-muted-foreground"> · {note.className}</span>
                {note.comment ? <p className="mt-1 text-muted-foreground">{note.comment}</p> : null}</div>
            </div>)}</div>
          </div>)}</div> : null}
        </article>})}</div>}
      <ReviewPagination label="élève" plural="élèves" total={spontaneous.totalStudents} page={spontaneousPage} pageSize={spontaneous.pageSize}
        onPageChange={goToSpontaneousPage}
        onPageSizeChange={(size) => { setSpontaneousPageSize(size); goToSpontaneousPage(1) }} />
      </> : null}
    </section> : null}
      </TabsContent>
    </Tabs>
  </PageLayout>
}
