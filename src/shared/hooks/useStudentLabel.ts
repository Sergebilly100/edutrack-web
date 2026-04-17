import { useQuery } from "@tanstack/react-query"

import { apiClient } from "@/shared/api/client"

type SchoolInfoResponse = {
  student_label?: string | null
  teaching_type?: "primaire" | "secondaire" | "superieur" | "mixte" | null
}

export function useStudentLabel() {
  const query = useQuery({
    queryKey: ["school", "student-label"],
    queryFn: async () => {
      const response = await apiClient.get<SchoolInfoResponse>("/school/info")
      const data = response.data
      if (typeof data.student_label === "string" && data.student_label.trim().length > 0) {
        return data.student_label.trim()
      }
      return data.teaching_type === "superieur" ? "Étudiant(e)" : "Élève"
    },
    staleTime: 1000 * 60 * 10,
  })

  return query.data ?? "Élève"
}
