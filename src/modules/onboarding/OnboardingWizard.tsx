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
import { useToast } from "@/components/ui/use-toast"
import { completeOnboarding, fetchSchoolInfo, patchSchoolInfo, type SchoolInfoPayload } from "@/modules/onboarding/onboarding.api"

const ONBOARDING_PROGRESS_KEY = "onboarding_progress"
type OnboardingStep = 1 | 2 | 3 | 4 | 5
type Progress = { step: OnboardingStep; schoolInfo: SchoolInfoPayload }
const defaultProgress: Progress = { step: 1, schoolInfo: { name: "", address: "", phone: "" } }
const steps: Array<{ step: OnboardingStep; label: string }> = [
  { step: 1, label: "Infos école" }, { step: 2, label: "Référentiel scolaire" },
  { step: 3, label: "Salles et frais" }, { step: 4, label: "Professeurs" }, { step: 5, label: "Terminer" },
]

const loadProgress = (): Progress => {
  try {
    const raw = localStorage.getItem(ONBOARDING_PROGRESS_KEY)
    if (!raw) return defaultProgress
    const saved = JSON.parse(raw) as Partial<Progress>
    return { ...defaultProgress, ...saved, schoolInfo: { ...defaultProgress.schoolInfo, ...saved.schoolInfo } }
  } catch { return defaultProgress }
}

export default function OnboardingWizard() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [progress, setProgress] = useState<Progress>(loadProgress)
  const schoolInfoQuery = useQuery({ queryKey: ["school-info"], queryFn: fetchSchoolInfo })
  const saveSchool = useMutation({
    mutationFn: patchSchoolInfo,
    onSuccess: () => { setProgress((current) => ({ ...current, step: 2 })); toast({ title: "Informations école enregistrées" }) },
    onError: (error: unknown) => toast({ title: "Erreur", description: error instanceof Error ? error.message : "Impossible d'enregistrer l'école.", variant: "destructive" }),
  })
  const complete = useMutation({
    mutationFn: completeOnboarding,
    onSuccess: () => { localStorage.removeItem(ONBOARDING_PROGRESS_KEY); navigate("/dashboard", { replace: true }) },
  })

  useEffect(() => { if (schoolInfoQuery.data?.onboarding_completed) navigate("/dashboard", { replace: true }) }, [navigate, schoolInfoQuery.data?.onboarding_completed])
  useEffect(() => { localStorage.setItem(ONBOARDING_PROGRESS_KEY, JSON.stringify(progress)) }, [progress])
  useEffect(() => {
    const school = schoolInfoQuery.data
    if (!school) return
    setProgress((current) => current.step === 1 && !current.schoolInfo.name
      ? { ...current, schoolInfo: { name: school.name ?? "", address: school.address ?? "", phone: school.phone ?? "" } } : current)
  }, [schoolInfoQuery.data])

  const setStep = (step: OnboardingStep) => setProgress((current) => ({ ...current, step }))
  const currentStep = progress.step
  const saveInfo = () => {
    if (!progress.schoolInfo.name.trim() || !progress.schoolInfo.address.trim() || !progress.schoolInfo.phone.trim()) {
      toast({ title: "Champs requis", description: "Renseignez le nom, l'adresse et le téléphone de l'école." })
      return
    }
    saveSchool.mutate(progress.schoolInfo)
  }

  return <Card className="mx-auto w-full max-w-5xl">
    <CardHeader className="space-y-4">
      <div><CardTitle>Configuration de l&apos;école</CardTitle><p className="text-sm text-muted-foreground">L&apos;année scolaire est ouverte par le super administrateur avant cette configuration.</p></div>
      <div className="space-y-2"><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ "--progress": `${Math.round((currentStep / 5) * 100)}%`, width: "var(--progress)" } as CSSProperties} /></div><div className="flex flex-wrap gap-2">{steps.map((item) => <Badge key={item.step} variant={item.step <= currentStep ? "default" : "outline"}>{item.step}. {item.label}</Badge>)}</div></div>
    </CardHeader>
    <CardContent className="space-y-6">
      {currentStep === 1 ? <section className="space-y-4"><h2 className="text-lg font-semibold">Informations de l&apos;école</h2><div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label htmlFor="school-name">Nom</Label><Input id="school-name" value={progress.schoolInfo.name} onChange={(event) => setProgress((p) => ({ ...p, schoolInfo: { ...p.schoolInfo, name: event.target.value } }))} /></div><div className="space-y-2"><Label htmlFor="school-phone">Téléphone</Label><Input id="school-phone" value={progress.schoolInfo.phone} onChange={(event) => setProgress((p) => ({ ...p, schoolInfo: { ...p.schoolInfo, phone: event.target.value } }))} /></div><div className="space-y-2 md:col-span-2"><Label htmlFor="school-address">Adresse</Label><Input id="school-address" value={progress.schoolInfo.address} onChange={(event) => setProgress((p) => ({ ...p, schoolInfo: { ...p.schoolInfo, address: event.target.value } }))} /></div></div><Button onClick={saveInfo} disabled={saveSchool.isPending}>{saveSchool.isPending ? "Enregistrement..." : "Continuer"}</Button></section> : null}
      {currentStep === 2 ? <section className="space-y-4"><h2 className="text-lg font-semibold">Référentiel scolaire</h2><Alert><AlertDescription>Créez les niveaux et les matières avant toute inscription. Les classes seront créées avec les premières inscriptions, pas pendant cette configuration.</AlertDescription></Alert><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => navigate("/academic/levels")}>Configurer les niveaux</Button><Button variant="outline" onClick={() => navigate("/academic/subjects")}>Configurer les matières</Button><Button onClick={() => setStep(3)}>Continuer</Button></div></section> : null}
      {currentStep === 3 ? <section className="space-y-4"><h2 className="text-lg font-semibold">Salles et frais</h2><Alert><AlertDescription>Ajoutez les salles et configurez les frais par niveau. L&apos;emploi du temps sera importé après les inscriptions et les affectations pédagogiques.</AlertDescription></Alert><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => navigate("/rooms")}>Configurer les salles</Button><Button variant="outline" onClick={() => navigate("/settings?tab=finance")}>Configurer les frais</Button><Button onClick={() => setStep(4)}>Continuer</Button></div></section> : null}
      {currentStep === 4 ? <section className="space-y-4"><h2 className="text-lg font-semibold">Professeurs</h2><Alert><AlertDescription>Importez uniquement les profils et contrats des professeurs. Les matières et classes leur seront affectées après la création des classes.</AlertDescription></Alert><ImportWizard selectedImportType="teachers" allowedImportTypes={["teachers"]} /><Button onClick={() => setStep(5)}>Continuer</Button></section> : null}
      {currentStep === 5 ? <section className="space-y-4"><h2 className="text-lg font-semibold">Configuration initiale terminée</h2><Alert><AlertDescription>Vous pourrez inscrire les élèves, créer leurs classes, affecter les professeurs, désigner les professeurs principaux puis importer l&apos;emploi du temps.</AlertDescription></Alert><Button disabled={complete.isPending} onClick={() => complete.mutate()}>{complete.isPending ? "Finalisation..." : "Accéder au tableau de bord"}</Button></section> : null}
      {currentStep > 1 ? <Button variant="ghost" onClick={() => setStep((currentStep - 1) as OnboardingStep)}>Retour</Button> : null}
    </CardContent>
  </Card>
}
