import { describe, expect, it } from "vitest"
import { changePermissions, isPermissionRequired } from "../permission-catalogue"
import { buildPermissionCatalogue } from "../../../../../edutrack-api/src/modules/permissions/permissions.catalogue"

const entries = buildPermissionCatalogue({ canEditSmsTemplate: true, smsEnabled: true, monetizeParentAlerts: true }).permissions
const mark = entries.find((entry) => entry.key === "attendance.mark_students")!
const view = entries.find((entry) => entry.key === "attendance.view")!

describe("sélection explicite des permissions", () => {
  it("ajoute la dépendance de lecture sans modifier les autres attributions", () => {
    expect(changePermissions(["legacy.custom"], [mark], true, entries)).toEqual(["attendance.mark_students", "attendance.view", "legacy.custom"])
  })
  it("empêche de retirer une lecture requise et permet de retirer le domaine entier", () => {
    const selected = [mark.key, view.key]
    expect(isPermissionRequired(view.key, selected, entries)).toBe(true)
    expect(changePermissions(selected, [view], false, entries)).toEqual(selected)
    expect(changePermissions(selected, [mark, view], false, entries)).toEqual([])
  })
  it("ne retire pas automatiquement la lecture après retrait d’une action", () => {
    expect(changePermissions([mark.key, view.key], [mark], false, entries)).toEqual([view.key])
  })
  it("ne coche ni ne retire les droits indisponibles par sélection de domaine", () => {
    const inactive = buildPermissionCatalogue({ canEditSmsTemplate: false, smsEnabled: false, monetizeParentAlerts: false }).permissions
    const subscriptions = inactive.filter((entry) => entry.domain === "subscriptions")
    expect(changePermissions([], subscriptions, true, inactive)).toEqual([])
    expect(changePermissions(["subscriptions.view"], subscriptions, false, inactive)).toEqual(["subscriptions.view"])
  })
})
