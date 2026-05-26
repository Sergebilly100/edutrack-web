import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { useRollCallStore } from "@/shared/store/rollCall.store"

/**
 * Vérifie la garde locale "QR fin == QR début" injectée dans
 * TeacherCheckInFlow.handleEndQrDetected. La fonction de matching n'est pas
 * exportée — on teste donc via les helpers du store qui constituent la source
 * de vérité de la comparaison.
 */
const SCHEDULE_ID = "schedule-1"
const DATE = "2026-05-26"

describe("rollCall.store — startScanContext (validation QR fin offline)", () => {
  beforeEach(() => {
    useRollCallStore.setState({ flows: {}, startScans: {} })
  })

  afterEach(() => {
    useRollCallStore.setState({ flows: {}, startScans: {} })
  })

  it("retourne null tant qu'aucun scan début n'a été enregistré", () => {
    expect(useRollCallStore.getState().getStartScanContext(SCHEDULE_ID, DATE)).toBeNull()
  })

  it("persiste le token QR et le roomId du scan début", () => {
    useRollCallStore.getState().setStartScanContext(SCHEDULE_ID, DATE, {
      qrToken: "qr-abc",
      roomId: "room-42",
      scannedAt: 1_700_000_000_000,
    })

    const ctx = useRollCallStore.getState().getStartScanContext(SCHEDULE_ID, DATE)
    expect(ctx).toEqual({
      qrToken: "qr-abc",
      roomId: "room-42",
      scannedAt: 1_700_000_000_000,
    })
  })

  it("permet de représenter un saut de QR (qrToken null)", () => {
    useRollCallStore.getState().setStartScanContext(SCHEDULE_ID, DATE, {
      qrToken: null,
      roomId: null,
      scannedAt: Date.now(),
    })

    const ctx = useRollCallStore.getState().getStartScanContext(SCHEDULE_ID, DATE)
    expect(ctx?.qrToken).toBeNull()
    expect(ctx?.roomId).toBeNull()
  })

  it("markDone nettoie le contexte du scan début pour éviter les conflits J+1", () => {
    const store = useRollCallStore.getState()
    store.setStartScanContext(SCHEDULE_ID, DATE, {
      qrToken: "qr-abc",
      roomId: "room-42",
      scannedAt: Date.now(),
    })
    store.markReadyToFinish(SCHEDULE_ID, DATE)

    useRollCallStore.getState().markDone(SCHEDULE_ID, DATE)

    expect(useRollCallStore.getState().getStartScanContext(SCHEDULE_ID, DATE)).toBeNull()
    expect(useRollCallStore.getState().getFlowState(SCHEDULE_ID, DATE)).toBeNull()
  })

  it("isole les contextes entre créneaux et entre dates", () => {
    const store = useRollCallStore.getState()
    store.setStartScanContext("s1", "2026-05-26", {
      qrToken: "qr-1",
      roomId: "room-1",
      scannedAt: 1,
    })
    store.setStartScanContext("s2", "2026-05-26", {
      qrToken: "qr-2",
      roomId: "room-2",
      scannedAt: 2,
    })
    store.setStartScanContext("s1", "2026-05-27", {
      qrToken: "qr-3",
      roomId: "room-1",
      scannedAt: 3,
    })

    expect(useRollCallStore.getState().getStartScanContext("s1", "2026-05-26")?.qrToken).toBe("qr-1")
    expect(useRollCallStore.getState().getStartScanContext("s2", "2026-05-26")?.qrToken).toBe("qr-2")
    expect(useRollCallStore.getState().getStartScanContext("s1", "2026-05-27")?.qrToken).toBe("qr-3")
  })
})

describe("matchEndQrAgainstStart — règle métier", () => {
  // Reproduit la logique de comparaison locale telle qu'implémentée dans
  // handleEndQrDetected : si un token start est connu, le token end DOIT
  // matcher exactement ; sinon (skipQr, scan absent), on délègue au backend.
  const matches = (startToken: string | null, endToken: string): boolean => {
    if (!startToken) return true
    return startToken === endToken.trim()
  }

  it("refuse un token end différent du token start", () => {
    expect(matches("qr-abc", "qr-xyz")).toBe(false)
  })

  it("accepte un token end identique au token start", () => {
    expect(matches("qr-abc", "qr-abc")).toBe(true)
  })

  it("ignore les espaces autour du token end", () => {
    expect(matches("qr-abc", "  qr-abc  ")).toBe(true)
  })

  it("retourne true si aucun token start n'est connu (saut QR ou pas de scan début)", () => {
    expect(matches(null, "qr-anything")).toBe(true)
  })
})
