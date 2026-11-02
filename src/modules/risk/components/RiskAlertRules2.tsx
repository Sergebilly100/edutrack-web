import { useEffect, useRef } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CheckCircle2, Info, Loader2, Save, ShieldAlert, Undo2 } from "lucide-react"
import { useForm, useWatch } from "react-hook-form"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/components/ui/use-toast"
import { QueryErrorState } from "@/shared/components/QueryErrorState"
import { fetchRiskAlertRules, saveRiskAlertRule, type RiskAlertRule } from "../risk.api"
import { createRuleDraftSchema, draftFields, draftFrom, draftsEqual, RULES, ruleInputFrom, type RuleDefinition, type RuleDraft } from "./risk-rule-form"

const RULES_QUERY_KEY = ["risk", "rules"] as const

function RuleEditor({ definition, existing }: { definition: RuleDefinition; existing?: RiskAlertRule }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const key = `${definition.subjectType}:${definition.signalType}`
  const isLateness = definition.signalType === "lateness"
  const isAbsences = definition.signalType === "absences"
  const lastServerDraft = useRef(draftFrom(definition, existing))
  const saveInFlight = useRef(false)
  const form = useForm<RuleDraft>({
    resolver: zodResolver(createRuleDraftSchema(definition)),
    defaultValues: draftFrom(definition, existing),
    mode: "onChange",
  })
  const { isDirty, isValid } = form.formState
  const thresholdValue = useWatch({ control: form.control, name: "thresholdValue" })
  const periodDays = useWatch({ control: form.control, name: "periodDays" })

  const saveMutation = useMutation({
    mutationFn: (values: RuleDraft) => saveRiskAlertRule(ruleInputFrom(definition, values)),
    onMutate: async () => { await queryClient.cancelQueries({ queryKey: RULES_QUERY_KEY }) },
    onSuccess: async (_result, submitted) => {
      // A read started before this write must not replace its acknowledged values.
      await queryClient.cancelQueries({ queryKey: RULES_QUERY_KEY })
      queryClient.setQueryData<RiskAlertRule[]>(RULES_QUERY_KEY, (current) => current?.map((rule) =>
        rule.subjectType === definition.subjectType && rule.signalType === definition.signalType
          ? { ...rule, ...ruleInputFrom(definition, submitted) } : rule
      ))
      lastServerDraft.current = draftFrom(definition, queryClient.getQueryData<RiskAlertRule[]>(RULES_QUERY_KEY)?.find((rule) =>
        rule.subjectType === definition.subjectType && rule.signalType === definition.signalType
      ))
      // Establish the acknowledged baseline without losing edits made during the request.
      const current = form.getValues()
      form.reset(submitted)
      for (const name of draftFields) {
        if (current[name] !== submitted[name]) {
          form.setValue(name, current[name], { shouldDirty: true, shouldValidate: true })
        }
      }
      toast({ title: "Règle de risque enregistrée", description: definition.label, duration: 3000 })
      void queryClient.invalidateQueries({ queryKey: RULES_QUERY_KEY })
    },
    onError: () => {
      toast({
        title: "Enregistrement impossible",
        description: "Vos modifications sont conservées. Réessayez dans un instant.",
        variant: "destructive", duration: 6000,
      })
    },
    onSettled: () => { saveInFlight.current = false },
  })

  useEffect(() => {
    const incoming = draftFrom(definition, existing)
    if (isDirty || saveMutation.isPending || draftsEqual(incoming, lastServerDraft.current)) return
    lastServerDraft.current = incoming
    form.reset(incoming)
  }, [definition, existing, form, isDirty, saveMutation.isPending])

  const numericField = (
    name: "thresholdValue" | "periodDays" | "lateMinutes",
    label: string,
    hint: string,
    showHint = true,
  ) => (
    <FormField control={form.control} name={name} render={({ field }) => (
      <FormItem className="min-w-0 flex-1 space-y-2">
        <FormLabel className="text-foreground">{label}</FormLabel>
        <FormControl>
          <Input
            {...field} type="number" min={name === "lateMinutes" ? 0 : 1}
            max={name === "periodDays" ? 365 : name === "thresholdValue" ? 999 : undefined}
            step={name === "thresholdValue" && !isLateness ? "any" : 1}
            inputMode={name === "thresholdValue" && !isLateness ? "decimal" : "numeric"}
            className="min-h-12 rounded-lg"
            onChange={(event) => { field.onChange(event); void form.trigger() }}
          />
        </FormControl>
        <FormDescription className={`text-sm text-foreground ${showHint ? "" : "sr-only"}`}>{hint}</FormDescription>
        <FormMessage role="alert" className="text-sm text-red-800 dark:text-red-200" />
      </FormItem>
    )} />
  )

  const unconfigured = isLateness && thresholdValue.trim() === ""
  const status = saveMutation.isPending ? "Enregistrement en cours…"
    : saveMutation.isError ? "Enregistrement impossible. Vos modifications sont conservées."
    : isDirty ? "Modifications non enregistrées"
    : unconfigured ? "À configurer"
    : saveMutation.isSuccess ? "Enregistré" : "Sans modification"

  return (
    <Form {...form}>
      <form
        aria-labelledby={`${key}-title`} noValidate
        onSubmit={(event) => {
          void form.handleSubmit((values) => {
            if (saveInFlight.current || !isDirty) return
            saveInFlight.current = true
            saveMutation.mutate(values)
          })(event)
        }}
        className="space-y-4 py-5 first:pt-0 last:pb-0"
      >
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
          <div className="min-w-0 flex-1 basis-64 space-y-1">
            <h4 id={`${key}-title`} className="text-base font-semibold">{definition.label}</h4>
            <p className="max-w-prose text-sm leading-relaxed text-foreground">{definition.description}</p>
          </div>
          <FormField control={form.control} name="isActive" render={({ field }) => (
            <FormItem className="shrink-0 space-y-0">
              <FormLabel className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg px-2 text-foreground">
                <FormControl>
                  <Checkbox
                    checked={field.value} onCheckedChange={(checked) => { field.onChange(checked === true); void form.trigger() }}
                    onBlur={field.onBlur} ref={field.ref}
                    aria-label={`Signal actif : ${definition.label}`} className="h-5 w-5"
                  />
                </FormControl>
                Signal actif
              </FormLabel>
              <FormDescription className="sr-only">Active ce signal sur le tableau de bord.</FormDescription>
            </FormItem>
          )} />
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          {definition.thresholdLabel ? (
            <div className="min-w-0 space-y-3">
              {isLateness ? (
                <div className="grid gap-6 sm:grid-cols-2">
                  <fieldset className="min-w-0 space-y-3">
                    <legend className="mb-3 text-sm font-semibold">Tolérance du pointage</legend>
                    {numericField("lateMinutes", "Tolérance en minutes", "Un pointage est en retard lorsque le nombre de minutes de retard dépasse cette tolérance.")}
                    <p className="max-w-prose text-sm leading-relaxed text-foreground">
                      S'applique aux prochains pointages, même si le signal est désactivé. Les pointages déjà enregistrés conservent leur statut.
                    </p>
                  </fieldset>
                  <fieldset className="min-w-0 space-y-3">
                    <legend className="mb-3 text-sm font-semibold">Signal sur le tableau de bord</legend>
                    {numericField("thresholdValue", "Nombre de retards", "Nombre requis pour enregistrer cette règle, même si le signal est désactivé.")}
                    <p className="text-sm font-medium">Sur les 30 derniers jours, période fixe.</p>
                    <p className="text-sm leading-relaxed text-foreground">Alimente « Professeurs à suivre » à partir de ce nombre de pointages en retard.</p>
                  </fieldset>
                </div>
              ) : definition.thresholdLabel ? (
                <div className={`grid max-w-3xl gap-4 ${isAbsences ? "sm:grid-cols-2" : "sm:max-w-sm"}`}>
                  {numericField("thresholdValue", definition.thresholdLabel, isAbsences
                    ? "Le signal se déclenche à partir de ce nombre d'absences."
                    : "Le signal se déclenche à partir de cette baisse de moyenne.", !isAbsences)}
                  {isAbsences ? numericField("periodDays", "Période (jours)", "Nombre de jours précédant le recalcul à prendre en compte.", false) : null}
                </div>
              ) : null}

              {isAbsences && isValid ? (
                <p className="text-sm font-medium">
                  Signaler à partir de {thresholdValue} absence{Number(thresholdValue) > 1 ? "s" : ""} sur les {periodDays} derniers jours.
                </p>
              ) : null}
            </div>
          ) : null}
          <div className={`flex flex-wrap items-center justify-between gap-3 ${definition.thresholdLabel ? "lg:max-w-xs lg:flex-col lg:items-end" : "lg:col-span-2"}`}>
            <p role="status" aria-atomic="true" className="flex min-h-6 items-center gap-2 text-sm text-foreground">
              <span className="sr-only">{definition.label} : </span>
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                : saveMutation.isSuccess && !isDirty ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : null}
              {status}
            </p>
            <div className="flex w-full flex-wrap gap-2 sm:w-auto">
              {isDirty ? (
                <Button
                  type="button" variant="ghost" className="min-h-12 flex-1 rounded-lg sm:flex-none"
                  aria-label={`Annuler les modifications : ${definition.label}`} disabled={saveMutation.isPending}
                  onClick={() => { form.reset(); saveMutation.reset() }}
                >
                  <Undo2 aria-hidden="true" /> Annuler
                </Button>
              ) : null}
              <Button
                type="submit" variant={isDirty ? "default" : "outline"}
                className={`min-h-12 flex-1 rounded-lg sm:flex-none ${isDirty ? "bg-blue-800 text-primary-foreground hover:bg-blue-900 dark:bg-blue-300 dark:text-blue-950 dark:hover:bg-blue-200" : ""}`}
                aria-label={`Enregistrer : ${definition.label}`}
                disabled={!isDirty || !isValid || saveMutation.isPending}
              >
                <Save aria-hidden="true" /> {saveMutation.isPending ? "Enregistrement…" : "Enregistrer"}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </Form>
  )
}

export function RiskAlertRules() {
  const rulesQuery = useQuery({ queryKey: RULES_QUERY_KEY, queryFn: fetchRiskAlertRules })

  if (rulesQuery.isLoading) {
    return (
      <div className="space-y-6" aria-busy="true">
        <p role="status" className="text-sm">Chargement des règles de risque…</p>
        <Skeleton className="h-48 rounded-lg" />
        <Skeleton className="h-48 rounded-lg" />
      </div>
    )
  }
  if (rulesQuery.isError && !rulesQuery.data) {
    return <QueryErrorState onRetry={() => void rulesQuery.refetch()} isRetrying={rulesQuery.isFetching} className="[&_button]:min-h-12" />
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="flex items-center gap-2 text-2xl font-medium">
          <ShieldAlert className="h-6 w-6 shrink-0" aria-hidden="true" /> Règles de risque
        </h2>
        <p className="max-w-prose text-sm leading-relaxed">Définissez les situations à suivre sur le tableau de bord de direction.</p>
        <p className="max-w-prose text-sm leading-relaxed">Les signaux sont recalculés au plus tard dans 15 minutes. La tolérance des retards s'applique aux prochains pointages après enregistrement.</p>
      </header>
      {rulesQuery.isError ? <QueryErrorState title="Actualisation impossible" message="Les règles affichées restent disponibles. Réessayez pour les actualiser." onRetry={() => void rulesQuery.refetch()} isRetrying={rulesQuery.isFetching} className="[&_button]:min-h-12" /> : null}
      {(["student", "teacher"] as const).map((subjectType) => (
        <section key={subjectType} aria-labelledby={`risk-${subjectType}-title`} className="rounded-lg border border-border bg-card p-4 text-card-foreground sm:p-6">
          <div className="mb-5 space-y-1 border-b border-border pb-4">
            <h3 id={`risk-${subjectType}-title`} className="text-xl font-semibold">{subjectType === "student" ? "Élèves" : "Professeurs"}</h3>
            <p className="text-sm">{subjectType === "student" ? "Assiduité, résultats scolaires et paiements." : "Ces signaux alimentent l'action « Professeurs à suivre »."}</p>
          </div>
          <div className="divide-y divide-border">
            {RULES.filter((rule) => rule.subjectType === subjectType).map((definition) => (
              <RuleEditor key={definition.signalType} definition={definition} existing={rulesQuery.data?.find((rule) => rule.subjectType === subjectType && rule.signalType === definition.signalType)} />
            ))}
          </div>
        </section>
      ))}
      <p className="flex max-w-prose items-start gap-2 text-sm leading-relaxed">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        Ces signaux n'envoient pas automatiquement de message aux parents ou aux professeurs.
      </p>
    </div>
  )
}
