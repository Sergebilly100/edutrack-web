import { expect, test, type Page } from "@playwright/test"

import { loginAsDirectorUI, mockDirectorAuth } from "./helpers"

const viewports = [
  { width: 1280, height: 720 },
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]
const pages = ["/finance/dashboard", "/settings?tab=general", "/settings?tab=risques", "/settings?tab=finance", "/teachers"]

/** Retourne l'excédent du document et les conteneurs défilants autres que <main> et la navigation latérale. */
const scan = (page: Page) =>
  page.evaluate(() => {
    const doc = document.documentElement
    const nested: string[] = []
    document.querySelectorAll("main *").forEach((el) => {
      const style = getComputedStyle(el)
      if ((style.overflowY === "auto" || style.overflowY === "scroll") && el.scrollHeight > el.clientHeight + 1) {
        nested.push(`${el.tagName}.${String(el.className).slice(0, 60)}`)
      }
    })
    return { documentExtra: doc.scrollHeight - window.innerHeight, nested }
  })

test.describe("Un seul défilement vertical (layout partagé)", () => {
  test.beforeEach(async ({ page }) => {
    await mockDirectorAuth(page)
  })

  for (const viewport of viewports) {
    for (const path of pages) {
      test(`${path} @ ${viewport.width}x${viewport.height}`, async ({ page }) => {
        await page.setViewportSize(viewport)
        await loginAsDirectorUI(page)
        await page.goto(path)
        await page.waitForLoadState("networkidle")
        const result = await scan(page)
        expect(result.documentExtra, "le document ne doit pas défiler en plus de <main>").toBeLessThanOrEqual(1)
        expect(result.nested, "aucun conteneur défilant imbriqué dans <main>").toEqual([])
      })
    }
  }
})
