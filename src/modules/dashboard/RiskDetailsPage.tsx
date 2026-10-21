import { useEffect, useMemo, useState, type ReactNode } from "react"
import { useQuery } from "@tanstack/react-query"
import { AlertTriangle, ChevronLeft, ChevronRight, GraduationCap, UsersRound } from "lucide-react"
import { Link, useSearchParams } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { listClasses, listLevels } from "@/modules/academic/academic.api"
import { listStudentRisks, listTeacherRisks, type RiskLevel, type RiskPagination, type StudentRiskCategory } from "@/modules/dashboard/dashboard.api"
import { EmptyState } from "@/shared/components/EmptyState"
import { QueryErrorState } from "@/shared/components/QueryErrorState"
import { usePermissions } from "@/shared/hooks/usePermissions"

const PAGE_SIZE = 10
const currentMonth = () => new Date().toISOString().slice(0, 7)
const levelLabel: Record<RiskLevel, string> = { none: "Aucun signal", attention: "À suivre", warning: "Vigilance", critical: "Prioritaire" }
const levelClass: Record<RiskLevel, string> = { none: "border-border bg-muted text-foreground", attention: "border-blue-200 bg-blue-50 text-blue-800", warning: "border-amber-200 bg-amber-50 text-amber-800", critical: "border-red-200 bg-red-50 text-red-700" }
const categoryLabel: Record<StudentRiskCategory, string> = { absences: "Absences", grades: "Baisse de moyenne", payments: "Paiement" }

type Tab = "students" | "teachers"
type RiskFilterLevel = Exclude<RiskLevel, "none">

export default function RiskDetailsPage() {
  const { hasPermission } = usePermissions()
  const [searchParams] = useSearchParams()
  const canViewTeachers = hasPermission("teachers.view") || hasPermission("attendance.view")
  const canViewStudents = hasPermission("students.view") || hasPermission("attendance.view")
  const schoolYearId = searchParams.get("schoolYearId") || undefined
  const gradingPeriodId = searchParams.get("gradingPeriodId") || undefined
  const openTeachers = canViewTeachers && (searchParams.get("tab") === "teachers" || !canViewStudents)
  const [tab, setTab] = useState<Tab>(openTeachers ? "teachers" : "students")
  const [studentPage, setStudentPage] = useState(1)
  const [teacherPage, setTeacherPage] = useState(1)
  const [schoolLevelId, setSchoolLevelId] = useState("all")
  const [classId, setClassId] = useState("all")
  const [category, setCategory] = useState<StudentRiskCategory | "all">("all")
  const [riskLevel, setRiskLevel] = useState<RiskFilterLevel | "all">("all")
  const [teacherMonth, setTeacherMonth] = useState(() => openTeachers ? "" : currentMonth())
  const canViewPayments = hasPermission("payments.view")

  const levelsQuery = useQuery({ queryKey: ["academic", "levels"], queryFn: listLevels, enabled: canViewStudents })
  const classesQuery = useQuery({ queryKey: ["academic", "classes", "risk-filters"], queryFn: () => listClasses(), enabled: canViewStudents })
  const availableClasses = useMemo(() => (classesQuery.data?.classes ?? []).filter((schoolClass) => schoolLevelId === "all" || schoolClass.level.id === schoolLevelId), [classesQuery.data?.classes, schoolLevelId])
  const studentFilters = { schoolYearId, gradingPeriodId, schoolLevelId: schoolLevelId === "all" ? undefined : schoolLevelId, classId: classId === "all" ? undefined : classId, category: category === "all" ? undefined : category, riskLevel: riskLevel === "all" ? undefined : riskLevel }
  const studentsQuery = useQuery({ queryKey: ["risks", "students", studentFilters, studentPage], queryFn: () => listStudentRisks({ ...studentFilters, atRisk: true, page: studentPage, limit: PAGE_SIZE }), enabled: canViewStudents, staleTime: 3 * 60_000 })
  const teachersQuery = useQuery({ queryKey: ["risks", "teachers", teacherMonth, teacherPage], queryFn: () => listTeacherRisks({ month: teacherMonth || undefined, atRisk: true, page: teacherPage, limit: PAGE_SIZE }), enabled: canViewTeachers, staleTime: 3 * 60_000 })

  useEffect(() => { setStudentPage(1) }, [schoolLevelId, classId, category, riskLevel])
  useEffect(() => { if (classId !== "all" && !availableClasses.some((schoolClass) => schoolClass.id === classId)) setClassId("all") }, [availableClasses, classId])
  useEffect(() => { setTeacherPage(1) }, [teacherMonth])

  return <div className="route-surface space-y-5 py-5 sm:py-6">
    <header className="border-b pb-5"><h1 className="text-2xl font-semibold tracking-tight">Élèves et professeurs à suivre</h1><p className="mt-1 text-sm text-muted-foreground">Consultez les signaux d’alerte et ouvrez la fiche concernée pour agir.</p></header>
    <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)}>
      <TabsList className="h-auto min-h-12 w-full sm:w-auto">{canViewStudents ? <TabsTrigger value="students" className="min-h-12 flex-1 sm:min-w-40">Élèves</TabsTrigger> : null}{canViewTeachers ? <TabsTrigger value="teachers" className="min-h-12 flex-1 sm:min-w-40">Professeurs</TabsTrigger> : null}</TabsList>
      <TabsContent value="students" className="mt-5 space-y-5">
        <StudentFilters schoolLevelId={schoolLevelId} classId={classId} category={category} riskLevel={riskLevel} onSchoolLevelChange={setSchoolLevelId} onClassChange={setClassId} onCategoryChange={(value) => setCategory(value as StudentRiskCategory | "all")} onRiskLevelChange={(value) => setRiskLevel(value as RiskFilterLevel | "all")} levels={(levelsQuery.data ?? []).map((level) => ({ id: level.id, name: level.name }))} classes={availableClasses.map((schoolClass) => ({ id: schoolClass.id, name: schoolClass.name }))} canViewPayments={canViewPayments} />
        <RiskCard title="Élèves à suivre" description="Les baisses de moyenne sont comparées à la période précédente et ne sont retenues que si les deux périodes sont clôturées." icon={<GraduationCap className="h-5 w-5" />}>
          {studentsQuery.isLoading ? <TableSkeleton /> : null}
          {studentsQuery.isError ? <QueryErrorState message="Impossible de charger les élèves à suivre." onRetry={() => void studentsQuery.refetch()} /> : null}
          {studentsQuery.data && studentsQuery.data.students.length === 0 ? <EmptyState icon={AlertTriangle} title="Aucun élève à suivre" message="Aucun élève ne correspond aux filtres sélectionnés." /> : null}
          {studentsQuery.data && studentsQuery.data.students.length > 0 ? <><div className="overflow-x-auto rounded-lg border"><Table><TableHeader><TableRow><TableHead>Élève</TableHead><TableHead>Niveau</TableHead><TableHead>Classe</TableHead><TableHead>Catégories</TableHead><TableHead>Priorité</TableHead></TableRow></TableHeader><TableBody>{studentsQuery.data.students.map((student) => <TableRow key={student.studentId}><TableCell><Link to={`/students/${student.studentId}?returnTo=${encodeURIComponent("/dashboard/risks")}`} className="inline-flex min-h-12 items-center font-medium text-primary underline-offset-4 hover:underline">{student.studentName}</Link></TableCell><TableCell>{student.schoolLevelName ?? "Non renseigné"}</TableCell><TableCell>{student.className ?? "Non renseignée"}</TableCell><TableCell><div className="flex min-w-44 flex-wrap gap-1">{student.absencesSignal ? <SignalBadge label={categoryLabel.absences} /> : null}{student.gradesSignal ? <SignalBadge label={categoryLabel.grades} /> : null}{student.paymentSignal ? <SignalBadge label={categoryLabel.payments} /> : null}</div></TableCell><TableCell><Badge variant="outline" className={levelClass[student.level]}>{levelLabel[student.level]}</Badge></TableCell></TableRow>)}</TableBody></Table></div><Pagination pagination={studentsQuery.data.pagination} label="élève" isFetching={studentsQuery.isFetching} onPrevious={() => setStudentPage((page) => Math.max(1, page - 1))} onNext={() => setStudentPage((page) => Math.min(studentsQuery.data!.pagination.totalPages, page + 1))} /></> : null}
        </RiskCard>
      </TabsContent>
      {canViewTeachers ? <TabsContent value="teachers" className="mt-5 space-y-5">
        <div className="max-w-xs space-y-2"><Label htmlFor="teacher-risk-month">Mois</Label><Input id="teacher-risk-month" type="month" className="min-h-12" value={teacherMonth} onChange={(event) => setTeacherMonth(event.target.value)} /></div>
        <RiskCard title="Professeurs à suivre" description={teacherMonth ? "Les absences et retards sont comptés sur le mois sélectionné et comparés aux seuils configurés." : "Les absences suivent leur fenêtre configurée et les retards les 30 derniers jours, comme pour l’action du tableau de bord. Sélectionnez un mois pour consulter une autre période."} icon={<UsersRound className="h-5 w-5" />}>
          {teachersQuery.isLoading ? <TableSkeleton /> : null}
          {teachersQuery.isError ? <QueryErrorState message="Impossible de charger les professeurs à suivre." onRetry={() => void teachersQuery.refetch()} /> : null}
          {teachersQuery.data && teachersQuery.data.teachers.length === 0 ? <EmptyState icon={UsersRound} title="Aucun professeur à suivre" message="Aucun signal d’absence ou de retard ne correspond à la période sélectionnée." /> : null}
          {teachersQuery.data && teachersQuery.data.teachers.length > 0 ? <><div className="overflow-x-auto rounded-lg border"><Table><TableHeader><TableRow><TableHead>Professeur</TableHead><TableHead>Mois</TableHead><TableHead className="text-right">Absences répétées</TableHead><TableHead className="text-right">Retards</TableHead><TableHead>Motif</TableHead><TableHead>Priorité</TableHead></TableRow></TableHeader><TableBody>{teachersQuery.data.teachers.map((teacher) => <TableRow key={teacher.teacherId}><TableCell><Link to={`/teachers/${teacher.teacherId}?returnTo=${encodeURIComponent("/dashboard/risks")}`} className="inline-flex min-h-12 items-center font-medium text-primary underline-offset-4 hover:underline">{teacher.teacherName}</Link></TableCell><TableCell>{formatMonth(teacherMonth)}</TableCell><TableCell className="text-right font-semibold tabular-nums">{teacher.absenceCount}</TableCell><TableCell className="text-right font-semibold tabular-nums">{teacher.latenessCount}</TableCell><TableCell><div className="flex flex-wrap gap-1">{teacher.absencesSignal ? <SignalBadge label="Absences" /> : null}{teacher.latenessSignal ? <SignalBadge label="Retards" /> : null}</div></TableCell><TableCell><Badge variant="outline" className={levelClass[teacher.level]}>{levelLabel[teacher.level]}</Badge></TableCell></TableRow>)}</TableBody></Table></div><Pagination pagination={teachersQuery.data.pagination} label="professeur" isFetching={teachersQuery.isFetching} onPrevious={() => setTeacherPage((page) => Math.max(1, page - 1))} onNext={() => setTeacherPage((page) => Math.min(teachersQuery.data!.pagination.totalPages, page + 1))} /></> : null}
        </RiskCard>
      </TabsContent> : null}
    </Tabs>
  </div>
}

function StudentFilters({ schoolLevelId, classId, category, riskLevel, onSchoolLevelChange, onClassChange, onCategoryChange, onRiskLevelChange, levels, classes, canViewPayments }: { schoolLevelId: string; classId: string; category: StudentRiskCategory | "all"; riskLevel: RiskFilterLevel | "all"; onSchoolLevelChange: (value: string) => void; onClassChange: (value: string) => void; onCategoryChange: (value: string) => void; onRiskLevelChange: (value: string) => void; levels: Array<{ id: string; name: string }>; classes: Array<{ id: string; name: string }>; canViewPayments: boolean }) {
  const categories = canViewPayments ? (Object.entries(categoryLabel) as Array<[StudentRiskCategory, string]>) : (Object.entries(categoryLabel).filter(([value]) => value !== "payments") as Array<[StudentRiskCategory, string]>)
  return <div className="grid gap-4 rounded-lg border bg-muted/20 p-4 sm:grid-cols-2 xl:grid-cols-4"><FilterSelect label="Niveau" value={schoolLevelId} onValueChange={onSchoolLevelChange} allLabel="Tous les niveaux" items={levels.map((level) => ({ value: level.id, label: level.name }))} /><FilterSelect label="Classe" value={classId} onValueChange={onClassChange} allLabel="Toutes les classes" items={classes.map((schoolClass) => ({ value: schoolClass.id, label: schoolClass.name }))} /><FilterSelect label="Catégorie de risque" value={category} onValueChange={onCategoryChange} allLabel="Toutes les catégories" items={categories.map(([value, label]) => ({ value, label }))} /><FilterSelect label="Priorité" value={riskLevel} onValueChange={onRiskLevelChange} allLabel="Tous les niveaux de priorité" items={(Object.entries(levelLabel).filter(([value]) => value !== "none") as Array<[RiskLevel, string]>).map(([value, label]) => ({ value, label }))} /></div>
}

function FilterSelect({ label, value, onValueChange, allLabel, items }: { label: string; value: string; onValueChange: (value: string) => void; allLabel: string; items: Array<{ value: string; label: string }> }) { return <div className="space-y-2"><Label>{label}</Label><Select value={value} onValueChange={onValueChange}><SelectTrigger className="min-h-12"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{allLabel}</SelectItem>{items.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div> }
function RiskCard({ title, description, icon, children }: { title: string; description: string; icon: ReactNode; children: ReactNode }) { return <Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg">{icon}{title}</CardTitle><CardDescription>{description}</CardDescription></CardHeader><CardContent>{children}</CardContent></Card> }
function SignalBadge({ label }: { label: string }) { return <Badge variant="outline">{label}</Badge> }
function TableSkeleton() { return <div className="space-y-2">{Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-12 w-full" />)}</div> }
function Pagination({ pagination, label, isFetching, onPrevious, onNext }: { pagination: RiskPagination; label: string; isFetching: boolean; onPrevious: () => void; onNext: () => void }) { const pageStart = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1; const pageEnd = Math.min(pagination.page * pagination.limit, pagination.total); return <div className="mt-4 flex flex-col gap-3 border-t pt-4 text-sm sm:flex-row sm:items-center sm:justify-between"><p className="text-muted-foreground">{pageStart}–{pageEnd} sur {pagination.total} {label}{pagination.total > 1 ? "s" : ""}</p><div className="flex items-center gap-2"><Button type="button" variant="outline" size="sm" className="min-h-12" disabled={pagination.page === 1 || isFetching} onClick={onPrevious}><ChevronLeft className="mr-1 h-4 w-4" />Précédent</Button><span className="min-w-20 text-center tabular-nums" aria-live="polite">Page {pagination.page} / {pagination.totalPages}</span><Button type="button" variant="outline" size="sm" className="min-h-12" disabled={pagination.page === pagination.totalPages || isFetching} onClick={onNext}>Suivant<ChevronRight className="ml-1 h-4 w-4" /></Button></div></div> }
function formatMonth(value: string): string { if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return "Fenêtre en cours"; return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(new Date(`${value}-01T00:00:00`)) }
