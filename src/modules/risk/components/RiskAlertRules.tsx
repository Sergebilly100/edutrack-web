import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, CheckCircle2, Loader2, ShieldAlert, UsersRound } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { QueryErrorState } from "@/shared/components/QueryErrorState"
import {
  fetchRiskAlertRules,
  saveRiskAlertRule,
  type RiskAlertRule,
  type RiskSignalType,
  type RiskSubjectType,
} from "../risk.api"

type RuleDefinition = {
  subjectType: RiskSubjectType
  signalType: RiskSignalType
  label: string
  description: string
  thresholdLabel?: string
  thresholdHint?: string
  periodLabel?: string
  periodHint?: string
  defaults: Pick<RiskAlertRule, "thresholdValue" | "periodDays" | "isActive">
}

const RULES: RuleDefinition[] = [
  {
    subjectType: "student",
    signalType: "absences",
    label: "Absences non justifiées",
    description: "Signale un élève dont les absences atteignent le seuil sur une période glissante.",
    thresholdLabel: "Absences",
    thresholdHint: "Nombre minimal d'absences.",
    periodLabel: "Sur les derniers jours",
    periodHint: "Fenêtre d'observation.",
    defaults: { thresholdValue: 3, periodDays: 30, isActive: true },
  },
  {
    subjectType: "student",
    signalType: "grades",
    label: "Baisse de moyenne",
    description: "Compare les deux dernières périodes validées de l'élève. Une amélioration ne déclenche jamais ce signal.",
    thresholdLabel: "Baisse minimale",
    thresholdHint: "En points de moyenne.",
    defaults: { thresholdValue: 2, periodDays: 0, isActive: true },
  },
  {
    subjectType: "student",
    signalType: "payments",
    label: "Situation financière en retard",
    description: "Signale un élève dont la situation financière est marquée « en retard » par le cache financier.",
    defaults: { thresholdValue: 1, periodDays: 0, isActive: true },
  },
  {
    subjectType: "teacher",
    signalType: "absences",
    label: "Absences professeur",
    description: "Signale un professeur dont les absences atteignent le seuil sur une période glissante.",
    thresholdLabel: "Absences",
    thresholdHint: "Nombre minimal d'absences.",
    periodLabel: "Sur les derniers jours",
    periodHint: "Fenêtre d'observation.",
    defaults: { thresholdValue: 3, periodDays: 30, isActive: true },
  },
]

type Draft = {
  thresholdValue: string
  periodDays: string
  isActive: boolean
}

const ruleKey = (subjectType: RiskSubjectType, signalType: RiskSignalType) =>
  `${subjectType}:${signalType}`

const draftFrom = (definition: RuleDefinition, existing?: RiskAlertRule): Draft => ({
  thresholdValue: String(existing?.thresholdValue ?? definition.defaults.thresholdValue),
  periodDays: String(existing?.periodDays ?? definition.defaults.periodDays),
  isActive: existing?.isActive ?? definition.defaults.isActive,
})

export function RiskAlertRules() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const rulesQuery = useQuery({
    queryKey: ["risk", "rules"],
    queryFn: fetchRiskAlertRules,
  })
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})

  const saveMutation = useMutation({
    mutationFn: saveRiskAlertRule,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["risk", "rules"] })
      toast({ title: "Règle de risque enregistrée", duration: 3000 })
    },
    onError: (error) => {
      toast({
        title: "Enregistrement impossible",
        description: error instanceof Error ? error.message : "Réessayez dans un instant.",
        variant: "destructive",
        duration: 6000,
      })
    },
  })

  const existingRule = (definition: RuleDefinition) =>
    rulesQuery.data?.find(
      (rule) =>
        rule.subjectType === definition.subjectType &&
        rule.signalType === definition.signalType
    )

  const currentDraft = (definition: RuleDefinition) => {
    const key = ruleKey(definition.subjectType, definition.signalType)
    return drafts[key] ?? draftFrom(definition, existingRule(definition))
  }

  const updateDraft = (definition: RuleDefinition, next: Draft) => {
    setDrafts((current) => ({
      ...current,
      [ruleKey(definition.subjectType, definition.signalType)]: next,
    }))
  }

  if (rulesQuery.isLoading) {
    return (
      <Card className="rounded-lg shadow-sm">
        <CardContent className="flex min-h-40 items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Chargement des règles de risque…
        </CardContent>
      </Card>
    )
  }

  if (rulesQuery.isError) {
    return <QueryErrorState onRetry={() => void rulesQuery.refetch()} />
  }

  return (
    <Card className="rounded-lg shadow-sm">
      <CardHeader className="gap-3 pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-600" aria-hidden="true" />
              Règles de risque
            </CardTitle>
            <CardDescription>
              Les changements sont pris en compte au prochain recalcul, au plus tard dans 15 minutes.
            </CardDescription>
          </div>
          <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
            <AlertTriangle className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
            Signaux de vigilance
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-0 divide-y divide-border rounded-lg border border-border">
        {RULES.map((definition) => {
          const draft = currentDraft(definition)
          const threshold = Number(draft.thresholdValue)
          const periodDays = Number(draft.periodDays)
          const thresholdValid =
            Number.isFinite(threshold) && threshold >= 1 && threshold <= 999
          const periodValid =
            Number.isInteger(periodDays) && periodDays >= 1 && periodDays <= 365
          const hasThreshold = Boolean(definition.thresholdLabel)
          const hasPeriod = Boolean(definition.periodLabel)
          const valid = (!hasThreshold || thresholdValid) && (!hasPeriod || periodValid)

          return (
            <section
              key={ruleKey(definition.subjectType, definition.signalType)}
              className="grid gap-4 px-4 py-5 lg:grid-cols-[minmax(0,1fr)_136px_136px_auto] lg:items-end"
            >
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold">{definition.label}</h3>
                  <Badge variant="secondary" className="font-normal">
                    {definition.subjectType === "student" ? "Élèves" : "Professeurs"}
                  </Badge>
                </div>
                <p className="max-w-2xl text-sm text-muted-foreground">{definition.description}</p>
              </div>

              {hasThreshold ? (
                <div className="space-y-1.5">
                  <Label htmlFor={`${ruleKey(definition.subjectType, definition.signalType)}-threshold`}>
                    {definition.thresholdLabel}
                  </Label>
                  <Input
                    id={`${ruleKey(definition.subjectType, definition.signalType)}-threshold`}
                    type="number"
                    min={1}
                    max={999}
                    inputMode="decimal"
                    value={draft.thresholdValue}
                    onChange={(event) =>
                      updateDraft(definition, { ...draft, thresholdValue: event.target.value })
                    }
                    aria-describedby={`${ruleKey(definition.subjectType, definition.signalType)}-threshold-hint`}
                  />
                  <p id={`${ruleKey(definition.subjectType, definition.signalType)}-threshold-hint`} className="text-xs text-muted-foreground">
                    {definition.thresholdHint}
                  </p>
                </div>
              ) : (
                <div className="hidden lg:block" aria-hidden="true" />
              )}

              {hasPeriod ? (
                <div className="space-y-1.5">
                  <Label htmlFor={`${ruleKey(definition.subjectType, definition.signalType)}-period`}>
                    {definition.periodLabel}
                  </Label>
                  <Input
                    id={`${ruleKey(definition.subjectType, definition.signalType)}-period`}
                    type="number"
                    min={1}
                    max={365}
                    inputMode="numeric"
                    value={draft.periodDays}
                    onChange={(event) =>
                      updateDraft(definition, { ...draft, periodDays: event.target.value })
                    }
                    aria-describedby={`${ruleKey(definition.subjectType, definition.signalType)}-period-hint`}
                  />
                  <p id={`${ruleKey(definition.subjectType, definition.signalType)}-period-hint`} className="text-xs text-muted-foreground">
                    {definition.periodHint}
                  </p>
                </div>
              ) : (
                <div className="hidden lg:block" aria-hidden="true" />
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 lg:flex-col lg:items-end">
                <Label className="flex min-h-12 cursor-pointer items-center gap-2 text-sm font-medium">
                  <Checkbox
                    checked={draft.isActive}
                    onCheckedChange={(checked) =>
                      updateDraft(definition, { ...draft, isActive: checked === true })
                    }
                  />
                  Active
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-12"
                  disabled={!valid || saveMutation.isPending}
                  onClick={() =>
                    saveMutation.mutate({
                      subjectType: definition.subjectType,
                      signalType: definition.signalType,
                      thresholdValue: hasThreshold ? threshold : definition.defaults.thresholdValue,
                      periodDays: hasPeriod ? periodDays : definition.defaults.periodDays,
                      isActive: draft.isActive,
                    })
                  }
                >
                  {saveMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden="true" />
                  )}
                  Enregistrer
                </Button>
              </div>
            </section>
          )
        })}
      </CardContent>
      <CardContent className="flex items-start gap-2 pt-4 text-xs text-muted-foreground">
        <UsersRound className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        Les signaux servent au tableau de bord de direction. Ils n'envoient pas automatiquement de message aux parents ou aux professeurs.
      </CardContent>
    </Card>
  )
}
