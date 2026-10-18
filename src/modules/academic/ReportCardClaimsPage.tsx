import { useEffect, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link, useSearchParams } from "react-router-dom"
import { ArrowLeft, Loader2, Plus, Search } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import { cn } from "@/lib/utils"
import { AcademicContextFilters } from "@/shared/components/AcademicContextFilters"
import { DependentSelect } from "@/shared/components/DependentSelect"
import { EmptyState } from "@/shared/components/EmptyState"
import { FilterBar } from "@/shared/components/FilterBar"
import { PageLayout } from "@/shared/components/PageLayout"
import { ResetFiltersButton } from "@/shared/components/ResetFiltersButton"
import { usePermissions } from "@/shared/hooks/usePermissions"
import { currentAcademicPeriodId } from "@/shared/lib/academic-context"
import { invalidateAcademicReportScope } from "./academic-report-cache"
import {
  createReportCardClaim, decideReportCardClaim, listClasses, listReportCardClasses, listGradingPeriods, listGradingPeriodsForYear,
  listReportCardClaims, listReportCardClaimStudents, listReportCardVersions, listReportCardAcademicAudit, listSchoolYears, listSubjects,
  type ReportCardClaim, type ReportCardClaimStatus,
} from "./academic.api"

const LABELS: Record<ReportCardClaimStatus, string> = {
  open: "Ouverte",
  pending_exceptional_authorization: "Autorisation exceptionnelle requise",
  approved: "Correction ouverte",
  refused: "Refusée",
  corrected: "Matière revalidée",
  regenerated: "Bulletins régénérés",
  republished: "Nouvelle version publiée",
}
const STATUSES = Object.keys(LABELS) as ReportCardClaimStatus[]
const CLAIM_RULE = "Sélectionnez une classe, une période et une matière dont les moyennes sont validées."
const optional = (value: string) => value || undefined

function ClaimDetail({ claim, periodLabel, canDecide, canCorrectPublished, onDecide, pending }: {
  claim: ReportCardClaim
  periodLabel: string
  canDecide: boolean
  canCorrectPublished: boolean
  onDecide: (id: string, decision: "approved" | "refused", reason: string) => void
  pending: boolean
}) {
  const [decisionReason, setDecisionReason] = useState("")
  const actionable = claim.status === "open" || claim.status === "pending_exceptional_authorization"
  const canApprove = canDecide && (claim.phase !== "published" || canCorrectPublished)
  return <div className="space-y-5 text-sm">
    <div className="space-y-2">
      <p><span className="font-medium">Cible :</span> {claim.student_name || "Toute la classe"} · {claim.class_name}</p>
      <p><span className="font-medium">Matière :</span> {claim.subject_name}</p>
      <p><span className="font-medium">Période :</span> {periodLabel}</p>
      <p><span className="font-medium">Date :</span> {new Date(claim.created_at).toLocaleDateString("fr-FR")}</p>
      <Badge variant="outline">{LABELS[claim.status]}</Badge>
    </div>
    <div className="space-y-2"><h3 className="font-semibold">Motif détaillé</h3><p className="whitespace-pre-wrap break-words">{claim.reason}</p></div>
    {claim.phase === "published" ? <Alert><AlertDescription>
      Une approbation retirera tous les bulletins publiés de cette classe et de cette période du portail parent. Une nouvelle version devra ensuite être régénérée et republiée.
    </AlertDescription></Alert> : null}
    {claim.phase === "generated" ? <p className="text-muted-foreground">Une approbation invalidera tous les bulletins générés de cette classe et de cette période.</p> : null}
    {claim.decision_reason ? <p className="text-muted-foreground">Décision : {claim.decision_reason}</p> : null}
    {actionable && canDecide ? <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
      <div className="space-y-2"><Label htmlFor={`decision-${claim.id}`}>Motif de la décision</Label>
        <Textarea id={`decision-${claim.id}`} value={decisionReason} onChange={(event) => setDecisionReason(event.target.value)} maxLength={4000} rows={4} />
        <p className="text-xs text-muted-foreground">Au moins 10 caractères, 4 000 maximum.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button className="min-h-12" disabled={!canApprove || decisionReason.trim().length < 10 || pending}
          onClick={() => onDecide(claim.id, "approved", decisionReason.trim())}>
          {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Approuver et ouvrir la correction
        </Button>
        <Button variant="outline" className="min-h-12" disabled={decisionReason.trim().length < 10 || pending}
          onClick={() => onDecide(claim.id, "refused", decisionReason.trim())}>Refuser</Button>
      </div>
      {!canApprove && claim.phase === "published" ? <p className="text-muted-foreground">Le droit « Autoriser une correction exceptionnelle après publication » est requis pour approuver cette réclamation.</p> : null}
    </div> : null}
  </div>
}

export default function ReportCardClaimsPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { hasPermission } = usePermissions()
  const [params] = useSearchParams()
  const [yearChoice, setYearChoice] = useState(params.get("schoolYearId") ?? "")
  const [periodChoice, setPeriodChoice] = useState(params.get("gradingPeriodId") ?? "")
  const [classId, setClassId] = useState(params.get("classId") ?? "")
  const [subjectId, setSubjectId] = useState(params.get("subjectId") ?? "")
  const [studentSearch, setStudentSearch] = useState("")
  const [status, setStatus] = useState<ReportCardClaimStatus | "">("")
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedClaim, setSelectedClaim] = useState<ReportCardClaim | null>(null)
  const [formClassId, setFormClassId] = useState("")
  const [formPeriodId, setFormPeriodId] = useState("")
  const [formSubjectId, setFormSubjectId] = useState("")
  const [formStudentId, setFormStudentId] = useState("")
  const [target, setTarget] = useState<"student" | "class">("class")
  const [reason, setReason] = useState("")
  const [createAttempted, setCreateAttempted] = useState(false)
  const errorSummaryRef = useRef<HTMLDivElement>(null)

  const yearsQuery = useQuery({ queryKey: ["academic", "school-years"], queryFn: listSchoolYears })
  const activeYear = yearsQuery.data?.find((year) => year.status === "active")
  const schoolYearId = yearChoice === "all" ? "" : yearChoice || activeYear?.id || ""
  const periodsQuery = useQuery({ queryKey: ["academic", "grading-periods", schoolYearId],
    queryFn: () => schoolYearId ? listGradingPeriodsForYear(schoolYearId) : listGradingPeriods(), enabled: yearsQuery.isSuccess })
  const classesQuery = useQuery({ queryKey: ["report-cards", "claim-classes", schoolYearId],
    queryFn: async () => schoolYearId
      ? (await listReportCardClasses(schoolYearId)).map((item) => ({ ...item, schoolYearId }))
      : (await listClasses()).classes.map((item) => ({ ...item, schoolYearId: item.schoolYear.id })),
    enabled: yearsQuery.isSuccess })
  const visiblePeriods = periodsQuery.data?.filter((item) => !schoolYearId || item.schoolYearId === schoolYearId) ?? []
  const gradingPeriodId = !schoolYearId || periodChoice === "all" ? "" :
    visiblePeriods.some((item) => item.id === periodChoice) ? periodChoice : currentAcademicPeriodId(visiblePeriods)
  const subjectsQuery = useQuery({ queryKey: ["academic", "claim-subjects"], queryFn: () => listSubjects() })
  const formClass = classesQuery.data?.find((item) => item.id === formClassId)
  const formPeriods = visiblePeriods.filter((item) => item.schoolYearId === formClass?.schoolYearId)
  const formSubjects = subjectsQuery.data?.filter((item) => item.levelId === formClass?.level.id) ?? []
  const studentsQuery = useQuery({ queryKey: ["report-card-claim-students", formClassId],
    queryFn: () => listReportCardClaimStudents(formClassId), enabled: createOpen && Boolean(formClassId) })
  const filters = { schoolYearId: optional(schoolYearId), gradingPeriodId: optional(gradingPeriodId),
    classId: optional(classId), subjectId: optional(subjectId) }
  const claimsQuery = useQuery({ queryKey: ["report-card-claims", filters], queryFn: () => listReportCardClaims(filters),
    enabled: yearsQuery.isSuccess && periodsQuery.isSuccess })
  const versionsQuery = useQuery({ queryKey: ["report-card-versions", classId, gradingPeriodId],
    queryFn: () => listReportCardVersions(classId, gradingPeriodId),
    enabled: Boolean(classId && gradingPeriodId && hasPermission("report_cards.published_correction")) })
  const auditQuery = useQuery({ queryKey: ["report-card-academic-audit", classId, gradingPeriodId],
    queryFn: () => listReportCardAcademicAudit(classId, gradingPeriodId),
    enabled: Boolean(classId && gradingPeriodId && hasPermission("report_cards.published_correction")) })

  const filterClass = classesQuery.data?.find((item) => item.id === classId)
  const visibleSubjects = subjectsQuery.data?.filter((item) => !filterClass || item.levelId === filterClass.level.id) ?? []
  const searchTerm = studentSearch.trim().toLocaleLowerCase("fr")
  const searchedClaims = (claimsQuery.data ?? []).filter((claim) => !searchTerm || claim.student_name?.toLocaleLowerCase("fr").includes(searchTerm))
  const visibleClaims = searchedClaims.filter((claim) => !status || claim.status === status)
  const periodLabel = (id: string) => periodsQuery.data?.find((period) => period.id === id)?.label ?? "Période indisponible"
  const createErrors = {
    classId: !formClassId || !formClass,
    periodId: !formPeriodId || !formPeriods.some((item) => item.id === formPeriodId),
    subjectId: !formSubjectId || !formSubjects.some((item) => item.id === formSubjectId),
    studentId: target === "student" && !formStudentId,
    reason: reason.trim().length < 10,
    year: formClass ? yearsQuery.data?.find((item) => item.id === formClass.schoolYearId)?.status !== "active" : false,
  }
  useEffect(() => {
    if (createAttempted) errorSummaryRef.current?.focus()
  }, [createAttempted])

  const openCreate = () => {
    setFormClassId(classId)
    setFormPeriodId(gradingPeriodId)
    setFormSubjectId(subjectId)
    setFormStudentId("")
    setTarget("class")
    setReason("")
    setCreateAttempted(false)
    setCreateOpen(true)
  }
  const invalidate = async (claimClassId: string, claimPeriodId: string) => {
    await invalidateAcademicReportScope(queryClient, claimClassId, claimPeriodId)
  }
  const createMutation = useMutation({
    mutationFn: () => createReportCardClaim({ classId: formClassId, studentId: target === "student" ? formStudentId : undefined,
      subjectId: formSubjectId, gradingPeriodId: formPeriodId, reason: reason.trim() }),
    onSuccess: async () => { setCreateOpen(false); await invalidate(formClassId, formPeriodId); toast({ title: "Réclamation ouverte" }) },
    onError: (error) => toast({ title: "Réclamation impossible", description: error instanceof Error ? error.message : undefined, variant: "destructive" }),
  })
  const decisionMutation = useMutation({
    mutationFn: (input: { id: string; decision: "approved" | "refused"; reason: string }) =>
      decideReportCardClaim(input.id, { decision: input.decision, reason: input.reason }),
    onSuccess: async () => { if (selectedClaim) await invalidate(selectedClaim.class_id, selectedClaim.grading_period_id)
      setSelectedClaim(null); toast({ title: "Décision enregistrée" }) },
    onError: (error) => toast({ title: "Décision impossible", description: error instanceof Error ? error.message : undefined, variant: "destructive" }),
  })

  return <PageLayout title="Réclamations de bulletins" subtitle="Suivez les corrections et leurs nouvelles versions par classe et période."
    actions={<><Button asChild variant="outline" className="min-h-12"><Link to="/academic/report-cards"><ArrowLeft className="mr-2 h-4 w-4" />Retour aux bulletins</Link></Button>
      <Button className="min-h-12" onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Nouvelle réclamation</Button></>}>

    <div className="flex flex-nowrap gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label="Filtrer par statut">
      <Button variant={!status ? "default" : "outline"} className="min-h-10 shrink-0 whitespace-nowrap rounded-md px-3 text-xs" aria-pressed={!status} onClick={() => setStatus("")}>Toutes · {searchedClaims.length}</Button>
      {STATUSES.map((key) => <Button key={key} variant={status === key ? "default" : "outline"} className="min-h-10 shrink-0 whitespace-nowrap rounded-md px-3 text-xs"
        aria-pressed={status === key} onClick={() => setStatus(key)}>{LABELS[key]} · {searchedClaims.filter((claim) => claim.status === key).length}</Button>)}
    </div>

    <section aria-label="Filtres des réclamations" className="space-y-4 rounded-lg border bg-card p-4">
      <AcademicContextFilters yearIdPrefix="claims" years={yearsQuery.data ?? []} yearId={schoolYearId}
        activeYear={activeYear} showPeriod allowAllYears allowAllPeriods periods={visiblePeriods} periodId={gradingPeriodId}
        yearDisabled={yearsQuery.isLoading} periodDisabled={periodsQuery.isFetching || !visiblePeriods.length || !schoolYearId}
        onYearChange={(value) => { setYearChoice(value || "all"); setPeriodChoice(""); setClassId(""); setSubjectId("") }}
        onPeriodChange={(value) => { setPeriodChoice(value || "all"); setClassId(""); setSubjectId("") }} />
      <FilterBar>
        <DependentSelect id="claim-class" label="Classe" value={classId} options={(classesQuery.data ?? []).map((item) => ({ id: item.id, label: item.name }))}
          dependsOn={{ field: "year", value: schoolYearId || "all" }} allLabel="Toutes les classes"
          onValueChange={(value) => { setClassId(value); setSubjectId("") }} />
        <DependentSelect id="claim-subject" label="Matière" value={subjectId}
          options={visibleSubjects.map((item) => ({ id: item.id, label: item.name }))}
          dependsOn={{ field: "class", value: classId }} allLabel="Toutes les matières" onValueChange={setSubjectId} />
        <div className="space-y-2"><Label htmlFor="claim-student-search">Rechercher un élève</Label>
          <div className="relative"><Search className="pointer-events-none absolute left-3 top-4 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <Input id="claim-student-search" className="min-h-12 pl-10" value={studentSearch} onChange={(event) => setStudentSearch(event.target.value)} placeholder="Nom de l’élève" /></div>
        </div>
      </FilterBar>
      <ResetFiltersButton active={Boolean(yearChoice || periodChoice || classId || subjectId || studentSearch || status)}
        onReset={() => { setYearChoice(""); setPeriodChoice(""); setClassId(""); setSubjectId(""); setStudentSearch(""); setStatus("") }} />
    </section>

    <section aria-labelledby="claim-list-title" className="rounded-lg border bg-card">
      <div className="border-b p-4"><h2 id="claim-list-title" className="text-lg font-semibold">Suivi des réclamations</h2></div>
      {claimsQuery.isPending ? <p className="flex items-center gap-2 p-4 text-sm"><Loader2 className="h-4 w-4 animate-spin" />Chargement…</p>
        : claimsQuery.isError ? <Alert variant="destructive" className="m-4 w-auto"><AlertDescription>Impossible de charger les réclamations. <Button variant="outline" className="min-h-12" onClick={() => void claimsQuery.refetch()}>Réessayer</Button></AlertDescription></Alert>
          : visibleClaims.length ? <Table><TableHeader><TableRow>
            <TableHead>Cible</TableHead><TableHead>Matière</TableHead><TableHead>Période</TableHead><TableHead>Motif</TableHead><TableHead>Statut</TableHead><TableHead>Date</TableHead>
          </TableRow></TableHeader><TableBody>{visibleClaims.map((claim) => <TableRow key={claim.id} className="cursor-pointer focus-within:bg-muted/50" onClick={() => setSelectedClaim(claim)}>
            <TableCell><Button variant="link" className="h-auto min-h-12 justify-start p-0 text-left font-medium" onClick={(event) => { event.stopPropagation(); setSelectedClaim(claim) }} aria-label={`Voir la réclamation de ${claim.student_name || "toute la classe"}`}>
              <span>{claim.student_name || "Toute la classe"}<span className="block text-xs font-normal text-muted-foreground">{claim.class_name}</span></span>
            </Button></TableCell>
            <TableCell>{claim.subject_name}</TableCell><TableCell>{periodLabel(claim.grading_period_id)}</TableCell>
            <TableCell className="max-w-48 truncate" title={claim.reason}>{claim.reason}</TableCell>
            <TableCell><Badge variant="outline">{LABELS[claim.status]}</Badge></TableCell>
            <TableCell>{new Date(claim.created_at).toLocaleDateString("fr-FR")}</TableCell>
          </TableRow>)}</TableBody></Table>
            : <EmptyState title="Aucune réclamation" description="Aucune demande ne correspond aux filtres choisis. Vous pouvez ouvrir une nouvelle réclamation."
              action={{ label: "Nouvelle réclamation", onClick: openCreate }} classNameRendu="py-12 [&>button]:min-h-12" />}
    </section>

    <Dialog open={createOpen} onOpenChange={setCreateOpen}><DialogContent className="flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-xl flex-col gap-0 overflow-hidden p-0 [&>button]:min-h-12 [&>button]:min-w-12">
      <DialogHeader className="px-6 pb-3 pr-16 pt-6"><DialogTitle>Nouvelle réclamation</DialogTitle><DialogDescription>{CLAIM_RULE}</DialogDescription></DialogHeader>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-3">
        {createAttempted && Object.values(createErrors).some(Boolean) ?
          <Alert ref={errorSummaryRef} tabIndex={-1} variant="destructive"><AlertDescription>
            {createErrors.classId || createErrors.periodId || createErrors.subjectId || createErrors.year ? CLAIM_RULE : "Corrigez les champs indiqués ci-dessous."}
            {createErrors.year ? " L’année scolaire doit être active." : ""}
          </AlertDescription></Alert> : null}
        <div className="space-y-2"><Label htmlFor="claim-form-class">Classe</Label>
          <Select value={formClassId} onValueChange={(value) => { setFormClassId(value); setFormPeriodId(""); setFormSubjectId(""); setFormStudentId("") }}>
            <SelectTrigger id="claim-form-class" className={cn("min-h-12", createAttempted && createErrors.classId && "border-destructive")} aria-invalid={createAttempted && createErrors.classId || undefined}
              aria-describedby={createAttempted && createErrors.classId ? "claim-form-class-error" : undefined}><SelectValue placeholder="Sélectionner une classe" /></SelectTrigger>
            <SelectContent>{(classesQuery.data ?? []).map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
          </Select>{createAttempted && createErrors.classId ? <p id="claim-form-class-error" className="text-sm text-destructive">Sélectionnez une classe.</p> : null}</div>
        <div className="space-y-2"><Label htmlFor="claim-form-period">Période</Label>
          <Select value={formPeriodId} onValueChange={setFormPeriodId} disabled={!formClassId}>
            <SelectTrigger id="claim-form-period" className={cn("min-h-12", createAttempted && createErrors.periodId && "border-destructive")} aria-invalid={createAttempted && createErrors.periodId || undefined}
              aria-describedby={createAttempted && createErrors.periodId ? "claim-form-period-error" : undefined}><SelectValue placeholder="Sélectionner une période" /></SelectTrigger>
            <SelectContent>{formPeriods.map((item) => <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>)}</SelectContent>
          </Select>{!formClassId ? <p className="text-xs text-muted-foreground">Choisissez d’abord une classe.</p> : null}
          {createAttempted && createErrors.periodId ? <p id="claim-form-period-error" className="text-sm text-destructive">Sélectionnez une période.</p> : null}</div>
        <div className="space-y-2"><Label htmlFor="claim-form-subject">Matière</Label>
          <Select value={formSubjectId} onValueChange={setFormSubjectId} disabled={!formClassId}>
            <SelectTrigger id="claim-form-subject" className={cn("min-h-12", createAttempted && createErrors.subjectId && "border-destructive")} aria-invalid={createAttempted && createErrors.subjectId || undefined}
              aria-describedby={createAttempted && createErrors.subjectId ? "claim-form-subject-error" : undefined}><SelectValue placeholder="Sélectionner une matière" /></SelectTrigger>
            <SelectContent>{formSubjects.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
          </Select>{!formClassId ? <p className="text-xs text-muted-foreground">Choisissez d’abord une classe.</p> : null}
          {createAttempted && createErrors.subjectId ? <p id="claim-form-subject-error" className="text-sm text-destructive">Sélectionnez une matière.</p> : null}</div>
        <div className="space-y-3"><p className="text-sm font-medium">Cible</p><div className="flex flex-wrap gap-2" role="group" aria-label="Cible de la réclamation">
          <Button type="button" variant={target === "student" ? "default" : "outline"} className="min-h-12" aria-pressed={target === "student"} onClick={() => setTarget("student")}>Un élève</Button>
          <Button type="button" variant={target === "class" ? "default" : "outline"} className="min-h-12" aria-pressed={target === "class"} onClick={() => { setTarget("class"); setFormStudentId("") }}>Toute la classe</Button>
        </div>{target === "student" ? <div className="space-y-2"><Label htmlFor="claim-form-student">Élève concerné</Label>
          <Select value={formStudentId} onValueChange={setFormStudentId} disabled={!formClassId || studentsQuery.isPending}>
            <SelectTrigger id="claim-form-student" className={cn("min-h-12", createAttempted && createErrors.studentId && "border-destructive")} aria-invalid={createAttempted && createErrors.studentId || undefined}
              aria-describedby={createAttempted && createErrors.studentId ? "claim-form-student-error" : undefined}><SelectValue placeholder="Sélectionner un élève" /></SelectTrigger>
            <SelectContent>{(studentsQuery.data ?? []).map((item) => <SelectItem key={item.id} value={item.id}>{item.fullName}</SelectItem>)}</SelectContent>
          </Select>{studentsQuery.isPending && formClassId ? <p className="text-xs text-muted-foreground">Chargement des élèves…</p> : null}
          {studentsQuery.isError ? <p className="text-sm text-destructive">Impossible de charger les élèves. <Button variant="link" className="min-h-12 p-0" onClick={() => void studentsQuery.refetch()}>Réessayer</Button></p> : null}
          {createAttempted && createErrors.studentId ? <p id="claim-form-student-error" className="text-sm text-destructive">Sélectionnez un élève.</p> : null}
        </div> : null}</div>
        <div className="space-y-2"><Label htmlFor="claim-reason">Motif détaillé</Label>
          <Textarea id="claim-reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={4000} rows={5}
            className={cn("min-h-28", createAttempted && createErrors.reason && "border-destructive")}
            placeholder="Précisez la note ou l’évaluation à vérifier." aria-invalid={createAttempted && createErrors.reason || undefined}
            aria-describedby={createAttempted && createErrors.reason ? "claim-reason-error" : "claim-reason-help"} />
          <div className="flex items-start justify-between gap-3 text-xs text-muted-foreground"><p id="claim-reason-help">Décrivez précisément l’erreur constatée (10 caractères minimum).</p><span className="shrink-0">{reason.length} / 4 000</span></div>
          {createAttempted && createErrors.reason ? <p id="claim-reason-error" className="text-sm text-destructive">Décrivez le motif en au moins 10 caractères.</p> : null}</div>
      </div>
      <DialogFooter className="border-t bg-background px-6 py-4">
        <Button variant="outline" className="min-h-12" onClick={() => setCreateOpen(false)}>Annuler</Button>
        <Button className="min-h-12" disabled={createMutation.isPending} onClick={() => {
          setCreateAttempted(true)
          if (!Object.values(createErrors).some(Boolean)) createMutation.mutate()
        }}>{createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Ouvrir la réclamation</Button>
      </DialogFooter>
    </DialogContent></Dialog>

    <Sheet open={Boolean(selectedClaim)} onOpenChange={(open) => { if (!open) setSelectedClaim(null) }}><SheetContent className="w-full overflow-y-auto [&>button]:min-h-12 [&>button]:min-w-12 sm:max-w-xl">
      <SheetHeader><SheetTitle>Détail de la réclamation</SheetTitle><SheetDescription>Consultez le motif et la décision.</SheetDescription></SheetHeader>
      {selectedClaim ? <div className="py-5"><ClaimDetail key={selectedClaim.id} claim={selectedClaim} periodLabel={periodLabel(selectedClaim.grading_period_id)}
        canDecide={hasPermission("report_cards.publish") && yearsQuery.data?.some((year) => year.id === selectedClaim.school_year_id && year.status !== "closed") === true}
        canCorrectPublished={hasPermission("report_cards.published_correction")} pending={decisionMutation.isPending}
        onDecide={(id, decision, decisionReason) => decisionMutation.mutate({ id, decision, reason: decisionReason })} /></div> : null}
    </SheetContent></Sheet>

    {versionsQuery.isSuccess && versionsQuery.data.length > 0 ? <section aria-labelledby="claim-history-title" className="rounded-lg border p-4">
      <h2 id="claim-history-title" className="text-lg font-semibold">Versions publiées archivées</h2>
      <ul className="mt-3 divide-y">{versionsQuery.data.map((version) => <li key={version.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
        <span>Élève {version.student_id} · révision {version.revision} · publiée le {new Date(version.published_at).toLocaleDateString("fr-FR")}</span>
        <Badge variant="outline">{version.invalidated_at ? "Invalidée" : "Active"}</Badge>
        {version.invalidation_reason ? <p className="w-full text-muted-foreground">Motif : {version.invalidation_reason}</p> : null}
      </li>)}</ul>
    </section> : null}
    {auditQuery.isSuccess && auditQuery.data.length > 0 ? <section aria-labelledby="claim-audit-title" className="rounded-lg border p-4">
      <h2 id="claim-audit-title" className="text-lg font-semibold">Journal des modifications</h2>
      <ul className="mt-3 divide-y">{auditQuery.data.map((entry) => <li key={entry.id} className="space-y-1 py-3 text-sm">
        <p className="font-medium">{entry.operation} · {new Date(entry.created_at).toLocaleString("fr-FR")}</p>
        <p className="break-all text-muted-foreground">Auteur : {entry.actor_user_id}{entry.claim_id ? ` · réclamation ${entry.claim_id}` : ""}</p>
        <p className="break-all text-muted-foreground">Évaluation : {entry.evaluation_id ?? "—"} · Élève : {entry.student_id ?? "—"}</p>
        <p className="break-all">Avant : {JSON.stringify(entry.old_value)} · Après : {JSON.stringify(entry.new_value)}</p>
      </li>)}</ul>
    </section> : null}
  </PageLayout>
}
