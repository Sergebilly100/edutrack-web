import type { StudentLabels } from "@/shared/hooks/useStudentLabel"

/** Libellés de repli quand l'école n'a rien configuré. */
export const FALLBACK_STUDENT_LABELS: StudentLabels = {
  singular: "Élève",
  plural: "Élèves",
  singularLower: "élève",
  pluralLower: "élèves",
}

const capitalize = (value: string): string => (value ? value.charAt(0).toUpperCase() + value.slice(1) : value)

/** Libellé accordé au nombre (0 et 1 → singulier, comme en français). */
export function studentNoun(
  labels: StudentLabels | null | undefined,
  count: number,
  options: { capitalized?: boolean } = {},
): string {
  const source = labels ?? FALLBACK_STUDENT_LABELS
  const word = Math.abs(count) > 1 ? source.pluralLower : source.singularLower
  return options.capitalized ? capitalize(word) : word
}

/** Libellé pluriel, en minuscules ou capitalisé. */
export function studentPlural(labels: StudentLabels | null | undefined, options: { capitalized?: boolean } = {}): string {
  const word = (labels ?? FALLBACK_STUDENT_LABELS).pluralLower
  return options.capitalized ? capitalize(word) : word
}

/** En-tête de colonne : « À suivre (élèves) » ou « À suivre (étudiants) ». */
export function toFollowColumnLabel(labels: StudentLabels | null | undefined): string {
  return `À suivre (${studentPlural(labels)})`
}

/** « 25 élèves » / « 1 étudiant ». */
export function countedStudents(labels: StudentLabels | null | undefined, count: number): string {
  return `${count} ${studentNoun(labels, count)}`
}
