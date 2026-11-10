import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

/**
 * Test de dérive des libellés : tout texte cité entre « » dans l'aide ou les visites
 * (bouton, onglet, titre) doit exister dans le code de l'interface. Un bouton renommé fait échouer ce test.
 */
const SRC = join(__dirname, "..", "..", "..")

const normalize = (value: string) =>
  value
    .replace(/[\u00a0\u202f]/g, " ")
    .replace(/[’‘]/g, "'")
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) return name === "__tests__" ? [] : files(full)
    return /\.tsx?$/.test(name) && !/\.test\./.test(name) ? [full] : []
  })
}

const all = files(SRC)
const contentFiles = all.filter((file) => file.endsWith(".aide.ts") || file.endsWith("tour-steps.ts"))
const interfaceCorpus = all
  .filter((file) => !contentFiles.includes(file))
  .map((file) => normalize(readFileSync(file, "utf8")))
  .join("\n")

describe("libellés cités dans l'aide et les visites", () => {
  const citations = contentFiles.flatMap((file) => {
    const text = readFileSync(file, "utf8")
    return [...text.matchAll(/«\s*([^»]{2,80}?)\s*»/g)].map((match) => ({
      file: file.split("/").pop() as string,
      label: normalize(match[1]).replace(/[.…]+$/, "").trim(),
    }))
  })

  it("lit un nombre significatif de citations", () => {
    expect(citations.length).toBeGreaterThan(300)
  })

  it("chaque libellé cité existe dans l'interface", () => {
    const missing = [...new Set(citations.filter((c) => c.label && !interfaceCorpus.includes(c.label)).map((c) => `${c.label} (${c.file})`))]
    expect(missing).toEqual([])
  })
})
