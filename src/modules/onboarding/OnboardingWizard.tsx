import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom"
import axios from "axios"
import {
  ArrowLeft,
  BookOpen,
  Check,
  DoorOpen,
  LockKeyhole,
  Moon,
  School,
  Sun,
  Users,
  Wallet,
} from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/shared/components/Spinner"
import { useToast } from "@/components/ui/use-toast"
import { useTheme } from "@/shared/hooks/useTheme"
import { useAuthStore } from "@/shared/store/auth.store"
import { listClasses } from "@/modules/academic/academic.api"
import { fetchImportHistory } from "@/modules/import-export/import-export.api"
import { completeOnboarding, fetchOnboardingStatus, fetchSchoolInfo, patchSchoolInfo, type OnboardingStatus, type SchoolInfoResponse } from "./onboarding.api"
import {
  clearProgress,
  canNavigateToStep,
  configurationLink,
  continueMessage,
  firstIncompleteStep,
  isStepComplete,
  isStepAccessible,
  onboardingStepLabels,
  parseStep,
  remainingStepLabel,
  type OnboardingStep,
} from "./onboarding.progress"

const requirements = [
  { key: "activeYear", label: "Année scolaire active" },
  { key: "schoolInfoComplete", label: "Infos école" },
  { key: "levels", label: "Au moins un niveau" },
  { key: "subjects", label: "Au moins une matière" },
  { key: "rooms", label: "Au moins une salle" },
  { key: "fees", label: "Frais de l’année" },
] as const

const errorMessage = (error: unknown) =>
  axios.isAxiosError(error) && typeof error.response?.data?.error === "string"
    ? error.response.data.error
    : "Vérifiez votre connexion et réessayez."

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const isDark = resolvedTheme === "dark"
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="h-10 w-10 shrink-0"
      aria-label={isDark ? "Passer au thème clair" : "Passer au thème sombre"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {isDark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
    </Button>
  )
}

function StepAction({
  icon: Icon,
  title,
  description,
  ready,
  statusLabel,
  href,
  actionLabel,
}: {
  icon: typeof School
  title: string
  description: string
  ready: boolean
  statusLabel: string
  href: string
  actionLabel: string
}) {
  return (
    <section className="flex flex-col justify-between gap-4 rounded-lg border bg-card p-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-muted text-primary">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{title}</h3>
            <Badge variant={ready ? "success" : "outline"}>{statusLabel}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <Button asChild type="button" variant="outline" className="min-h-12 shrink-0">
        <Link to={href}>{actionLabel}</Link>
      </Button>
    </section>
  )
}

function UpcomingAction({
  index,
  title,
  href,
  disabledReason,
}: {
  index: number
  title: string
  href: string
  disabledReason?: string
}) {
  return (
    <li className="flex items-start gap-3 rounded-lg border p-4">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold tabular-nums">
        {index}
      </span>
      <div className="min-w-0 flex-1">
        {disabledReason ? (
          <>
            <p className="font-medium text-muted-foreground" aria-disabled="true">{title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{disabledReason}</p>
          </>
        ) : (
          <Link to={href} className="inline-flex min-h-10 items-center font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
            {title}
          </Link>
        )}
      </div>
    </li>
  )
}

function SchoolOnboarding({ school, schoolId }: { school: SchoolInfoResponse; schoolId: string }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()
  const { toast } = useToast()
  const user = useAuthStore((state) => state.user)
  const [schoolInfo, setSchoolInfo] = useState({
    name: school.name ?? "",
    address: school.address ?? "",
    phone: school.phone ?? "",
  })
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null)

  const status = useQuery<OnboardingStatus, Error>({
    queryKey: ["onboarding-status", schoolId],
    queryFn: fetchOnboardingStatus,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    retry: false,
  })
  const verified = status.data?.schoolId === schoolId
  const statusData = verified ? status.data : null
  const requestedStep = params.get("school") === schoolId ? parseStep(params.get("step")) : null
  const step = statusData
    ? requestedStep && isStepAccessible(requestedStep, statusData)
      ? requestedStep
      : firstIncompleteStep(statusData)
    : 1
  const shouldCorrectUrl = Boolean(statusData) &&
    (params.get("school") !== schoolId || parseStep(params.get("step")) !== step)
  const classesQuery = useQuery({
    queryKey: ["onboarding", "next-actions", "classes", schoolId],
    queryFn: () => listClasses(),
    enabled: step === 5 && verified && statusData?.canComplete === true,
    retry: false,
  })
  const historicalStudentsImportQuery = useQuery({
    queryKey: ["import-history", user?.schemaName, user?.tenantId, { page: 1, type: "students" }],
    queryFn: () => fetchImportHistory({ limit: 100, page: 1, type: "students" }),
    enabled: step === 4 && verified,
    retry: false,
  })
  const historicalStudentsImport = historicalStudentsImportQuery.data?.items.find(
    (item) => item.historicalSchoolYearLabel !== null,
  )

  useEffect(() => {
    if (school.onboarding_completed) {
      clearProgress(schoolId)
    }
  }, [school.onboarding_completed, schoolId])

  const goToStep = (next: OnboardingStep, navigationStatus = statusData) => {
    if (!verified || !navigationStatus || !canNavigateToStep(next, step, navigationStatus)) return
    setParams({ step: String(next), school: schoolId })
  }

  const returnToPreviousStep = () => {
    if (step <= 1) return
    goToStep((step - 1) as OnboardingStep)
  }

  const saveSchool = useMutation({
    mutationFn: patchSchoolInfo,
    onSuccess: async () => {
      try {
        const freshStatus = await queryClient.fetchQuery({
          queryKey: ["onboarding-status", schoolId],
          queryFn: fetchOnboardingStatus,
          staleTime: 0,
        })
        if (freshStatus.schoolId !== schoolId) {
          setSaveFeedback("Les informations ont été enregistrées, mais le serveur a renvoyé le statut d’une autre école. Réessayez.")
          return
        }
        if (!isStepComplete(1, freshStatus)) {
          setSaveFeedback(continueMessage(1, freshStatus) ?? "Le serveur ne confirme pas encore tous les prérequis de cette étape.")
          return
        }

        setSaveFeedback(null)
        goToStep(2, freshStatus)
        toast({ title: "Informations de l’école enregistrées", duration: 3000 })
      } catch (error) {
        setSaveFeedback(`Les informations ont été enregistrées, mais la vérification des prérequis a échoué. ${errorMessage(error)}`)
      }
    },
    onError: (error) => toast({
      title: "Enregistrement impossible",
      description: errorMessage(error),
      variant: "destructive",
      duration: 6000,
    }),
  })

  const complete = useMutation({
    mutationFn: completeOnboarding,
    onSuccess: () => {
      queryClient.setQueriesData<SchoolInfoResponse>({ queryKey: ["school-info"] }, (cached) =>
        cached?.id === schoolId ? { ...cached, onboarding_completed: true } : cached)
      clearProgress(schoolId)
      toast({ title: "Configuration initiale terminée", duration: 3000 })
      navigate("/dashboard", { replace: true })
    },
    onError: async (error) => {
      await status.refetch()
      toast({
        title: "Finalisation impossible",
        description: errorMessage(error),
        variant: "destructive",
        duration: 6000,
      })
    },
  })

  if (school.onboarding_completed) return <Navigate to="/dashboard" replace />

  if (status.isPending) {
    return <Skeleton className="mx-auto h-72 w-full max-w-6xl" aria-label="Vérification des prérequis" />
  }
  if (!statusData) {
    return (
      <Alert variant="destructive" className="mx-auto max-w-4xl">
        <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
          Impossible de vérifier les prérequis de cette école. Aucune étape ne sera validée sans réponse du serveur.
          <Button type="button" variant="outline" className="min-h-12" onClick={() => void status.refetch()}>
            Réessayer
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  if (shouldCorrectUrl) {
    return <Navigate replace to={`/onboarding?step=${step}&school=${encodeURIComponent(schoolId)}`} />
  }

  const progress = onboardingStepLabels.map((_, index) =>
    isStepComplete((index + 1) as OnboardingStep, statusData),
  )
  const nextStepMessage = step >= 2 && !isStepAccessible((step + 1) as OnboardingStep, statusData)
    ? continueMessage(firstIncompleteStep(statusData), statusData)
    : null
  const currentContinueMessage = step === 1 ? continueMessage(step, statusData) : nextStepMessage
  const canSaveSchool = schoolInfo.name.trim().length >= 2 &&
    schoolInfo.address.trim().length >= 3 &&
    schoolInfo.phone.trim().length >= 6
  const classes = classesQuery.data?.classes ?? []

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <header className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link to="/dashboard" className="flex min-h-12 items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
            <img src="/logo.png" alt="" className="h-10 w-10 rounded-md object-contain" />
            <span className="text-lg font-semibold tracking-tight">IvoirEdu</span>
          </Link>
          <div className="ml-auto flex flex-wrap items-center gap-3">
            <p className="text-sm font-medium text-muted-foreground" aria-live="polite">
              {remainingStepLabel(step)}
            </p>
            <ThemeToggle />
          </div>
        </div>
        <div className="grid grid-cols-5 gap-2" role="progressbar" aria-label="Progression de la configuration" aria-valuemin={1} aria-valuemax={5} aria-valuenow={step}>
          {onboardingStepLabels.map((label, index) => {
            const filled = index + 1 <= step || progress[index]
            return <span key={label} aria-hidden="true" className={`h-1.5 rounded-full ${filled ? "bg-primary" : "bg-muted"}`} />
          })}
        </div>
      </header>

      <Card className="overflow-hidden border-border shadow-none">
        <div className="grid min-h-[34rem] lg:grid-cols-[17rem_minmax(0,1fr)]">
          <aside className="border-b bg-muted/20 p-4 lg:border-b-0 lg:border-r lg:p-5">
            <nav aria-label="Étapes de configuration" className="space-y-1">
              {onboardingStepLabels.map((label, index) => {
                const targetStep = (index + 1) as OnboardingStep
                const isCurrent = step === targetStep
                const accessible = canNavigateToStep(targetStep, step, statusData)
                const isComplete = targetStep < step && progress[index]
                const Icon = isComplete ? Check : !accessible ? LockKeyhole : null
                return (
                  <Button
                    key={label}
                    type="button"
                    variant="ghost"
                    disabled={!accessible}
                    aria-disabled={!accessible}
                    aria-current={isCurrent ? "step" : undefined}
                    onClick={() => goToStep(targetStep)}
                    className={`min-h-12 w-full justify-start gap-3 px-3 text-left ${isCurrent ? "bg-primary/10 text-primary hover:bg-primary/10 dark:bg-primary/15 dark:text-primary dark:hover:bg-primary/15" : ""} ${!accessible ? "cursor-not-allowed text-muted-foreground" : ""} ${isComplete ? "text-foreground" : ""}`}
                  >
                    {Icon ? (
                      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${isComplete ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300" : "bg-muted text-muted-foreground"}`}>
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                    ) : (
                      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${isCurrent ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                        {targetStep}
                      </span>
                    )}
                    <span className="truncate">{label}</span>
                  </Button>
                )
              })}
            </nav>

            <section className="mt-5 border-t pt-4" aria-labelledby="onboarding-followup-title">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 id="onboarding-followup-title" className="text-sm font-semibold">
                  Obligatoire · {requirements.filter(({ key }) => statusData[key]).length} sur 6
                </h2>
                {status.isFetching ? <Spinner size="sm" /> : null}
              </div>
              <ul className="space-y-2" aria-label="Suivi des prérequis">
                {requirements.map(({ key, label }) => {
                  const done = statusData[key]
                  return (
                    <li key={key} className="flex min-h-8 items-center gap-2 text-sm">
                      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${done ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300" : "bg-muted text-muted-foreground"}`}>
                        {done ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <span className="h-2 w-2 rounded-full border border-current" aria-hidden="true" />}
                      </span>
                      <span className={done ? "text-muted-foreground" : "font-medium"}>{label}</span>
                    </li>
                  )
                })}
              </ul>
            </section>
          </aside>

          <div className="flex min-w-0 flex-col p-5 md:p-8">
            <div className="flex-1 space-y-6">
              {status.isFetching ? <p role="status" className="text-sm text-muted-foreground">Mise à jour des prérequis…</p> : null}
              {status.isError && !saveFeedback ? (
                <Alert variant="destructive">
                  <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                    Impossible d’actualiser le statut. Les informations déjà chargées restent visibles.
                    <Button type="button" variant="outline" className="min-h-12" onClick={() => void status.refetch()}>
                      Réessayer
                    </Button>
                  </AlertDescription>
                </Alert>
              ) : null}
              {!statusData.activeYear && step !== 1 ? (
                <Alert>
                  <AlertDescription>
                    Aucune année scolaire active. L’administration doit ouvrir l’année avant de continuer la configuration.
                  </AlertDescription>
                </Alert>
              ) : null}

              {step === 1 ? (
                <section className="space-y-6" aria-labelledby="school-info-heading">
                  {saveFeedback ? (
                    <Alert variant="destructive">
                      <AlertDescription>{saveFeedback}</AlertDescription>
                    </Alert>
                  ) : null}
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-primary">Étape 1 sur 5</p>
                    <h1 id="school-info-heading" className="text-2xl font-semibold tracking-tight md:text-3xl">Informations de l&apos;école</h1>
                    <p className="max-w-2xl text-muted-foreground">Renseignez le nom, l’adresse et le téléphone qui apparaîtront sur les documents de l’école.</p>
                  </div>
                  <div className="grid gap-5 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="school-name">Nom de l’école</Label>
                      <Input id="school-name" className="min-h-12" value={schoolInfo.name} onChange={(event) => setSchoolInfo((current) => ({ ...current, name: event.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="school-phone">Téléphone</Label>
                      <Input id="school-phone" type="tel" inputMode="tel" className="min-h-12" value={schoolInfo.phone} onChange={(event) => setSchoolInfo((current) => ({ ...current, phone: event.target.value }))} />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="school-address">Adresse</Label>
                      <Input id="school-address" className="min-h-12" value={schoolInfo.address} onChange={(event) => setSchoolInfo((current) => ({ ...current, address: event.target.value }))} />
                    </div>
                  </div>
                  {!canSaveSchool ? (
                    <p className="text-sm text-muted-foreground" role="status">
                      Renseignez un nom, une adresse et un téléphone valides pour enregistrer.
                    </p>
                  ) : null}
                </section>
              ) : null}

              {step === 2 ? (
                <section className="space-y-5" aria-labelledby="academic-setup-heading">
                  {!statusData.schoolInfoComplete ? (
                    <Alert>
                      <AlertDescription>
                        L’année scolaire est active et vous pouvez continuer. Le serveur ne confirme pas encore le nom, l’adresse et le téléphone du directeur. Vérifiez ces informations avant de finaliser la configuration.
                      </AlertDescription>
                    </Alert>
                  ) : null}
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-primary">Étape 2 sur 5</p>
                    <h1 id="academic-setup-heading" className="text-2xl font-semibold tracking-tight md:text-3xl">Référentiel scolaire</h1>
                    <p className="max-w-2xl text-muted-foreground">Ajoutez les niveaux et les matières enseignées avant de créer les classes.</p>
                  </div>
                  <div className="space-y-3">
                    <StepAction icon={School} title="Niveaux" description="Organisez les niveaux de l’école dans leur ordre d’affichage." ready={statusData.levels} statusLabel={statusData.levels ? "Configuré" : "À faire"} href={configurationLink("/academic/levels", schoolId, 2)} actionLabel="Configurer les niveaux" />
                    <StepAction icon={BookOpen} title="Matières" description="Ajoutez les matières enseignées et leurs coefficients par niveau." ready={statusData.subjects} statusLabel={statusData.subjects ? "Configuré" : "À faire"} href={configurationLink("/academic/subjects", schoolId, 2)} actionLabel="Configurer les matières" />
                  </div>
                </section>
              ) : null}

              {step === 3 ? (
                <section className="space-y-5" aria-labelledby="rooms-fees-heading">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-primary">Étape 3 sur 5</p>
                    <h1 id="rooms-fees-heading" className="text-2xl font-semibold tracking-tight md:text-3xl">Salles et frais</h1>
                    <p className="max-w-2xl text-muted-foreground">Ajoutez une salle active et définissez les frais de scolarité pour l’année active.</p>
                  </div>
                  <div className="space-y-3">
                    <StepAction icon={DoorOpen} title="Salles" description="Créez au moins une salle active pour organiser les cours." ready={statusData.rooms} statusLabel={statusData.rooms ? "Configuré" : "À faire"} href={configurationLink("/rooms", schoolId, 3)} actionLabel="Configurer les salles" />
                    <StepAction icon={Wallet} title="Frais de l’année" description="Définissez le montant annuel et la part à régler à l’inscription par niveau." ready={statusData.fees} statusLabel={statusData.fees ? "Configuré" : "À faire"} href={configurationLink("/onboarding/fees", schoolId, 3)} actionLabel="Configurer les frais" />
                  </div>
                </section>
              ) : null}

              {step === 4 ? (
                <section className="space-y-5" aria-labelledby="teachers-setup-heading">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-primary">Étape 4 sur 5</p>
                    <h1 id="teachers-setup-heading" className="text-2xl font-semibold tracking-tight md:text-3xl">Profils à préparer (Facultatif)</h1>
                    <p className="max-w-2xl text-muted-foreground">Importez les profils et contrats maintenant, ou poursuivez sans import et revenez-y plus tard.</p>
                  </div>
                  <p className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">Facultatif : vous pourrez importer ces fichiers plus tard. Les affectations des professeurs interviendront après les inscriptions.</p>
                  {historicalStudentsImportQuery.isError ? (
                    <Alert variant="destructive">
                      <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                        Impossible de vérifier si des profils élèves historiques ont déjà été importés.
                        <Button type="button" variant="outline" className="min-h-12" onClick={() => void historicalStudentsImportQuery.refetch()}>
                          Réessayer
                        </Button>
                      </AlertDescription>
                    </Alert>
                  ) : null}
                  <div className="space-y-3">
                    <StepAction icon={Users} title="Profils des professeurs" description="Importez le fichier des enseignants de l’école." ready={statusData.teachers} statusLabel={statusData.teachers ? "Profils disponibles" : "Facultatif"} href={configurationLink("/import?type=teachers", schoolId, 4)} actionLabel="Importer les professeurs" />
                    <StepAction
                      icon={BookOpen}
                      title="Profils élèves historiques"
                      description={historicalStudentsImport
                        ? `Import historique ${historicalStudentsImport.historicalSchoolYearLabel} effectué · ${historicalStudentsImport.importedCount} profil(s) créé(s).`
                        : "Préparez les profils et l’année scolaire de leur historique."}
                      ready={Boolean(historicalStudentsImport)}
                      statusLabel={historicalStudentsImport
                        ? "Import effectué"
                        : historicalStudentsImportQuery.isPending || historicalStudentsImportQuery.isFetching
                          ? "Vérification…"
                          : historicalStudentsImportQuery.isError
                            ? "Statut indisponible"
                            : "Facultatif"}
                      href={configurationLink("/import?type=students", schoolId, 4)}
                      actionLabel={historicalStudentsImport ? "Importer d’autres élèves" : "Importer les élèves"}
                    />
                  </div>
                </section>
              ) : null}

              {step === 5 ? (
                <section className="space-y-5" aria-labelledby="finish-setup-heading">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-primary">Étape 5 sur 5</p>
                    <h1 id="finish-setup-heading" className="text-2xl font-semibold tracking-tight md:text-3xl">Terminer la configuration</h1>
                    <p className="max-w-2xl text-muted-foreground">Votre école est prête. Voici les prochaines actions pour démarrer l’année.</p>
                  </div>
                  {classesQuery.isError ? (
                    <Alert variant="destructive">
                      <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                        Impossible de vérifier les classes disponibles pour la suite.
                        <Button type="button" variant="outline" className="min-h-12" onClick={() => void classesQuery.refetch()}>Réessayer</Button>
                      </AlertDescription>
                    </Alert>
                  ) : null}
                  {classesQuery.isPending ? <Skeleton className="h-24 w-full" aria-label="Vérification des classes" /> : null}
                  <ol className="space-y-3">
                    <UpcomingAction index={1} title="Renseigner les documents requis par niveau" href="/settings?tab=scolarite" />
                    <UpcomingAction index={2} title="Effectuer les premières inscriptions" href="/enrollments/new" />
                    <UpcomingAction index={3} title="Affecter les professeurs aux matières et aux classes" href="/teachers" disabledReason={!statusData.teachers ? "Importez d’abord les profils des professeurs." : undefined} />
                    <UpcomingAction index={4} title="Désigner le professeur principal de chaque classe" href="/academic/classes" disabledReason={!classes.length ? "Disponible après les premières inscriptions, lorsque les classes seront créées." : undefined} />
                    <UpcomingAction index={5} title="Importer l’emploi du temps" href="/import?type=schedule" disabledReason={!classes.length ? "Créez d’abord des classes lors des premières inscriptions." : undefined} />
                  </ol>
                </section>
              ) : null}
            </div>

            <footer className="mt-8 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-h-12 items-center">
                {step > 1 ? (
                  <Button type="button" variant="outline" className="min-h-12" onClick={returnToPreviousStep}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Retour
                  </Button>
                ) : null}
              </div>
              <div className="flex flex-col gap-2 sm:items-end">
                {currentContinueMessage && step < 4 && !saveFeedback ? (
                  <p id="continue-requirement-message" className="max-w-md text-sm text-muted-foreground sm:text-right" role="status">{currentContinueMessage}</p>
                ) : null}
                {step === 1 ? (
                  <Button
                    type="button"
                    className="min-h-12 w-full sm:w-auto"
                    disabled={saveSchool.isPending || !canSaveSchool || status.isFetching}
                    onClick={() => {
                      setSaveFeedback(null)
                      saveSchool.mutate(schoolInfo)
                    }}
                  >
                    {saveSchool.isPending ? <><Spinner size="sm" className="mr-2" />Enregistrement…</> : statusData.activeYear ? "Enregistrer et continuer" : "Enregistrer les informations"}
                  </Button>
                ) : null}
                {step === 2 || step === 3 ? (
                  <Button
                    type="button"
                    className="min-h-12 w-full sm:w-auto"
                    disabled={!isStepAccessible((step + 1) as OnboardingStep, statusData) || status.isFetching}
                    aria-describedby={currentContinueMessage ? "continue-requirement-message" : undefined}
                    onClick={() => goToStep((step + 1) as OnboardingStep)}
                  >
                    Continuer
                  </Button>
                ) : null}
                {step === 4 ? (
                  <Button type="button" className="min-h-12 w-full sm:w-auto" disabled={!isStepAccessible(5, statusData) || status.isFetching} onClick={() => goToStep(5)}>
                    Continuer sans import
                  </Button>
                ) : null}
                {step === 5 ? (
                  <>
                    {!isStepComplete(5, statusData) ? (
                      <p role="status" className="max-w-md text-sm text-muted-foreground sm:text-right">
                        {continueMessage(firstIncompleteStep(statusData), statusData) ?? "Complétez les prérequis pour finaliser la configuration."}
                      </p>
                    ) : null}
                    <Button
                      type="button"
                      className="min-h-12 w-full sm:w-auto"
                      disabled={!verified || !isStepComplete(5, statusData) || status.isFetching || complete.isPending}
                      onClick={() => complete.mutate()}
                    >
                      {complete.isPending ? <><Spinner size="sm" className="mr-2" />Finalisation…</> : "Accéder au tableau de bord"}
                    </Button>
                  </>
                ) : null}
              </div>
            </footer>
          </div>
        </div>
      </Card>
    </div>
  )
}

export default function OnboardingWizard() {
  const user = useAuthStore((state) => state.user)
  const canConfigure = user?.role === "director"
  const school = useQuery({
    queryKey: ["school-info", user?.schemaName, user?.tenantId],
    queryFn: fetchSchoolInfo,
    enabled: canConfigure,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  })

  if (!canConfigure) {
    return <Alert><AlertDescription>Seul le directeur de l’école peut accéder à cette configuration.</AlertDescription></Alert>
  }
  if (school.isPending) {
    return <div className="min-h-screen bg-muted/20 px-4 py-6"><Skeleton className="mx-auto h-72 w-full max-w-6xl" aria-label="Chargement de l’école" /></div>
  }
  if (!school.data?.id) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <Alert variant="destructive">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            Impossible de charger l’école.
            <Button type="button" variant="outline" className="min-h-12" onClick={() => void school.refetch()}>Réessayer</Button>
          </AlertDescription>
        </Alert>
      </div>
    )
  }
  return (
    <div className="min-h-screen bg-muted/20 px-4 py-5 md:px-8 md:py-7">
      {school.isError ? (
        <Alert variant="destructive" className="mx-auto mb-5 max-w-6xl">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            Impossible d’actualiser les informations de l’école. Vos saisies restent conservées.
            <Button type="button" variant="outline" className="min-h-12" onClick={() => void school.refetch()}>
              Réessayer
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      <SchoolOnboarding key={school.data.id} school={school.data} schoolId={school.data.id} />
    </div>
  )
}
