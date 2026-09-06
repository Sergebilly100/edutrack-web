import { afterEach, describe, expect, it, vi } from "vitest"

import { triggerBlobDownload, triggerPdfExportDownload } from "./pdfExport.api"

describe("pdf export download helpers", () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it("déclenche le téléchargement avant de révoquer l'URL Blob", () => {
    vi.useFakeTimers()
    const objectUrl = "blob:export-test"
    const createObjectUrl = vi.fn(() => objectUrl)
    const revokeObjectUrl = vi.fn(() => undefined)
    vi.stubGlobal("URL", { createObjectURL: createObjectUrl, revokeObjectURL: revokeObjectUrl })
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined)

    triggerBlobDownload(new Blob(["contenu"]), "journal-caisse.xlsx")

    expect(createObjectUrl).toHaveBeenCalledOnce()
    expect(click).toHaveBeenCalledOnce()
    expect(revokeObjectUrl).not.toHaveBeenCalled()

    vi.runOnlyPendingTimers()

    expect(revokeObjectUrl).toHaveBeenCalledWith(objectUrl)
  })

  it("prépare une navigation navigateur vers l'URL PDF signée", () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.href).toBe("https://api.ivoiredu.ci/api/v1/jobs/197/download?signature=signed")
      expect(this.download).toBe("journal-caisse.pdf")
      expect(this.referrerPolicy).toBe("no-referrer")
    })

    triggerPdfExportDownload(
      "https://api.ivoiredu.ci/api/v1/jobs/197/download?signature=signed",
      "journal-caisse.pdf"
    )

    expect(click).toHaveBeenCalledOnce()
  })
})
