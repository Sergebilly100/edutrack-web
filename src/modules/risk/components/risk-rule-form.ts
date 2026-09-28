import { z } from "zod"

import type { RiskAlertRule, RiskSignalType, RiskSubjectType, SaveRiskAlertRuleInput } from "../risk.api"

export type RuleDefinition = {
  subjectType: RiskSubjectType
  signalType: RiskSignalType
  label: string
  description: string
  thresholdLabel?: string
  defaults: { thresholdValue: number | null; periodDays: number; isActive: boolean }
}

export const RULES: RuleDefinition[] = [
  {
    subjectType: "student", signalType: "absences", label: "Absences élèves",
    description: "Suit les absences enregistrées dans l'assiduité des élèves.",
    thresholdLabel: "Nombre d'absences",
    defaults: { thresholdValue: 3, periodDays: 30, isActive: true },
  },
  {
    subjectType: "student", signalType: "grades", label: "Baisse de moyenne",
    description: "Compare les moyennes des deux dernières périodes scolaires. Une hausse ne déclenche pas ce signal.",
    thresholdLabel: "Baisse minimale (points)",
    defaults: { thresholdValue: 2, periodDays: 0, isActive: true },
  },
  {
    subjectType: "student", signalType: "payments", label: "Situation financière en retard",
    description: "Signale un élève dont la situation financière indique un retard de paiement.",
    defaults: { thresholdValue: 1, periodDays: 0, isActive: true },
  },
  {
    subjectType: "teacher", signalType: "absences", label: "Absences professeur",
    description: "Suit les absences enregistrées dans l'assiduité des professeurs.",
    thresholdLabel: "Nombre d'absences",
    defaults: { thresholdValue: 3, periodDays: 30, isActive: true },
  },
  {
    subjectType: "teacher", signalType: "lateness", label: "Retards professeur",
    description: "Définissez quand un pointage est en retard, puis à partir de combien de retards suivre le professeur.",
    thresholdLabel: "Nombre de retards",
    defaults: { thresholdValue: null, periodDays: 30, isActive: false },
  },
]

export type RuleDraft = {
  thresholdValue: string
  periodDays: string
  isActive: boolean
  lateMinutes: string
}

export const draftFrom = (definition: RuleDefinition, existing?: RiskAlertRule): RuleDraft => ({
  thresholdValue: String(existing?.thresholdValue ?? definition.defaults.thresholdValue ?? ""),
  periodDays: String(existing?.periodDays ?? definition.defaults.periodDays),
  isActive: existing?.isActive ?? definition.defaults.isActive,
  lateMinutes: String(existing?.lateMinutes ?? 15),
})

export const draftFields = ["thresholdValue", "periodDays", "isActive", "lateMinutes"] as const

export const draftsEqual = (left: RuleDraft, right: RuleDraft) =>
  draftFields.every((name) => left[name] === right[name])

export const ruleInputFrom = (definition: RuleDefinition, values: RuleDraft): SaveRiskAlertRuleInput => ({
  subjectType: definition.subjectType,
  signalType: definition.signalType,
  thresholdValue: Number(values.thresholdValue),
  periodDays: definition.signalType === "absences" ? Number(values.periodDays) : definition.defaults.periodDays,
  isActive: values.isActive,
  ...(definition.signalType === "lateness" ? { lateMinutes: Number(values.lateMinutes) } : {}),
})

export const createRuleDraftSchema = (definition: RuleDefinition) =>
  z.object({
    thresholdValue: z.string(),
    periodDays: z.string(),
    isActive: z.boolean(),
    lateMinutes: z.string(),
  }).superRefine((draft, context) => {
    const isLateness = definition.signalType === "lateness"
    const threshold = Number(draft.thresholdValue)
    if (definition.thresholdLabel && (
      draft.thresholdValue.trim() === "" || !Number.isFinite(threshold) ||
      threshold < 1 || threshold > 999 || (isLateness && !Number.isInteger(threshold))
    )) {
      context.addIssue({
        code: z.ZodIssueCode.custom, path: ["thresholdValue"],
        message: isLateness
          ? "Saisissez un nombre entier de retards entre 1 et 999."
          : "Saisissez une valeur entre 1 et 999.",
      })
    }
    if (definition.signalType === "absences") {
      const days = Number(draft.periodDays)
      if (!Number.isInteger(days) || days < 1 || days > 365) {
        context.addIssue({
          code: z.ZodIssueCode.custom, path: ["periodDays"],
          message: "Saisissez une durée entière entre 1 et 365 jours.",
        })
      }
    }
    if (isLateness) {
      if (draft.periodDays !== "30") {
        context.addIssue({
          code: z.ZodIssueCode.custom, path: ["periodDays"],
          message: "La période des retards est fixée à 30 jours.",
        })
      }
      const minutes = Number(draft.lateMinutes)
      if (draft.lateMinutes.trim() === "" || !Number.isInteger(minutes) || minutes < 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom, path: ["lateMinutes"],
          message: "Saisissez une tolérance entière supérieure ou égale à 0 minute.",
        })
      }
    }
  })
