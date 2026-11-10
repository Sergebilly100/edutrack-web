import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

/**
 * Test de dérive : chaque cible `data-tour` citée par une visite doit exister dans le code d'un écran.
 * Les cibles mortes déjà connues sont listées ci-dessous : le lot B (remise à niveau) doit vider cette liste.
 */
const KNOWN_DEAD_TARGETS = new Set<string>()

const SRC = join(__dirname, "..", "..", "..")

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) return name === "__tests__" ? [] : sourceFiles(full)
    return /\.(tsx?)$/.test(name) && !/\.test\./.test(name) && !full.endsWith("tour-steps.ts") ? [full] : []
  })
}

describe("dérive des visites guidées", () => {
  const tourSource = readFileSync(join(SRC, "shared/lib/tour-steps.ts"), "utf8")
  const targets = [...new Set([...tourSource.matchAll(/data-tour='([^']+)'/g)].map((match) => match[1]))]
  const corpus = sourceFiles(SRC).map((file) => readFileSync(file, "utf8")).join("\n")

  it("liste des cibles lue dans tour-steps.ts", () => {
    expect(targets.length).toBeGreaterThan(50)
  })

  it("aucune étape ne vise une cible absente de l'interface (hors liste connue)", () => {
    const dead = targets.filter((target) => !corpus.includes(`"${target}"`) && !corpus.includes(`'${target}'`) && !corpus.includes(`data-tour={\`${target}`))
    const unexpected = dead.filter((target) => !KNOWN_DEAD_TARGETS.has(target))
    expect(unexpected).toEqual([])
  })
})
