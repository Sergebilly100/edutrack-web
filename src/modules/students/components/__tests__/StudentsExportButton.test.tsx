import { render } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ exportStudentsExcel: vi.fn(), props: null as null | { filtersActive: boolean; onExport: (request: unknown) => Promise<void> } }))
vi.mock("@/modules/students/students.api", () => ({ exportStudentsExcel: mocks.exportStudentsExcel }))
vi.mock("@/shared/components/ExportListDialog", () => ({ ExportListDialog: (props: never) => { mocks.props = props; return null } }))

import { StudentsExportButton } from "../StudentsExportButton"

const filters = { noun: "élèves", levelFilter: "lvl", classFilter: "cls", statusFilter: "active", searchTerm: " kon " }

describe("StudentsExportButton", () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.exportStudentsExcel.mockResolvedValue(undefined) })

  it("sans filtre, signale qu'aucune sélection filtrée n'existe", () => {
    render(<StudentsExportButton {...filters} levelFilter="all" classFilter="all" statusFilter="all" searchTerm="  " />)
    expect(mocks.props?.filtersActive).toBe(false)
  })

  it("« sélection filtrée » reprend niveau, classe, statut et recherche de la liste", async () => {
    render(<StudentsExportButton {...filters} />)
    expect(mocks.props?.filtersActive).toBe(true)
    await mocks.props!.onExport({ schoolYearId: "y", schoolYearLabel: "2025-2026", filtered: true, isActiveYear: true })
    expect(mocks.exportStudentsExcel).toHaveBeenCalledWith({
      schoolYearId: "y", schoolYearLabel: "2025-2026",
      filters: { classId: "cls", levelId: "lvl", isActive: true, search: "kon" },
    })
  })

  it("ignore le filtre de classe pour une autre année que l'active", async () => {
    render(<StudentsExportButton {...filters} />)
    await mocks.props!.onExport({ schoolYearId: "old", schoolYearLabel: "2024-2025", filtered: true, isActiveYear: false })
    expect(mocks.exportStudentsExcel).toHaveBeenCalledWith(expect.objectContaining({ filters: expect.objectContaining({ classId: undefined, levelId: "lvl" }) }))
  })

  it("« tout exporter » n'envoie aucun filtre", async () => {
    render(<StudentsExportButton {...filters} />)
    await mocks.props!.onExport({ schoolYearId: "y", schoolYearLabel: "2025-2026", filtered: false, isActiveYear: true })
    expect(mocks.exportStudentsExcel).toHaveBeenCalledWith({ schoolYearId: "y", schoolYearLabel: "2025-2026", filters: undefined })
  })
})
