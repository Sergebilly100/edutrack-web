import { birthDateIssue, yesterdayInBusinessTimezone } from "@/shared/lib/date-validation"
import { useEffect, useMemo, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react"
import { Link, useLocation, useNavigate, useParams } from "react-router-dom"
import axios from "axios"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { listClasses, listLevels, listSchoolYears } from "@/modules/academic/academic.api"
import { createStudent, getStudentById, updateStudent } from "@/modules/students/students.api"
import { PageLayout } from "@/shared/components/PageLayout"
import { QueryErrorState } from "@/shared/components/QueryErrorState"
import { usePermissions } from "@/shared/hooks/usePermissions"
import { useStudentLabels } from "@/shared/hooks/useStudentLabel"
import { BirthPlaceField, NationalityField, SexField } from "@/shared/components/IdentityFields"
import { birthPlaceError, cleanBirthPlace, identityToPayload } from "@/shared/lib/identity"
import { useAuthStore } from "@/shared/store/auth.store"
import { discardEnrollmentClassDraft, readEnrollmentClassDraft, resolveEnrollmentClassReturn, saveEnrollmentClassDraft, type EnrollmentIdentityDraft } from "@/shared/lib/enrollment-class-flow"
import { isValidOptionalPhone, normalizePhoneInput } from "@/shared/utils/phone"
import { DocumentChecklist } from "./components/DocumentChecklist"
import { EnrollmentProgress } from "./components/EnrollmentProgress"
import { createEnrollment, getEnrollment, updateEnrollment, verifyStudentDocuments, type Enrollment } from "./enrollments.api"

const EMPTY_FORM: EnrollmentIdentityDraft = {
  firstName: "", lastName: "", birthDate: "", matricule: "", parentName: "",
  parentPhone: "", parentEmail: "", parentName2: "", parentPhone2: "",
  sex: "", nationality: "", birthPlace: "",
  // « Non » présélectionné pour une nouvelle inscription ; l’utilisateur peut le modifier.
  isRepeating: "false",
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
  const [returnDraft] = useState(() => readEnrollmentClassDraft(location.state, location.pathname))
  const [returnRestored, setReturnRestored] = useState(false)
  const [returnMessage, setReturnMessage] = useState<string | null>(() => location.state && !returnDraft ? "Le brouillon temporaire a expiré ou a été effacé après une actualisation. Rouvrez le dossier depuis les inscriptions." : null)
  const { enrollmentId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { hasPermission } = usePermissions()
  const studentLabels = useStudentLabels()
  const [step, setStep] = useState(1)
  const [schoolYearId, setSchoolYearId] = useState(returnDraft?.context.schoolYearId ?? "")
  const [levelId, setLevelId] = useState(returnDraft?.context.levelId ?? "")
  const [classId, setClassId] = useState("")
  const [form, setForm] = useState<EnrollmentIdentityDraft>(returnDraft?.form ?? EMPTY_FORM)
  const [birthInputError, setBirthInputError] = useState<string | null>(null)
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
    enabled: Boolean(historicalEnrollmentQuery.data?.studentId),
  })

  const yearsQuery = useQuery({ queryKey: ["academic", "school-years", "enrollment"], queryFn: listSchoolYears, refetchOnMount: "always" })
  const activeYear = yearsQuery.data?.find((year) => year.status === "active")
  useEffect(() => {
    if (!enrollmentId && !returnDraft && yearsQuery.data) setSchoolYearId(activeYear?.id ?? "")
  }, [activeYear?.id, enrollmentId, returnDraft, yearsQuery.data])
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
    if (!enrollmentId || !student || initializedEnrollmentId.current === enrollmentId || !historicalEnrollment) return
    initializedEnrollmentId.current = enrollmentId
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
      sex: student.sex ?? "",
      nationality: student.nationality ?? "",
      birthPlace: student.birthPlace ?? "",
      // Inscription existante : on reflète la valeur enregistrée (null = non renseigné, aucune présélection).
      isRepeating: historicalEnrollment.isRepeating === true ? "true" : historicalEnrollment.isRepeating === false ? "false" : "",
    })
  }, [enrollmentId, historicalEnrollmentQuery.data, historicalStudentQuery.data, returnDraft])

  useEffect(() => {
    if (!levelId && selectedClass) setLevelId(selectedClass.level.id)
  }, [levelId, selectedClass])

  useEffect(() => {
    if (!returnDraft || returnRestored || referencesLoading || referencesError
      || !yearsQuery.data || !levelsQuery.data || !classesQuery.data
      || (enrollmentId && !historicalStudentQuery.data)
      || (enrollmentId && !historicalEnrollmentQuery.data)) return
    const result = resolveEnrollmentClassReturn(returnDraft, yearsQuery.data, levelsQuery.data, classesQuery.data)
    setReturnRestored(true)
    setClassId(result.classId)
    setLevelId(levelsQuery.data.some((level) => level.id === returnDraft.context.levelId) ? returnDraft.context.levelId : "")
    setReturnMessage(result.message)
    discardEnrollmentClassDraft(returnDraft.context.draftId)
  }, [returnDraft, returnRestored, referencesLoading, referencesError, yearsQuery.data, levelsQuery.data, classesQuery.data, enrollmentId, historicalStudentQuery.data, historicalEnrollmentQuery.data])

  const openClassCreation = () => {
    try {
      const context = saveEnrollmentClassDraft({
        form, classId, schoolYearId, levelId,
        returnTo: enrollment ? `/enrollments/${enrollment.id}/edit` : location.pathname,
      })
      navigate("/academic/classes", { state: context })
    } catch (error) {
      toast({ title: "Brouillon indisponible", description: error instanceof Error ? error.message : "Rouvrez le dossier depuis les inscriptions.", variant: "destructive" })
    }
  }

  const creationMutation = useMutation({
    mutationFn: async () => {
      if (!selectedClass || referencesLoading || referencesError || returnPending || (!enrollment && !selectedYearActive) || (returnDraft && !selectedYearActive)) {
        throw new Error("Vérifiez l’année, le niveau et la classe avant de continuer.")
      }
      const contextValidation = !enrollment || returnDraft ? { levelId, expectedActiveSchoolYearId: schoolYearId } : {}
      const studentPayload = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        ...(enrollment && form.birthDate === (historicalStudentQuery.data?.birthDate?.slice(0, 10) ?? "")
          ? {} : { birthDate: form.birthDate || null }),
        matricule: form.matricule.trim() || null,
        parentName: form.parentName.trim() || null,
        parentPhone: form.parentPhone.trim() || null,
        parentEmail: form.parentEmail.trim() || null,
        parentName2: form.parentName2.trim() || null,
        parentPhone2: form.parentPhone2.trim() || null,
        ...identityToPayload(form),
      }
      const isRepeating = form.isRepeating === "" ? null : form.isRepeating === "true"
      if (enrollment) {
        await updateStudent(enrollment.studentId, studentPayload)
        const updatedEnrollment = await updateEnrollment(enrollment.id, { classId, ...contextValidation, isRepeating })
        return { enrollment: updatedEnrollment, missingMandatoryDocuments: [], documentWarning: null, updated: true }
      }
      const student = await createStudent(studentPayload)
      return createEnrollment({ studentId: student.id, classId, schoolYearId, type: "new_registration", isRepeating, ...contextValidation })
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

  const identityValue = { sex: form.sex, nationality: form.nationality, birthPlace: form.birthPlace }
  const applyIdentity = (next: typeof identityValue) => setForm((current) => ({ ...current, ...next }))
  const birthDateUnchanged = Boolean(enrollment) && form.birthDate === (historicalStudentQuery.data?.birthDate?.slice(0, 10) ?? "")
  const existingBirthDateIssue = birthDateUnchanged ? birthDateIssue(form.birthDate) : null
  const birthDateError = (birthDateUnchanged ? null : birthDateIssue(form.birthDate)) ?? birthInputError
  const parentPairValid = (form.parentName.trim().length === 0 && form.parentPhone.trim().length === 0)
    || (form.parentName.trim().length >= 2 && form.parentPhone.trim().length > 0)
  const parentPhoneValid = isValidOptionalPhone(form.parentPhone)
  const secondPhoneValid = isValidOptionalPhone(form.parentPhone2)
  const parentEmailValid = !form.parentEmail.trim() || /.+@.+\..+/.test(form.parentEmail.trim())
  const formValid = Boolean(
    schoolYearId && classId && form.firstName.trim() && form.lastName.trim()
    && !birthDateError && Boolean(form.sex && form.nationality && cleanBirthPlace(form.birthPlace) && form.isRepeating) && !birthPlaceError(form.birthPlace) && parentPhoneValid && secondPhoneValid && parentPairValid && parentEmailValid,
  )
  const yearLabel = yearsQuery.data?.find((year) => year.id === schoolYearId)?.label
    ?? (enrollmentId && historicalEnrollmentQuery.data?.schoolYearId === schoolYearId ? historicalEnrollmentQuery.data.schoolYearLabel : null)
  const blockedReason = referencesLoading || returnPending ? "Vérification de l’année et des classes en cours…"
    : referencesError ? "Les classes sont indisponibles. Réessayez après le chargement."
    : !schoolYearId || ((!enrollment || returnDraft) && !selectedYearActive) ? "Aucune année scolaire active n’est disponible pour cette inscription."
    : !form.firstName.trim() || !form.lastName.trim() ? "Renseignez le prénom et le nom de l’élève."
    : birthDateError ? birthDateError
    : !form.sex || !form.nationality || !cleanBirthPlace(form.birthPlace) ? "Renseignez le sexe, la nationalité et le lieu de naissance."
    : birthPlaceError(form.birthPlace) ? birthPlaceError(form.birthPlace)
    : !form.isRepeating ? "Indiquez si l’élève est redoublant."
    : !classId || !selectedClass ? "Choisissez une classe pour continuer."
    : !parentPairValid ? "Renseignez ensemble le nom et le téléphone du parent, ou laissez les deux champs vides."
    : !parentPhoneValid || !secondPhoneValid ? "Vérifiez le format du numéro de téléphone."
    : !parentEmailValid ? "Vérifiez l’adresse e-mail du parent."
    : null
  const historicalLoading = Boolean(enrollmentId) && (historicalEnrollmentQuery.isLoading || historicalStudentQuery.isLoading)
  const historicalError = Boolean(enrollmentId) && (historicalEnrollmentQuery.isError || historicalStudentQuery.isError)
  const historicalConfirmed = historicalEnrollmentQuery.data?.status === "confirmed"
  const historicalForbidden = Boolean(enrollmentId) && !canEditDraft

  return (
    <PageLayout
      title={enrollmentId ? "Modifier l’inscription" : "Nouvelle inscription"}
      subtitle={
        enrollmentId
          ? "Corrigez l’identité, les contacts du parent ou la classe tant que l’inscription n’est pas finalisée."
          : "Renseignez l’élève et ses documents. Le passage en caisse se fait ensuite depuis la liste des inscriptions."
      }
      actions={
        <Button variant="outline" asChild>
          <Link to="/enrollments">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour
          </Link>
        </Button>
      }
    >
      <div className="mx-auto max-w-3xl space-y-6">
        {historicalLoading ? (
          <div className="space-y-3" aria-label="Chargement de l’inscription">
            <div className="h-16 animate-pulse rounded-lg bg-muted" />
            <div className="h-96 animate-pulse rounded-lg bg-muted" />
          </div>
        ) : null}
        {historicalError ? (
          <QueryErrorState
            message="Impossible de charger l’inscription et les informations de l’élève."
            onRetry={() => {
              void historicalEnrollmentQuery.refetch();
              void historicalStudentQuery.refetch();
            }}
            isRetrying={
              historicalEnrollmentQuery.isFetching ||
              historicalStudentQuery.isFetching
            }
          />
        ) : null}
        {historicalForbidden ? (
          <Alert variant="destructive">
            <AlertDescription>
              Votre poste doit autoriser la modification des inscriptions et des
              élèves pour ouvrir ce formulaire.
            </AlertDescription>
          </Alert>
        ) : null}
        {historicalConfirmed ? (
          <Alert>
            <AlertDescription>
              Cette inscription est finalisée. Ses informations ne peuvent plus
              être modifiées depuis ce parcours.
            </AlertDescription>
          </Alert>
        ) : null}
        {returnMessage ? (
          <Alert>
            <AlertDescription>{returnMessage}</AlertDescription>
          </Alert>
        ) : null}
        {referencesError ? (
          <QueryErrorState
            message="Impossible de vérifier l’année, les niveaux et les classes. Réessayez avant de poursuivre."
            onRetry={() => {
              void yearsQuery.refetch();
              void levelsQuery.refetch();
              if (schoolYearId) void classesQuery.refetch();
            }}
            isRetrying={referencesLoading}
          />
        ) : null}
        {!yearsQuery.isLoading &&
        !referencesError &&
        !enrollmentId &&
        !activeYear ? (
          <Alert variant="destructive">
            <AlertDescription>
              Aucune année scolaire active. Ouvrez une année scolaire avant de
              créer une inscription.
            </AlertDescription>
          </Alert>
        ) : null}
        {returnPending && !referencesError ? (
          <p role="status" className="text-sm text-muted-foreground">
            {referencesPaused
              ? "Connexion nécessaire pour vérifier l’année, le niveau et la classe. Le dossier reste en attente."
              : "Vérification du dossier et de la classe auprès du serveur…"}
          </p>
        ) : null}
        {!historicalLoading &&
        !historicalError &&
        !historicalConfirmed &&
        !historicalForbidden ? (
          <div className="space-y-4">
            {yearLabel ? (
              <p className="text-sm text-muted-foreground">
                {enrollmentId ? "Année du dossier" : "Année scolaire active"}{" "}
                <span className="ml-1 font-semibold text-foreground">
                  {yearLabel}
                </span>
              </p>
            ) : null}
            <EnrollmentProgress currentStep={step} />
          </div>
        ) : null}

        {!historicalLoading &&
        !historicalError &&
        !historicalConfirmed &&
        !historicalForbidden &&
        step === 1 ? (
          <Card className="rounded-lg shadow-sm">
            <CardContent className="space-y-8 p-4 sm:p-6 [&_input]:min-h-12">
              <section
                className="space-y-4"
                aria-labelledby="student-identity-title"
              >
                <h2
                  id="student-identity-title"
                  className="text-base font-semibold"
                >
                  Identité de l’{studentLabels.singularLower}
                </h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="first-name">Prénom *</Label>
                    <Input
                      id="first-name"
                      value={form.firstName}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          firstName: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last-name">Nom *</Label>
                    <Input
                      id="last-name"
                      value={form.lastName}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          lastName: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="birth-date">Date de naissance</Label>
                    <Input
                      id="birth-date"
                      type="date"
                      max={yesterdayInBusinessTimezone()}
                      aria-invalid={Boolean(
                        birthDateError || existingBirthDateIssue,
                      )}
                      aria-describedby={
                        birthDateError
                          ? "birth-date-error"
                          : existingBirthDateIssue
                            ? "existing-birth-date-error"
                            : undefined
                      }
                      value={form.birthDate}
                      onInput={(event) =>
                        setBirthInputError(
                          event.currentTarget.validity.badInput
                            ? "Date de naissance invalide : indiquez une date réelle."
                            : null,
                        )
                      }
                      onChange={(event) => {
                        setBirthInputError(null);
                        setForm((current) => ({
                          ...current,
                          birthDate: event.target.value,
                        }));
                      }}
                    />
                    {birthDateError ? (
                      <p
                        id="birth-date-error"
                        role="alert"
                        className="text-sm text-destructive"
                      >
                        {birthDateError}
                      </p>
                    ) : null}
                    {existingBirthDateIssue ? (
                      <p
                        id="existing-birth-date-error"
                        className="text-sm text-destructive"
                      >
                        Date existante à corriger. Vous pouvez enregistrer les
                        autres informations sans la modifier.
                      </p>
                    ) : null}
                  </div>
                  <BirthPlaceField idPrefix="enrollment" required value={identityValue} onChange={applyIdentity} />
                  <SexField idPrefix="enrollment" required value={identityValue} onChange={applyIdentity} />
                  <div className="space-y-2">
                    <Label htmlFor="matricule">Matricule (facultatif)</Label>
                    <Input
                      id="matricule"
                      aria-describedby="matricule-help"
                      value={form.matricule}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          matricule: event.target.value,
                        }))
                      }
                    />
                    <p
                      id="matricule-help"
                      className="text-xs text-muted-foreground"
                    >
                      Chaque matricule renseigné doit être unique parmi les{" "}
                      {studentLabels.pluralLower}.
                    </p>
                  </div>
                  <NationalityField idPrefix="enrollment" required value={identityValue} onChange={applyIdentity} />
                  <fieldset className="mt-2 space-y-2">
                    <legend className="text-sm font-medium leading-none">
                      Redoublant pour cette année scolaire *
                    </legend>
                    <RadioGroup
                      value={form.isRepeating}
                      onValueChange={(value) =>
                        setForm((current) => ({
                          ...current,
                          isRepeating: value as "true" | "false",
                        }))
                      }
                      className="flex flex-wrap gap-2"
                      aria-label="Redoublant"
                    >
                      {(
                        [
                          ["false", "Non"],
                          ["true", "Oui"],
                        ] as const
                      ).map(([value, label]) => (
                        <Label
                          key={value}
                          htmlFor={`enrollment-repeating-${value}`}
                          className="flex min-h-12 cursor-pointer items-center gap-2 rounded-lg border px-4 font-normal has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                        >
                          <RadioGroupItem
                            id={`enrollment-repeating-${value}`}
                            value={value}
                          />
                          {label}
                        </Label>
                      ))}
                    </RadioGroup>
                    {form.isRepeating === "" ? (
                      <p className="text-xs text-destructive">À renseigner</p>
                    ) : null}
                  </fieldset>
                </div>
              </section>

              <section
                className="space-y-4 border-t pt-6"
                aria-labelledby="target-class-title"
              >
                <h2 id="target-class-title" className="text-base font-semibold">
                  Affectation
                </h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="enrollment-level">Niveau visé</Label>
                    <Select
                      value={levelId}
                      onValueChange={(value) => {
                        setLevelId(value);
                        setClassId("");
                        setReturnMessage(null);
                      }}
                      disabled={levelsQuery.isLoading || returnPending}
                    >
                      <SelectTrigger id="enrollment-level" className="min-h-12">
                        <SelectValue
                          placeholder={
                            levelsQuery.isLoading
                              ? "Chargement…"
                              : "Choisir un niveau"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {(levelsQuery.data ?? []).map((level) => (
                          <SelectItem key={level.id} value={level.id}>
                            {level.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="enrollment-class">Classe visée *</Label>
                    <Select
                      value={classId}
                      onValueChange={(value) => {
                        setClassId(value);
                        const selected = availableClasses.find(
                          (item) => item.id === value,
                        );
                        if (selected) setLevelId(selected.level.id);
                        setReturnMessage(null);
                      }}
                      disabled={
                        !schoolYearId || classesQuery.isLoading || returnPending
                      }
                    >
                      <SelectTrigger id="enrollment-class" className="min-h-12">
                        <SelectValue placeholder="Choisir une classe" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableClasses.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.name} · {item.level.name} ·{" "}
                            {item.studentCount}{" "}
                            {item.studentCount === 1
                              ? "élève confirmé"
                              : "élèves confirmés"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {schoolYearId &&
                !referencesLoading &&
                !referencesError &&
                availableClasses.length === 0 ? (
                  <div className="flex flex-col gap-3 rounded-lg border bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-foreground">
                      {levelId
                        ? "Aucune classe pour ce niveau."
                        : "Aucune classe pour l’année active."}{" "}
                      {!canCreateClass
                        ? "Demandez au directeur d’en créer une."
                        : !levelId
                          ? "Choisissez un niveau pour en créer une."
                          : null}
                    </p>
                    {canCreateClass && levelId && selectedYearActive ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="min-h-12 shrink-0"
                        disabled={returnPending || creationMutation.isPending}
                        onClick={openClassCreation}
                      >
                        Créer une classe
                      </Button>
                    ) : null}
                  </div>
                ) : null}
                {canCreateClass &&
                levelId &&
                selectedYearActive &&
                availableClasses.length > 0 ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-12"
                    disabled={
                      referencesLoading ||
                      referencesError ||
                      returnPending ||
                      creationMutation.isPending
                    }
                    onClick={openClassCreation}
                  >
                    Créer une classe
                  </Button>
                ) : null}
                {selectedClass ? (
                  <p className="text-sm text-muted-foreground">
                    Effectif actuel confirmé :{" "}
                    <span className="font-medium text-foreground">
                      {selectedClass.studentCount}{" "}
                      {selectedClass.studentCount === 1 ? "élève" : "élèves"}
                    </span>
                    . Les dossiers en attente de paiement ne sont pas comptés.
                  </p>
                ) : null}
              </section>

              <section
                className="space-y-4 border-t pt-6"
                aria-labelledby="parent-title"
              >
                <div>
                  <h2 id="parent-title" className="text-base font-semibold">
                    Contact parent
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Facultatif. Le nom et le téléphone se renseignent ensemble.
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="parent-name">Nom du parent</Label>
                    <Input
                      id="parent-name"
                      aria-invalid={!parentPairValid}
                      aria-describedby={
                        !parentPairValid ? "parent-pair-error" : undefined
                      }
                      value={form.parentName}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          parentName: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="parent-phone">Téléphone</Label>
                    <Input
                      id="parent-phone"
                      inputMode="tel"
                      placeholder="2250700000000"
                      aria-invalid={!parentPairValid || !parentPhoneValid}
                      aria-describedby={
                        !parentPairValid || !parentPhoneValid
                          ? "parent-pair-error"
                          : undefined
                      }
                      value={form.parentPhone}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          parentPhone: normalizePhoneInput(event.target.value),
                        }))
                      }
                    />
                  </div>
                </div>
                {(!parentPairValid || !parentPhoneValid) &&
                (form.parentName.trim() || form.parentPhone.trim()) ? (
                  <p
                    id="parent-pair-error"
                    className="text-sm text-destructive"
                  >
                    {!parentPairValid
                      ? "Complétez le nom et le téléphone du parent, ou laissez les deux champs vides."
                      : "Vérifiez le numéro de téléphone du parent."}
                  </p>
                ) : null}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="parent-email">E-mail du parent</Label>
                    <Input
                      id="parent-email"
                      type="email"
                      aria-invalid={!parentEmailValid}
                      aria-describedby={
                        !parentEmailValid ? "parent-email-error" : undefined
                      }
                      value={form.parentEmail}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          parentEmail: event.target.value,
                        }))
                      }
                    />
                    {!parentEmailValid ? (
                      <p
                        id="parent-email-error"
                        className="text-sm text-destructive"
                      >
                        Vérifiez l’adresse e-mail.
                      </p>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="parent-name-2">Nom du second parent</Label>
                    <Input
                      id="parent-name-2"
                      value={form.parentName2}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          parentName2: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="parent-phone-2">Second téléphone</Label>
                    <Input
                      id="parent-phone-2"
                      inputMode="tel"
                      aria-invalid={!secondPhoneValid}
                      aria-describedby={
                        !secondPhoneValid ? "parent-phone-2-error" : undefined
                      }
                      value={form.parentPhone2}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          parentPhone2: normalizePhoneInput(event.target.value),
                        }))
                      }
                    />
                    {!secondPhoneValid ? (
                      <p
                        id="parent-phone-2-error"
                        className="text-sm text-destructive"
                      >
                        Vérifiez le second numéro de téléphone.
                      </p>
                    ) : null}
                  </div>
                </div>
              </section>

              <div className="sticky bottom-0 z-10 -mx-4 -mb-4 flex flex-col gap-2 border-t bg-card px-4 py-4 sm:-mx-6 sm:-mb-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <p aria-live="polite" className="text-sm text-muted-foreground">
                  {blockedReason ??
                    "Les informations sont prêtes pour la suite du dossier."}
                </p>
                <Button
                  className="min-h-12 w-full sm:w-auto"
                  disabled={
                    !formValid ||
                    creationMutation.isPending ||
                    !selectedClass ||
                    referencesLoading ||
                    referencesError ||
                    returnPending ||
                    Boolean((!enrollment || returnDraft) && !selectedYearActive)
                  }
                  onClick={() => creationMutation.mutate()}
                >
                  {creationMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowRight className="mr-2 h-4 w-4" />
                  )}
                  {creationMutation.isPending
                    ? enrollment
                      ? "Mise à jour…"
                      : "Création du dossier…"
                    : enrollment
                      ? "Enregistrer et continuer"
                      : "Créer et continuer"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {step === 2 && enrollment ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Documents requis</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <DocumentChecklist
                studentId={enrollment.studentId}
                canEdit={hasPermission("enrollments.edit")}
              />
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                {canEditDraft ? (
                  <Button
                    variant="outline"
                    className="min-h-12"
                    disabled={finishMutation.isPending}
                    onClick={() => setStep(1)}
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Modifier les informations
                  </Button>
                ) : (
                  <span />
                )}
                <Button
                  className="min-h-12"
                  disabled={finishMutation.isPending}
                  onClick={() => finishMutation.mutate()}
                >
                  {finishMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  {finishMutation.isPending
                    ? "Vérification…"
                    : "Terminer le dossier"}
                  {!finishMutation.isPending ? (
                    <ArrowRight className="ml-2 h-4 w-4" />
                  ) : null}
                </Button>
              </div>
              <p className="text-right text-sm text-muted-foreground">
                Les pièces seront vérifiées automatiquement. Le paiement pourra
                ensuite être enregistré avec le bouton « Caisse ».
              </p>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </PageLayout>
  );
}
