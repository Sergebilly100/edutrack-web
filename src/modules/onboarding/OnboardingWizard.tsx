import { type CSSProperties, useEffect, useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"

import ImportWizard from "@/modules/import-export/ImportWizard"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { useStudentLabels, type StudentLabels } from "@/shared/hooks/useStudentLabel"
import {
  completeOnboarding,
  createScheduleSlot,
  createStudent,
  createTeacher,
  fetchSchoolInfo,
  fetchTeachers,
  patchSchoolInfo,
  type SchoolInfoPayload,
} from "@/modules/onboarding/onboarding.api"

const ONBOARDING_PROGRESS_KEY = "onboarding_progress"

type OnboardingStep = 1 | 2 | 3 | 4 | 5

type OnboardingProgress = {
  step: OnboardingStep
  schoolInfo: SchoolInfoPayload
  manualTeacher: { name: string; subject: string; type: "vacataire" | "permanent" }
  manualStudent: { first_name: string; last_name: string; class_name: string }
  manualSchedule: {
    teacher_id: string
    class_name: string
    day_of_week: string
    time_slot: string
  }
}

const defaultProgress: OnboardingProgress = {
  step: 1,
  schoolInfo: {
    name: "",
    address: "",
    phone: "",
  },
  manualTeacher: {
    name: "",
    subject: "",
    type: "vacataire",
  },
  manualStudent: {
    first_name: "",
    last_name: "",
    class_name: "",
  },
  manualSchedule: {
    teacher_id: "",
    class_name: "",
    day_of_week: "1",
    time_slot: "08:00-10:00",
  },
}

const dayOptions = [
  { value: "1", label: "Lundi" },
  { value: "2", label: "Mardi" },
  { value: "3", label: "Mercredi" },
  { value: "4", label: "Jeudi" },
  { value: "5", label: "Vendredi" },
  { value: "6", label: "Samedi" },
]

const slotOptions = ["08:00-10:00", "10:00-12:00", "14:00-16:00", "16:00-18:00"]

const buildStepLabels = (labels: StudentLabels): Array<{ step: OnboardingStep; label: string }> => [
  { step: 1, label: "Infos école" },
  { step: 2, label: "Profs" },
  { step: 3, label: labels.plural },
  { step: 4, label: "Emploi du temps" },
  { step: 5, label: "Test live" },
]

function loadProgress(): OnboardingProgress {
  if (typeof window === "undefined") {
    return defaultProgress
  }

  const rawValue = window.localStorage.getItem(ONBOARDING_PROGRESS_KEY)
  if (!rawValue) {
    return defaultProgress
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<OnboardingProgress>
    return {
      ...defaultProgress,
      ...parsed,
      schoolInfo: { ...defaultProgress.schoolInfo, ...parsed.schoolInfo },
      manualTeacher: { ...defaultProgress.manualTeacher, ...parsed.manualTeacher },
      manualStudent: { ...defaultProgress.manualStudent, ...parsed.manualStudent },
      manualSchedule: { ...defaultProgress.manualSchedule, ...parsed.manualSchedule },
    }
  } catch {
    return defaultProgress
  }
}

function clampStep(step: number): OnboardingStep {
  if (step <= 1) return 1
  if (step >= 5) return 5
  return step as OnboardingStep
}

export default function OnboardingWizard() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const studentLabels = useStudentLabels()
  const stepLabels = buildStepLabels(studentLabels)

  const [progress, setProgress] = useState<OnboardingProgress>(() => loadProgress())

  const schoolInfoQuery = useQuery({
    queryKey: ["school-info"],
    queryFn: fetchSchoolInfo,
  })

  const teachersQuery = useQuery({
    queryKey: ["onboarding-teachers"],
    queryFn: fetchTeachers,
  })

  const schoolInfoMutation = useMutation({
    mutationFn: patchSchoolInfo,
    onSuccess: () => {
      setProgress((previous) => ({ ...previous, step: 2 }))
      toast({ title: "Informations école enregistrées" })
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Une erreur est survenue"
      toast({ title: "Erreur", description: message, variant: "destructive" })
    },
  })

  const createTeacherMutation = useMutation({
    mutationFn: createTeacher,
    onSuccess: () => {
      void teachersQuery.refetch()
      toast({ title: "Professeur ajouté" })
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Une erreur est survenue"
      toast({ title: "Erreur", description: message, variant: "destructive" })
    },
  })

  const createStudentMutation = useMutation({
    mutationFn: createStudent,
    onSuccess: () => {
      toast({ title: `${studentLabels.singular} ajouté` })
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Une erreur est survenue"
      toast({ title: "Erreur", description: message, variant: "destructive" })
    },
  })

  const createScheduleMutation = useMutation({
    mutationFn: createScheduleSlot,
    onSuccess: () => {
      toast({ title: "Créneau ajouté" })
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Une erreur est survenue"
      toast({ title: "Erreur", description: message, variant: "destructive" })
    },
  })

  const completeMutation = useMutation({
    mutationFn: completeOnboarding,
    onSuccess: () => {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(ONBOARDING_PROGRESS_KEY)
      }
      navigate("/dashboard", { replace: true })
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Une erreur est survenue"
      toast({ title: "Erreur", description: message, variant: "destructive" })
    },
  })

  useEffect(() => {
    if (schoolInfoQuery.data?.onboarding_completed) {
      navigate("/dashboard", { replace: true })
    }
  }, [navigate, schoolInfoQuery.data?.onboarding_completed])

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    window.localStorage.setItem(ONBOARDING_PROGRESS_KEY, JSON.stringify(progress))
  }, [progress])

  const currentStep = progress.step
  const progressPercent = Math.round((currentStep / 5) * 100)
  const teachers = teachersQuery.data ?? []

  const setStep = (step: number) => {
    setProgress((previous) => ({ ...previous, step: clampStep(step) }))
  }

  const isStepTwoValid = teachers.length > 0

  const handleSchoolInfoSubmit = () => {
    if (!progress.schoolInfo.name || !progress.schoolInfo.address || !progress.schoolInfo.phone) {
      toast({
        title: "Champs requis",
        description: "Renseignez nom, adresse et téléphone de l'école.",
      })
      return
    }

    schoolInfoMutation.mutate(progress.schoolInfo)
  }

  const handleManualTeacherSubmit = () => {
    const payload = progress.manualTeacher

    if (!payload.name || !payload.subject || !payload.type) {
      toast({
        title: "Champs requis",
        description: "Renseignez nom, matière et type du professeur.",
      })
      return
    }

    createTeacherMutation.mutate({
      name: payload.name,
      subjects: [payload.subject],
      type: payload.type,
    })
  }

  const handleManualStudentSubmit = () => {
    const payload = progress.manualStudent

    if (!payload.first_name || !payload.last_name || !payload.class_name) {
      toast({
        title: "Champs requis",
        description: "Renseignez prénom, nom et classe.",
      })
      return
    }

    createStudentMutation.mutate(payload)
  }

  const handleManualScheduleSubmit = () => {
    const payload = progress.manualSchedule

    if (!payload.teacher_id || !payload.class_name || !payload.day_of_week || !payload.time_slot) {
      toast({
        title: "Champs requis",
        description: "Renseignez prof, classe, jour et créneau.",
      })
      return
    }

    createScheduleMutation.mutate({
      teacher_id: payload.teacher_id,
      class_name: payload.class_name,
      day_of_week: Number(payload.day_of_week),
      time_slot_label: payload.time_slot,
    })
  }

  return (
    <Card className="mx-auto w-full max-w-5xl">
      <CardHeader className="space-y-4">
        <div className="space-y-1">
          <CardTitle>Onboarding directeur</CardTitle>
          <p className="text-sm text-muted-foreground">Étape {currentStep}/5</p>
        </div>

        <div className="space-y-2">
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full w-[var(--progress)] bg-primary transition-all duration-300"
                style={{ "--progress": `${progressPercent}%` } as CSSProperties}
              />
            </div>
          <div className="flex flex-wrap gap-2">
            {stepLabels.map((item) => (
              <Badge key={item.step} variant={item.step <= currentStep ? "default" : "outline"}>
                {item.step}. {item.label}
              </Badge>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {schoolInfoQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Vérification du statut onboarding...</p>
        ) : null}

        {currentStep === 1 ? (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Étape 1 — Infos école</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="school-name">Nom de l'école</Label>
                <Input
                  id="school-name"
                  value={progress.schoolInfo.name}
                  onChange={(event) =>
                    setProgress((previous) => ({
                      ...previous,
                      schoolInfo: { ...previous.schoolInfo, name: event.target.value },
                    }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="school-phone">Téléphone</Label>
                <Input
                  id="school-phone"
                  value={progress.schoolInfo.phone}
                  onChange={(event) =>
                    setProgress((previous) => ({
                      ...previous,
                      schoolInfo: { ...previous.schoolInfo, phone: event.target.value },
                    }))
                  }
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="school-address">Adresse</Label>
                <Input
                  id="school-address"
                  value={progress.schoolInfo.address}
                  onChange={(event) =>
                    setProgress((previous) => ({
                      ...previous,
                      schoolInfo: { ...previous.schoolInfo, address: event.target.value },
                    }))
                  }
                />
              </div>
            </div>

            <Button
              className="min-h-[48px]"
              onClick={handleSchoolInfoSubmit}
              disabled={schoolInfoMutation.isPending}
            >
              {schoolInfoMutation.isPending ? "Enregistrement..." : "Continuer"}
            </Button>
          </div>
        ) : null}

        {currentStep === 2 ? (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Étape 2 — Professeurs</h2>
            <Alert>
              <AlertDescription>
                Importez vos profs (type teachers) ou ajoutez-en un manuellement. Minimum requis: 1 professeur.
              </AlertDescription>
            </Alert>

            <ImportWizard />

            <div className="space-y-3 rounded-lg border border-border p-4">
              <h3 className="font-medium">Saisie manuelle rapide</h3>
              <div className="grid gap-3 md:grid-cols-3">
                <Input
                  placeholder="Nom du prof"
                  value={progress.manualTeacher.name}
                  onChange={(event) =>
                    setProgress((previous) => ({
                      ...previous,
                      manualTeacher: { ...previous.manualTeacher, name: event.target.value },
                    }))
                  }
                />
                <Input
                  placeholder="Matière"
                  value={progress.manualTeacher.subject}
                  onChange={(event) =>
                    setProgress((previous) => ({
                      ...previous,
                      manualTeacher: { ...previous.manualTeacher, subject: event.target.value },
                    }))
                  }
                />
                <Select
                  value={progress.manualTeacher.type}
                  onValueChange={(value) =>
                    setProgress((prev) => ({
                      ...prev,
                      manualTeacher: {
                        ...prev.manualTeacher,
                        type: value as "vacataire" | "permanent",
                      },
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vacataire">Vacataire</SelectItem>
                    <SelectItem value="permanent">Permanent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  className="min-h-[48px]"
                  onClick={handleManualTeacherSubmit}
                  disabled={createTeacherMutation.isPending}
                >
                  Ajouter le professeur
                </Button>
                <Button
                  variant="outline"
                  className="min-h-[48px]"
                  onClick={() => void teachersQuery.refetch()}
                >
                  Actualiser la liste
                </Button>
                <Badge variant={isStepTwoValid ? "default" : "outline"}>
                  {teachers.length} professeur(s)
                </Badge>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" className="min-h-[48px]" disabled={!isStepTwoValid} onClick={() => setStep(3)}>
                Continuer
              </Button>
              <Button variant="ghost" className="min-h-[48px]" disabled>
                Passer cette étape (désactivé en Phase 2)
              </Button>
            </div>
          </div>
        ) : null}

        {currentStep === 3 ? (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">{`Étape 3 — ${studentLabels.plural}`}</h2>
            <Alert>
              <AlertDescription>
                {`Importez vos ${studentLabels.pluralLower} (type students) ou ajoutez-en un manuellement. Vous pouvez passer cette étape.`}
              </AlertDescription>
            </Alert>

            <ImportWizard />

            <div className="space-y-3 rounded-lg border border-border p-4">
              <h3 className="font-medium">Saisie manuelle rapide</h3>
              <div className="grid gap-3 md:grid-cols-2">
                <Input
                  placeholder="Prénom"
                  value={progress.manualStudent.first_name}
                  onChange={(event) =>
                    setProgress((previous) => ({
                      ...previous,
                      manualStudent: { ...previous.manualStudent, first_name: event.target.value },
                    }))
                  }
                />
                <Input
                  placeholder="Nom"
                  value={progress.manualStudent.last_name}
                  onChange={(event) =>
                    setProgress((previous) => ({
                      ...previous,
                      manualStudent: { ...previous.manualStudent, last_name: event.target.value },
                    }))
                  }
                />
                <Input
                  placeholder="Classe"
                  value={progress.manualStudent.class_name}
                  onChange={(event) =>
                    setProgress((previous) => ({
                      ...previous,
                      manualStudent: { ...previous.manualStudent, class_name: event.target.value },
                    }))
                  }
                />
              </div>

              <Button
                variant="secondary"
                className="min-h-[48px]"
                onClick={handleManualStudentSubmit}
                disabled={createStudentMutation.isPending}
              >
                {`Ajouter l'${studentLabels.singularLower}`}
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" className="min-h-[48px]" onClick={() => setStep(4)}>
                Continuer
              </Button>
              <Button variant="ghost" className="min-h-[48px]" onClick={() => setStep(4)}>
                Passer cette étape
              </Button>
            </div>
          </div>
        ) : null}

        {currentStep === 4 ? (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Étape 4 — Emploi du temps</h2>
            <Alert>
              <AlertDescription>
                Importez l'emploi du temps (type schedule) ou ajoutez un créneau manuellement.
              </AlertDescription>
            </Alert>

            <ImportWizard />

            <div className="space-y-3 rounded-lg border border-border p-4">
              <h3 className="font-medium">Ajout manuel d'un créneau</h3>
              <div className="grid gap-3 md:grid-cols-2">
                {teachers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Aucun professeur disponible. Revenez à l'étape 2 pour en ajouter un.
                  </p>
                ) : (
                  <Select
                    value={progress.manualSchedule.teacher_id}
                    onValueChange={(value) =>
                      setProgress((previous) => ({
                        ...previous,
                        manualSchedule: { ...previous.manualSchedule, teacher_id: value },
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un professeur" />
                    </SelectTrigger>
                    <SelectContent>
                      {teachers.map((teacher) => (
                        <SelectItem key={teacher.id} value={teacher.id}>
                          {teacher.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                <Input
                  placeholder="Classe (ex: 6e A)"
                  value={progress.manualSchedule.class_name}
                  onChange={(event) =>
                    setProgress((previous) => ({
                      ...previous,
                      manualSchedule: {
                        ...previous.manualSchedule,
                        class_name: event.target.value,
                      },
                    }))
                  }
                />

                <Select
                  value={progress.manualSchedule.day_of_week}
                  onValueChange={(value) =>
                    setProgress((previous) => ({
                      ...previous,
                      manualSchedule: { ...previous.manualSchedule, day_of_week: value },
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Jour" />
                  </SelectTrigger>
                  <SelectContent>
                    {dayOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={progress.manualSchedule.time_slot}
                  onValueChange={(value) =>
                    setProgress((previous) => ({
                      ...previous,
                      manualSchedule: { ...previous.manualSchedule, time_slot: value },
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Créneau" />
                  </SelectTrigger>
                  <SelectContent>
                    {slotOptions.map((slot) => (
                      <SelectItem key={slot} value={slot}>
                        {slot}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                variant="secondary"
                className="min-h-[48px]"
                onClick={handleManualScheduleSubmit}
                disabled={createScheduleMutation.isPending}
              >
                Ajouter le créneau
              </Button>
            </div>

            <Button className="min-h-[48px]" onClick={() => setStep(5)}>
              Continuer
            </Button>
          </div>
        ) : null}

        {currentStep === 5 ? (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">🎉 Configuration terminée !</h2>
            <Alert>
              <AlertDescription>
                Votre école est prête. Vous pouvez maintenant imprimer les QR codes des salles depuis le tableau de bord et les afficher dans chaque salle.
              </AlertDescription>
            </Alert>

            <Button
              className="min-h-[48px]"
              disabled={completeMutation.isPending}
              onClick={() => completeMutation.mutate()}
            >
              {completeMutation.isPending ? "Finalisation..." : "Accéder au tableau de bord"}
            </Button>
          </div>
        ) : null}

        <div className="flex justify-between">
          <Button
            variant="ghost"
            className="min-h-[48px]"
            disabled={currentStep === 1}
            onClick={() => setStep(currentStep - 1)}
          >
            Retour
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
