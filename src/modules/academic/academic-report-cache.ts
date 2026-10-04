import type { QueryClient } from "@tanstack/react-query"

/** Les vues de la même classe/période partagent les conséquences d'une note ou d'un bulletin. */
export async function invalidateAcademicReportScope(queryClient: QueryClient, classId: string, gradingPeriodId: string) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["evaluations-scope", classId, gradingPeriodId] }),
    queryClient.invalidateQueries({ queryKey: ["class-completion", classId, gradingPeriodId] }),
    queryClient.invalidateQueries({ queryKey: ["report-cards-readiness", gradingPeriodId] }),
    queryClient.invalidateQueries({ queryKey: ["report-cards-class", classId, gradingPeriodId] }),
    queryClient.invalidateQueries({ queryKey: ["report-card-versions", classId, gradingPeriodId] }),
    queryClient.invalidateQueries({ queryKey: ["report-card-academic-audit", classId, gradingPeriodId] }),
    queryClient.invalidateQueries({ queryKey: ["report-card-claims"] }),
    queryClient.invalidateQueries({ queryKey: ["academic", "grading-periods"] }),
    queryClient.invalidateQueries({ queryKey: ["parent", "report-cards"] }),
  ])
}
