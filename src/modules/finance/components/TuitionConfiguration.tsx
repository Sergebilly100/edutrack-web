import { useEffect, useMemo, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CalendarClock, CheckCircle2, Loader2, Plus, RotateCcw, Tag, Trash2 } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
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
import { getStudentTuitionSchedule, grantTuitionOverride, listTuitionPlans, resetStudentTuitionSchedule, saveStudentTuitionSchedule, upsertTuitionPlan, type TuitionPlan, type TuitionScheduleStep } from "../finance.api"
import type { TuitionRecovery } from "../tuition-recovery"
import { StudentSearch } from "./StudentSearch"

type TuitionConfigurationProps = {
  schoolYearId: string
  canEdit: boolean
  canGrantDiscount: boolean
  recovery?: TuitionRecovery | null
  onPlanSaved?: (plan: TuitionPlan) => Promise<void>
}

const blankStep = (): TuitionScheduleStep => ({ dueDate: "", cumulativeAmountExpected: 0 })

export function TuitionConfiguration({ schoolYearId, canEdit, canGrantDiscount, recovery, onPlanSaved }: TuitionConfigurationProps) {
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
  const [steps, setSteps] = useState<TuitionScheduleStep[]>([blankStep()])
  const [student, setStudent] = useState<StudentItem | null>(null)
  const [overrideType, setOverrideType] = useState<"discount" | "total">("discount")
  const [overrideAmount, setOverrideAmount] = useState("")
  const [overrideReason, setOverrideReason] = useState("")
  const [scheduleStudent, setScheduleStudent] = useState<StudentItem | null>(null)
  const [studentScheduleSteps, setStudentScheduleSteps] = useState<TuitionScheduleStep[]>([blankStep()])
  const [isResetScheduleDialogOpen, setIsResetScheduleDialogOpen] = useState(false)
  const levels = !canReadLevels && recovery ? [{ id: recovery.levelId, name: recovery.levelName }] : levelsQuery.data ?? []
  const selectedPlan = useMemo(() => plansQuery.data?.find((plan) => plan.levelId === levelId), [plansQuery.data, levelId])
  const studentScheduleQuery = useQuery({
    queryKey: ["finance", "student-tuition-schedule", schoolYearId, scheduleStudent?.id],
    queryFn: () => getStudentTuitionSchedule(scheduleStudent!.id, schoolYearId),
    enabled: Boolean(schoolYearId && scheduleStudent),
  })

  useEffect(() => {
    if (!levelId && levels[0]) setLevelId(levels[0].id)
  }, [levelId, levels])

  useEffect(() => {
    setTotalAmount(selectedPlan ? String(selectedPlan.totalAmount) : "")
    setSteps(selectedPlan?.scheduleSteps.length ? selectedPlan.scheduleSteps : [blankStep()])
  }, [schoolYearId, levelId, selectedPlan])

  useEffect(() => {
    if (!scheduleStudent) {
      setStudentScheduleSteps([blankStep()])
      return
    }
    if (studentScheduleQuery.data) {
      setStudentScheduleSteps(studentScheduleQuery.data.length > 0 ? studentScheduleQuery.data : [blankStep()])
    }
  }, [scheduleStudent, studentScheduleQuery.data])

  const planMutation = useMutation({
    mutationFn: () => upsertTuitionPlan(levelId, {
      schoolYearId,
      totalAmount: Number(totalAmount),
      currency: "FCFA",
      scheduleSteps: steps.map((step) => ({ dueDate: step.dueDate, cumulativeAmountExpected: Number(step.cumulativeAmountExpected) })),
    }),
    onSuccess: async (plan) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["finance"] }),
        queryClient.invalidateQueries({ queryKey: ["enrollments", "payment-summary"] }),
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

  const studentScheduleMutation = useMutation({
    mutationFn: () => saveStudentTuitionSchedule({
      studentId: scheduleStudent!.id,
      schoolYearId,
      scheduleSteps: studentScheduleSteps.map((step) => ({
        dueDate: step.dueDate,
        cumulativeAmountExpected: Number(step.cumulativeAmountExpected),
      })),
    }),
    onSuccess: async (savedSteps) => {
      setStudentScheduleSteps(savedSteps)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["finance", "student-tuition-schedule", schoolYearId, scheduleStudent?.id] }),
        queryClient.invalidateQueries({ queryKey: ["finance", "financial-summary"] }),
      ])
      toast({ title: "Courbe individuelle enregistrée", description: "Les statuts financiers et les relances utilisent désormais cet échéancier." })
    },
    onError: (error) => toast({ title: "Enregistrement impossible", description: error instanceof Error ? error.message : "Vérifiez les dates et les montants de la courbe.", variant: "destructive" }),
  })

  const resetStudentScheduleMutation = useMutation({
    mutationFn: () => resetStudentTuitionSchedule(scheduleStudent!.id, schoolYearId),
    onSuccess: async () => {
      setStudentScheduleSteps([blankStep()])
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["finance", "student-tuition-schedule", schoolYearId, scheduleStudent?.id] }),
        queryClient.invalidateQueries({ queryKey: ["finance", "financial-summary"] }),
      ])
      toast({ title: "Courbe individuelle réinitialisée", description: "L’élève suit de nouveau le plan de son niveau." })
    },
    onError: (error) => toast({ title: "Réinitialisation impossible", description: error instanceof Error ? error.message : "Réessayez dans quelques instants.", variant: "destructive" }),
  })

  const total = Number(totalAmount)
  const stepsValid = steps.every((step, index) => {
    const previous = steps[index - 1]
    return Boolean(step.dueDate) && step.cumulativeAmountExpected >= 0 && step.cumulativeAmountExpected <= total && (!previous || (step.dueDate > previous.dueDate && step.cumulativeAmountExpected >= previous.cumulativeAmountExpected))
  })
  const studentScheduleValid = studentScheduleSteps.every((step, index) => {
    const previous = studentScheduleSteps[index - 1]
    return Boolean(step.dueDate) && step.cumulativeAmountExpected >= 0 && (!previous || (step.dueDate > previous.dueDate && step.cumulativeAmountExpected >= previous.cumulativeAmountExpected))
  })

  return (
    <section className="space-y-6">
      <div className="max-w-2xl space-y-1"><h2 className="text-xl font-semibold">Configuration des frais</h2><p className="text-sm text-muted-foreground">Définissez le montant annuel et les seuils cumulés attendus. Aucun versement individuel n’est imposé.</p></div>
      {canReadLevels && levelsQuery.isLoading || canReadPlans && plansQuery.isLoading ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Chargement des frais…</p> : null}
      {canReadLevels && levelsQuery.isError || canReadPlans && plansQuery.isError ? <Alert variant="destructive"><AlertDescription>Impossible de charger les frais ou les niveaux. Vérifiez vos droits et réessayez.</AlertDescription></Alert> : null}

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><CalendarClock className="h-5 w-5 text-primary" />Plan par niveau</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="tuition-level">Niveau</Label><Select value={levelId} onValueChange={setLevelId}><SelectTrigger id="tuition-level" className="min-h-12"><SelectValue placeholder="Choisir un niveau" /></SelectTrigger><SelectContent>{levels.map((level) => <SelectItem key={level.id} value={level.id}>{level.name}</SelectItem>)}</SelectContent></Select><p className="text-xs text-muted-foreground">Toutes les classes de ce niveau utilisent ce plan pendant l’année scolaire sélectionnée.</p></div>
            <div className="space-y-2"><Label htmlFor="tuition-total">Montant total annuel</Label><div className="relative"><Input id="tuition-total" className="min-h-12 pr-16 tabular-nums" inputMode="numeric" disabled={!canEdit} value={totalAmount} onChange={(event) => setTotalAmount(event.target.value.replace(/\D/g, ""))} placeholder="Ex. 350000" /><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">FCFA</span></div></div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3"><div><Label>Courbe cumulative attendue</Label><p className="mt-1 text-xs text-muted-foreground">Les dates et montants doivent progresser dans l’ordre.</p></div>{canEdit ? <Button type="button" variant="outline" size="sm" className="min-h-12" onClick={() => setSteps((current) => [...current, blankStep()])}><Plus className="mr-2 h-4 w-4" />Ajouter un seuil</Button> : null}</div>
            <div className="space-y-2">
              {steps.map((step, index) => (
                <div key={step.id ?? index} className="grid gap-2 rounded-lg border bg-muted/20 p-3 sm:grid-cols-[2rem_1fr_1fr_3rem] sm:items-end">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">{index + 1}</span>
                  <div className="space-y-1.5"><Label htmlFor={`step-date-${index}`}>Date seuil</Label><Input id={`step-date-${index}`} type="date" disabled={!canEdit} value={step.dueDate} onChange={(event) => setSteps((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, dueDate: event.target.value } : item))} /></div>
                  <div className="space-y-1.5"><Label htmlFor={`step-amount-${index}`}>Cumul attendu</Label><Input id={`step-amount-${index}`} inputMode="numeric" disabled={!canEdit} value={step.cumulativeAmountExpected || ""} onChange={(event) => setSteps((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, cumulativeAmountExpected: Number(event.target.value.replace(/\D/g, "")) } : item))} /></div>
                  {canEdit ? <Button type="button" variant="ghost" size="icon" className="min-h-12 min-w-12 text-muted-foreground hover:text-red-700" aria-label={`Supprimer le seuil ${index + 1}`} disabled={steps.length === 1} onClick={() => setSteps((current) => current.filter((_, itemIndex) => itemIndex !== index))}><Trash2 className="h-4 w-4" /></Button> : null}
                </div>
              ))}
            </div>
          </div>

          {!stepsValid && total > 0 ? <Alert variant="destructive"><AlertDescription>Chaque seuil doit avoir une date croissante et un cumul compris entre 0 et {formatFcfa(total)}.</AlertDescription></Alert> : null}
          {canEdit ? <div className="flex justify-end"><Button type="button" className="min-h-12" disabled={!levelId || total <= 0 || !stepsValid || planMutation.isPending || (canReadLevels && (levelsQuery.isLoading || levelsQuery.isError)) || (canReadPlans && (plansQuery.isLoading || plansQuery.isError))} onClick={() => planMutation.mutate()}>{planMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}{planMutation.isPending ? "Enregistrement…" : "Enregistrer le plan"}</Button></div> : null}
        
          
          {canGrantDiscount ? (
            <Card className="mt-6">
              <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><CalendarClock className="h-5 w-5 text-primary" />Courbe individuelle</CardTitle></CardHeader>
              <CardContent className="space-y-4 mb-6">
                <p className="text-sm text-muted-foreground">Pour un cas particulier, remplacez la Courbe cumulative attendue pour cet élève uniquement. Les alertes et le statut de paiement suivront cette nouvelle courbe.</p>
                <div className="space-y-2"><Label>Élève</Label><StudentSearch value={scheduleStudent} onChange={setScheduleStudent} placeholder="Rechercher un élève à personnaliser" /></div>
                {scheduleStudent ? (
                  <div className="space-y-3">
                    {studentScheduleQuery.isLoading ? <p className="text-sm text-muted-foreground">Chargement de la courbe de l’élève…</p> : null}
                    {studentScheduleQuery.isError ? <Alert variant="destructive"><AlertDescription>Impossible de charger la courbe actuelle de cet élève.</AlertDescription></Alert> : null}
                    {!studentScheduleQuery.isLoading && !studentScheduleQuery.isError ? <>
                      <div className="flex items-center justify-between gap-3"><div><Label>Seuils cumulés attendus</Label><p className="mt-1 text-xs text-muted-foreground">Chaque cumul doit progresser et rester dans les frais de scolarité de l’élève.</p></div><Button type="button" variant="outline" size="sm" className="min-h-12" disabled={studentScheduleMutation.isPending || resetStudentScheduleMutation.isPending} onClick={() => setStudentScheduleSteps((current) => [...current, blankStep()])}><Plus className="mr-2 h-4 w-4" />Ajouter un seuil</Button></div>
                      <div className="space-y-2">
                        {studentScheduleSteps.map((step, index) => (
                          <div key={`${scheduleStudent.id}-${step.id ?? index}`} className="grid gap-2 rounded-lg border bg-muted/20 p-3 sm:grid-cols-[2rem_1fr_1fr_3rem] sm:items-end">
                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">{index + 1}</span>
                            <div className="space-y-1.5"><Label htmlFor={`student-step-date-${index}`}>Date seuil</Label><Input id={`student-step-date-${index}`} type="date" disabled={studentScheduleMutation.isPending || resetStudentScheduleMutation.isPending} value={step.dueDate} onChange={(event) => setStudentScheduleSteps((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, dueDate: event.target.value } : item))} /></div>
                            <div className="space-y-1.5"><Label htmlFor={`student-step-amount-${index}`}>Cumul attendu</Label><Input id={`student-step-amount-${index}`} inputMode="numeric" disabled={studentScheduleMutation.isPending || resetStudentScheduleMutation.isPending} value={step.cumulativeAmountExpected || ""} onChange={(event) => setStudentScheduleSteps((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, cumulativeAmountExpected: Number(event.target.value.replace(/\D/g, "")) } : item))} /></div>
                            <Button type="button" variant="ghost" size="icon" className="min-h-12 min-w-12 text-muted-foreground hover:text-red-700" aria-label={`Supprimer le seuil individuel ${index + 1}`} disabled={studentScheduleSteps.length === 1 || studentScheduleMutation.isPending || resetStudentScheduleMutation.isPending} onClick={() => setStudentScheduleSteps((current) => current.filter((_, itemIndex) => itemIndex !== index))}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        ))}
                      </div>
                      {!studentScheduleValid ? <Alert variant="destructive"><AlertDescription>Chaque seuil doit avoir une date croissante et un cumul au moins égal au précédent.</AlertDescription></Alert> : null}
                      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                        <Button type="button" variant="outline" className="min-h-12" disabled={studentScheduleMutation.isPending || resetStudentScheduleMutation.isPending || studentScheduleQuery.data?.length === 0} onClick={() => setIsResetScheduleDialogOpen(true)}>{resetStudentScheduleMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}Revenir au plan du niveau</Button>
                        <Button type="button" className="min-h-12" disabled={!studentScheduleValid || studentScheduleMutation.isPending || resetStudentScheduleMutation.isPending} onClick={() => studentScheduleMutation.mutate()}>{studentScheduleMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}Enregistrer la courbe</Button>
                      </div>
                    </> : null}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : null} 
        </CardContent>
      </Card>

      {canGrantDiscount ? (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Tag className="h-5 w-5 text-primary" />Ajustement individuel</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">Une seule remise ou un seul montant personnalisé peut être accordé par élève et par année scolaire.</p>
            <div className="space-y-2"><Label>Élève</Label><StudentSearch value={student} onChange={setStudent} /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="override-type">Type d’ajustement</Label><Select value={overrideType} onValueChange={(value) => setOverrideType(value as "discount" | "total")}><SelectTrigger id="override-type" className="min-h-12"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="discount">Remise à déduire</SelectItem><SelectItem value="total">Montant total personnalisé</SelectItem></SelectContent></Select></div>
              <div className="space-y-2"><Label htmlFor="override-amount">Montant</Label><Input id="override-amount" className="min-h-12" inputMode="numeric" value={overrideAmount} onChange={(event) => setOverrideAmount(event.target.value.replace(/\D/g, ""))} placeholder="Montant en FCFA" /></div>
            </div>
            <div className="space-y-2"><Label htmlFor="override-reason">Motif obligatoire</Label><Textarea id="override-reason" value={overrideReason} maxLength={1000} onChange={(event) => setOverrideReason(event.target.value)} placeholder="Décision et contexte de l’ajustement" /></div>
            <div className="flex justify-end"><Button type="button" className="min-h-12" disabled={!student || !overrideAmount || Number(overrideAmount) < 0 || !overrideReason.trim() || overrideMutation.isPending} onClick={() => overrideMutation.mutate()}>{overrideMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Accorder l’ajustement</Button></div>
          </CardContent>
        </Card>
      ) : null}

      <AlertDialog open={isResetScheduleDialogOpen} onOpenChange={setIsResetScheduleDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Revenir au plan du niveau ?</AlertDialogTitle><AlertDialogDescription>La courbe particulière de {scheduleStudent ? `${scheduleStudent.lastName} ${scheduleStudent.firstName}` : "cet élève"} sera supprimée. Les alertes et le statut financier suivront de nouveau le plan commun.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-12">Annuler</AlertDialogCancel>
            <AlertDialogAction className="min-h-12" onClick={() => resetStudentScheduleMutation.mutate()}>Revenir au plan commun</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
