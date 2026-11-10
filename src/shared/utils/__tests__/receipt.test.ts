import { describe, expect, it } from "vitest"

import { formatPaymentMoment, formatReceiptNumber } from "../receipt"

describe("formatReceiptNumber", () => {
  it("affiche les numéros tels qu’émis, anciens formats compris", () => {
    expect(formatReceiptNumber("REC-0000000004")).toBe("REC-0000000004")
    expect(formatReceiptNumber("DEMO-1-1")).toBe("DEMO-1-1")
    expect(formatReceiptNumber("REC-20261105-0001")).toBe("REC-20261105-0001")
  })
  it("numéro absent : libellé explicite", () => {
    expect(formatReceiptNumber(null)).toBe("Sans numéro de reçu")
    expect(formatReceiptNumber("")).toBe("Sans numéro de reçu")
  })
})

describe("formatPaymentMoment : l’heure seulement si elle est connue (mêmes règles que le PDF)", () => {
  it("heure connue le même jour : « 5 nov. 2026 à 14:32 »", () => {
    const moment = formatPaymentMoment({ paymentDate: "2026-11-05", paidAt: "2026-11-05T14:32:10.000Z" })
    expect(moment.text).toBe("5 nov. 2026 à 14:32")
    expect(moment.time).toBe("14:32")
  })
  it("jamais « 00:00 » : minuit, heure inconnue ou absente → date seule", () => {
    expect(formatPaymentMoment({ paymentDate: "2026-11-05", paidAt: "2026-11-05T00:00:00.000Z" }).text).toBe("5 nov. 2026")
    expect(formatPaymentMoment({ paymentDate: "2026-11-05", paidAt: null }).time).toBeNull()
    expect(formatPaymentMoment({ paymentDate: "2026-11-05T00:00:00" }).text).toBe("5 nov. 2026")
  })
  it("paiement rétrodaté : heure d’enregistrement ignorée", () => {
    expect(formatPaymentMoment({ paymentDate: "2026-09-01", paidAt: "2026-11-05T14:32:10.000Z" }).text).toBe("1 sept. 2026")
  })
  it("date absente ou invalide : « Date inconnue »", () => {
    expect(formatPaymentMoment({ paymentDate: "" }).text).toBe("Date inconnue")
    expect(formatPaymentMoment({ paymentDate: "n/a" }).text).toBe("Date inconnue")
  })
})
