import { beforeEach, describe, expect, it, vi } from "vitest"
import { apiClient } from "@/shared/api/client"
import { updateSchoolInfo } from "../settings.api"

vi.mock("@/shared/api/client", () => ({ apiClient: { patch: vi.fn() } }))
beforeEach(() => { vi.resetAllMocks() })

describe("mise à jour partielle de l’école", () => {
  it("ne renvoie pas une adresse vide lors d’un changement de logo", async () => {
    await updateSchoolInfo({ logoUrl: "https://example.test/logo.png" })
    const [, payload] = vi.mocked(apiClient.patch).mock.calls[0]
    expect(JSON.parse(JSON.stringify(payload))).toEqual({ logoUrl: "https://example.test/logo.png" })
  })

  it("transmet l’adresse explicitement modifiée", async () => {
    await updateSchoolInfo({ address: "Rue des écoles, Abidjan" })
    expect(apiClient.patch).toHaveBeenCalledWith("/permissions/config/school", expect.objectContaining({ address: "Rue des écoles, Abidjan" }))
  })

  it("ne contourne pas un refus de permission avec un deuxième endpoint", async () => {
    const error = { isAxiosError: true, response: { status: 403 } }
    vi.mocked(apiClient.patch).mockRejectedValueOnce(error)
    await expect(updateSchoolInfo({ address: "Rue des écoles" })).rejects.toBe(error)
    expect(apiClient.patch).toHaveBeenCalledTimes(1)
  })
})
