import { useEffect, useMemo, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, ArrowRight, Loader2, UserPlus } from "lucide-react"
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom"
import axios from "axios"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { listClasses, listLevels, listSchoolYears } from "@/modules/academic/academic.api"
import { createStudent, getStudentById, updateStudent } from "@/modules/students/students.api"
import { PageLayout } from "@/shared/components/PageLayout"
import { EmptyState } from "@/shared/components/EmptyState"
import { QueryErrorState } from "@/shared/components/QueryErrorState"
import { usePermissions } from "@/shared/hooks/usePermissions"
import { useAuthStore } from "@/shared/store/auth.store"
import { discardEnrollmentClassDraft, readEnrollmentClassDraft, resolveEnrollmentClassReturn, saveEnrollmentClassDraft, type EnrollmentIdentityDraft } from "@/shared/lib/enrollment-class-flow"
import { isValidOptionalPhone, normalizePhoneInput } from "@/shared/utils/phone"
import { DocumentChecklist } from "./components/DocumentChecklist"
import { EnrollmentProgress } from "./components/EnrollmentProgress"
import { createEnrollment, getEnrollment, updateEnrollment, verifyStudentDocuments, type Enrollment } from "./enrollments.api"

const EMPTY_FORM: EnrollmentIdentityDraft = {
  firstName: "", lastName: "", birthDate: "", matricule: "", parentName: "",
  parentPhone: "", parentEmail: "", parentName2: "", parentPhone2: "",
}

const getError = (error: unknown) => axios.isAxiosError(error) && typeof error.response?.data?.error === "string"
  ? error.response.data.error : error instanceof Error ? error.message : "Impossible d’enregistrer l’inscription."

export default function NewEnrollmentPage() {
  const location = useLocation()
  return <EnrollmentForm key={location.key} />
}

function EnrollmentForm() {
  const location = useLocation()
  const user = useAuthStore((state) => state.user)
  const [returnDraft] = useState(() => readEnrollmentClassDraft(location.state, location.pathname + location.search))
  const [returnRestored, setReturnRestored] = useState(false)
  const [returnMessage, setReturnMessage] = useState<string | null>(() => location.state && !returnDraft ? "Le brouillon temporaire a expiré ou a été effacé après une actualisation. Rouvrez le dossier depuis les inscriptions." : null)
  const { enrollmentId } = useParams()
  const [searchParams] = useSearchParams()
  const profileStudentId = searchParams.get("studentId")
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { hasPermission } = usePermissions()
  const [step, setStep] = useState(1)
  const [schoolYearId, setSchoolYearId] = useState(returnDraft?.context.schoolYearId ?? "")
  const [levelId, setLevelId] = useState(returnDraft?.context.levelId ?? "")
  const [classId, setClassId] = useState("")
  const [form, setForm] = useState<EnrollmentIdentityDraft>(returnDraft?.form ?? EMPTY_FORM)
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null)
  const initializedEnrollmentId = useRef<string | null>(null)

  const historicalEnrollmentQuery = useQuery({
    queryKey: ["enrollments", "detail", enrollmentId],
    queryFn: () => getEnrollment(enrollmentId!),
    enabled: Boolean(enrollmentId),
  })
  const historicalStudentQuery = useQuery({
    queryKey: ["students", "detail", historicalEnrollmentQuery.data?.studentId ?? profileStudentId],
    queryFn: () => getStudentById(historicalEnrollmentQuery.data?.studentId ?? profileStudentId!),
    enabled: Boolean(historicalEnrollmentQuery.data?.studentId || profileStudentId),
  })

  const yearsQuery = useQuery({ queryKey: ["academic", "school-years", "enrollment"], queryFn: listSchoolYears, refetchOnMount: "always" })
  const levelsQuery = useQuery({ queryKey: ["academic", "levels", "enrollment"], queryFn: listLevels, refetchOnMount: "always" })
  const classesQuery = useQuery({
    queryKey: ["academic", "classes", "enrollment", schoolYearId],
    queryFn: () => listClasses(schoolYearId, { requireServer: Boolean(returnDraft) }),
    enabled: Boolean(schoolYearId),
    refetchOnMount: "always",
  })
  const availableClasses = useMemo(() => (classesQuery.data?.classes ?? []).filter((item) => item.isActive && (!levelId || item.level.id === levelId)), [classesQuery.data, levelId])
  const selectedClass = availableClasses.find((item) => item.id === classId)
  const canCreateClass = (user?.role === "director" || hasPermission("classes.create")) && (user?.role === "director" || hasPermission("classes.view"))
  const selectedYearActive = yearsQuery.data?.some((year) => year.id === schoolYearId && year.status === "active") && classesQuery.data?.activeSchoolYear?.id === schoolYearId
  const referencesPaused = yearsQuery.isPaused || levelsQuery.isPaused || classesQuery.isPaused
  const referencesLoading = referencesPaused || yearsQuery.isFetching || levelsQuery.isFetching || classesQuery.isFetching
  const referencesError = yearsQuery.isError || levelsQuery.isError || classesQuery.isError
  const returnPending = Boolean(returnDraft && !returnRestored)
  const canEditDraft = hasPermission("enrollments.edit") && hasPermission("students.edit")

  useEffect(() => {
    const historicalEnrollment = historicalEnrollmentQuery.data
    const student = historicalStudentQuery.data
    const contextId = enrollmentId ?? profileStudentId
    if (!contextId || !student || initializedEnrollmentId.current === contextId || (enrollmentId && !historicalEnrollment)) return
    initializedEnrollmentId.current = contextId
    if (historicalEnrollment) {
      setEnrollment(historicalEnrollment)
      setSchoolYearId(historicalEnrollment.schoolYearId)
      setClassId(historicalEnrollment.classId)
    }
    setForm(returnDraft?.form ?? {
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
  }, [enrollmentId, profileStudentId, historicalEnrollmentQuery.data, historicalStudentQuery.data, returnDraft])

  useEffect(() => {
    if (!levelId && selectedClass) setLevelId(selectedClass.level.id)
  }, [levelId, selectedClass])

  useEffect(() => {
    if (!returnDraft || returnRestored || referencesLoading || referencesError
      || !yearsQuery.data || !levelsQuery.data || !classesQuery.data
      || ((enrollmentId || profileStudentId) && !historicalStudentQuery.data)
      || (enrollmentId && !historicalEnrollmentQuery.data)) return
    const result = resolveEnrollmentClassReturn(returnDraft, yearsQuery.data, levelsQuery.data, classesQuery.data)
    setReturnRestored(true)
    setClassId(result.classId)
    setLevelId(levelsQuery.data.some((level) => level.id === returnDraft.context.levelId) ? returnDraft.context.levelId : "")
    setReturnMessage(result.message)
    discardEnrollmentClassDraft(returnDraft.context.draftId)
  }, [returnDraft, returnRestored, referencesLoading, referencesError, yearsQuery.data, levelsQuery.data, classesQuery.data, enrollmentId, profileStudentId, historicalStudentQuery.data, historicalEnrollmentQuery.data])

  const openClassCreation = () => {
    try {
      const context = saveEnrollmentClassDraft({
        form, classId, schoolYearId, levelId,
        returnTo: enrollment ? `/enrollments/${enrollment.id}/edit` : location.pathname + location.search,
      })
      navigate("/academic/classes", { state: context })
    } catch (error) {
      toast({ title: "Brouillon indisponible", description: error instanceof Error ? error.message : "Rouvrez le dossier depuis les inscriptions.", variant: "destructive" })
    }
  }

  const creationMutation = useMutation({
    mutationFn: async () => {
      if (!selectedClass || referencesLoading || referencesError || returnPending || (returnDraft && !selectedYearActive)) {
        throw new Error("Vérifiez l’année, le niveau et la classe avant de continuer.")
      }
      const contextValidation = returnDraft ? { levelId, expectedActiveSchoolYearId: schoolYearId } : {}
      const studentPayload = {
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
        const updatedEnrollment = await updateEnrollment(enrollment.id, { classId, ...contextValidation })
        return { enrollment: updatedEnrollment, missingMandatoryDocuments: [], documentWarning: null, updated: true }
      }
      const student = profileStudentId
        ? await updateStudent(profileStudentId, studentPayload)
        : await createStudent(studentPayload)
      return createEnrollment({ studentId: student.id, classId, schoolYearId, type: "new_registration", ...contextValidation })
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
  const historicalLoading = Boolean(enrollmentId || profileStudentId) && (historicalEnrollmentQuery.isLoading || historicalStudentQuery.isLoading)
  const historicalError = Boolean(enrollmentId || profileStudentId) && (historicalEnrollmentQuery.isError || historicalStudentQuery.isError)
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
        {returnMessage ? <Alert><AlertDescription>{returnMessage}</AlertDescription></Alert> : null}
        {referencesError ? <QueryErrorState message="Impossible de vérifier l’année, les niveaux et les classes. Réessayez avant de poursuivre." onRetry={() => { void yearsQuery.refetch(); void levelsQuery.refetch(); if (schoolYearId) void classesQuery.refetch() }} isRetrying={referencesLoading} /> : null}
        {returnPending && !referencesError ? <p role="status" className="text-sm text-muted-foreground">{referencesPaused ? "Connexion nécessaire pour vérifier l’année, le niveau et la classe. Le dossier reste en attente." : "Vérification du dossier et de la classe auprès du serveur…"}</p> : null}
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
                  <div className="space-y-2"><Label htmlFor="enrollment-year">Année scolaire *</Label><Select value={schoolYearId} onValueChange={(value) => { setSchoolYearId(value); setClassId(""); setReturnMessage(null) }} disabled={Boolean(enrollment) || returnPending}><SelectTrigger id="enrollment-year" className="min-h-12"><SelectValue placeholder={yearsQuery.isLoading ? "Chargement…" : "Choisir une année"} /></SelectTrigger><SelectContent>{(yearsQuery.data ?? []).map((year) => <SelectItem key={year.id} value={year.id}>{year.label}</SelectItem>)}</SelectContent></Select>{enrollment ? <p className="text-xs text-muted-foreground">L’année scolaire ne peut plus être changée après la création du dossier.</p> : null}</div>
                  <div className="space-y-2"><Label htmlFor="enrollment-level">Niveau visé</Label><Select value={levelId} onValueChange={(value) => { setLevelId(value); setClassId(""); setReturnMessage(null) }} disabled={levelsQuery.isLoading || returnPending}><SelectTrigger id="enrollment-level" className="min-h-12"><SelectValue placeholder={levelsQuery.isLoading ? "Chargement…" : "Choisir un niveau"} /></SelectTrigger><SelectContent>{(levelsQuery.data ?? []).map((level) => <SelectItem key={level.id} value={level.id}>{level.name}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-2"><Label htmlFor="enrollment-class">Classe visée *</Label><Select value={classId} onValueChange={(value) => { setClassId(value); const selected = availableClasses.find((item) => item.id === value); if (selected) setLevelId(selected.level.id); setReturnMessage(null) }} disabled={!schoolYearId || classesQuery.isLoading || returnPending}><SelectTrigger id="enrollment-class" className="min-h-12"><SelectValue placeholder={!schoolYearId ? "Choisissez d’abord l’année" : "Choisir une classe"} /></SelectTrigger><SelectContent>{availableClasses.map((item) => <SelectItem key={item.id} value={item.id}>{item.name} · {item.level.name} · {item.studentCount} élèves</SelectItem>)}</SelectContent></Select></div>
                </div>
                {schoolYearId && !referencesLoading && !referencesError && availableClasses.length === 0 ? <EmptyState title="Aucune classe adaptée" message="Aucune classe active n’est configurée pour l’année et le niveau choisis." /> : null}
                {canCreateClass ? <div className="space-y-2"><Button type="button" variant="outline" className="min-h-12" disabled={!selectedYearActive || !levelId || referencesLoading || referencesError || returnPending || creationMutation.isPending} onClick={openClassCreation}>Créer une classe</Button><p className="text-xs text-muted-foreground">Choisissez l’année active et un niveau pour créer une classe. Votre brouillon sera conservé pendant ce parcours.</p></div> : <p className="text-sm text-muted-foreground">Si la classe souhaitée manque, demandez au directeur ou à un responsable autorisé à créer des classes de l’ajouter.</p>}
                {selectedClass ? <p className="text-sm text-muted-foreground">Effectif actuel confirmé : <span className="font-medium text-foreground">{selectedClass.studentCount} élèves</span>. Les dossiers en attente de paiement ne sont pas comptés.</p> : null}
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
                <Button className="min-h-12 w-full sm:w-auto" disabled={!formValid || creationMutation.isPending || !selectedClass || referencesLoading || referencesError || returnPending || Boolean(returnDraft && !selectedYearActive)} onClick={() => creationMutation.mutate()}>
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
