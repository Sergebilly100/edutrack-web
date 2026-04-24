import { describe, expect, it } from "vitest"

import { shouldMarkCheckinQrDoneOnSheetClose } from "@/modules/attendance/components/TeacherCheckInFlow"

describe("shouldMarkCheckinQrDoneOnSheetClose", () => {
  it("retourne false quand la modal est fermée en étape 1", () => {
    expect(
      shouldMarkCheckinQrDoneOnSheetClose({
        step: 1,
        isRollCallPending: false,
        isReadyToFinish: false,
      })
    ).toBe(false)
  })

  it("retourne false quand la modal est fermée en étape 2", () => {
    expect(
      shouldMarkCheckinQrDoneOnSheetClose({
        step: 2,
        isRollCallPending: false,
        isReadyToFinish: false,
      })
    ).toBe(false)
  })

  it("retourne true uniquement en étape 3 si l'appel n'est pas déjà différé", () => {
    expect(
      shouldMarkCheckinQrDoneOnSheetClose({
        step: 3,
        isRollCallPending: false,
        isReadyToFinish: false,
      })
    ).toBe(true)
  })

  it("retourne false si l'appel est déjà en attente (rollcall_pending)", () => {
    expect(
      shouldMarkCheckinQrDoneOnSheetClose({
        step: 3,
        isRollCallPending: true,
        isReadyToFinish: false,
      })
    ).toBe(false)
  })
})
