import { expect, it } from "vitest"
import { clampPercentage } from "../parent.utils"

it("borne défensivement le taux d'absence affiché", () => {
  expect(clampPercentage(-12)).toBe(0)
  expect(clampPercentage(12.5)).toBe(12.5)
  expect(clampPercentage(140)).toBe(100)
  expect(clampPercentage(Number.NaN)).toBe(0)
  expect(clampPercentage(undefined)).toBe(0)
})
