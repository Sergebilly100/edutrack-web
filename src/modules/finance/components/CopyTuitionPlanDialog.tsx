import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CheckCircle2, CircleAlert, Loader2, MinusCircle } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { formatFcfa } from "@/shared/utils/formatting"
import { copyTuitionPlan, getTuitionCopyPreview, type TuitionCopyResponse, type TuitionCopyTarget, type TuitionPlanSummary } from "../finance.api"
import { isoToFr } from "../cash-journal.helpers"

type CopyTuitionPlanDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  schoolYearId: string
  sourceLevelId: string
  /** Appelé quand au moins un niveau a été copié (rafraîchir la liste des plans). */
  onCopied?: () => void
}

const planLine = (plan: TuitionPlanSummary) =>
  `${formatFcfa(plan.totalAmount)} par an · inscription ${formatFcfa(plan.registrationAmount)} · ${plan.scheduleSteps.length} échéance${plan.scheduleSteps.length > 1 ? "s" : ""}`

const plural = (count: number, one: string, many: string) => (count > 1 ? many : one)

type Choice = { overwrite: boolean; confirmEnrolled: boolean }

/** Copie le plan de frais d'un niveau vers d'autres niveaux de la même année ; rien n'est écrasé sans confirmation explicite par niveau. */
export function CopyTuitionPlanDialog({ open, onOpenChange, schoolYearId, sourceLevelId, onCopied }: CopyTuitionPlanDialogProps) {
  const queryClient = useQueryClient()
  const [choices, setChoices] = useState<Record<string, Choice>>({})
  const [response, setResponse] = useState<TuitionCopyResponse | null>(null)

  const previewQuery = useQuery({
    queryKey: ["finance", "tuition-copy-preview", schoolYearId, sourceLevelId],
    queryFn: () => getTuitionCopyPreview(sourceLevelId, schoolYearId),
    enabled: open && Boolean(schoolYearId && sourceLevelId),
    gcTime: 0,
  })

  useEffect(() => {
    if (open) { setChoices({}); setResponse(null) }
  }, [open, sourceLevelId])

  const preview = previewQuery.data
  const targets = useMemo(() => preview?.targets ?? [], [preview])
  const selected = targets.filter((target) => choices[target.levelId])
  const ready = selected.length > 0 && selected.every((target) => {
    const choice = choices[target.levelId]!
    return (!target.existingPlan || choice.overwrite) && (target.enrolledStudents === 0 || choice.confirmEnrolled)
  })

  const copyMutation = useMutation({
    mutationFn: () => copyTuitionPlan(sourceLevelId, {
      schoolYearId,
      targets: selected.map((target) => ({ levelId: target.levelId, overwrite: choices[target.levelId]!.overwrite, confirmEnrolled: choices[target.levelId]!.confirmEnrolled })),
    }),
    onSuccess: async (result) => {
      setResponse(result)
      if (result.results.some((item) => item.status === "copied")) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["finance"] }),
          queryClient.invalidateQueries({ queryKey: ["enrollments", "payment-summary"] }),
          queryClient.invalidateQueries({ queryKey: ["onboarding-status"] }),
        ])
        onCopied?.()
      }
    },
  })

  const toggle = (target: TuitionCopyTarget, checked: boolean) => setChoices((current) => {
    const next = { ...current }
    if (checked) next[target.levelId] = { overwrite: false, confirmEnrolled: false }
    else delete next[target.levelId]
    return next
  })
  const setChoice = (levelId: string, patch: Partial<Choice>) => setChoices((current) => ({ ...current, [levelId]: { ...current[levelId]!, ...patch } }))
  const levelName = (levelId: string) => targets.find((target) => target.levelId === levelId)?.levelName ?? "Niveau"

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!copyMutation.isPending) onOpenChange(next) }}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{preview ? `Copier les frais de ${preview.source.levelName}` : "Copier les frais"}</DialogTitle>
          <DialogDescription>{preview ? `Année scolaire ${preview.schoolYearLabel}. Les remises et échéanciers négociés des élèves ne sont jamais modifiés.` : "Choisissez les niveaux qui recevront ces frais."}</DialogDescription>
        </DialogHeader>

        {previewQuery.isLoading ? (
          <div className="space-y-3" role="status" aria-label="Chargement des niveaux"><Skeleton className="h-20 w-full" /><Skeleton className="h-24 w-full" /></div>
        ) : previewQuery.isError || !preview ? (
          <Alert variant="destructive"><AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            Impossible de charger les frais de ce niveau. Enregistrez d’abord ses frais, puis réessayez.
            <Button type="button" variant="outline" className="min-h-12" onClick={() => void previewQuery.refetch()}>Réessayer</Button>
          </AlertDescription></Alert>
        ) : response ? (
          <div className="space-y-3">
            <ul className="space-y-2" aria-label="Résultat de la copie">
              {response.results.map((item) => (
                <li key={item.levelId} className="flex items-start gap-3 rounded-md border p-3 text-sm">
                  {item.status === "copied" ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    : item.status === "skipped" ? <MinusCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    : <CircleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />}
                  <div className="space-y-0.5">
                    <p className="font-medium">{levelName(item.levelId)} · {item.status === "copied" ? "Copié" : item.status === "skipped" ? "Ignoré" : "Erreur"}</p>
                    {item.message ? <p className="text-muted-foreground">{item.message}</p> : null}
                  </div>
                </li>
              ))}
            </ul>
            {!response.cacheRefreshed ? <Alert><AlertDescription>Les frais sont copiés, mais les indicateurs financiers seront mis à jour avec un léger retard.</AlertDescription></Alert> : null}
          </div>
        ) : (
          <div className="space-y-4">
            <section aria-label="Frais à copier" className="space-y-2 rounded-md border bg-muted/30 p-3 text-sm">
              <p className="font-medium">{planLine(preview.source.plan)}</p>
              {preview.source.plan.scheduleSteps.length > 0 ? (
                <ul className="space-y-0.5 text-muted-foreground">
                  {preview.source.plan.scheduleSteps.map((step) => <li key={step.dueDate} className="tabular-nums">{isoToFr(step.dueDate)} · cumul attendu {formatFcfa(step.cumulativeAmountExpected)}</li>)}
                </ul>
              ) : <p className="text-muted-foreground">Aucune échéance intermédiaire.</p>}
            </section>

            {targets.length === 0 ? (
              <Alert><AlertDescription>Il n’y a pas d’autre niveau vers lequel copier ces frais.</AlertDescription></Alert>
            ) : (
              <fieldset className="space-y-2">
                <legend className="mb-2 text-sm font-medium">Copier vers</legend>
                {targets.map((target) => {
                  const choice = choices[target.levelId]
                  const checkboxId = `copy-level-${target.levelId}`
                  return (
                    <div key={target.levelId} className="space-y-3 rounded-md border p-3">
                      <div className="flex items-start gap-3">
                        <Checkbox id={checkboxId} checked={Boolean(choice)} onCheckedChange={(checked) => toggle(target, checked === true)} className="mt-1" />
                        <Label htmlFor={checkboxId} className="flex-1 space-y-1 font-normal">
                          <span className="flex flex-wrap items-center gap-2 font-medium">
                            {target.levelName}
                            {target.existingPlan ? <Badge variant="outline">A déjà des frais</Badge> : <Badge variant="secondary">Pas encore de frais</Badge>}
                            {target.enrolledStudents > 0 ? <Badge variant="outline">{target.enrolledStudents} {plural(target.enrolledStudents, "élève inscrit", "élèves inscrits")}</Badge> : null}
                          </span>
                          {target.existingPlan ? <span className="block text-xs text-muted-foreground">Actuellement : {planLine(target.existingPlan)}</span> : null}
                        </Label>
                      </div>
                      {choice && target.existingPlan ? (
                        <div className="ml-7 flex items-start gap-3">
                          <Checkbox id={`${checkboxId}-overwrite`} checked={choice.overwrite} onCheckedChange={(checked) => setChoice(target.levelId, { overwrite: checked === true })} className="mt-1" />
                          <Label htmlFor={`${checkboxId}-overwrite`} className="text-sm font-normal">Remplacer les frais actuels de {target.levelName} (obligatoire pour copier)</Label>
                        </div>
                      ) : null}
                      {choice && target.enrolledStudents > 0 ? (
                        <div className="ml-7 flex items-start gap-3">
                          <Checkbox id={`${checkboxId}-enrolled`} checked={choice.confirmEnrolled} onCheckedChange={(checked) => setChoice(target.levelId, { confirmEnrolled: checked === true })} className="mt-1" />
                          <Label htmlFor={`${checkboxId}-enrolled`} className="text-sm font-normal">
                            Je confirme : {target.enrolledStudents} {plural(target.enrolledStudents, "élève inscrit", "élèves inscrits")} sur {target.levelName} {plural(target.enrolledStudents, "verra", "verront")} ces frais s’appliquer.
                            {target.studentsWithIndividualTerms > 0 ? ` ${target.studentsWithIndividualTerms} ${plural(target.studentsWithIndividualTerms, "garde", "gardent")} leur remise ou échéancier négocié.` : ""}
                          </Label>
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </fieldset>
            )}
            {copyMutation.isError ? <Alert variant="destructive" role="alert"><AlertDescription>{copyMutation.error instanceof Error ? copyMutation.error.message : "La copie a échoué. Rien n’a été modifié."}</AlertDescription></Alert> : null}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {response ? (
            <Button type="button" className="min-h-12" onClick={() => onOpenChange(false)}>Fermer</Button>
          ) : (
            <>
              <Button type="button" variant="outline" className="min-h-12" onClick={() => onOpenChange(false)} disabled={copyMutation.isPending}>Annuler</Button>
              <Button type="button" className="min-h-12" disabled={!ready || copyMutation.isPending || !preview} onClick={() => copyMutation.mutate()}>
                {copyMutation.isPending ? <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" /> : null}
                {copyMutation.isPending ? "Copie en cours…" : selected.length > 0 ? `Copier vers ${selected.length} ${plural(selected.length, "niveau", "niveaux")}` : "Copier"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
