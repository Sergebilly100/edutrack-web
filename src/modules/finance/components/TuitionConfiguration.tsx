import { useEffect, useMemo, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CalendarClock, CheckCircle2, Loader2, Plus, RotateCcw, Tag, Trash2 } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import { listLevels } from "@/modules/academic/academic.api"
import type { StudentItem } from "@/modules/students/students.api"
import { formatFcfa } from "@/shared/utils/formatting"
import { usePermissions } from "@/shared/hooks/usePermissions"
import { addDaysIso } from "@/shared/lib/business-date"
import { isCivilDate } from "@/shared/lib/date-validation"
import { getStudentTuitionSchedule, getTuitionOverrideWithdrawalPreview, grantTuitionOverride, listTuitionPlans, resetStudentTuitionSchedule, saveStudentTuitionSchedule, upsertTuitionPlan, withdrawTuitionOverride, type TuitionPlan, type TuitionScheduleStep } from "../finance.api"
import type { TuitionRecovery } from "../tuition-recovery"
import { StudentSearch } from "./StudentSearch"

type TuitionConfigurationProps = {
  schoolYearId: string
  canEdit: boolean
  canGrantDiscount: boolean
  canManageStudentSchedule: boolean
  simplifiedForOnboarding?: boolean
  recovery?: TuitionRecovery | null
  onPlanSaved?: (plan: TuitionPlan) => Promise<void>
}

const blankStep = (): TuitionScheduleStep => ({ dueDate: "", cumulativeAmountExpected: 0 })
type NegotiatedInstallment = { id?: string; dueDate: string; amount: number }
const blankInstallment = (): NegotiatedInstallment => ({ dueDate: "", amount: 0 })

const changeStepDate = (steps: TuitionScheduleStep[], index: number, value: string) => {
  let cleared = false
  const next = steps.map((step, stepIndex) => {
    if (stepIndex === index) return { ...step, dueDate: value }
    if (isCivilDate(value) && step.dueDate && ((stepIndex < index && step.dueDate >= value) || (stepIndex > index && step.dueDate <= value))) {
      cleared = true
      return { ...step, dueDate: "" }
    }
    return step
  })
  return { next, cleared }
}

export function TuitionConfiguration({ schoolYearId, canEdit, canGrantDiscount, canManageStudentSchedule, simplifiedForOnboarding = false, recovery, onPlanSaved }: TuitionConfigurationProps) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { hasPermission } = usePermissions()
  const canReadLevels = !recovery || hasPermission("classes.view")
  const canReadPlans = !recovery || hasPermission("tuition.view")
  const levelsQuery = useQuery({ queryKey: ["academic", "levels"], queryFn: listLevels, enabled: canReadLevels })
  const plansQuery = useQuery({ queryKey: ["finance", "tuition-plans", schoolYearId], queryFn: () => listTuitionPlans(schoolYearId), enabled: Boolean(schoolYearId) && canReadPlans })
  const [levelId, setLevelId] = useState(recovery?.levelId ?? "")
  const mounted = useRef(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const [totalAmount, setTotalAmount] = useState("")
  const [registrationAmount, setRegistrationAmount] = useState("")
  const [steps, setSteps] = useState<TuitionScheduleStep[]>([blankStep()])
  const [student, setStudent] = useState<StudentItem | null>(null)
  const [overrideType, setOverrideType] = useState<"discount" | "total">("discount")
  const [overrideAmount, setOverrideAmount] = useState("")
  const [overrideReason, setOverrideReason] = useState("")
  const [withdrawReason, setWithdrawReason] = useState("")
  const [withdrawScheduleResolution, setWithdrawScheduleResolution] = useState<"keep" | "reset">("keep")
  const [isWithdrawDialogOpen, setIsWithdrawDialogOpen] = useState(false)
  const [scheduleStudent, setScheduleStudent] = useState<StudentItem | null>(null)
  const [studentInstallments, setStudentInstallments] = useState<NegotiatedInstallment[]>([blankInstallment()])
  const [scheduleReason, setScheduleReason] = useState("")
  const [stepDateMessage, setStepDateMessage] = useState<string | null>(null)
  const updateStepDate = (index: number, value: string) => {
    const result = changeStepDate(steps, index, value)
    setSteps(result.next)
    setStepDateMessage(result.cleared ? "Les dates de seuil incompatibles ont été effacées. Renseignez-les à nouveau." : null)
  }
  const updateInstallmentDate = (index: number, value: string) => {
    let cleared = false
    setStudentInstallments((current) => current.map((step, stepIndex) => {
      if (stepIndex === index) return { ...step, dueDate: value }
      if (isCivilDate(value) && step.dueDate && ((stepIndex < index && step.dueDate >= value) || (stepIndex > index && step.dueDate <= value))) {
        cleared = true
        return { ...step, dueDate: "" }
      }
      return step
    }))
    setStepDateMessage(cleared ? "Les dates incompatibles ont été effacées. Renseignez-les à nouveau." : null)
  }
  const [isResetScheduleDialogOpen, setIsResetScheduleDialogOpen] = useState(false)
  const [isSaveScheduleDialogOpen, setIsSaveScheduleDialogOpen] = useState(false)
  const levels = !canReadLevels && recovery ? [{ id: recovery.levelId, name: recovery.levelName }] : levelsQuery.data ?? []
  const selectedPlan = useMemo(() => plansQuery.data?.find((plan) => plan.levelId === levelId), [plansQuery.data, levelId])
  const studentScheduleQuery = useQuery({
    queryKey: ["finance", "student-tuition-schedule", schoolYearId, scheduleStudent?.id],
    queryFn: () => getStudentTuitionSchedule(scheduleStudent!.id, schoolYearId),
    enabled: Boolean(schoolYearId && scheduleStudent),
  })
  const overridePreviewQuery = useQuery({ queryKey: ["finance", "tuition-override-withdrawal-preview", schoolYearId, student?.id], queryFn: () => getTuitionOverrideWithdrawalPreview(student!.id, schoolYearId), enabled: Boolean(schoolYearId && student && canGrantDiscount), retry: false })

  useEffect(() => {
    if (!levelId && levels[0]) setLevelId(levels[0].id)
  }, [levelId, levels])

  useEffect(() => {
    setTotalAmount(selectedPlan ? String(selectedPlan.totalAmount) : "")
    setRegistrationAmount(selectedPlan ? String(selectedPlan.registrationAmount) : "")
    setSteps(selectedPlan?.scheduleSteps.length ? selectedPlan.scheduleSteps : [blankStep()])
  }, [schoolYearId, levelId, selectedPlan])

  useEffect(() => {
    if (!scheduleStudent) {
      setStudentInstallments([blankInstallment()])
      setScheduleReason("")
      return
    }
    if (studentScheduleQuery.data) {
      const agreement = studentScheduleQuery.data.agreement
      let previousCumulative = 0
      setStudentInstallments(agreement?.scheduleSteps.length ? agreement.scheduleSteps.map((step) => {
        const amount = step.cumulativeAmountExpected - previousCumulative
        previousCumulative = step.cumulativeAmountExpected
        return { id: step.id, dueDate: step.dueDate, amount }
      }) : [blankInstallment()])
      setScheduleReason(agreement?.reason ?? "")
    }
  }, [scheduleStudent, studentScheduleQuery.data])

  const planMutation = useMutation({
    mutationFn: () => upsertTuitionPlan(levelId, {
      schoolYearId,
      totalAmount: Number(totalAmount),
      registrationAmount: Number(registrationAmount),
      currency: "FCFA",
      scheduleSteps: simplifiedForOnboarding
        ? (selectedPlan?.scheduleSteps ?? []).map(({ dueDate, cumulativeAmountExpected }) => ({ dueDate, cumulativeAmountExpected }))
        : steps.map((step) => ({ dueDate: step.dueDate, cumulativeAmountExpected: Number(step.cumulativeAmountExpected) })),
    }),
    onSuccess: async (plan) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["finance"] }),
        queryClient.invalidateQueries({ queryKey: ["enrollments", "payment-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["onboarding-status"] }),
      ])
      toast({ title: "Plan de frais enregistré", description: "Le plan s’applique à toutes les classes de ce niveau pour l’année sélectionnée." })
      if (mounted.current) await onPlanSaved?.(plan)
    },
    onError: (error) => toast({ title: "Enregistrement impossible", description: error instanceof Error ? error.message : "Vérifiez les montants et les dates.", variant: "destructive" }),
  })

  const overrideMutation = useMutation({
    mutationFn: () => grantTuitionOverride({
      studentId: student!.id,
      schoolYearId,
      ...(overrideType === "discount" ? { discountAmount: Number(overrideAmount) } : { overrideTotalAmount: Number(overrideAmount) }),
      reason: overrideReason.trim(),
    }),
    onSuccess: () => {
      setStudent(null)
      setOverrideAmount("")
      setOverrideReason("")
      toast({ title: overrideType === "discount" ? "Remise accordée" : "Montant personnalisé enregistré", description: "Le responsable de l’école a été notifié." })
    },
    onError: (error) => toast({ title: "Modification impossible", description: error instanceof Error ? error.message : "Vérifiez les informations saisies.", variant: "destructive" }),
  })
  const withdrawOverrideMutation = useMutation({
    mutationFn: () => withdrawTuitionOverride({ studentId: student!.id, schoolYearId, reason: withdrawReason.trim(), scheduleResolution: withdrawScheduleResolution }),
    onSuccess: async () => { setIsWithdrawDialogOpen(false); setWithdrawReason(""); await queryClient.invalidateQueries({ queryKey: ["finance"] }); toast({ title: "Ajustement retiré", description: "Le plan du niveau, les statuts et les indicateurs financiers ont été recalculés." }) },
    onError: (error) => toast({ title: "Retrait impossible", description: error instanceof Error ? error.message : "Aucun paiement n’a été modifié.", variant: "destructive" }),
  })

  const studentScheduleMutation = useMutation({
    mutationFn: () => saveStudentTuitionSchedule({
      studentId: scheduleStudent!.id,
      schoolYearId,
      reason: scheduleReason.trim(),
      installments: studentInstallments.map((step) => ({
        dueDate: step.dueDate,
        amount: Number(step.amount),
      })),
    }),
    onSuccess: async (savedSchedule) => {
      setIsSaveScheduleDialogOpen(false)
      const agreement = savedSchedule.agreement
      if (agreement) {
        let previousCumulative = 0
        setStudentInstallments(agreement.scheduleSteps.map((step) => {
          const amount = step.cumulativeAmountExpected - previousCumulative
          previousCumulative = step.cumulativeAmountExpected
          return { id: step.id, dueDate: step.dueDate, amount }
        }))
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["finance", "student-tuition-schedule", schoolYearId, scheduleStudent?.id] }),
        queryClient.invalidateQueries({ queryKey: ["finance", "financial-summary"] }),
      ])
      toast({ title: "Échéancier négocié enregistré", description: "Les statuts financiers et les relances utilisent désormais cet accord." })
    },
    onError: (error) => toast({ title: "Enregistrement impossible", description: error instanceof Error ? error.message : "Vérifiez les dates et les montants de la courbe.", variant: "destructive" }),
  })

  const resetStudentScheduleMutation = useMutation({
    mutationFn: () => resetStudentTuitionSchedule(scheduleStudent!.id, schoolYearId, scheduleReason.trim()),
    onSuccess: async () => {
      setIsResetScheduleDialogOpen(false)
      setStudentInstallments([blankInstallment()])
      setScheduleReason("")
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["finance", "student-tuition-schedule", schoolYearId, scheduleStudent?.id] }),
        queryClient.invalidateQueries({ queryKey: ["finance", "financial-summary"] }),
      ])
      toast({ title: "Échéancier négocié supprimé", description: "L’élève suit de nouveau le plan de son niveau." })
    },
    onError: (error) => toast({ title: "Réinitialisation impossible", description: error instanceof Error ? error.message : "Réessayez dans quelques instants.", variant: "destructive" }),
  })

  const total = Number(totalAmount)
  const registrationTotal = Number(registrationAmount)
  const registrationAmountValid = !simplifiedForOnboarding || (Number.isFinite(registrationTotal) && registrationTotal > 0)
  const stepsValid = steps.every((step, index) => {
    const previous = steps[index - 1]
    return isCivilDate(step.dueDate) && step.cumulativeAmountExpected >= 0 && step.cumulativeAmountExpected <= total && (!previous || (step.dueDate > previous.dueDate && step.cumulativeAmountExpected >= previous.cumulativeAmountExpected))
  })
  const negotiatedTotal = studentInstallments.reduce((sum, step) => sum + Number(step.amount || 0), 0)
  const negotiatedTotalDue = studentScheduleQuery.data?.totalTuitionAmount ?? 0
  const remainingToPlan = negotiatedTotalDue - negotiatedTotal
  const studentScheduleValid = studentInstallments.every((step, index) => {
    const previous = studentInstallments[index - 1]
    return isCivilDate(step.dueDate) && Number(step.amount) > 0 && (!previous || step.dueDate > previous.dueDate)
  }) && remainingToPlan === 0 && Boolean(scheduleReason.trim())

  return (
    <section className="space-y-6">
      <div className="max-w-2xl space-y-1">
        <h2 className="text-xl font-semibold">Configuration des frais</h2>
        <p className="text-sm text-muted-foreground">
          Définissez le montant annuel et les seuils cumulés attendus. Aucun
          versement individuel n’est imposé.
        </p>
      </div>
      {(canReadLevels && levelsQuery.isLoading) ||
      (canReadPlans && plansQuery.isLoading) ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Chargement des frais…
        </p>
      ) : null}
      {(canReadLevels && levelsQuery.isError) ||
      (canReadPlans && plansQuery.isError) ? (
        <Alert variant="destructive">
          <AlertDescription>
            Impossible de charger les frais ou les niveaux. Vérifiez vos droits
            et réessayez.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <CalendarClock className="h-5 w-5 text-primary" />
            Plan par niveau
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 p-3">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="tuition-level">Niveau</Label>
              <Select value={levelId} onValueChange={setLevelId}>
                <SelectTrigger id="tuition-level" className="min-h-12">
                  <SelectValue placeholder="Choisir un niveau" />
                </SelectTrigger>
                <SelectContent>
                  {levels.map((level) => (
                    <SelectItem key={level.id} value={level.id}>
                      {level.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Toutes les classes de ce niveau utilisent ce plan pendant
                l’année scolaire sélectionnée.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tuition-total">Montant total de scolarité annuel</Label>
              <div className="relative">
                <Input
                  id="tuition-total"
                  className="min-h-12 pr-16 tabular-nums"
                  inputMode="numeric"
                  disabled={!canEdit}
                  value={
                    totalAmount
                      ? Number(totalAmount).toLocaleString("fr-FR")
                      : ""
                  }
                  onChange={(event) =>
                    setTotalAmount(event.target.value.replace(/\D/g, ""))
                  }
                  placeholder="Ex. 350000"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  FCFA
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tuition-registration">Montant à verser à l’inscription</Label>
              <div className="relative">
                <Input
                  id="tuition-registration"
                  className="min-h-12 pr-16 tabular-nums"
                  inputMode="numeric"
                  disabled={!canEdit}
                  required={simplifiedForOnboarding}
                  aria-describedby="tuition-registration-help"
                  value={registrationAmount ? Number(registrationAmount).toLocaleString("fr-FR") : ""}
                  onChange={(event) => setRegistrationAmount(event.target.value.replace(/\D/g, ""))}
                  placeholder="Ex. 50000"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">FCFA</span>
              </div>
              <p id="tuition-registration-help" className="text-xs text-muted-foreground">
                Montant obligatoire à régler lors de l’inscription.
              </p>
            </div>
          </div>

          {simplifiedForOnboarding ? (
            <p className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
              La courbe cumulative et ses échéances pourront être renseignées plus tard.
            </p>
          ) : <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label>Courbe cumulative attendue</Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  Les dates et montants doivent progresser dans l’ordre.
                </p>
              </div>
              {canEdit ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-10"
                  onClick={() =>
                    setSteps((current) => [...current, blankStep()])
                  }
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Ajouter un seuil
                </Button>
              ) : null}
            </div>
            <div className="space-y-2">
              {steps.map((step, index) => (
                <div
                  key={step.id ?? index}
                  className={cn(
                    "grid gap-2 rounded-lg border bg-muted/20 p-3 sm:items-end",
                    canEdit
                      ? "sm:grid-cols-[2rem_0.5fr_0.5fr_1fr_3rem]"
                      : "sm:grid-cols-[2rem_1fr_1fr_7rem]",
                  )}
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {index + 1}
                  </span>
                  <div className="space-y-1.5">
                    <Label htmlFor={`step-date-${index}`}>Date seuil</Label>
                    <Input
                      id={`step-date-${index}`}
                      type="date"
                      disabled={!canEdit}
                      value={step.dueDate}
                      aria-describedby={
                        stepDateMessage ? "plan-step-date-message" : undefined
                      }
                      min={
                        isCivilDate(steps[index - 1]?.dueDate ?? "")
                          ? addDaysIso(steps[index - 1]!.dueDate, 1)
                          : undefined
                      }
                      max={
                        isCivilDate(steps[index + 1]?.dueDate ?? "")
                          ? addDaysIso(steps[index + 1]!.dueDate, -1)
                          : undefined
                      }
                      onChange={(event) =>
                        updateStepDate(index, event.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`step-amount-${index}`}>
                      Cumul attendu
                    </Label>
                    <Input
                      id={`step-amount-${index}`}
                      inputMode="numeric"
                      disabled={!canEdit}
                      value={
                        step.cumulativeAmountExpected
                          ? step.cumulativeAmountExpected.toLocaleString(
                              "fr-FR",
                            )
                          : ""
                      }
                      onChange={(event) =>
                        setSteps((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index
                              ? {
                                  ...item,
                                  cumulativeAmountExpected: Number(
                                    event.target.value.replace(/\D/g, ""),
                                  ),
                                }
                              : item,
                          ),
                        )
                      }
                    />
                  </div>
                  <div className="space-y-1.5 pb-1 text-sm tabular-nums text-muted-foreground">
                    <span className="block text-xs">Part du total</span>
                    {total > 0
                      ? Math.min(
                          100,
                          Math.round(
                            (step.cumulativeAmountExpected / total) * 100,
                          ),
                        )
                      : 0}{" "}
                    %
                    <Progress
                      value={
                        total > 0
                          ? Math.min(
                              100,
                              (step.cumulativeAmountExpected / total) * 100,
                            )
                          : 0
                      }
                      aria-label={`Part du total au seuil ${index + 1}`}
                      className="h-1.5"
                    />
                  </div>
                  {canEdit ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="min-h-12 min-w-12 text-muted-foreground hover:text-red-700"
                      aria-label={`Supprimer le seuil ${index + 1}`}
                      disabled={steps.length === 1}
                      onClick={() =>
                        setSteps((current) =>
                          current.filter((_, itemIndex) => itemIndex !== index),
                        )
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          </div>}

          {!simplifiedForOnboarding && stepDateMessage ? (
            <p
              id="plan-step-date-message"
              role="alert"
              className="text-sm text-destructive"
            >
              {stepDateMessage}
            </p>
          ) : null}
          {!simplifiedForOnboarding && stepsValid &&
          total > 0 &&
          steps[steps.length - 1] &&
          steps[steps.length - 1]!.cumulativeAmountExpected < total ? (
            <p className="text-sm text-muted-foreground">
              Le dernier seuil (
              {formatFcfa(steps[steps.length - 1]!.cumulativeAmountExpected)})
              est inférieur au montant annuel ({formatFcfa(total)}) : vérifiez
              que c’est voulu.
            </p>
          ) : null}
          {!simplifiedForOnboarding && !stepsValid && total > 0 ? (
            <Alert variant="destructive">
              <AlertDescription>
                Chaque seuil doit avoir une date croissante et un cumul compris
                entre 0 et {formatFcfa(total)}.
              </AlertDescription>
            </Alert>
          ) : null}
          {canEdit ? (
            <div className="flex justify-end">
              <Button
                type="button"
                className="min-h-12"
                disabled={
                  !levelId ||
                  total <= 0 ||
                  !registrationAmountValid ||
                  (!simplifiedForOnboarding && !stepsValid) ||
                  planMutation.isPending ||
                  (canReadLevels &&
                    (levelsQuery.isLoading || levelsQuery.isError)) ||
                  (canReadPlans && (plansQuery.isLoading || plansQuery.isError))
                }
                onClick={() => planMutation.mutate()}
              >
                {planMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                )}
                {planMutation.isPending
                  ? "Enregistrement…"
                  : "Enregistrer le plan"}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {canManageStudentSchedule ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarClock className="h-5 w-5 text-primary" />
              Échéancier négocié
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Cet accord adapte les dates et montants des versements sans
              diminuer la dette de scolarité.
            </p>
            <div className="space-y-2">
              <Label>Élève</Label>
              <StudentSearch
                schoolYearId={schoolYearId}
                value={scheduleStudent}
                onChange={setScheduleStudent}
                placeholder="Rechercher un élève confirmé"
              />
            </div>
            {scheduleStudent ? (
              <div className="space-y-4">
                {studentScheduleQuery.isLoading ? (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Chargement de l’accord…
                  </p>
                ) : null}
                {studentScheduleQuery.isError ? (
                  <Alert variant="destructive">
                    <AlertDescription>
                      Impossible de charger l’accord actuel de cet élève.
                    </AlertDescription>
                  </Alert>
                ) : null}
                {!studentScheduleQuery.isLoading &&
                !studentScheduleQuery.isError ? (
                  <>
                    <div className="grid gap-3 rounded-lg border bg-muted/20 p-3 text-sm sm:grid-cols-2">
                      <p>
                        <span className="block text-xs text-muted-foreground">
                          Total de scolarité à couvrir
                        </span>
                        <span className="font-semibold tabular-nums">
                          {formatFcfa(negotiatedTotalDue)}
                        </span>
                      </p>
                      <p>
                        <span className="block text-xs text-muted-foreground">
                          Solde restant à planifier
                        </span>
                        <span
                          className={
                            remainingToPlan === 0
                              ? "font-semibold tabular-nums text-green-700"
                              : "font-semibold tabular-nums text-amber-700"
                          }
                        >
                          {formatFcfa(Math.abs(remainingToPlan))}
                          {remainingToPlan < 0 ? " en trop" : ""}
                        </span>
                      </p>
                    </div>
                    {studentScheduleQuery.data?.agreement ? (
                      <p className="text-xs text-muted-foreground">
                        Accord mis à jour le{" "}
                        {new Date(
                          studentScheduleQuery.data.agreement.updatedAt,
                        ).toLocaleDateString("fr-CI")}
                        {studentScheduleQuery.data.agreement.updatedByName
                          ? ` par ${studentScheduleQuery.data.agreement.updatedByName}`
                          : ""}{" "}
                        · motif : {studentScheduleQuery.data.agreement.reason}
                      </p>
                    ) : null}
                    <div className="space-y-2">
                      <Label htmlFor="schedule-reason">Motif de l’accord</Label>
                      <Textarea
                        id="schedule-reason"
                        className="min-h-24"
                        value={scheduleReason}
                        maxLength={1000}
                        disabled={
                          studentScheduleMutation.isPending ||
                          resetStudentScheduleMutation.isPending
                        }
                        onChange={(event) =>
                          setScheduleReason(event.target.value)
                        }
                        placeholder="Ex. accord conclu avec le parent le…"
                      />
                      <p className="text-xs text-muted-foreground">
                        Le motif est conservé dans l’historique de l’accord.
                      </p>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <Label>Échéances</Label>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Saisissez le montant de chaque versement ; le cumul
                          est calculé automatiquement.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="min-h-12"
                        disabled={
                          studentScheduleMutation.isPending ||
                          resetStudentScheduleMutation.isPending
                        }
                        onClick={() =>
                          setStudentInstallments((current) => [
                            ...current,
                            blankInstallment(),
                          ])
                        }
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Ajouter
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {studentInstallments.map((step, index) => {
                        const cumulative = studentInstallments
                          .slice(0, index + 1)
                          .reduce(
                            (sum, installment) =>
                              sum + Number(installment.amount || 0),
                            0,
                          );
                        return (
                          <div
                            key={`${scheduleStudent.id}-${step.id ?? index}`}
                            className="grid gap-2 rounded-lg border bg-muted/20 p-3 sm:grid-cols-[2rem_1fr_1fr_1fr_3rem] sm:items-end"
                          >
                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                              {index + 1}
                            </span>
                            <div className="space-y-1.5">
                              <Label htmlFor={`student-step-date-${index}`}>
                                Date d’échéance
                              </Label>
                              <Input
                                id={`student-step-date-${index}`}
                                type="date"
                                className="min-h-12"
                                disabled={
                                  studentScheduleMutation.isPending ||
                                  resetStudentScheduleMutation.isPending
                                }
                                value={step.dueDate}
                                min={
                                  isCivilDate(
                                    studentInstallments[index - 1]?.dueDate ??
                                      "",
                                  )
                                    ? addDaysIso(
                                        studentInstallments[index - 1]!.dueDate,
                                        1,
                                      )
                                    : undefined
                                }
                                max={
                                  isCivilDate(
                                    studentInstallments[index + 1]?.dueDate ??
                                      "",
                                  )
                                    ? addDaysIso(
                                        studentInstallments[index + 1]!.dueDate,
                                        -1,
                                      )
                                    : undefined
                                }
                                onChange={(event) =>
                                  updateInstallmentDate(
                                    index,
                                    event.target.value,
                                  )
                                }
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label htmlFor={`student-step-amount-${index}`}>
                                Montant de l’échéance
                              </Label>
                              <Input
                                id={`student-step-amount-${index}`}
                                className="min-h-12 tabular-nums"
                                inputMode="numeric"
                                disabled={
                                  studentScheduleMutation.isPending ||
                                  resetStudentScheduleMutation.isPending
                                }
                                value={step.amount || ""}
                                onChange={(event) =>
                                  setStudentInstallments((current) =>
                                    current.map((item, itemIndex) =>
                                      itemIndex === index
                                        ? {
                                            ...item,
                                            amount: Number(
                                              event.target.value.replace(
                                                /\D/g,
                                                "",
                                              ),
                                            ),
                                          }
                                        : item,
                                    ),
                                  )
                                }
                              />
                            </div>
                            <p className="pb-3 text-sm tabular-nums text-muted-foreground">
                              <span className="block text-xs">
                                Cumul calculé
                              </span>
                              {formatFcfa(cumulative)}
                            </p>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="min-h-12 min-w-12 text-muted-foreground hover:text-red-700"
                              aria-label={`Supprimer l’échéance ${index + 1}`}
                              disabled={
                                studentInstallments.length === 1 ||
                                studentScheduleMutation.isPending ||
                                resetStudentScheduleMutation.isPending
                              }
                              onClick={() =>
                                setStudentInstallments((current) =>
                                  current.filter(
                                    (_, itemIndex) => itemIndex !== index,
                                  ),
                                )
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                    {!studentScheduleValid ? (
                      <Alert variant="destructive">
                        <AlertDescription>
                          Renseignez des dates strictement croissantes, des
                          montants positifs, un motif, et planifiez exactement
                          le total de scolarité.
                        </AlertDescription>
                      </Alert>
                    ) : null}
                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        className="min-h-12"
                        disabled={
                          !studentScheduleQuery.data?.agreement ||
                          !scheduleReason.trim() ||
                          studentScheduleMutation.isPending ||
                          resetStudentScheduleMutation.isPending
                        }
                        onClick={() => setIsResetScheduleDialogOpen(true)}
                      >
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Revenir au plan commun
                      </Button>
                      <Button
                        type="button"
                        className="min-h-12"
                        disabled={
                          !studentScheduleValid ||
                          studentScheduleMutation.isPending ||
                          resetStudentScheduleMutation.isPending
                        }
                        onClick={() => setIsSaveScheduleDialogOpen(true)}
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Enregistrer l’accord
                      </Button>
                    </div>
                  </>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {canGrantDiscount ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Tag className="h-5 w-5 text-primary" />
              Ajustement individuel
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Une seule remise ou un seul montant personnalisé peut être accordé
              par élève et par année scolaire.
            </p>
            <div className="space-y-2">
              <Label>Élève</Label>
              <StudentSearch
                schoolYearId={schoolYearId}
                value={student}
                onChange={setStudent}
              />
            </div>
            {student && overridePreviewQuery.isLoading ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Vérification de l’ajustement actif…
              </p>
            ) : null}
            {student && overridePreviewQuery.data ? (
              <div className="space-y-4 rounded-lg border bg-muted/20 p-4 text-sm">
                <p className="font-medium">
                  Ajustement actif :{" "}
                  {overridePreviewQuery.data.adjustment.type === "discount"
                    ? `remise de ${formatFcfa(overridePreviewQuery.data.adjustment.discountAmount ?? 0)}`
                    : `montant personnalisé de ${formatFcfa(overridePreviewQuery.data.adjustment.overrideTotalAmount ?? 0)}`}
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <p>
                    <span className="block text-xs text-muted-foreground">
                      Montant actuel
                    </span>
                    <span className="font-semibold tabular-nums">
                      {formatFcfa(overridePreviewQuery.data.currentTotalAmount)}
                    </span>
                  </p>
                  <p>
                    <span className="block text-xs text-muted-foreground">
                      Montant après retrait
                    </span>
                    <span className="font-semibold tabular-nums">
                      {formatFcfa(
                        overridePreviewQuery.data.restoredTotalAmount,
                      )}
                    </span>
                  </p>
                  <p>
                    <span className="block text-xs text-muted-foreground">
                      Déjà encaissé
                    </span>
                    <span className="font-semibold tabular-nums">
                      {formatFcfa(overridePreviewQuery.data.confirmedPaid)}
                    </span>
                  </p>
                  <p>
                    <span className="block text-xs text-muted-foreground">
                      Reste à payer après retrait
                    </span>
                    <span className="font-semibold tabular-nums">
                      {formatFcfa(overridePreviewQuery.data.remainingAfter)}
                    </span>
                  </p>
                </div>
                {overridePreviewQuery.data.potentialOverpayment ? (
                  <Alert variant="destructive">
                    <AlertDescription>
                      Le retrait est bloqué : il créerait un trop-perçu à
                      traiter comptablement.
                    </AlertDescription>
                  </Alert>
                ) : null}
                {overridePreviewQuery.data.schedule.present &&
                !overridePreviewQuery.data.schedule.compatible ? (
                  <Alert>
                    <AlertDescription>
                      L’échéancier négocié ne correspond plus au plan restauré.
                      Choisissez son remplacement ou le retour au plan commun
                      dans la confirmation.
                    </AlertDescription>
                  </Alert>
                ) : null}
                <Button
                  type="button"
                  variant="destructive"
                  className="min-h-12"
                  disabled={overridePreviewQuery.data.potentialOverpayment}
                  onClick={() => {
                    setWithdrawScheduleResolution(
                      overridePreviewQuery.data!.schedule.compatible
                        ? "keep"
                        : "reset",
                    );
                    setIsWithdrawDialogOpen(true);
                  }}
                >
                  Retirer l’ajustement
                </Button>
              </div>
            ) : null}
            {!student || !overridePreviewQuery.data ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="override-type">Type d’ajustement</Label>
                    <Select
                      value={overrideType}
                      onValueChange={(value) =>
                        setOverrideType(value as "discount" | "total")
                      }
                    >
                      <SelectTrigger id="override-type" className="min-h-12">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="discount">
                          Remise à déduire
                        </SelectItem>
                        <SelectItem value="total">
                          Montant total personnalisé
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="override-amount">Montant</Label>
                    <Input
                      id="override-amount"
                      className="min-h-12"
                      inputMode="numeric"
                      value={overrideAmount}
                      onChange={(event) =>
                        setOverrideAmount(event.target.value.replace(/\D/g, ""))
                      }
                      placeholder="Montant en FCFA"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="override-reason">Motif obligatoire</Label>
                  <Textarea
                    id="override-reason"
                    value={overrideReason}
                    maxLength={1000}
                    onChange={(event) => setOverrideReason(event.target.value)}
                    placeholder="Décision et contexte de l’ajustement"
                  />
                </div>
                <div className="flex justify-end">
                  <Button
                    type="button"
                    className="min-h-12"
                    disabled={
                      !student ||
                      !overrideAmount ||
                      Number(overrideAmount) < 0 ||
                      !overrideReason.trim() ||
                      overrideMutation.isPending
                    }
                    onClick={() => overrideMutation.mutate()}
                  >
                    {overrideMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Accorder l’ajustement
                  </Button>
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <AlertDialog
        open={isSaveScheduleDialogOpen}
        onOpenChange={setIsSaveScheduleDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Confirmer l’échéancier négocié ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Les dates, montants et motif de cet accord seront enregistrés et
              utilisés immédiatement pour les relances et le statut financier.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-12">Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="min-h-12"
              onClick={() => studentScheduleMutation.mutate()}
            >
              {studentScheduleMutation.isPending
                ? "Enregistrement…"
                : "Confirmer l’accord"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={isWithdrawDialogOpen}
        onOpenChange={setIsWithdrawDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Confirmer le retrait de l’ajustement ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Cette action restaure le montant du plan de niveau. Aucun paiement
              confirmé ne sera modifié.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3">
            <Label htmlFor="withdraw-reason">Motif obligatoire</Label>
            <Textarea
              id="withdraw-reason"
              value={withdrawReason}
              onChange={(event) => setWithdrawReason(event.target.value)}
              maxLength={1000}
              placeholder="Expliquez la décision de retrait"
            />
            {overridePreviewQuery.data?.schedule.present &&
            !overridePreviewQuery.data.schedule.compatible ? (
              <div className="space-y-2">
                <Label>Échéancier négocié</Label>
                <Select
                  value={withdrawScheduleResolution}
                  onValueChange={(value) =>
                    setWithdrawScheduleResolution(value as "keep" | "reset")
                  }
                >
                  <SelectTrigger className="min-h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="reset">
                      Revenir au plan du niveau
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-12">Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="min-h-12"
              disabled={
                !withdrawReason.trim() || withdrawOverrideMutation.isPending
              }
              onClick={(event) => {
                event.preventDefault();
                withdrawOverrideMutation.mutate();
              }}
            >
              {withdrawOverrideMutation.isPending
                ? "Retrait en cours…"
                : "Confirmer le retrait"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={isResetScheduleDialogOpen}
        onOpenChange={setIsResetScheduleDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revenir au plan du niveau ?</AlertDialogTitle>
            <AlertDialogDescription>
              L’échéancier négocié de{" "}
              {scheduleStudent
                ? `${scheduleStudent.lastName} ${scheduleStudent.firstName}`
                : "cet élève"}{" "}
              sera archivé dans l’historique. Les alertes et le statut financier
              suivront de nouveau le plan commun.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-12">Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="min-h-12"
              onClick={() => resetStudentScheduleMutation.mutate()}
            >
              {resetStudentScheduleMutation.isPending
                ? "Enregistrement…"
                : "Revenir au plan commun"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
