import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowRight, FileCheck2, Loader2, Pencil, Plus, RefreshCw } from "lucide-react"
import { Link } from "react-router-dom"
import axios from "axios"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"
import { listClasses, listSchoolYears } from "@/modules/academic/academic.api"
import { listClassDecisions } from "@/modules/class-decisions/class-decisions.api"
import { PageLayout } from "@/shared/components/PageLayout"
import { usePermissions } from "@/shared/hooks/usePermissions"
import { createEnrollment, listEnrollments, type Enrollment } from "./enrollments.api"
import { enrollmentStatusLabel } from "./enrollments.helpers"

const statusClassName: Record<Enrollment["status"], string> = {
  pending_cashier: "border-blue-200 bg-blue-50 text-blue-800",
  pending_dossier: "border-amber-200 bg-amber-50 text-amber-800",
  confirmed: "border-green-200 bg-green-50 text-green-800",
  blocked_unpaid: "border-red-200 bg-red-50 text-red-800",
}

function EnrollmentDocumentBadge({ enrollment }: { enrollment: Enrollment }) {
  return (
    <Badge variant="outline" className={enrollment.documentStatus === "complete" ? "border-green-200 bg-green-50 text-green-700" : enrollment.documentStatus === "incomplete" ? "border-amber-200 bg-amber-50 text-amber-700" : "text-muted-foreground"}>
      {enrollment.documentStatus === "complete"
        ? "Dossier complet"
        : enrollment.documentStatus === "incomplete"
          ? `${enrollment.missingMandatoryDocumentCount} pièce${enrollment.missingMandatoryDocumentCount > 1 ? "s" : ""} manquante${enrollment.missingMandatoryDocumentCount > 1 ? "s" : ""}`
          : "Documents non configurés"}
    </Badge>
  )
}

export default function EnrollmentsPage() {
  const { hasPermission } = usePermissions()
  const canEditDraft = hasPermission("enrollments.edit") && hasPermission("students.edit")
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [targetYearId, setTargetYearId] = useState("")
  const [classSelections, setClassSelections] = useState<Record<string, string>>({})

  const enrollmentsQuery = useQuery({ queryKey: ["enrollments", "list"], queryFn: () => listEnrollments() })
  const decisionsQuery = useQuery({ queryKey: ["class-decisions", "enrollment-candidates"], queryFn: listClassDecisions })
  const yearsQuery = useQuery({ queryKey: ["academic", "school-years", "re-enrollment"], queryFn: listSchoolYears })
  const classesQuery = useQuery({ queryKey: ["academic", "classes", "re-enrollment", targetYearId], queryFn: () => listClasses(targetYearId), enabled: Boolean(targetYearId) })

  const enrollmentByStudent = useMemo(() => new Map((enrollmentsQuery.data ?? []).map((item) => [item.studentId, item])), [enrollmentsQuery.data])
  const decisionByStudent = useMemo(() => new Map((decisionsQuery.data?.decisions ?? []).map((item) => [item.studentId, item])), [decisionsQuery.data])

  const reEnrollmentMutation = useMutation({
    mutationFn: ({ studentId, classId }: { studentId: string; classId: string }) => createEnrollment({
      studentId,
      classId,
      schoolYearId: targetYearId,
      type: "re_registration",
    }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["enrollments"] })
      toast({
        title: result.enrollment.status === "blocked_unpaid" ? "Réinscription bloquée" : "Réinscription créée",
        description: result.enrollment.status === "blocked_unpaid"
          ? "Le parent doit se présenter dans l’établissement pour régulariser la situation."
          : "Le dossier peut maintenant être vérifié puis transmis à la caisse.",
      })
    },
    onError: (error) => toast({
      title: "Réinscription impossible",
      description: axios.isAxiosError(error) && typeof error.response?.data?.error === "string" ? error.response.data.error : "Vérifiez la décision finale et la classe choisie.",
      variant: "destructive",
    }),
  })

  const namedEnrollments = (enrollmentsQuery.data ?? []).map((enrollment) => ({ enrollment, decision: decisionByStudent.get(enrollment.studentId) }))

  return (
    <PageLayout
      title="Inscriptions"
      subtitle="Suivez les nouveaux dossiers, les réinscriptions et les passages en caisse."
      actions={hasPermission("enrollments.create") ? <Button asChild><Link to="/enrollments/new"><Plus className="mr-2 h-4 w-4" />Nouvelle inscription</Link></Button> : undefined}
    >
      <Tabs defaultValue="dossiers" className="space-y-5">
        <TabsList className="grid h-auto w-full grid-cols-2 sm:w-[420px]"><TabsTrigger className="min-h-12" value="dossiers">Dossiers</TabsTrigger><TabsTrigger className="min-h-12" value="re-enrollment">Réinscriptions</TabsTrigger></TabsList>

        <TabsContent value="dossiers" className="space-y-4">
          {enrollmentsQuery.isLoading ? <div className="space-y-3">{[0, 1, 2].map((item) => <div key={item} className="h-24 animate-pulse rounded-lg bg-muted" />)}</div> : null}
          {enrollmentsQuery.isError ? <Alert variant="destructive"><AlertDescription>Impossible de charger les dossiers d’inscription.</AlertDescription></Alert> : null}
          {!enrollmentsQuery.isLoading && !enrollmentsQuery.isError && namedEnrollments.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center"><FileCheck2 className="mx-auto h-9 w-9 text-muted-foreground" /><h2 className="mt-3 font-semibold">Aucun dossier d’inscription</h2><p className="mt-1 text-sm text-muted-foreground">Créez une nouvelle inscription ou ouvrez l’onglet Réinscriptions.</p></div>
          ) : null}
          <div className="divide-y rounded-lg border bg-card">
            {namedEnrollments.map(({ enrollment, decision }) => (
              <div key={enrollment.id} className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center">
                <div className="min-w-0 flex-1"><p className="font-medium">{decision ? `${decision.studentLastName} ${decision.studentFirstName}` : `${enrollment.studentLastName} ${enrollment.studentFirstName}`}</p><p className="text-sm text-muted-foreground">{enrollment.className} · {enrollment.schoolYearLabel} · {enrollment.type === "re_registration" ? "Réinscription" : "Nouvelle inscription"}</p></div>
                <Badge className={`w-fit border ${statusClassName[enrollment.status]}`}>{enrollmentStatusLabel[enrollment.status]}</Badge>
                <EnrollmentDocumentBadge enrollment={enrollment} />
                <div className="flex flex-wrap gap-2">
                  {canEditDraft && enrollment.status !== "confirmed" ? <Button variant="outline" asChild><Link to={`/enrollments/${enrollment.id}/edit`}><Pencil className="mr-2 h-4 w-4" />Modifier</Link></Button> : null}
                  <Button variant="outline" asChild><Link to={`/enrollments/students/${enrollment.studentId}/documents`}>Vérifier le dossier</Link></Button>
                  {hasPermission("enrollments.confirm_payment") && enrollment.status !== "confirmed" && enrollment.status !== "blocked_unpaid" ? <Button asChild><Link to={`/enrollments/${enrollment.id}/payment`}>Caisse<ArrowRight className="ml-2 h-4 w-4" /></Link></Button> : null}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="re-enrollment" className="space-y-5">
          <div className="rounded-lg border bg-card p-4"><div className="max-w-sm space-y-2"><Label>Nouvelle année scolaire</Label><Select value={targetYearId} onValueChange={(value) => { setTargetYearId(value); setClassSelections({}) }}><SelectTrigger className="min-h-12"><SelectValue placeholder={yearsQuery.isLoading ? "Chargement…" : "Choisir l’année cible"} /></SelectTrigger><SelectContent>{(yearsQuery.data ?? []).map((year) => <SelectItem key={year.id} value={year.id}>{year.label}</SelectItem>)}</SelectContent></Select></div><p className="mt-3 text-sm text-muted-foreground">Les impayés de l’année précédente sont vérifiés automatiquement lors de la réinscription. Aucune saisie manuelle n’est nécessaire.</p></div>
          {decisionsQuery.isError ? <Alert variant="destructive"><AlertDescription>Les décisions finales ne sont pas accessibles. La revue de fin d’année doit être ouverte et validée avant les réinscriptions.</AlertDescription></Alert> : null}
          {!targetYearId ? <Alert><AlertDescription>Sélectionnez l’année scolaire cible pour afficher les classes compatibles avec chaque décision.</AlertDescription></Alert> : null}
          <div className="divide-y rounded-lg border bg-card">
            {(decisionsQuery.data?.decisions ?? []).filter((decision) => decision.finalDecision !== null).map((decision) => {
              const existing = enrollmentByStudent.get(decision.studentId)
              const eligibleClasses = (classesQuery.data?.classes ?? []).filter((item) => item.level.id === decision.nextLevelId)
              return (
                <div key={decision.studentId} className="space-y-4 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><p className="font-medium">{decision.studentLastName} {decision.studentFirstName}</p><p className="text-sm text-muted-foreground">{decision.className} · Décision: {decision.finalDecision === "promoted" ? "Admis(e)" : decision.finalDecision === "repeat" ? "Redouble" : "Exclu(e)"} · Niveau proposé: {decision.nextLevelName ?? "non défini"}</p></div>{existing ? <div className="flex flex-wrap gap-2"><Badge className={`w-fit border ${statusClassName[existing.status]}`}>{enrollmentStatusLabel[existing.status]}</Badge><EnrollmentDocumentBadge enrollment={existing} /></div> : <Badge variant="outline">À traiter</Badge>}</div>
                  {existing?.status === "blocked_unpaid" ? <Alert variant="destructive"><AlertDescription>La réinscription en ligne est bloquée pour impayé. Le parent doit se présenter dans l’établissement.</AlertDescription></Alert> : null}
                  {!existing && decision.finalDecision !== "expelled" && targetYearId ? (
                    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                      <div className="space-y-2"><Label>Classe proposée</Label><Select value={classSelections[decision.studentId] ?? ""} onValueChange={(value) => setClassSelections((current) => ({ ...current, [decision.studentId]: value }))}><SelectTrigger className="min-h-12"><SelectValue placeholder={classesQuery.isLoading ? "Chargement…" : eligibleClasses.length ? "Choisir la classe" : "Aucune classe compatible"} /></SelectTrigger><SelectContent>{eligibleClasses.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div>
                      <Button className="min-h-12" disabled={!classSelections[decision.studentId] || reEnrollmentMutation.isPending} onClick={() => reEnrollmentMutation.mutate({ studentId: decision.studentId, classId: classSelections[decision.studentId]! })}>{reEnrollmentMutation.isPending && reEnrollmentMutation.variables?.studentId === decision.studentId ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}Réinscrire</Button>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        </TabsContent>
      </Tabs>
    </PageLayout>
  )
}
