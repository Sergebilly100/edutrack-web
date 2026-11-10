import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ listSchoolYears: vi.fn(), canExport: true }))
vi.mock("@/modules/academic/academic.api", () => ({ listSchoolYears: mocks.listSchoolYears }))
vi.mock("@/shared/hooks/useCanExportData", () => ({ useCanExportData: () => mocks.canExport }))

import { ExportListDialog } from "../ExportListDialog"

const years = [
  { id: "y24", label: "2024-2025", status: "closed" },
  { id: "y25", label: "2025-2026", status: "active" },
]

const renderDialog = (props: Partial<Parameters<typeof ExportListDialog>[0]> = {}) => {
  const onExport = vi.fn().mockResolvedValue(undefined)
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ExportListDialog noun="élèves" filtersActive yearHint="Indice année" onExport={onExport} {...props} />
    </QueryClientProvider>,
  )
  return onExport
}

const open = async () => {
  fireEvent.click(screen.getByRole("button", { name: "Exporter" }))
  return screen.findByRole("dialog", {}, { timeout: 4000 })
}

/** Le bouton de validation reste désactivé tant que les années ne sont pas chargées. */
const submit = async () => {
  const button = () => screen.getAllByRole("button", { name: "Exporter" }).at(-1)!
  await waitFor(() => expect(button()).toBeEnabled(), { timeout: 4000 })
  fireEvent.click(button())
}

describe("ExportListDialog", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.canExport = true
    mocks.listSchoolYears.mockResolvedValue(years)
  })

  it("propose l'année active par défaut et la sélection filtrée quand des filtres sont appliqués", async () => {
    const onExport = renderDialog()
    await open()
    expect(await screen.findByRole("combobox", { name: "Année scolaire" }, { timeout: 4000 })).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: /Exporter la sélection filtrée/ })).toBeChecked()
    expect(screen.getByText("Indice année")).toBeInTheDocument()
    expect(screen.getByText(/ne sont jamais exportés/)).toBeInTheDocument()
    await submit()
    await waitFor(() => expect(onExport).toHaveBeenCalledWith({ schoolYearId: "y25", schoolYearLabel: "2025-2026", filtered: true, isActiveYear: true }))
  })

  it("exporte tout quand « Tout exporter » est choisi", async () => {
    const onExport = renderDialog()
    await open()
    await screen.findByRole("combobox", { name: "Année scolaire" }, { timeout: 4000 })
    fireEvent.click(screen.getByRole("radio", { name: /Tout exporter/ }))
    await submit()
    await waitFor(() => expect(onExport).toHaveBeenCalledWith(expect.objectContaining({ filtered: false })))
  })

  it("désactive la sélection filtrée sans filtre appliqué", async () => {
    renderDialog({ filtersActive: false })
    await open()
    expect(await screen.findByRole("radio", { name: /Exporter la sélection filtrée/ }, { timeout: 4000 })).toBeDisabled()
    expect(screen.getByRole("radio", { name: /Tout exporter/ })).toBeChecked()
    expect(screen.getByText("Aucun filtre n’est appliqué à la liste.")).toBeInTheDocument()
  })

  it("désactive le bouton quand l'école interdit l'export", () => {
    mocks.canExport = false
    renderDialog()
    const button = screen.getByRole("button", { name: "Exporter" })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute("title", "L’export de données est désactivé pour cet établissement.")
  })

  it("affiche l'erreur et garde la fenêtre ouverte quand l'export échoue", async () => {
    const onExport = renderDialog()
    onExport.mockRejectedValueOnce(new Error("L’export de données est désactivé pour cet établissement."))
    await open()
    await screen.findByRole("combobox", { name: "Année scolaire" }, { timeout: 4000 })
    await submit()
    expect(await screen.findByRole("alert", {}, { timeout: 4000 })).toHaveTextContent("désactivé pour cet établissement")
    expect(screen.getByRole("dialog")).toBeInTheDocument()
  })
})
