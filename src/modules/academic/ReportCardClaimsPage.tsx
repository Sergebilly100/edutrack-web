import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link, useSearchParams } from "react-router-dom"
import { Loader2 } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import { PageLayout } from "@/shared/components/PageLayout"
import { EmptyState } from "@/shared/components/EmptyState"
import { AcademicContextFilters } from "@/shared/components/AcademicContextFilters"
import { DependentSelect } from "@/shared/components/DependentSelect"
import { FilterBar } from "@/shared/components/FilterBar"
import { ResetFiltersButton } from "@/shared/components/ResetFiltersButton"
import { FILTER_HELP } from "@/shared/components/filter-help"
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

const optional = (value: string) => value || undefined

function ClaimRow({ claim, canDecide, canCorrectPublished, onDecide, pending }: {
  claim: ReportCardClaim
  canDecide: boolean
  canCorrectPublished: boolean
  onDecide: (id: string, decision: "approved" | "refused", reason: string) => void
  pending: boolean
}) {
  const [decisionReason, setDecisionReason] = useState("")
  const actionable = claim.status === "open" || claim.status === "pending_exceptional_authorization"
  const canApprove = canDecide && (claim.phase !== "published" || canCorrectPublished)
  return <article className="space-y-3 border-b py-4 last:border-b-0">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div>
        <h2 className="font-semibold">{claim.class_name} · {claim.subject_name}</h2>
        <p className="text-sm">{claim.student_name ? `Élève concerné : ${claim.student_name}` : "Réclamation concernant toute la classe"}</p>
        <p className="text-sm text-muted-foreground">{new Date(claim.created_at).toLocaleDateString("fr-FR")}</p>
      </div>
      <Badge variant="outline">{LABELS[claim.status]}</Badge>
    </div>
    <p className="max-w-prose whitespace-pre-wrap text-sm">{claim.reason}</p>
    {claim.phase === "published" ? <Alert><AlertDescription>
      Une approbation retirera tous les bulletins publiés de cette classe et de cette période du portail parent. Une nouvelle version devra ensuite être régénérée et republiée.
    </AlertDescription></Alert> : null}
    {claim.phase === "generated" ? <p className="text-sm text-muted-foreground">Une approbation invalidera tous les bulletins générés de cette classe et de cette période.</p> : null}
    {claim.decision_reason ? <p className="text-sm text-muted-foreground">Décision : {claim.decision_reason}</p> : null}
    {actionable && canDecide ? <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
      <Label htmlFor={`decision-${claim.id}`}>Motif de la décision</Label>
      <Textarea id={`decision-${claim.id}`} value={decisionReason} onChange={(event) => setDecisionReason(event.target.value)} maxLength={4000} />
      <div className="flex flex-wrap gap-2">
        <Button className="min-h-12" disabled={!canApprove || decisionReason.trim().length < 10 || pending}
          onClick={() => onDecide(claim.id, "approved", decisionReason.trim())}>
          {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Approuver et ouvrir la correction
        </Button>
        <Button variant="outline" className="min-h-12" disabled={decisionReason.trim().length < 10 || pending}
          onClick={() => onDecide(claim.id, "refused", decisionReason.trim())}>Refuser</Button>
      </div>
      {!canApprove && claim.phase === "published" ? <p className="text-sm text-muted-foreground">Le droit « Autoriser une correction exceptionnelle après publication » est requis pour approuver cette réclamation.</p> : null}
    </div> : null}
  </article>
}

export default function ReportCardClaimsPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { hasPermission } = usePermissions()
  const [params] = useSearchParams()
  const [yearChoice, setYearChoice] = useState(params.get("schoolYearId") ?? "")
  const [periodChoice, setPeriodChoice] = useState(params.get("gradingPeriodId") ?? "")
  const [classId, setClassId] = useState(params.get("classId") ?? "")
  const [levelId, setLevelId] = useState("")
  const [studentId, setStudentId] = useState("")
  const [subjectId, setSubjectId] = useState(params.get("subjectId") ?? "")
  const [status, setStatus] = useState("")
  const [reason, setReason] = useState("")
  const [createAttempted, setCreateAttempted] = useState(false)

  const yearsQuery = useQuery({ queryKey: ["academic", "school-years"], queryFn: listSchoolYears })
  const activeYear = yearsQuery.data?.find((year) => year.status === "active")
  const schoolYearId = yearChoice === "all" ? "" : yearChoice || activeYear?.id || ""
  const periodsQuery = useQuery({
    queryKey: ["academic", "grading-periods", schoolYearId],
    queryFn: () => schoolYearId ? listGradingPeriodsForYear(schoolYearId) : listGradingPeriods(),
    enabled: yearsQuery.isSuccess,
  })
  const classesQuery = useQuery({
    queryKey: ["report-cards", "claim-classes", schoolYearId],
    queryFn: async () => schoolYearId
      ? (await listReportCardClasses(schoolYearId)).map((item) => ({ ...item, schoolYearId }))
      : (await listClasses()).classes.map((item) => ({ ...item, schoolYearId: item.schoolYear.id })),
    enabled: yearsQuery.isSuccess,
  })
  const visiblePeriods = periodsQuery.data?.filter((item) => !schoolYearId || item.schoolYearId === schoolYearId) ?? []
  const gradingPeriodId = !schoolYearId || periodChoice === "all" ? "" :
    visiblePeriods.some((item) => item.id === periodChoice) ? periodChoice : currentAcademicPeriodId(visiblePeriods)
  const subjectsQuery = useQuery({ queryKey: ["academic", "claim-subjects"], queryFn: () => listSubjects() })
  const studentsQuery = useQuery({ queryKey: ["report-card-claim-students", classId], queryFn: () => listReportCardClaimStudents(classId), enabled: Boolean(classId) })
  const filters = { schoolYearId: optional(schoolYearId), gradingPeriodId: optional(gradingPeriodId),
    classId: optional(classId), studentId: optional(studentId), subjectId: optional(subjectId), status: optional(status) }
  const claimsQuery = useQuery({ queryKey: ["report-card-claims", filters], queryFn: () => listReportCardClaims(filters), enabled: yearsQuery.isSuccess && periodsQuery.isSuccess })
  const versionsQuery = useQuery({
    queryKey: ["report-card-versions", classId, gradingPeriodId],
    queryFn: () => listReportCardVersions(classId, gradingPeriodId),
    enabled: Boolean(classId && gradingPeriodId && hasPermission("report_cards.published_correction")),
  })
  const auditQuery = useQuery({
    queryKey: ["report-card-academic-audit", classId, gradingPeriodId],
    queryFn: () => listReportCardAcademicAudit(classId, gradingPeriodId),
    enabled: Boolean(classId && gradingPeriodId && hasPermission("report_cards.published_correction")),
  })

  const invalidate = async () => {
    await Promise.all([
      classId && gradingPeriodId ? invalidateAcademicReportScope(queryClient, classId, gradingPeriodId)
        : queryClient.invalidateQueries({ queryKey: ["report-card-claims"] }),
    ])
  }

  const createMutation = useMutation({
    mutationFn: () => createReportCardClaim({ classId, studentId: optional(studentId), subjectId, gradingPeriodId, reason: reason.trim() }),
    onSuccess: async () => { setReason(""); await invalidate(); toast({ title: "Réclamation ouverte" }) },
    onError: (error) => toast({ title: "Réclamation impossible", description: error instanceof Error ? error.message : undefined, variant: "destructive" }),
  })
  const decisionMutation = useMutation({
    mutationFn: (input: { id: string; decision: "approved" | "refused"; reason: string }) =>
      decideReportCardClaim(input.id, { decision: input.decision, reason: input.reason }),
    onSuccess: async () => { await invalidate(); toast({ title: "Décision enregistrée" }) },
    onError: (error) => toast({ title: "Décision impossible", description: error instanceof Error ? error.message : undefined, variant: "destructive" }),
  })

  const selectedYear = yearsQuery.data?.find((item) => item.id === schoolYearId)
  const selectedClass = classesQuery.data?.find((item) => item.id === classId)
  const effectiveLevelId = levelId || (classId ? selectedClass?.level.id ?? "" : "")
  const selectedPeriod = visiblePeriods.find((item) => item.id === gradingPeriodId)
  const claimYear = yearsQuery.data?.find((item) => item.id === selectedPeriod?.schoolYearId)
  const visibleClasses = (classesQuery.data ?? []).filter((item) => !selectedPeriod || item.schoolYearId === selectedPeriod.schoolYearId)
  const visibleLevels = Array.from(new Map(visibleClasses.map((item) => [item.level.id, { id: item.level.id, label: item.level.name }])).values())
  useEffect(() => {
    if (classId && selectedClass && selectedPeriod && selectedClass.schoolYearId !== selectedPeriod.schoolYearId) {
      setClassId("")
      setStudentId("")
      setSubjectId("")
    }
  }, [classId, selectedClass, selectedPeriod])
  const visibleSubjects = subjectsQuery.data?.filter((item) => item.levelId === selectedClass?.level.id) ?? []
  const canCorrectPublished = hasPermission("report_cards.published_correction")
  const createErrors = [
    !schoolYearId && FILTER_HELP.year,
    !gradingPeriodId && "Choisissez une période.",
    !classId && "Choisissez une classe.",
    !subjectId && "Choisissez une matière.",
    Boolean(classId && gradingPeriodId && selectedClass?.schoolYearId !== selectedPeriod?.schoolYearId) && "La classe et la période doivent appartenir à la même année.",
    Boolean(subjectId && selectedClass && selectedClass.level.id !== subjectsQuery.data?.find((item) => item.id === subjectId)?.levelId) && "La matière doit correspondre au niveau de la classe.",
    reason.trim().length < 10 && "Décrivez le motif en au moins 10 caractères.",
  ].filter((error): error is string => typeof error === "string")

  return <PageLayout title="Réclamations de bulletins" subtitle="Suivez les corrections et leurs nouvelles versions par classe et période.">
    <div className="mb-4"><Button asChild variant="outline" className="min-h-12"><Link to="/academic/report-cards">Retour aux bulletins</Link></Button></div>
    <section aria-label="Filtres des réclamations" className="space-y-4 rounded-lg border bg-card p-4">
      <AcademicContextFilters yearIdPrefix="claims" years={yearsQuery.data ?? []} yearId={schoolYearId}
        activeYear={activeYear} showPeriod allowAllYears allowAllPeriods
        periods={visiblePeriods} periodId={gradingPeriodId}
        yearDisabled={yearsQuery.isLoading} periodDisabled={periodsQuery.isFetching || !visiblePeriods.length || !schoolYearId}
        onYearChange={(value) => { setYearChoice(value || "all"); setPeriodChoice(""); setLevelId(""); setClassId(""); setStudentId(""); setSubjectId("") }}
        onPeriodChange={(value) => { setPeriodChoice(value || "all"); setLevelId(""); setClassId(""); setStudentId(""); setSubjectId("") }} />
      <FilterBar>
      <DependentSelect id="claim-level" label="Niveau" value={effectiveLevelId} options={visibleLevels}
        dependsOn={{ field: "year", value: schoolYearId }} allLabel="Tous les niveaux"
        onValueChange={(value) => { setLevelId(value); setClassId(""); setSubjectId(""); setStudentId("") }} />
      <DependentSelect id="claim-class" label="Classe" value={classId}
        options={visibleClasses.filter((item) => item.level.id === effectiveLevelId).map((item) => ({ id: item.id, label: item.name }))}
        dependsOn={{ field: effectiveLevelId ? "year" : schoolYearId ? "level" : "year", value: effectiveLevelId && schoolYearId ? schoolYearId : "" }}
        allLabel="Toutes les classes" invalid={createAttempted && !classId} onValueChange={(value) => { setClassId(value); setSubjectId(""); setStudentId("") }} />
      <DependentSelect id="claim-subject" label="Matière" value={subjectId}
        options={visibleSubjects.map((item) => ({ id: item.id, label: item.name }))}
        dependsOn={{ field: "class", value: classId }} allLabel="Toutes les matières" invalid={createAttempted && !subjectId}
        onValueChange={(value) => { setSubjectId(value); setStudentId("") }} />
      <DependentSelect id="claim-student" label="Élève concerné" value={studentId}
        options={(studentsQuery.data ?? []).map((student) => ({ id: student.id, label: student.fullName }))}
        dependsOn={{ field: "class", value: classId }} allLabel="Toute la classe" loading={studentsQuery.isPending && Boolean(classId)}
        onValueChange={setStudentId} />
      {studentsQuery.isError ? <p className="text-xs text-destructive">Impossible de charger les élèves. <Button variant="link" className="h-auto p-0 text-xs" onClick={() => void studentsQuery.refetch()}>Réessayer</Button></p> : null}
      <div className="space-y-2"><Label htmlFor="claim-status">Statut</Label><Select value={status || "all"} onValueChange={(value) => setStatus(value === "all" ? "" : value)}><SelectTrigger id="claim-status" className="min-h-12"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Tous les statuts</SelectItem>{Object.entries(LABELS).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent></Select></div>
      </FilterBar>
      <ResetFiltersButton active={Boolean(yearChoice || periodChoice || levelId || classId || subjectId || studentId || status)}
        onReset={() => { setYearChoice(""); setPeriodChoice(""); setLevelId(""); setClassId(""); setSubjectId(""); setStudentId(""); setStatus("") }} />
    </section>

    {selectedYear?.status !== "closed" ? <section aria-labelledby="claim-create-title" className="mt-6 space-y-3 rounded-lg border p-4">
      <h2 id="claim-create-title" className="text-lg font-semibold">Ouvrir une réclamation</h2>
      <p className="text-sm text-muted-foreground">Choisissez une classe, une période et une matière dont les moyennes sont validées. Vous pouvez cibler un élève ou toute la classe. Décrivez précisément l’erreur constatée.</p>
      <Label htmlFor="claim-reason">Motif détaillé</Label>
      <Textarea id="claim-reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={4000} placeholder="Précisez la note ou l’évaluation à vérifier."
        aria-invalid={createAttempted && reason.trim().length < 10 || undefined} className={createAttempted && reason.trim().length < 10 ? "border-destructive" : undefined} />
      {createAttempted && createErrors.length ? <Alert variant="destructive" role="alert"><AlertDescription>
        <ul className="list-disc pl-5">{createErrors.map((error) => <li key={error}>{error}</li>)}</ul>
      </AlertDescription></Alert> : null}
      <Button className="min-h-12" disabled={createMutation.isPending || claimYear?.status === "closed"} onClick={() => {
        setCreateAttempted(true)
        if (!createErrors.length) createMutation.mutate()
      }}>
        {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Ouvrir la réclamation
      </Button>
    </section> : <p className="mt-6 text-sm text-muted-foreground">L’année scolaire {selectedYear.label} est clôturée. Ses réclamations restent consultables.</p>}

    <section aria-labelledby="claim-list-title" className="mt-6 rounded-lg border p-4">
      <h2 id="claim-list-title" className="text-lg font-semibold">Suivi des réclamations</h2>
      {claimsQuery.isPending ? <p className="mt-3 flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" />Chargement…</p>
        : claimsQuery.isError ? <Alert variant="destructive" className="mt-3"><AlertDescription>Impossible de charger les réclamations. <Button variant="outline" onClick={() => void claimsQuery.refetch()}>Réessayer</Button></AlertDescription></Alert>
          : claimsQuery.data?.length ? claimsQuery.data.map((claim) => <ClaimRow key={claim.id} claim={claim}
            canDecide={hasPermission("report_cards.publish") && yearsQuery.data?.some((year) => year.id === claim.school_year_id && year.status !== "closed") === true} canCorrectPublished={canCorrectPublished}
            pending={decisionMutation.isPending} onDecide={(id, decision, decisionReason) => decisionMutation.mutate({ id, decision, reason: decisionReason })} />)
            : <EmptyState title="Aucune réclamation" description="Les demandes correspondant aux filtres apparaîtront ici." />}
    </section>

    {versionsQuery.isSuccess && versionsQuery.data.length > 0 ? <section aria-labelledby="claim-history-title" className="mt-6 rounded-lg border p-4">
      <h2 id="claim-history-title" className="text-lg font-semibold">Versions publiées archivées</h2>
      <ul className="mt-3 divide-y">{versionsQuery.data.map((version) => <li key={version.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
        <span>Élève {version.student_id} · révision {version.revision} · publiée le {new Date(version.published_at).toLocaleDateString("fr-FR")}</span>
        <Badge variant="outline">{version.invalidated_at ? "Invalidée" : "Active"}</Badge>
        {version.invalidation_reason ? <p className="w-full text-muted-foreground">Motif : {version.invalidation_reason}</p> : null}
      </li>)}</ul>
    </section> : null}
    {auditQuery.isSuccess && auditQuery.data.length > 0 ? <section aria-labelledby="claim-audit-title" className="mt-6 rounded-lg border p-4">
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
