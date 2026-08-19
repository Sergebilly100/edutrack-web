import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CalendarClock, CheckCircle2, Loader2, Plus, Tag, Trash2 } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
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
import { grantTuitionOverride, listTuitionPlans, upsertTuitionPlan, type TuitionScheduleStep } from "../finance.api"
import { StudentSearch } from "./StudentSearch"

type TuitionConfigurationProps = {
  schoolYearId: string
  canEdit: boolean
  canGrantDiscount: boolean
}

const blankStep = (): TuitionScheduleStep => ({ dueDate: "", cumulativeAmountExpected: 0 })

export function TuitionConfiguration({ schoolYearId, canEdit, canGrantDiscount }: TuitionConfigurationProps) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const levelsQuery = useQuery({ queryKey: ["academic", "levels"], queryFn: listLevels })
  const plansQuery = useQuery({ queryKey: ["finance", "tuition-plans", schoolYearId], queryFn: () => listTuitionPlans(schoolYearId), enabled: Boolean(schoolYearId) })
  const [levelId, setLevelId] = useState("")
  const [totalAmount, setTotalAmount] = useState("")
  const [steps, setSteps] = useState<TuitionScheduleStep[]>([blankStep()])
  const [student, setStudent] = useState<StudentItem | null>(null)
  const [overrideType, setOverrideType] = useState<"discount" | "total">("discount")
  const [overrideAmount, setOverrideAmount] = useState("")
  const [overrideReason, setOverrideReason] = useState("")
  const levels = levelsQuery.data ?? []
  const selectedPlan = useMemo(() => plansQuery.data?.find((plan) => plan.levelId === levelId), [plansQuery.data, levelId])

  useEffect(() => {
    if (!levelId && levels[0]) setLevelId(levels[0].id)
  }, [levelId, levels])

  useEffect(() => {
    setTotalAmount(selectedPlan ? String(selectedPlan.totalAmount) : "")
    setSteps(selectedPlan?.scheduleSteps.length ? selectedPlan.scheduleSteps : [blankStep()])
  }, [levelId, selectedPlan])

  const planMutation = useMutation({
    mutationFn: () => upsertTuitionPlan(levelId, {
      schoolYearId,
      totalAmount: Number(totalAmount),
      currency: "FCFA",
      scheduleSteps: steps.map((step) => ({ dueDate: step.dueDate, cumulativeAmountExpected: Number(step.cumulativeAmountExpected) })),
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["finance", "tuition-plans"] })
      toast({ title: "Plan de frais enregistré", description: "Le plan s’applique à toutes les classes de ce niveau pour l’année sélectionnée." })
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

  const total = Number(totalAmount)
  const stepsValid = steps.every((step, index) => {
    const previous = steps[index - 1]
    return Boolean(step.dueDate) && step.cumulativeAmountExpected >= 0 && step.cumulativeAmountExpected <= total && (!previous || (step.dueDate > previous.dueDate && step.cumulativeAmountExpected >= previous.cumulativeAmountExpected))
  })

  return (
    <section className="space-y-6">
      <div className="max-w-2xl space-y-1"><h2 className="text-xl font-semibold">Configuration des frais</h2><p className="text-sm text-muted-foreground">Définissez le montant annuel et les seuils cumulés attendus. Aucun versement individuel n’est imposé.</p></div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><CalendarClock className="h-5 w-5 text-primary" />Plan par niveau</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="tuition-level">Niveau</Label><Select value={levelId} onValueChange={setLevelId}><SelectTrigger id="tuition-level" className="min-h-12"><SelectValue placeholder="Choisir un niveau" /></SelectTrigger><SelectContent>{levels.map((level) => <SelectItem key={level.id} value={level.id}>{level.name}</SelectItem>)}</SelectContent></Select><p className="text-xs text-muted-foreground">Toutes les classes de ce niveau utilisent ce plan pendant l’année scolaire sélectionnée.</p></div>
            <div className="space-y-2"><Label htmlFor="tuition-total">Montant total annuel</Label><div className="relative"><Input id="tuition-total" className="min-h-12 pr-16 tabular-nums" inputMode="numeric" disabled={!canEdit} value={totalAmount} onChange={(event) => setTotalAmount(event.target.value.replace(/\D/g, ""))} placeholder="Ex. 350000" /><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">FCFA</span></div></div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3"><div><Label>Courbe cumulative attendue</Label><p className="mt-1 text-xs text-muted-foreground">Les dates et montants doivent progresser dans l’ordre.</p></div>{canEdit ? <Button type="button" variant="outline" size="sm" className="min-h-10" onClick={() => setSteps((current) => [...current, blankStep()])}><Plus className="mr-2 h-4 w-4" />Ajouter un seuil</Button> : null}</div>
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
          {canEdit ? <div className="flex justify-end"><Button type="button" className="min-h-12" disabled={!levelId || total <= 0 || !stepsValid || planMutation.isPending} onClick={() => planMutation.mutate()}>{planMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}Enregistrer le plan</Button></div> : null}
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
    </section>
  )
}
