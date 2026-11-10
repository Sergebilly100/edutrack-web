import { useEffect, useMemo, useState } from "react"
import { Navigate } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Plus, Trash2 } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/components/ui/use-toast"
import { listLevels, listSchoolYears } from "@/modules/academic/academic.api"
import { CopyTuitionPlanDialog } from "@/modules/finance/components/CopyTuitionPlanDialog"
import { planFormMatchesSaved } from "@/modules/finance/tuition-copy"
import { listTuitionPlans, upsertTuitionPlan, type TuitionPlan, type TuitionScheduleStep } from "@/modules/finance/finance.api"
import { usePermissions } from "@/shared/hooks/usePermissions"
import { useAuthStore } from "@/shared/store/auth.store"
import { formatFcfa } from "@/shared/utils/formatting"
import { isCivilDate } from "@/shared/lib/date-validation"
import { useOnboardingContext } from "./OnboardingReturn"

const blankStep = (): TuitionScheduleStep => ({ dueDate: "", cumulativeAmountExpected: 0 })

export default function OnboardingFeesPage() {
  const { target, focusStep, schoolId } = useOnboardingContext()
  const user = useAuthStore((state) => state.user)
  const { hasPermission } = usePermissions()
  const canEdit = user?.role === "director" && hasPermission("tuition.edit")
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [levelId, setLevelId] = useState("")
  const [totalAmount, setTotalAmount] = useState("")
  const [registrationAmount, setRegistrationAmount] = useState("")
  const [steps, setSteps] = useState<TuitionScheduleStep[]>([])
  const [copyOpen, setCopyOpen] = useState(false)

  const yearsQuery = useQuery({
    queryKey: ["academic", "school-years"],
    queryFn: listSchoolYears,
    enabled: canEdit && Boolean(target && focusStep === 3 && schoolId),
    retry: false,
  })
  const activeYear = yearsQuery.data?.find((year) => year.status === "active")
  const levelsQuery = useQuery({
    queryKey: ["academic", "levels"],
    queryFn: listLevels,
    enabled: canEdit && Boolean(target && focusStep === 3 && schoolId),
    retry: false,
  })
  const plansQuery = useQuery({
    queryKey: ["finance", "tuition-plans", activeYear?.id],
    queryFn: () => listTuitionPlans(activeYear!.id),
    enabled: Boolean(activeYear?.id && canEdit),
    retry: false,
  })
  const levels = levelsQuery.data ?? []
  const plans = plansQuery.data ?? []
  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.levelId === levelId),
    [levelId, plans],
  )
  const copyTargets = useMemo(
    () => levels.filter((level) => level.id !== levelId),
    [levelId, levels],
  )

  useEffect(() => {
    if (!levels.some((level) => level.id === levelId)) {
      setLevelId(levels[0]?.id ?? "")
    }
  }, [levelId, levels])

  useEffect(() => {
    setTotalAmount(selectedPlan ? String(selectedPlan.totalAmount) : "")
    setRegistrationAmount(selectedPlan ? String(selectedPlan.registrationAmount) : "")
    setSteps(selectedPlan?.scheduleSteps.length ? selectedPlan.scheduleSteps : [])
  }, [activeYear?.id, levelId, selectedPlan])

  const total = Number(totalAmount)
  const registration = Number(registrationAmount)
  const stepsValid = steps.every((step, index) => {
    const previous = steps[index - 1]
    return isCivilDate(step.dueDate)
      && step.cumulativeAmountExpected > 0
      && step.cumulativeAmountExpected <= total
      && (!previous || (
        step.dueDate > previous.dueDate
        && step.cumulativeAmountExpected >= previous.cumulativeAmountExpected
      ))
  })
  const formMatchesSaved = planFormMatchesSaved(selectedPlan, { totalAmount, registrationAmount, steps })
  const amountsValid = Number.isFinite(total)
    && total > 0
    && Number.isFinite(registration)
    && registration > 0
    && registration <= total
  const canSave = canEdit
    && Boolean(activeYear?.id && levelId)
    && amountsValid
    && stepsValid
    && plansQuery.isSuccess

  const savePlan = useMutation({
    mutationFn: (targetLevelId: string) => upsertTuitionPlan(targetLevelId, {
      schoolYearId: activeYear!.id,
      totalAmount: total,
      registrationAmount: registration,
      currency: "FCFA",
      scheduleSteps: steps.map(({ dueDate, cumulativeAmountExpected }) => ({ dueDate, cumulativeAmountExpected })),
    }),
    onSuccess: async (_plan, targetLevelId) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["finance"] }),
        queryClient.invalidateQueries({ queryKey: ["onboarding-status"] }),
      ])
      const targetLevel = levels.find((level) => level.id === targetLevelId)
      toast({
        title: targetLevelId === levelId ? "Frais enregistrés" : "Frais copiés",
        description: targetLevelId === levelId
          ? `Le plan annuel du niveau ${targetLevel?.name ?? ""} est enregistré.`
          : `Le plan a été copié vers le niveau ${targetLevel?.name ?? ""}.`,
      })
    },
    onError: (error) => toast({
      title: "Enregistrement impossible",
      description: error instanceof Error ? error.message : "Vérifiez les montants et les échéances puis réessayez.",
      variant: "destructive",
    }),
  })

  if (user?.role !== "director" || !target || focusStep !== 3 || !schoolId) {
    return <Navigate to="/settings?tab=finance" replace />
  }

  const retryQueries = () => {
    if (yearsQuery.isError) void yearsQuery.refetch()
    if (levelsQuery.isError) void levelsQuery.refetch()
    if (plansQuery.isError) void plansQuery.refetch()
  }

  const isLoading = yearsQuery.isLoading || levelsQuery.isLoading || (Boolean(activeYear) && plansQuery.isLoading)
  const hasError = yearsQuery.isError || levelsQuery.isError || plansQuery.isError

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Frais de scolarité</h1>
          <p className="max-w-2xl text-muted-foreground">
            Définissez le montant annuel et la somme à régler à l’inscription pour chaque niveau.
          </p>
        </div>
        {activeYear ? (
          <span className="inline-flex min-h-12 items-center justify-center rounded-full border bg-background px-5 text-sm font-medium">
            Année {activeYear.label}
          </span>
        ) : null}
      </header>

      {isLoading ? (
        <div className="space-y-4" role="status" aria-label="Chargement des frais">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : hasError ? (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            Impossible de charger l’année, les niveaux ou les frais existants.
            <Button type="button" variant="outline" className="min-h-12" onClick={retryQueries}>Réessayer</Button>
          </AlertDescription>
        </Alert>
      ) : !canEdit ? (
        <Alert variant="destructive">
          <AlertDescription>Vous n’avez pas la permission de modifier les frais de scolarité.</AlertDescription>
        </Alert>
      ) : !activeYear ? (
        <Alert>
          <AlertDescription>Aucune année scolaire active. Activez une année scolaire avant de configurer les frais.</AlertDescription>
        </Alert>
      ) : levels.length === 0 ? (
        <Alert>
          <AlertDescription>Ajoutez d’abord au moins un niveau à l’étape « Référentiel scolaire ».</AlertDescription>
        </Alert>
      ) : (
        <>
          <section className="space-y-2" aria-labelledby="tuition-level-heading">
            <Label id="tuition-level-heading">Niveau</Label>
            <div className="flex flex-wrap gap-2" role="group" aria-labelledby="tuition-level-heading">
              {levels.map((level) => (
                <Button
                  key={level.id}
                  type="button"
                  variant={level.id === levelId ? "default" : "outline"}
                  className="min-h-12 rounded-full px-5"
                  aria-pressed={level.id === levelId}
                  onClick={() => setLevelId(level.id)}
                >
                  {level.name}
                </Button>
              ))}
            </div>
          </section>

          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.9fr)]">
            <section className="space-y-5 rounded-lg border bg-card p-4 sm:p-6" aria-label="Plan de frais annuel">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="tuition-annual-amount">Montant annuel de scolarité (FCFA)</Label>
                  <Input
                    id="tuition-annual-amount"
                    inputMode="numeric"
                    className="min-h-12 tabular-nums"
                    value={totalAmount ? Number(totalAmount).toLocaleString("fr-FR") : ""}
                    onChange={(event) => setTotalAmount(event.target.value.replace(/\D/g, ""))}
                    disabled={!canEdit || savePlan.isPending}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tuition-registration-amount">Montant minimum à verser à l’inscription (FCFA)</Label>
                  <Input
                    id="tuition-registration-amount"
                    inputMode="numeric"
                    className="min-h-12 tabular-nums"
                    value={registrationAmount ? Number(registrationAmount).toLocaleString("fr-FR") : ""}
                    onChange={(event) => setRegistrationAmount(event.target.value.replace(/\D/g, ""))}
                    aria-describedby="tuition-registration-help"
                    disabled={!canEdit || savePlan.isPending}
                  />
                  <p id="tuition-registration-help" className="text-sm text-muted-foreground">
                    Cette somme est comprise dans le montant annuel.
                  </p>
                </div>
              </div>

              {registrationAmount && totalAmount && registration > total ? (
                <p className="text-sm text-destructive" role="alert">
                  Le montant à verser à l’inscription ne peut pas dépasser le montant annuel.
                </p>
              ) : null}

              <div className="space-y-3 border-t pt-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-semibold">Échéancier</h2>
                    <p className="text-sm text-muted-foreground">Ajoutez les dates et les montants cumulés attendus.</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-12"
                    disabled={!canEdit || savePlan.isPending}
                    onClick={() => setSteps((current) => [...current, blankStep()])}
                  >
                    <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                    Ajouter une échéance
                  </Button>
                </div>
                {steps.length === 0 ? (
                  <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                    Aucun échéancier défini. Vous pourrez en ajouter un si les versements sont répartis sur l’année.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {steps.map((step, index) => (
                      <div key={step.id ?? index} className="grid gap-3 rounded-md border p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                        <div className="space-y-2">
                          <Label htmlFor={`tuition-step-date-${index}`}>Échéance {index + 1}</Label>
                          <Input
                            id={`tuition-step-date-${index}`}
                            type="date"
                            className="min-h-12"
                            value={step.dueDate}
                            onChange={(event) => setSteps((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, dueDate: event.target.value } : item))}
                            disabled={!canEdit || savePlan.isPending}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`tuition-step-amount-${index}`}>Cumul attendu (FCFA)</Label>
                          <Input
                            id={`tuition-step-amount-${index}`}
                            inputMode="numeric"
                            className="min-h-12 tabular-nums"
                            value={step.cumulativeAmountExpected ? step.cumulativeAmountExpected.toLocaleString("fr-FR") : ""}
                            onChange={(event) => setSteps((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, cumulativeAmountExpected: Number(event.target.value.replace(/\D/g, "")) } : item))}
                            disabled={!canEdit || savePlan.isPending}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="min-h-12 min-w-12"
                          aria-label={`Supprimer l’échéance ${index + 1}`}
                          disabled={!canEdit || savePlan.isPending}
                          onClick={() => setSteps((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                {steps.length > 0 && !stepsValid ? (
                  <p role="alert" className="text-sm text-destructive">
                    Vérifiez les dates croissantes et les montants cumulés, qui doivent rester compris entre 1 et le montant annuel.
                  </p>
                ) : null}
              </div>
            </section>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Récapitulatif · {levels.find((level) => level.id === levelId)?.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 py-4">
                <div className="flex justify-between gap-4 text-sm">
                  <span className="text-muted-foreground">Montant annuel</span>
                  <span className="font-medium tabular-nums">{formatFcfa(total || 0)}</span>
                </div>
                <div className="flex justify-between gap-4 text-sm">
                  <span className="text-muted-foreground">À verser à l’inscription</span>
                  <span className="font-medium tabular-nums">{formatFcfa(registration || 0)}</span>
                </div>
                <div className="flex justify-between gap-4 text-sm">
                  <span className="text-muted-foreground">Reste après inscription</span>
                  <span className="font-medium tabular-nums">{formatFcfa(Math.max(0, total - registration))}</span>
                </div>
                <div className="flex items-center justify-between gap-4 border-t pt-4">
                  <span className="font-semibold">Total annuel</span>
                  <span className="text-lg font-semibold tabular-nums">{formatFcfa(total || 0)}</span>
                </div>
                <Button
                  type="button"
                  className="min-h-12 w-full"
                  disabled={!canSave || savePlan.isPending}
                  onClick={() => savePlan.mutate(levelId)}
                >
                  {savePlan.isPending && savePlan.variables === levelId ? "Enregistrement…" : "Enregistrer les frais"}
                </Button>

                {copyTargets.length > 0 ? (
                  <div className="border-t pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-12 w-full"
                      disabled={!canSave || !selectedPlan || !formMatchesSaved || savePlan.isPending}
                      title={formMatchesSaved ? undefined : "Enregistrez d’abord les frais de ce niveau : la copie reprend les frais enregistrés."}
                      onClick={() => setCopyOpen(true)}
                    >
                      Copier ces frais vers…
                    </Button>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>

          <CopyTuitionPlanDialog open={copyOpen} onOpenChange={setCopyOpen} schoolYearId={activeYear.id} sourceLevelId={levelId} />
        </>
      )}
    </div>
  )
}
