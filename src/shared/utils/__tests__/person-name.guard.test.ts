import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

/**
 * Garde-fou : le prénom et le nom ne se concatènent jamais à la main dans l'interface.
 * Tout affichage passe par `formatPersonName` (NOM Prénoms, ordre configurable) — voir shared/utils/person-name.ts.
 */
const SRC = path.resolve(process.cwd(), "src")
const FIRST = String.raw`(?:first_?[nN]ame|studentFirstName)`
const LAST = String.raw`(?:last_?[nN]ame|studentLastName)`
const PATTERNS: RegExp[] = [
  // Gabarit : `${a.firstName} ${a.lastName}` (dans les deux ordres)
  new RegExp(String.raw`\$\{[^}]*\b${FIRST}\b[^}]*\}\s*\$\{[^}]*\b${LAST}\b[^}]*\}`),
  new RegExp(String.raw`\$\{[^}]*\b${LAST}\b[^}]*\}\s*\$\{[^}]*\b${FIRST}\b[^}]*\}`),
  // JSX : {a.firstName} {a.lastName} (dans les deux ordres)
  new RegExp(String.raw`\{[\w.?]*\b${FIRST}\}\s*\{[\w.?]*\b${LAST}\}`),
  new RegExp(String.raw`\{[\w.?]*\b${LAST}\}\s*\{[\w.?]*\b${FIRST}\}`),
]

/** Exceptions justifiées : donnée d'import ou nom saisi, jamais un affichage. */
const ALLOWED: Array<{ file: string; reason: string }> = [
  { file: "modules/teachers/teachers.api.ts", reason: "nom du professeur reconstitué depuis un champ unique « name » (pas de séparation fiable prénom/nom)" },
]

const walk = (dir: string): string[] => readdirSync(dir).flatMap((entry) => {
  const full = path.join(dir, entry)
  if (statSync(full).isDirectory()) return entry === "__tests__" ? [] : walk(full)
  return /\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [full] : []
})

describe("affichage des noms : aucune concaténation directe prénom/nom", () => {
  it("passe par formatPersonName partout", () => {
    const violations: string[] = []
    for (const file of walk(SRC)) {
      const relative = path.relative(SRC, file).split(path.sep).join("/")
      if (relative === "shared/utils/person-name.ts" || ALLOWED.some((item) => item.file === relative)) continue
      readFileSync(file, "utf8").split("\n").forEach((line, index) => {
        if (PATTERNS.some((pattern) => pattern.test(line))) violations.push(`${relative}:${index + 1}  ${line.trim().slice(0, 110)}`)
      })
    }
    expect(violations, `Utilisez formatPersonName :\n${violations.join("\n")}`).toEqual([])
  })

  it("les exceptions déclarées existent toujours", () => {
    for (const item of ALLOWED) expect(() => statSync(path.join(SRC, item.file))).not.toThrow()
  })
})
