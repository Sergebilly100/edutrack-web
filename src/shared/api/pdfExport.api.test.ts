import { afterEach, describe, expect, it, vi } from "vitest"

import { triggerBlobDownload } from "./pdfExport.api"

describe("triggerBlobDownload", () => {
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
})
