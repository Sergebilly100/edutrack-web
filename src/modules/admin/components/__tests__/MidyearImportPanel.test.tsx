import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

const api = vi.hoisted(() => ({
  getMidyearMappingProfile: vi.fn(),
  analyzeMidyearImport: vi.fn(),
  saveMidyearMappingProfile: vi.fn(),
  confirmMidyearImport: vi.fn(),
}))

vi.mock("@/modules/admin/admin.api", () => api)
vi.mock("@/components/ui/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }))

import { MidyearImportPanel } from "../MidyearImportPanel"

describe("MidyearImportPanel", () => {
  it("exige puis enregistre les correspondances avant de permettre l'import", async () => {
    api.getMidyearMappingProfile.mockResolvedValue(null)
    api.analyzeMidyearImport.mockResolvedValue({
      headers: ["Libellé", "Position"],
      rowCount: 2,
      matchedFields: [
        { sourceColumnLabel: "Libellé", targetField: "nom", isRequired: true, translations: [] },
        { sourceColumnLabel: "Position", targetField: "ordre", isRequired: false, translations: [] },
      ],
      missingTargets: ["nom"],
      profile: null,
    })
    api.saveMidyearMappingProfile.mockResolvedValue({ id: "profile-1", importType: "midyear_levels", label: "niveaux.xlsx", isActive: true, fields: [] })

    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MidyearImportPanel tenantId="tenant-1" /></QueryClientProvider>)

    const file = new File(["xlsx"], "niveaux.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
    fireEvent.change(screen.getByLabelText(/Fichier Excel/), { target: { files: [file] } })
    fireEvent.click(screen.getByRole("button", { name: "Analyser les colonnes" }))

    await screen.findByText("Correspondance des colonnes")
    expect(screen.getByRole("button", { name: "Lancer l’import définitif" })).toBeDisabled()

    fireEvent.click(screen.getByRole("button", { name: "Enregistrer les correspondances" }))
    await waitFor(() => expect(api.saveMidyearMappingProfile).toHaveBeenCalledWith(
      "tenant-1",
      "levels",
      expect.objectContaining({ label: "niveaux.xlsx", fields: expect.any(Array) })
    ))
  })
})
