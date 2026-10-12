import { beforeEach, describe, expect, it, vi } from "vitest"
import { apiClient } from "@/shared/api/client"
import { fetchAdministrationConfig, fetchSchoolConfig, fetchPermissionCatalogue, updateSchoolInfo } from "../settings.api"
import { buildPermissionCatalogue } from "../../../../../edutrack-api/src/modules/permissions/permissions.catalogue"

vi.mock("@/shared/api/client", () => ({ apiClient: { patch: vi.fn(), get: vi.fn() } }))
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

describe("lectures école et administration séparées", () => {
  it("charge uniquement les informations école avec settings.school", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { school: { name: "École", canEditSmsTemplate: true, allowTeacherQrSkip: true } } })
    const config = await fetchSchoolConfig()
    expect(apiClient.get).toHaveBeenCalledWith("/permissions/config/school")
    expect(apiClient.get).toHaveBeenCalledTimes(1)
    expect(config.school.canEditSmsTemplate).toBe(true)
    expect(config.school.allowTeacherQrSkip).toBe(true)
    expect(config.users).toEqual([])
    expect(config.positions).toEqual([])
  })

  it.each([403, 404, 500])("ne replie pas une lecture administrative refusée (%s)", async (status) => {
    const error = { isAxiosError: true, response: { status } }
    vi.mocked(apiClient.get).mockRejectedValue(error)
    await expect(fetchAdministrationConfig()).rejects.toBe(error)
    expect(apiClient.get).toHaveBeenCalledWith("/permissions/config")
    expect(apiClient.get).toHaveBeenCalledTimes(1)
  })

  it("ne replie pas un 403 de lecture école", async () => {
    const error = { isAxiosError: true, response: { status: 403 } }
    vi.mocked(apiClient.get).mockRejectedValue(error)
    await expect(fetchSchoolConfig()).rejects.toBe(error)
    expect(apiClient.get).toHaveBeenCalledTimes(1)
  })

  it("refuse une version de contrat inconnue", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { version: 2, permissions: [] } })
    await expect(fetchPermissionCatalogue()).rejects.toThrow()
  })

  it("accepte le catalogue réel avec le droit de correction publié déléguable", async () => {
    const catalogue = buildPermissionCatalogue({ canEditSmsTemplate: true, smsEnabled: true, monetizeParentAlerts: true })
    vi.mocked(apiClient.get).mockResolvedValue({ data: catalogue })
    await expect(fetchPermissionCatalogue()).resolves.toEqual(catalogue)
    expect(catalogue.permissions.find((entry) => entry.key === "report_cards.published_correction")).toMatchObject({
      available: true, activationDependencies: [],
    })
  })

  it("refuse un droit indiqué disponible alors qu’une activation manque", async () => {
    const catalogue = buildPermissionCatalogue({ canEditSmsTemplate: false, smsEnabled: true, monetizeParentAlerts: true })
    const sms = catalogue.permissions.find((entry) => entry.key === "settings.sms_templates")!
    vi.mocked(apiClient.get).mockResolvedValue({ data: {
      ...catalogue,
      permissions: catalogue.permissions.map((entry) => entry.key === sms.key
        ? { ...sms, available: true, unavailableReason: null } : entry),
    } })
    await expect(fetchPermissionCatalogue()).rejects.toThrow("Les dépendances du catalogue sont incohérentes")
  })
})
