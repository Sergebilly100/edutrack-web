import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import axios from "axios"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/shared/components/Spinner"
import { useToast } from "@/components/ui/use-toast"
import { useAuthStore, type PermissionKey } from "@/shared/store/auth.store"
import { completeOnboarding, fetchOnboardingStatus, fetchSchoolInfo, patchSchoolInfo, type SchoolInfoResponse } from "./onboarding.api"
import { clearProgress, configurationLink, loadStep, parseStep, saveStep, type OnboardingStep } from "./onboarding.progress"

const steps = ["Infos école", "Référentiel scolaire", "Salles et frais", "Professeurs", "Terminer"]
const requirements = [
  { key: "schoolInfoComplete", label: "Informations école complètes", step: 1 },
  { key: "activeYear", label: "Année scolaire active", step: 1 },
  { key: "levels", label: "Au moins un niveau", step: 2 },
  { key: "subjects", label: "Au moins une matière", step: 2 },
  { key: "rooms", label: "Au moins une salle active", step: 3 },
  { key: "fees", label: "Frais configurés pour l’année active", step: 3 },
] as const
const errorMessage = (error: unknown) => axios.isAxiosError(error) && typeof error.response?.data?.error === "string"
  ? error.response.data.error : "Vérifiez votre connexion et réessayez."

export default function OnboardingWizard() {
  const user = useAuthStore((state) => state.user)
  const permissions = useAuthStore((state) => state.permissions)
  const canConfigure = user?.role === "director" || permissions.includes("settings.school")
  const school = useQuery({
    queryKey: ["school-info", user?.schemaName, user?.tenantId], queryFn: fetchSchoolInfo,
    enabled: canConfigure, staleTime: 0, refetchOnMount: "always",
  })
  if (!canConfigure) return <Alert><AlertDescription>Vous n’avez pas le droit de configurer cette école.</AlertDescription></Alert>
  if (school.isPending || school.isFetching) return <Skeleton className="mx-auto h-48 w-full max-w-5xl" aria-label="Chargement de l’école" />
  if (school.isError || !school.data.id) return <Alert variant="destructive"><AlertDescription>Impossible de charger l’école. <Button variant="outline" className="min-h-[48px]" onClick={() => void school.refetch()}>Réessayer</Button></AlertDescription></Alert>
  return <SchoolOnboarding key={school.data.id} school={school.data} schoolId={school.data.id} />
}

function SchoolOnboarding({ school, schoolId }: { school: SchoolInfoResponse; schoolId: string }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()
  const { toast } = useToast()
  const user = useAuthStore((state) => state.user)
  const permissions = useAuthStore((state) => state.permissions)
  const can = (permission: PermissionKey) => user?.role === "director" || permissions.includes(permission)
  const [step, setStep] = useState<OnboardingStep>(() => {
    const savedStep = loadStep(schoolId)
    return params.get("school") === schoolId ? parseStep(params.get("step")) ?? savedStep : savedStep
  })
  const [schoolInfo, setSchoolInfo] = useState({ name: school.name ?? "", address: school.address ?? "", phone: school.phone ?? "" })
  const status = useQuery({
    queryKey: ["onboarding-status", schoolId], queryFn: fetchOnboardingStatus,
    staleTime: 0, refetchOnMount: "always", refetchOnWindowFocus: "always",
  })
  const verified = status.isSuccess && !status.isFetching && status.data.schoolId === schoolId
  const goToStep = (next: OnboardingStep) => {
    setStep(next)
    setParams({ step: String(next), school: schoolId }, { replace: true })
  }
  useEffect(() => { saveStep(schoolId, step) }, [schoolId, step])
  useEffect(() => {
    if (school.onboarding_completed) { clearProgress(schoolId); navigate("/dashboard", { replace: true }) }
  }, [navigate, school.onboarding_completed, schoolId])
  const saveSchool = useMutation({
    mutationFn: patchSchoolInfo,
    onSuccess: async () => {
      await status.refetch()
      goToStep(2)
      toast({ title: "Informations école enregistrées", duration: 3000 })
    },
    onError: (error) => toast({ title: "Enregistrement impossible", description: errorMessage(error), variant: "destructive", duration: 6000 }),
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
      toast({ title: "Finalisation impossible", description: errorMessage(error), variant: "destructive", duration: 6000 })
    },
  })
  const configAction = (path: string, origin: OnboardingStep, label: string, permission: PermissionKey, view?: PermissionKey) =>
    can(permission) && (!view || can(view)) ? <Button asChild variant="outline" className="min-h-[48px]"><Link to={configurationLink(path, schoolId, origin)}>{label}</Link></Button> : null
  const canContinue = verified && requirements.filter((item) => item.step === step).every((item) => status.data[item.key])

  return (
    <Card className="mx-auto w-full max-w-5xl">
      <CardHeader className="space-y-4">
        <div>
          <CardTitle>Configuration de l&apos;école</CardTitle>
          <p className="text-sm text-muted-foreground">Étape {step}/5 : {steps[step - 1]}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {steps.map((label, index) => (
            <Button key={label} variant={step === index + 1 ? "default" : "outline"}
              className="min-h-[48px]" aria-current={step === index + 1 ? "step" : undefined}
              onClick={() => goToStep((index + 1) as OnboardingStep)}>
              {index + 1}. {label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {status.isFetching || status.isPending ? (
          <p role="status" className="flex items-center gap-2"><Spinner size="sm" />Vérification des prérequis...</p>
        ) : null}
        {status.isError ? (
          <Alert variant="destructive">
            <AlertDescription>
              Impossible de vérifier les prérequis. La finalisation reste indisponible.
              <Button variant="outline" className="min-h-[48px]" onClick={() => void status.refetch()}>Réessayer</Button>
            </AlertDescription>
          </Alert>
        ) : null}
        {verified ? (
          <>
            {!status.data.activeYear ? (
              <Alert variant="destructive">
                <AlertDescription>
                  Aucune année scolaire active. Le super administrateur doit d’abord ouvrir l’année scolaire.
                  Vous ne pouvez pas terminer la configuration avant cette ouverture.
                </AlertDescription>
              </Alert>
            ) : null}
            <ul aria-label="Prérequis de configuration" className="divide-y divide-border">
              {requirements.map((item) => (
                <li key={item.key} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>{item.label}</span>
                  <Badge variant={status.data[item.key] ? "secondary" : "outline"}>
                    {status.data[item.key] ? "Prêt" : "À compléter"}
                  </Badge>
                </li>
              ))}
            </ul>
            <Button variant="ghost" className="min-h-[48px]" onClick={() => void status.refetch()}>Actualiser les prérequis</Button>
          </>
        ) : null}
        {step === 1 ? (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Informations de l&apos;école</h2>
            <p className="text-sm text-muted-foreground">Renseignez le nom, l’adresse et le téléphone de l’école.</p>
            <div className="grid gap-4 md:grid-cols-2">
              {(["name", "phone", "address"] as const).map((field) => (
                <div key={field} className="space-y-2">
                  <Label htmlFor={`school-${field}`}>{field === "name" ? "Nom de l’école" : field === "phone" ? "Téléphone" : "Adresse"}</Label>
                  <Input id={`school-${field}`} className="min-h-[48px]" value={schoolInfo[field]}
                    onChange={(event) => setSchoolInfo((current) => ({ ...current, [field]: event.target.value }))} />
                </div>
              ))}
            </div>
            <Button className="min-h-[48px]" disabled={saveSchool.isPending || schoolInfo.name.trim().length < 2 || schoolInfo.address.trim().length < 3 || schoolInfo.phone.trim().length < 6}
              onClick={() => saveSchool.mutate(schoolInfo)}>
              {saveSchool.isPending ? <><Spinner size="sm" className="mr-2" />Enregistrement...</> : "Enregistrer et continuer"}
            </Button>
          </section>
        ) : null}
        {step === 2 ? (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Référentiel scolaire</h2>
            <p>Créez les niveaux et les matières avant toute inscription. Les classes seront créées avec les premières inscriptions.</p>
            <div className="flex flex-wrap gap-2">
              {configAction("/academic/levels", 2, "Configurer les niveaux", "classes.create", "classes.view")}
              {configAction("/academic/subjects", 2, "Configurer les matières", "classes.edit", "classes.view")}
            </div>
          </section>
        ) : null}
        {step === 3 ? (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Salles et frais</h2>
            <p>Ajoutez au moins une salle et configurez les frais pour un niveau de l’année active.</p>
            <div className="flex flex-wrap gap-2">
              {configAction("/rooms", 3, "Configurer les salles", "rooms.create", "rooms.view")}
              {configAction("/settings?tab=finance", 3, "Configurer les frais", "tuition.edit", "tuition.view")}
            </div>
          </section>
        ) : null}
        {step === 4 ? (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Profils à préparer</h2>
            <p>Importez uniquement les profils et contrats des professeurs. Les affectations individuelles aux matières et classes interviendront après les inscriptions.</p>
            <p className="text-sm text-muted-foreground">Facultatif : vous pouvez continuer si vous ne disposez pas encore des profils.</p>
            <Badge variant="outline">{verified && status.data.teachers ? "Profils disponibles" : "Import facultatif"}</Badge>
            <div>{configAction("/import?type=teachers", 4, "Importer les profils et contrats", "import.teachers")}</div>
            <p>Préparez aussi les profils historiques des élèves. Ils seront inscrits plus tard, lors de l’ouverture des classes. Cet import ne crée aucune inscription, aucun paiement, dossier financier ou document.</p>
            <div>{configAction("/import?type=students", 4, "Importer les profils élèves historiques", "import.students")}</div>
          </section>
        ) : null}
        {step === 5 ? (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Terminer la configuration initiale</h2>
            <p>Après cette configuration :</p>
            <ol className="list-decimal space-y-2 pl-5">
              <li>Effectuez les premières inscriptions et créez les classes à cette occasion.</li>
              <li>Affectez individuellement chaque professeur aux matières et classes.</li>
              <li>Désignez le professeur principal de chaque classe.</li>
              <li>Importez ensuite l’emploi du temps (EDT).</li>
            </ol>
            {verified && !status.data.canComplete ? <p role="status">Complétez les prérequis indiqués ci-dessus avant de terminer.</p> : null}
            <Button className="min-h-[48px]" disabled={!verified || !status.data.canComplete || complete.isPending} onClick={() => complete.mutate()}>
              {complete.isPending ? <><Spinner size="sm" className="mr-2" />Finalisation...</> : "Accéder au tableau de bord"}
            </Button>
          </section>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {step > 1 ? <Button variant="ghost" className="min-h-[48px]" onClick={() => goToStep((step - 1) as OnboardingStep)}>Retour</Button> : null}
          {step > 1 && step < 5 ? (
            <Button className="min-h-[48px]" disabled={step !== 4 && !canContinue} onClick={() => goToStep((step + 1) as OnboardingStep)}>
              {step === 4 ? "Continuer sans import" : "Continuer"}
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
