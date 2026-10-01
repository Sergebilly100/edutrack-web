import type { ConductDecisionWorkspaceResponse } from "./academic.api"

// La portée vient de l'API ; l'année et la fenêtre de revue pilotent seulement l'affichage du menu.
export function getOpenConductScopes(workspace: ConductDecisionWorkspaceResponse | undefined) {
  return (workspace?.decisionScopes ?? []).filter((scope) =>
    scope.schoolYearStatus === "active" && scope.reviewOpen && !scope.isClosed && scope.studentCount > 0,
  )
}

export function getConductReminderCount(workspace: ConductDecisionWorkspaceResponse | undefined) {
  return getOpenConductScopes(workspace).reduce((total, scope) => total + scope.pendingCount, 0)
}
