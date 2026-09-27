import { z } from "zod"

const periodSchema = z.object({
  weekStart: z.iso.date({ error: "Sélectionnez une date de début valide." })
    .refine((value) => new Date(`${value}T00:00:00.000Z`).getUTCDay() === 1,
      "La période doit commencer un lundi."),
  weekEnd: z.iso.date({ error: "Sélectionnez une date de fin valide." })
    .refine((value) => new Date(`${value}T00:00:00.000Z`).getUTCDay() === 0,
      "La période doit se terminer un dimanche."),
}).refine((value) => value.weekStart <= value.weekEnd, {
  message: "La date de fin doit être postérieure ou égale à la date de début.",
  path: ["weekEnd"],
})

export function getSchedulePeriodSummary(weekStart: string, weekEnd: string) {
  const result = periodSchema.safeParse({ weekStart, weekEnd })
  if (!result.success) {
    const errors = result.error.flatten().fieldErrors
    return { startError: errors.weekStart?.[0], endError: errors.weekEnd?.[0], weeks: null }
  }
  const start = new Date(`${weekStart}T00:00:00.000Z`)
  const end = new Date(`${weekEnd}T00:00:00.000Z`)
  return { startError: undefined, endError: undefined, weeks: (end.getTime() - start.getTime() + 86400000) / 604800000 }
}

export const formatSchedulePeriodDate = (value: string) => new Intl.DateTimeFormat("fr-FR", {
  day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Abidjan",
}).format(new Date(`${value}T00:00:00.000Z`))
