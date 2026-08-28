import { useEffect, useMemo, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, ArrowRight, Loader2, UserPlus } from "lucide-react"
import { Link, useNavigate, useParams } from "react-router-dom"
import axios from "axios"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { listClasses, listSchoolYears } from "@/modules/academic/academic.api"
import { createStudent, getStudentById, updateStudent } from "@/modules/students/students.api"
import { PageLayout } from "@/shared/components/PageLayout"
import { QueryErrorState } from "@/shared/components/QueryErrorState"
import { usePermissions } from "@/shared/hooks/usePermissions"
import { isValidOptionalPhone, normalizePhoneInput } from "@/shared/utils/phone"
import { DocumentChecklist } from "./components/DocumentChecklist"
import { EnrollmentProgress } from "./components/EnrollmentProgress"
import { createEnrollment, getEnrollment, updateEnrollment, verifyStudentDocuments, type Enrollment } from "./enrollments.api"

type StudentForm = {
  firstName: string; lastName: string; birthDate: string; matricule: string
  parentName: string; parentPhone: string; parentEmail: string
  parentName2: string; parentPhone2: string
}

const EMPTY_FORM: StudentForm = {
  firstName: "", lastName: "", birthDate: "", matricule: "", parentName: "",
  parentPhone: "", parentEmail: "", parentName2: "", parentPhone2: "",
}

const getError = (error: unknown) => axios.isAxiosError(error) && typeof error.response?.data?.error === "string"
  ? error.response.data.error : "Impossible d’enregistrer l’inscription."

export default function NewEnrollmentPage() {
  const { enrollmentId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { hasPermission } = usePermissions()
  const [step, setStep] = useState(1)
  const [schoolYearId, setSchoolYearId] = useState("")
  const [classId, setClassId] = useState("")
  const [form, setForm] = useState<StudentForm>(EMPTY_FORM)
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null)
  const initializedEnrollmentId = useRef<string | null>(null)

  const historicalEnrollmentQuery = useQuery({
    queryKey: ["enrollments", "detail", enrollmentId],
    queryFn: () => getEnrollment(enrollmentId!),
    enabled: Boolean(enrollmentId),
  })
  const historicalStudentQuery = useQuery({
    queryKey: ["students", "detail", historicalEnrollmentQuery.data?.studentId],
    queryFn: () => getStudentById(historicalEnrollmentQuery.data!.studentId),
    enabled: Boolean(enrollmentId && historicalEnrollmentQuery.data?.studentId),
  })

  const yearsQuery = useQuery({ queryKey: ["academic", "school-years", "enrollment"], queryFn: listSchoolYears })
  const classesQuery = useQuery({
    queryKey: ["academic", "classes", "enrollment", schoolYearId],
    queryFn: () => listClasses(schoolYearId),
    enabled: Boolean(schoolYearId),
  })
  const selectedClass = useMemo(() => classesQuery.data?.classes.find((item) => item.id === classId), [classId, classesQuery.data])
  const canEditDraft = hasPermission("enrollments.edit") && hasPermission("students.edit")

  useEffect(() => {
    const historicalEnrollment = historicalEnrollmentQuery.data
    const student = historicalStudentQuery.data
    if (!enrollmentId || !historicalEnrollment || !student || initializedEnrollmentId.current === enrollmentId) return
    initializedEnrollmentId.current = enrollmentId
    setEnrollment(historicalEnrollment)
    setSchoolYearId(historicalEnrollment.schoolYearId)
    setClassId(historicalEnrollment.classId)
    setForm({
      firstName: student.firstName,
      lastName: student.lastName,
      birthDate: student.birthDate?.slice(0, 10) ?? "",
      matricule: student.matricule ?? "",
      parentName: student.parentName ?? "",
      parentPhone: student.parentPhone ?? "",
      parentEmail: student.parentEmail ?? "",
      parentName2: student.parentName2 ?? "",
      parentPhone2: student.parentPhone2 ?? "",
    })
  }, [enrollmentId, historicalEnrollmentQuery.data, historicalStudentQuery.data])

  const creationMutation = useMutation({
    mutationFn: async () => {
      const studentPayload = {
        classId,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        birthDate: form.birthDate || null,
        matricule: form.matricule.trim() || null,
        parentName: form.parentName.trim() || null,
        parentPhone: form.parentPhone.trim() || null,
        parentEmail: form.parentEmail.trim() || null,
        parentName2: form.parentName2.trim() || null,
        parentPhone2: form.parentPhone2.trim() || null,
      }
      if (enrollment) {
        await updateStudent(enrollment.studentId, studentPayload)
        const updatedEnrollment = await updateEnrollment(enrollment.id, { classId })
        return { enrollment: updatedEnrollment, missingMandatoryDocuments: [], documentWarning: null, updated: true }
      }
      const student = await createStudent(studentPayload)
      return createEnrollment({ studentId: student.id, classId, schoolYearId, type: "new_registration" })
    },
    onSuccess: async (result) => {
      setEnrollment(result.enrollment)
      setStep(2)
      await queryClient.invalidateQueries({ queryKey: ["enrollments"] })
      await queryClient.invalidateQueries({ queryKey: ["enrollments", "documents", result.enrollment.studentId] })
      toast({ title: "updated" in result ? "Informations mises à jour" : "Dossier créé", description: "Vous pouvez maintenant vérifier les pièces demandées pour ce niveau." })
    },
    onError: (error) => toast({ title: "Création impossible", description: getError(error), variant: "destructive" }),
  })

  const finishMutation = useMutation({
    mutationFn: () => verifyStudentDocuments(enrollment!.studentId),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["enrollments"] })
      await queryClient.invalidateQueries({ queryKey: ["enrollments", "documents", enrollment!.studentId] })
      toast({
        title: result.dossierComplete ? "Dossier complet" : "Dossier vérifié",
        description: result.notificationQueued
          ? "Le parent a été notifié des pièces obligatoires manquantes."
          : result.dossierComplete
            ? "Toutes les pièces obligatoires sont fournies."
            : "Des pièces obligatoires manquent, mais aucun numéro de parent n’est disponible pour la notification.",
      })
      navigate("/enrollments")
    },
    onError: (error) => toast({ title: "Vérification impossible", description: getError(error), variant: "destructive" }),
  })

  const parentPairValid = (form.parentName.trim().length === 0 && form.parentPhone.trim().length === 0)
    || (form.parentName.trim().length >= 2 && form.parentPhone.trim().length > 0)
  const formValid = Boolean(
    schoolYearId && classId && form.firstName.trim() && form.lastName.trim()
    && isValidOptionalPhone(form.parentPhone) && isValidOptionalPhone(form.parentPhone2)
    && parentPairValid && (!form.parentEmail.trim() || /.+@.+\..+/.test(form.parentEmail.trim())),
  )
  const historicalLoading = Boolean(enrollmentId) && (historicalEnrollmentQuery.isLoading || historicalStudentQuery.isLoading)
  const historicalError = Boolean(enrollmentId) && (historicalEnrollmentQuery.isError || historicalStudentQuery.isError)
  const historicalConfirmed = historicalEnrollmentQuery.data?.status === "confirmed"
  const historicalForbidden = Boolean(enrollmentId) && !canEditDraft

  return (
    <PageLayout
      title={enrollmentId ? "Modifier l’inscription" : "Nouvelle inscription"}
      subtitle={enrollmentId ? "Corrigez l’identité, les contacts du parent ou la classe tant que l’inscription n’est pas finalisée." : "Renseignez l’élève et ses documents. Le passage en caisse se fait ensuite depuis la liste des inscriptions."}
      actions={<Button variant="outline" asChild><Link to="/enrollments"><ArrowLeft className="mr-2 h-4 w-4" />Retour</Link></Button>}
    >
      <div className="mx-auto max-w-3xl space-y-6">
        {historicalLoading ? <div className="space-y-3" aria-label="Chargement de l’inscription"><div className="h-16 animate-pulse rounded-lg bg-muted" /><div className="h-96 animate-pulse rounded-lg bg-muted" /></div> : null}
        {historicalError ? <QueryErrorState message="Impossible de charger l’inscription et les informations de l’élève." onRetry={() => { void historicalEnrollmentQuery.refetch(); void historicalStudentQuery.refetch() }} isRetrying={historicalEnrollmentQuery.isFetching || historicalStudentQuery.isFetching} /> : null}
        {historicalForbidden ? <Alert variant="destructive"><AlertDescription>Votre poste doit autoriser la modification des inscriptions et des élèves pour ouvrir ce formulaire.</AlertDescription></Alert> : null}
        {historicalConfirmed ? <Alert><AlertDescription>Cette inscription est finalisée. Ses informations ne peuvent plus être modifiées depuis ce parcours.</AlertDescription></Alert> : null}
        {!historicalLoading && !historicalError && !historicalConfirmed && !historicalForbidden ? <EnrollmentProgress currentStep={step} /> : null}

        {!historicalLoading && !historicalError && !historicalConfirmed && !historicalForbidden && step === 1 ? (
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-xl"><UserPlus className="h-5 w-5" />Identité et classe visée</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <section className="space-y-4" aria-labelledby="student-identity-title">
                <h2 id="student-identity-title" className="text-base font-semibold">Identité de l’élève</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2"><Label htmlFor="first-name">Prénom *</Label><Input id="first-name" value={form.firstName} onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))} /></div>
                  <div className="space-y-2"><Label htmlFor="last-name">Nom *</Label><Input id="last-name" value={form.lastName} onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))} /></div>
                  <div className="space-y-2"><Label htmlFor="birth-date">Date de naissance</Label><Input id="birth-date" type="date" value={form.birthDate} onChange={(event) => setForm((current) => ({ ...current, birthDate: event.target.value }))} /></div>
                  <div className="space-y-2"><Label htmlFor="matricule">Matricule</Label><Input id="matricule" value={form.matricule} onChange={(event) => setForm((current) => ({ ...current, matricule: event.target.value }))} /></div>
                </div>
              </section>

              <section className="space-y-4" aria-labelledby="target-class-title">
                <h2 id="target-class-title" className="text-base font-semibold">Classe et année scolaire</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2"><Label>Année scolaire *</Label><Select value={schoolYearId} onValueChange={(value) => { setSchoolYearId(value); setClassId("") }} disabled={Boolean(enrollment)}><SelectTrigger className="min-h-12"><SelectValue placeholder={yearsQuery.isLoading ? "Chargement…" : "Choisir une année"} /></SelectTrigger><SelectContent>{(yearsQuery.data ?? []).map((year) => <SelectItem key={year.id} value={year.id}>{year.label}</SelectItem>)}</SelectContent></Select>{enrollment ? <p className="text-xs text-muted-foreground">L’année scolaire ne peut plus être changée après la création du dossier.</p> : null}</div>
                  <div className="space-y-2"><Label>Classe visée *</Label><Select value={classId} onValueChange={setClassId} disabled={!schoolYearId || classesQuery.isLoading}><SelectTrigger className="min-h-12"><SelectValue placeholder={!schoolYearId ? "Choisissez d’abord l’année" : "Choisir une classe"} /></SelectTrigger><SelectContent>{(classesQuery.data?.classes ?? []).filter((item) => item.isActive).map((item) => <SelectItem key={item.id} value={item.id}>{item.name} · {item.level.name}</SelectItem>)}</SelectContent></Select></div>
                </div>
                {schoolYearId && !classesQuery.isLoading && (classesQuery.data?.classes.length ?? 0) === 0 ? <Alert><AlertDescription>Aucune classe n’est configurée pour cette année scolaire.</AlertDescription></Alert> : null}
              </section>

              <section className="space-y-4" aria-labelledby="parent-title">
                <h2 id="parent-title" className="text-base font-semibold">Contact parent</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2"><Label htmlFor="parent-name">Nom du parent</Label><Input id="parent-name" value={form.parentName} onChange={(event) => setForm((current) => ({ ...current, parentName: event.target.value }))} /></div>
                  <div className="space-y-2"><Label htmlFor="parent-phone">Téléphone</Label><Input id="parent-phone" inputMode="tel" placeholder="2250700000000" value={form.parentPhone} onChange={(event) => setForm((current) => ({ ...current, parentPhone: normalizePhoneInput(event.target.value) }))} /></div>
                  <div className="space-y-2"><Label htmlFor="parent-email">E-mail</Label><Input id="parent-email" type="email" value={form.parentEmail} onChange={(event) => setForm((current) => ({ ...current, parentEmail: event.target.value }))} /></div>
                  <div className="space-y-2"><Label htmlFor="parent-phone-2">Second téléphone</Label><Input id="parent-phone-2" inputMode="tel" value={form.parentPhone2} onChange={(event) => setForm((current) => ({ ...current, parentPhone2: normalizePhoneInput(event.target.value) }))} /></div>
                </div>
              </section>

              <div className="sticky bottom-0 flex justify-end border-t bg-card/95 pt-4 backdrop-blur">
                <Button className="min-h-12 w-full sm:w-auto" disabled={!formValid || creationMutation.isPending || !selectedClass} onClick={() => creationMutation.mutate()}>
                  {creationMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
                  {creationMutation.isPending ? enrollment ? "Mise à jour…" : "Création du dossier…" : enrollment ? "Enregistrer et continuer" : "Créer et continuer"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {step === 2 && enrollment ? (
          <Card><CardHeader><CardTitle className="text-xl">Documents requis</CardTitle></CardHeader><CardContent className="space-y-5"><DocumentChecklist studentId={enrollment.studentId} canEdit={hasPermission("enrollments.edit")} /><div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">{canEditDraft ? <Button variant="outline" className="min-h-12" disabled={finishMutation.isPending} onClick={() => setStep(1)}><ArrowLeft className="mr-2 h-4 w-4" />Modifier les informations</Button> : <span /> }<Button className="min-h-12" disabled={finishMutation.isPending} onClick={() => finishMutation.mutate()}>{finishMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{finishMutation.isPending ? "Vérification…" : "Terminer le dossier"}{!finishMutation.isPending ? <ArrowRight className="ml-2 h-4 w-4" /> : null}</Button></div><p className="text-right text-sm text-muted-foreground">Les pièces seront vérifiées automatiquement. Le paiement pourra ensuite être enregistré avec le bouton « Caisse ».</p></CardContent></Card>
        ) : null}
      </div>
    </PageLayout>
  )
}
