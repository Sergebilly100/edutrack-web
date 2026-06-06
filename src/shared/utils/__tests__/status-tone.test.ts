import { describe, expect, it } from "vitest"

import {
  attendanceTone,
  statusToneBadge,
  statusToneIconBg,
  statusToneText,
} from "@/shared/utils/status-tone"

describe("attendanceTone", () => {
  it("retourne success au-dessus du seuil haut (≥85)", () => {
    expect(attendanceTone(85)).toBe("success")
    expect(attendanceTone(100)).toBe("success")
  })

  it("retourne warning dans la zone intermédiaire (60–84)", () => {
    expect(attendanceTone(60)).toBe("warning")
    expect(attendanceTone(84)).toBe("warning")
  })

  it("retourne danger sous le seuil bas (<60)", () => {
    expect(attendanceTone(59)).toBe("danger")
    expect(attendanceTone(0)).toBe("danger")
  })
})

describe("maps de tons", () => {
  it("exposent une classe pour chaque ton", () => {
    for (const tone of ["success", "warning", "danger", "info", "neutral"] as const) {
      expect(statusToneBadge[tone]).toBeTruthy()
      expect(statusToneText[tone]).toBeTruthy()
      expect(statusToneIconBg[tone]).toBeTruthy()
    }
  })

  it("incluent une variante dark mode pour les tons colorés", () => {
    expect(statusToneBadge.success).toContain("dark:")
    expect(statusToneIconBg.warning).toContain("dark:")
  })
})
