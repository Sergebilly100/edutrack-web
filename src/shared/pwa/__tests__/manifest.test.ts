import { describe, expect, it } from "vitest"

import { getPwaManifestHref, setPwaManifest } from "../manifest"

describe("PWA manifest selection", () => {
  it("maps install audiences to dedicated manifests", () => {
    expect(getPwaManifestHref("user")).toBe("/manifest-teacher.webmanifest")
    expect(getPwaManifestHref("parent")).toBe("/manifest-parent.webmanifest")
  })

  it("creates and updates the active manifest link", () => {
    document.head.innerHTML = ""

    setPwaManifest("user")
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')
    expect(link?.getAttribute("href")).toBe("/manifest-teacher.webmanifest")
    expect(link?.dataset.pwaAudience).toBe("user")

    setPwaManifest("parent")
    expect(document.querySelectorAll('link[rel="manifest"]')).toHaveLength(1)
    expect(link?.getAttribute("href")).toBe("/manifest-parent.webmanifest")
    expect(link?.dataset.pwaAudience).toBe("parent")
  })
})
