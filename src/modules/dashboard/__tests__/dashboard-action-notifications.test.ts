import { describe, expect, it } from "vitest"

import { actionItemToNotification, CONFIG_ACTION_TYPES, DASHBOARD_ACTION_ROUTES } from "../dashboard-action-notifications"

const item = (type: string) => ({ id: type, type, referenceId: null, priority: "medium" as const, message: "Message.", generatedAt: "2026-11-08" })

describe("actions prioritaires : routes et titres", () => {
  it("couvre les 13 actions de configuration et de conduite attendues", () => {
    expect([...CONFIG_ACTION_TYPES].sort()).toEqual([
      "config_active_year", "config_document_identity", "config_fees", "config_grading_periods", "config_levels",
      "config_reminder_rules", "config_required_documents", "config_risk_rules", "config_rooms", "config_schedule",
      "config_school_info", "config_subjects", "config_teachers",
    ])
    expect(DASHBOARD_ACTION_ROUTES.conduct_decision_pending.href).toBe("/academic/conduct")
  })

  it("chaque type a un titre lisible et un lien interne, jamais le titre générique", () => {
    for (const type of Object.keys(DASHBOARD_ACTION_ROUTES)) {
      const notification = actionItemToNotification(item(type))
      expect(notification.title, type).not.toBe("Action à traiter")
      expect(notification.targetHref, type).toMatch(/^\//)
      expect(notification.actionLabel, type).not.toBe("Consulter")
    }
  })

  it("les réglages ouvrent le bon onglet des paramètres", () => {
    expect(DASHBOARD_ACTION_ROUTES.config_fees.href).toBe("/settings?tab=finance")
    expect(DASHBOARD_ACTION_ROUTES.config_required_documents.href).toBe("/settings?tab=scolarite")
    expect(DASHBOARD_ACTION_ROUTES.config_reminder_rules.href).toBe("/settings?tab=relances")
    expect(DASHBOARD_ACTION_ROUTES.config_risk_rules.href).toBe("/settings?tab=risques")
    expect(DASHBOARD_ACTION_ROUTES.config_document_identity.href).toBe("/settings?tab=general")
  })
})
