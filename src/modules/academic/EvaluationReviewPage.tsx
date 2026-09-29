import { useEffect, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { ChevronDown, ChevronUp, Info } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { EmptyState } from "@/shared/components/EmptyState"
import { PageLayout } from "@/shared/components/PageLayout"
import { fetchEvaluationReview, fetchReviewOptions, fetchSpontaneousReview, type ReviewOption } from "./evaluation-review.api"

const ALL = "all"
const displayDate = (date: string | null) => date ? new Date(`${date}T00:00:00`).toLocaleDateString("fr-FR") : "Sans date"
const displayAdjustment = (value: number) => new Intl.NumberFormat("fr-FR", { signDisplay: "always", maximumFractionDigits: 3 }).format(value)
function ReviewSelect({ label, value, options, onChange, disabled = false, optional = false, hint }: {
  label: string; value: string; options: ReviewOption[]; onChange: (value: string) => void; disabled?: boolean; optional?: boolean; hint?: string
}) {
  const id = `review-${label.toLowerCase().replace(/\s+/g, "-")}`
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label><Select value={value || (optional ? ALL : "")} onValueChange={(next) => onChange(next === ALL ? "" : next)} disabled={disabled}>
    <SelectTrigger id={id} className="min-h-12 w-full"><SelectValue placeholder={`Choisir ${label.toLowerCase()}`} /></SelectTrigger>
    <SelectContent>{optional ? <SelectItem value={ALL}>Tous</SelectItem> : null}{options.map((option) =>
      <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>)}</SelectContent>
  </Select>{hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}</div>
}

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
  const scheduledSectionRef = useRef<HTMLDivElement>(null)
  const spontaneousSectionRef = useRef<HTMLElement>(null)
  const [year, setYear] = useState("")
  const [period, setPeriod] = useState("")
  const [level, setLevel] = useState("")
  const [classId, setClassId] = useState("")
  const [subject, setSubject] = useState("")
  const [teacher, setTeacher] = useState("")
  const [view, setView] = useState("scheduled")
  const [page, setPage] = useState(1)
  const [spontaneousPage, setSpontaneousPage] = useState(1)
  const [spontaneousPageSize, setSpontaneousPageSize] = useState(20)
  const [openId, setOpenId] = useState<string | null>(null)
  const [openStudentId, setOpenStudentId] = useState<string | null>(null)
  const [studentSearchInput, setStudentSearchInput] = useState("")
  const [studentSearch, setStudentSearch] = useState("")

  const yearsQuery = useQuery({ queryKey: ["evaluation-review", "years"], queryFn: () => fetchReviewOptions({}) })
  const schoolYearId = year || yearsQuery.data?.schoolYears.find((item) => item.active)?.id || yearsQuery.data?.schoolYears[0]?.id || ""
  const calendarQuery = useQuery({ queryKey: ["evaluation-review", "calendar", schoolYearId],
    queryFn: () => fetchReviewOptions({ schoolYearId }), enabled: Boolean(schoolYearId) })
  const availablePeriods = calendarQuery.data?.gradingPeriods ?? []
  const gradingPeriodId = period || availablePeriods.find((item) => !item.isFuture && item.hasEvaluations)?.id
    || availablePeriods.find((item) => item.isCurrent)?.id || availablePeriods.find((item) => !item.isFuture)?.id
    || availablePeriods[availablePeriods.length - 1]?.id || ""
  const optionsQuery = useQuery({ queryKey: ["evaluation-review", "options", schoolYearId, gradingPeriodId, level, classId, subject],
    queryFn: () => fetchReviewOptions({ schoolYearId, gradingPeriodId, levelId: level || undefined,
      classId: classId || undefined, subjectId: subject || undefined }), enabled: Boolean(gradingPeriodId) })
  const options = optionsQuery.data
  const resultQuery = useQuery({
    queryKey: ["evaluation-review", "list", schoolYearId, gradingPeriodId, level, classId, subject, teacher, page],
    queryFn: () => fetchEvaluationReview({ schoolYearId, gradingPeriodId, levelId: level || undefined,
      classId: classId || undefined, subjectId: subject || undefined, teacherId: teacher || undefined, page }),
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
  const resetPage = () => { setPage(1); setSpontaneousPage(1); setOpenId(null); setOpenStudentId(null) }
  const applyStudentSearch = (value: string) => { setStudentSearch(value.trim()); setSpontaneousPage(1); setOpenStudentId(null) }
  const goToScheduledPage = (next: number) => { setPage(next); setOpenId(null); scheduledSectionRef.current?.scrollIntoView?.({ block: "start" }) }
  const goToSpontaneousPage = (next: number) => { setSpontaneousPage(next); setOpenStudentId(null); spontaneousSectionRef.current?.scrollIntoView?.({ block: "start" }) }
  const changeYear = (value: string) => { setYear(value); setPeriod(""); setLevel(""); setClassId(""); setSubject(""); setTeacher(""); resetPage() }
  const changePeriod = (value: string) => { setPeriod(value); setLevel(""); setClassId(""); setSubject(""); setTeacher(""); resetPage() }
  const changeLevel = (value: string) => { setLevel(value); setClassId(""); setSubject(""); setTeacher(""); resetPage() }
  const changeClass = (value: string) => { setClassId(value); setSubject(""); setTeacher(""); resetPage() }
  const changeSubject = (value: string) => { setSubject(value); setTeacher(""); resetPage() }

  return <PageLayout title="Suivi des évaluations et notes" subtitle="Consultez les évaluations saisies et les notes des élèves." contentClassName="max-w-6xl">
    <Alert variant="info" role="note"><Info className="h-4 w-4" /><AlertDescription>Utilisez les filtres pour obtenir des résultats plus précis : choisissez une période, puis affinez par niveau, classe, matière et professeur. Les périodes à venir sont aussi disponibles.</AlertDescription></Alert>
    <section aria-label="Filtres" className="grid gap-4 rounded-lg border bg-card p-4 sm:grid-cols-2 lg:grid-cols-3">
      <ReviewSelect label="Année scolaire" value={schoolYearId} options={yearsQuery.data?.schoolYears ?? []} onChange={changeYear} disabled={yearsQuery.isLoading} />
      <ReviewSelect label="Période" value={gradingPeriodId}
        options={availablePeriods.map((item) => ({ id: item.id, label: item.isFuture ? `${item.label} (à venir)` : item.label }))}
        onChange={changePeriod} disabled={!availablePeriods.length || calendarQuery.isFetching} />
      <ReviewSelect label="Niveau" value={level} options={options?.levels ?? []} onChange={changeLevel}
        disabled={!options?.levels.length || optionsQuery.isFetching}
        hint={options && options.levels.length === 0 ? "Aucun niveau pour cette année." : undefined} optional />
      <ReviewSelect label="Classe" value={classId} options={options?.classes ?? []} onChange={changeClass}
        disabled={!level || !options?.classes.length || optionsQuery.isFetching}
        hint={!level ? "Choisissez un niveau." : options && options.classes.length === 0 ? "Aucune classe pour ce niveau." : undefined} optional />
      <ReviewSelect label="Matière" value={subject} options={options?.subjects ?? []} onChange={changeSubject}
        disabled={!classId || !options?.subjects.length || optionsQuery.isFetching}
        hint={!classId ? "Choisissez une classe." : options && options.subjects.length === 0 ? "Aucune matière pour cette classe." : undefined} optional />
      <ReviewSelect label="Professeur" value={teacher} options={options?.teachers ?? []} onChange={(value) => { setTeacher(value); resetPage() }}
        disabled={!subject || !options?.teachers.length || optionsQuery.isFetching}
        hint={!subject ? "Choisissez une matière." : options && options.teachers.length === 0 ? "Aucun professeur pour cette matière." : undefined} optional />
    </section>
    {yearsQuery.isError || calendarQuery.isError || optionsQuery.isError || (view === "scheduled" ? resultQuery.isError : spontaneousQuery.isError) ? <Alert variant="destructive"><AlertDescription>Impossible de charger les évaluations. Réessayez dans un instant.</AlertDescription></Alert> : null}
    {!schoolYearId && !yearsQuery.isLoading ? <EmptyState title="Aucune année scolaire" description="Créez une année scolaire pour consulter les évaluations." /> : null}
    {schoolYearId && !gradingPeriodId && !calendarQuery.isLoading ? <EmptyState title="Aucune période configurée" description="Configurez une période pour cette année scolaire." /> : null}
    <Tabs value={view} onValueChange={setView} className="space-y-4">
      <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto sm:w-auto">
        <TabsTrigger value="scheduled" className="min-h-10 whitespace-nowrap">Évaluations programmées</TabsTrigger>
        <TabsTrigger value="spontaneous" className="min-h-10 whitespace-nowrap">Notes spontanées</TabsTrigger>
      </TabsList>
      <TabsContent ref={scheduledSectionRef} value="scheduled" className="space-y-4">
    {yearsQuery.isLoading || calendarQuery.isLoading || optionsQuery.isLoading || resultQuery.isLoading || resultQuery.isFetching ? <div aria-label="Chargement des évaluations" className="space-y-3"><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /></div> : null}
    {result && !resultQuery.isFetching ? <>
      <h2 className="text-xl font-medium">Évaluations programmées</h2>
      <section aria-label="Synthèse" className="flex flex-wrap gap-x-6 gap-y-2 border-b pb-4 text-sm">
        <span><strong className="text-lg">{result.summary.evaluations}</strong> évaluations programmées</span>
        <span><strong className="text-lg">{result.summary.grades}</strong> notes saisies</span>
        <span><strong className="text-lg">{result.summary.missing}</strong> notes manquantes</span>
      </section>
      {result.items.length === 0 ? <EmptyState title="Aucune évaluation" description="Aucune évaluation ne correspond aux filtres sélectionnés." /> :
        <section aria-label="Évaluations" className="divide-y rounded-lg border bg-card">{result.items.map((evaluation) => {
          const open = openId === evaluation.id
          const entered = evaluation.notes.filter((note) => note.score !== null).length
          return <article key={evaluation.id} className="p-4">
            <Button variant="ghost" className="h-auto min-h-12 w-full justify-between gap-3 whitespace-normal text-left" aria-expanded={open}
              aria-controls={`notes-${evaluation.id}`} onClick={() => setOpenId(open ? null : evaluation.id)}>
              <span className="min-w-0"><span className="block font-semibold">{evaluation.label}</span>
                <span className="block text-sm font-normal text-muted-foreground">{evaluation.class.name} · {evaluation.subject.name} · {evaluation.teacher.name}</span></span>
              {open ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
            </Button>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span>{displayDate(evaluation.date)}</span>
              <span>Coefficient {evaluation.coefficient}</span>
              <Badge variant="secondary">{entered}/{evaluation.notes.length} notes</Badge>
            </div>
            {open ? <div id={`notes-${evaluation.id}`} className="mt-4 border-t pt-3">
              {evaluation.notes.length === 0 ? <EmptyState title="Aucun élève dans cette classe" description="Aucun élève rattaché à cette classe pour l’année sélectionnée." classNameRendu="py-6" /> :
                <div className="divide-y">{evaluation.notes.map((note) => <div key={note.studentId} className="grid gap-1 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-4">
                  <div className="min-w-0"><span className="font-medium">{note.studentName}</span>{note.comment ? <p className="mt-1 text-muted-foreground">{note.comment}</p> : null}</div>
                  <span className="tabular-nums sm:text-right">{note.score === null ? "Note manquante" : `${note.score} / ${note.maxScore}`}</span>
                </div>)}</div>}
            </div> : null}
          </article>
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
          return <article key={student.id}>
          <h3><Button variant="ghost" className="h-auto min-h-14 w-full justify-between gap-3 rounded-none px-4 py-3 text-left" aria-expanded={open}
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
