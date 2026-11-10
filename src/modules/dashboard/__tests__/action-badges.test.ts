import { describe, expect, it } from "vitest"

import { summarizeActionBadges } from "../action-badges"

const item = (type: string, message = "Message.") => ({ id: type, type, referenceId: null, priority: "medium" as const, message, generatedAt: "2026-11-08" })

describe("summarizeActionBadges", () => {
  it("compte les actions par entrée de menu et par onglet des paramètres", () => {
    const badges = summarizeActionBadges([
      item("config_subjects"), item("config_levels"), item("config_rooms"),
      item("config_school_info"), item("config_document_identity"), item("config_fees"),
      item("config_required_documents"), item("config_reminder_rules"), item("config_risk_rules"),
    ])
    expect(badges.byHref["/academic"]).toBe(2)
    expect(badges.byHref["/rooms"]).toBe(1)
    expect(badges.byHref["/settings"]).toBe(6)
    expect(badges.bySettingsTab).toEqual({ general: 2, finance: 1, scolarite: 1, relances: 1, risques: 1 })
  })

  it("ignore les types qui ont déjà leur pastille (validations, conduite) ou sans page dédiée", () => {
    expect(summarizeActionBadges([item("validations_pending"), item("conduct_decision_pending"), item("student_at_risk")]))
      .toEqual({ byHref: {}, bySettingsTab: {}, detailsByHref: {}, detailsBySettingsTab: {} })
  })

  it("liste vide : aucune pastille", () => {
    expect(summarizeActionBadges([])).toEqual({ byHref: {}, bySettingsTab: {}, detailsByHref: {}, detailsBySettingsTab: {} })
  })
  it("décrit l'action derrière chaque pastille : titre et message, par page et par onglet", () => {
    const badges = summarizeActionBadges([
      item("report_cards_blocked", "En 6ème A, les moyennes de 1 matière ne sont pas validées."),
      item("config_fees", "Les frais de scolarité ne sont pas configurés pour l’année en cours."),
    ])
    expect(badges.detailsByHref["/academic/report-cards"]).toEqual(["Bulletins bloqués : En 6ème A, les moyennes de 1 matière ne sont pas validées."])
    expect(badges.detailsBySettingsTab.finance).toEqual(["Frais de scolarité à configurer : Les frais de scolarité ne sont pas configurés pour l’année en cours."])
  })
})
