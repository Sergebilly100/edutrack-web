import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ get: vi.fn(), download: vi.fn() }))
vi.mock("@/shared/api/client", () => ({ apiClient: { get: mocks.get } }))
vi.mock("@/shared/api/pdfExport.api", () => ({ triggerBlobDownload: mocks.download }))

import { downloadExcelExport, EXPORT_DISABLED_MESSAGE, EXPORT_FAILED_MESSAGE } from "./excelExport.api"

const axiosError = (data: unknown) => Object.assign(new Error("fail"), { isAxiosError: true, response: { status: 403, data } })

describe("downloadExcelExport", () => {
  beforeEach(() => vi.resetAllMocks())

  it("télécharge le fichier avec le nom demandé", async () => {
    const blob = new Blob(["x"])
    mocks.get.mockResolvedValue({ data: blob })
    await downloadExcelExport("/students/export", { school_year_id: "y1" }, "eleves.xlsx")
    expect(mocks.get).toHaveBeenCalledWith("/students/export", { params: { school_year_id: "y1" }, responseType: "blob" })
    expect(mocks.download).toHaveBeenCalledWith(blob, "eleves.xlsx")
  })

  it("traduit EXPORT_DISABLED, y compris quand le corps d'erreur est un Blob", async () => {
    mocks.get.mockRejectedValueOnce(axiosError({ code: "EXPORT_DISABLED" }))
    await expect(downloadExcelExport("/x", {}, "f.xlsx")).rejects.toThrow(EXPORT_DISABLED_MESSAGE)
    mocks.get.mockRejectedValueOnce(axiosError(new Blob([JSON.stringify({ code: "EXPORT_DISABLED" })])))
    await expect(downloadExcelExport("/x", {}, "f.xlsx")).rejects.toThrow(EXPORT_DISABLED_MESSAGE)
  })

  it("utilise un message générique pour les autres erreurs", async () => {
    mocks.get.mockRejectedValueOnce(new Error("réseau"))
    await expect(downloadExcelExport("/x", {}, "f.xlsx")).rejects.toThrow(EXPORT_FAILED_MESSAGE)
  })
})
