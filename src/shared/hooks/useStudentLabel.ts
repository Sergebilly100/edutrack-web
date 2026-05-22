import { useQuery } from "@tanstack/react-query"

import { apiClient } from "@/shared/api/client"

type SchoolInfoResponse = {
  student_label?: string | null
  teaching_type?: "primaire" | "secondaire" | "superieur" | "mixte" | null
}

export type StudentLabels = {
  singular: string
  plural: string
  /** Lowercased singular — useful inside sentences ("Liste des {singularLower}s") */
  singularLower: string
  /** Lowercased plural — useful inside sentences */
  pluralLower: string
}

const labelsFromSingular = (singular: string): StudentLabels => {
  const trimmed = singular.trim()
  const plural = /étudiant/i.test(trimmed) ? "Étudiants" : "Élèves"
  return {
    singular: trimmed,
    plural,
    singularLower: trimmed.toLowerCase(),
    pluralLower: plural.toLowerCase(),
  }
}

const DEFAULT_LABELS: StudentLabels = labelsFromSingular("Élève")

/**
 * Returns the active student label (singular only).
 * Legacy callers keep using this — new code should prefer `useStudentLabels()`.
 */
export function useStudentLabel(): string {
  return useStudentLabels().singular
}

/**
 * Returns both singular and plural variants of the student label as configured
 * on the tenant. Falls back to "Élève / Élèves" if the school hasn't customized it,
 * or "Étudiant(e) / Étudiants" for higher-education tenants.
 */
export function useStudentLabels(): StudentLabels {
  const query = useQuery({
    queryKey: ["school", "student-label"],
    queryFn: async () => {
      const response = await apiClient.get<SchoolInfoResponse>("/school/info")
      const data = response.data
      if (typeof data.student_label === "string" && data.student_label.trim().length > 0) {
        return labelsFromSingular(data.student_label)
      }
      return data.teaching_type === "superieur"
        ? labelsFromSingular("Étudiant(e)")
        : DEFAULT_LABELS
    },
    staleTime: 1000 * 60 * 10,
  })

  return query.data ?? DEFAULT_LABELS
}
