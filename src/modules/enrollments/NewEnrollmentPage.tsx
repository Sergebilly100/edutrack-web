import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, ArrowRight, Loader2, UserPlus } from "lucide-react"
import { Link, useNavigate } from "react-router-dom"
import axios from "axios"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { listClasses, listSchoolYears } from "@/modules/academic/academic.api"
import { createStudent } from "@/modules/students/students.api"
import { PageLayout } from "@/shared/components/PageLayout"
import { usePermissions } from "@/shared/hooks/usePermissions"
import { isValidOptionalPhone, normalizePhoneInput } from "@/shared/utils/phone"
import { DocumentChecklist } from "./components/DocumentChecklist"
import { EnrollmentProgress } from "./components/EnrollmentProgress"
import { createEnrollment, type Enrollment } from "./enrollments.api"

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
  ? error.response.data.error : "Impossible de créer l’inscription."

export default function NewEnrollmentPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { hasPermission } = usePermissions()
  const [step, setStep] = useState(1)
  const [schoolYearId, setSchoolYearId] = useState("")
  const [classId, setClassId] = useState("")
  const [form, setForm] = useState<StudentForm>(EMPTY_FORM)
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null)

  const yearsQuery = useQuery({ queryKey: ["academic", "school-years", "enrollment"], queryFn: listSchoolYears })
  const classesQuery = useQuery({
    queryKey: ["academic", "classes", "enrollment", schoolYearId],
    queryFn: () => listClasses(schoolYearId),
    enabled: Boolean(schoolYearId),
  })
  const selectedClass = useMemo(() => classesQuery.data?.classes.find((item) => item.id === classId), [classId, classesQuery.data])

  const creationMutation = useMutation({
    mutationFn: async () => {
      const student = await createStudent({
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
      })
      return createEnrollment({ studentId: student.id, classId, schoolYearId, type: "new_registration", hasPreviousYearUnpaid: false })
    },
    onSuccess: async (result) => {
      setEnrollment(result.enrollment)
      setStep(2)
      await queryClient.invalidateQueries({ queryKey: ["enrollments"] })
      toast({ title: "Dossier créé", description: "Ajoutez maintenant les pièces demandées pour ce niveau." })
    },
    onError: (error) => toast({ title: "Création impossible", description: getError(error), variant: "destructive" }),
  })

  const parentPairValid = (form.parentName.trim().length === 0 && form.parentPhone.trim().length === 0)
    || (form.parentName.trim().length >= 2 && form.parentPhone.trim().length > 0)
  const formValid = Boolean(
    schoolYearId && classId && form.firstName.trim() && form.lastName.trim()
    && isValidOptionalPhone(form.parentPhone) && isValidOptionalPhone(form.parentPhone2)
    && parentPairValid && (!form.parentEmail.trim() || /.+@.+\..+/.test(form.parentEmail.trim())),
  )

  return (
    <PageLayout
      title="Nouvelle inscription"
      subtitle="Créez le dossier, ajoutez les pièces puis transmettez-le à la caisse."
      actions={<Button variant="outline" asChild><Link to="/enrollments"><ArrowLeft className="mr-2 h-4 w-4" />Retour</Link></Button>}
    >
      <div className="mx-auto max-w-3xl space-y-6">
        <EnrollmentProgress currentStep={step} />

        {step === 1 ? (
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
                  <div className="space-y-2"><Label>Année scolaire *</Label><Select value={schoolYearId} onValueChange={(value) => { setSchoolYearId(value); setClassId("") }}><SelectTrigger className="min-h-12"><SelectValue placeholder={yearsQuery.isLoading ? "Chargement…" : "Choisir une année"} /></SelectTrigger><SelectContent>{(yearsQuery.data ?? []).map((year) => <SelectItem key={year.id} value={year.id}>{year.label}</SelectItem>)}</SelectContent></Select></div>
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
                  {creationMutation.isPending ? "Création du dossier…" : "Créer et continuer"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {step === 2 && enrollment ? (
          <Card><CardHeader><CardTitle className="text-xl">Documents requis</CardTitle></CardHeader><CardContent className="space-y-5"><DocumentChecklist studentId={enrollment.studentId} canEdit={hasPermission("enrollments.edit")} /><div className="flex justify-end"><Button className="min-h-12 w-full sm:w-auto" onClick={() => setStep(3)}>Continuer vers la caisse<ArrowRight className="ml-2 h-4 w-4" /></Button></div></CardContent></Card>
        ) : null}

        {step === 3 && enrollment ? (
          <Card><CardHeader><CardTitle className="text-xl">Dossier prêt pour la caisse</CardTitle></CardHeader><CardContent className="space-y-5"><div className="rounded-lg bg-muted p-4"><p className="text-sm text-muted-foreground">Montant attendu</p><p className="mt-1 text-lg font-semibold">À calculer lors de la Vague 4</p><p className="mt-1 text-sm text-muted-foreground">La confirmation actuelle valide uniquement le statut de l’inscription.</p></div>{hasPermission("enrollments.confirm_payment") ? <Button className="min-h-12 w-full" onClick={() => navigate(`/enrollments/${enrollment.id}/payment`)}>Ouvrir la confirmation caisse<ArrowRight className="ml-2 h-4 w-4" /></Button> : <Alert><AlertDescription>Le dossier est transmis. Un membre autorisé du staff doit confirmer le paiement.</AlertDescription></Alert>}</CardContent></Card>
        ) : null}
      </div>
    </PageLayout>
  )
}
