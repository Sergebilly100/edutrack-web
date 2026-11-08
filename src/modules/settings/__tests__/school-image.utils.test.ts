import { describe, expect, it } from "vitest"

import {
  extractApiErrorMessage,
  formatDimensions,
  formatFileSize,
  precheckImageFile,
} from "../identity/school-image.utils"

const file = (name: string, type: string, size: number) => {
  const instance = new File(["x"], name, { type })
  Object.defineProperty(instance, "size", { value: size })
  return instance
}

describe("school-image.utils", () => {
  it("formate tailles et dimensions en français", () => {
    expect(formatFileSize(128 * 1024).replace(/\s/g, " ")).toBe("128 Ko")
    expect(formatFileSize(1.4 * 1024 * 1024).replace(/\s/g, " ")).toBe("1,4 Mo")
    expect(formatDimensions(1200, 600).replace(/\s/g, " ")).toBe("1 200 × 600 px")
  })

  it("refuse SVG et PDF avant envoi, accepte PNG/JPEG/WebP jusqu’à 2 Mo", () => {
    expect(precheckImageFile(file("a.svg", "image/svg+xml", 100))).toMatch(/Format non supporté/)
    expect(precheckImageFile(file("a.pdf", "application/pdf", 100))).toMatch(/Format non supporté/)
    expect(precheckImageFile(file("a.png", "image/png", 2 * 1024 * 1024 + 1))).toMatch(/trop volumineux/)
    for (const type of ["image/png", "image/jpeg", "image/webp"]) {
      expect(precheckImageFile(file("a", type, 2 * 1024 * 1024))).toBeNull()
    }
  })

  it("extrait le message d’erreur serveur, y compris depuis un Blob", async () => {
    expect(await extractApiErrorMessage({ response: { data: { error: "Fichier corrompu." } } })).toBe("Fichier corrompu.")
    const blob = new Blob([JSON.stringify({ error: "Image trop petite." })], { type: "application/json" })
    expect(await extractApiErrorMessage({ response: { data: blob } })).toBe("Image trop petite.")
  })

  it("donne un message lisible en cas d’erreur réseau", async () => {
    expect(await extractApiErrorMessage(new Error("Network Error"))).toMatch(/connexion/)
    expect(await extractApiErrorMessage({ code: "ECONNABORTED" })).toMatch(/délai/)
  })
})
