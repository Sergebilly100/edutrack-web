import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

/**
 * Couverture des visites : une visite de page ne doit pas se limiter à un survol.
 * Seuil bas volontaire : il empêche surtout qu'une visite redevienne anecdotique.
 */
const SRC = join(__dirname, "..", "..", "..")
const source = readFileSync(join(SRC, "shared/lib/tour-steps.ts"), "utf8")

const tours = [...source.matchAll(/export const (\w+TourSteps)[^=]*= \[([\s\S]*?)\n\]\n/g)].map((match) => ({
  name: match[1],
  steps: (match[2].match(/target:/g) ?? []).length,
}))

/** Visites courtes assumées : la page n'a qu'un ou deux blocs distincts. */
const SHORT_ALLOWED = new Set(["historicalStudentsImportTourSteps", "financeHistoryTourSteps"])

describe("couverture des visites guidées", () => {
  it("lit toutes les visites de tour-steps.ts", () => {
    expect(tours.length).toBeGreaterThan(25)
  })

  it.each(tours.filter((tour) => !SHORT_ALLOWED.has(tour.name)).map((tour) => [tour.name, tour.steps] as const))(
    "%s compte au moins 4 étapes (%i)",
    (_name, steps) => {
      expect(steps).toBeGreaterThanOrEqual(4)
    },
  )
})
