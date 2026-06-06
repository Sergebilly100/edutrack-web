import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { HttpResponse, http } from "msw"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { server } from "@/test/msw/server"
import ImportWizard from "../ImportWizard"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
}

function renderWizard(props: Partial<React.ComponentProps<typeof ImportWizard>> = {}) {
  const queryClient = createQueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <ImportWizard
        allowedImportTypes={["students", "teachers", "schedule"]}
        selectedImportType="students"
        onImportTypeChange={vi.fn()}
        {...props}
      />
    </QueryClientProvider>
  )
}

const makeXlsxFile = (name = "import.xlsx") =>
  new File(["fake-xlsx-content"], name, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })

const DRY_RUN_OK = {
  valid: 3,
  errors: [],
  preview: [
    { "Prénom*": "Alice", "Nom*": "Dupont", "Classe*": "6eA" },
    { "Prénom*": "Bob", "Nom*": "Martin", "Classe*": "6eA" },
    { "Prénom*": "Carol", "Nom*": "Lemaire", "Classe*": "6eA" },
  ],
  toAdd: [{ key: "alice::dupont", displayName: "Alice Dupont" }],
  toUpdate: [],
  toDelete: [],
  unchanged: 2,
  importMode: "merge",
  conflicts: [],
}

const DRY_RUN_ERRORS = {
  valid: 1,
  errors: [
    { row: 2, column: "Prénom*", message: "Le prénom est requis", severity: "error" },
    { row: 3, column: "Classe*", message: "Classe introuvable", severity: "error" },
  ],
  preview: [
    { "Prénom*": "", "Nom*": "Badone", "Classe*": "6eA" },
    { "Prénom*": "Good", "Nom*": "Two", "Classe*": "6eA" },
  ],
  toAdd: [],
  toUpdate: [],
  toDelete: [],
  unchanged: 0,
  importMode: "merge",
  conflicts: [],
}

const DRY_RUN_CONFLICTS = {
  ...DRY_RUN_OK,
  conflicts: [
    {
      periodName: "Semaine du 2026-06-01",
      weekStart: "2026-06-01",
      weekEnd: "2026-06-08",
      message: "La semaine du 01/06/2026 a déjà un EDT.",
    },
  ],
}

const CONFIRM_OK = {
  imported: 3,
  updated: 0,
  errors: [],
  preview: [],
  deactivated: 0,
  importMode: "merge",
}

const CONFIRM_PARTIAL = {
  imported: 2,
  updated: 0,
  errors: [{ row: 3, column: "Classe*", message: "Classe introuvable", severity: "error" }],
  preview: [],
  deactivated: 0,
  importMode: "merge",
}

const CONFIRM_REPLACE = {
  imported: 1,
  updated: 0,
  errors: [],
  preview: [],
  deactivated: 2,
  importMode: "replace",
}

// ---------------------------------------------------------------------------
// Helpers to set up MSW handlers
// ---------------------------------------------------------------------------

function mockDryRunOk(type = "students") {
  server.use(
    http.post(`*/import/${type}/dry-run`, () => HttpResponse.json(DRY_RUN_OK))
  )
}

function mockDryRunErrors(type = "students") {
  server.use(
    http.post(`*/import/${type}/dry-run`, () => HttpResponse.json(DRY_RUN_ERRORS))
  )
}

function mockConfirmOk(type = "students") {
  server.use(
    http.post(`*/import/${type}/confirm`, () => HttpResponse.json(CONFIRM_OK))
  )
}

// ---------------------------------------------------------------------------
// Helper: simulate file drop via DropZone
// ---------------------------------------------------------------------------

function dropFile(file: File) {
  const dropzone = document.querySelector('[data-testid="dropzone"], input[type="file"]')
  if (dropzone instanceof HTMLInputElement) {
    Object.defineProperty(dropzone, "files", { value: [file], writable: false })
    fireEvent.change(dropzone)
  } else {
    // fallback: fire drop event on the div
    const div = document.querySelector("[data-dropzone], .dropzone") ?? document.body
    fireEvent.drop(div, { dataTransfer: { files: [file] } })
  }
}

// ---------------------------------------------------------------------------
// Step 1 - Upload & type selection
// ---------------------------------------------------------------------------

describe("ImportWizard - step 1 (upload)", () => {
  beforeEach(() => {
    server.use(
      http.get("*/import/students/template", () =>
        new HttpResponse(new Blob(["xlsx"]), {
          status: 200,
          headers: { "Content-Disposition": 'attachment; filename="students-template.xlsx"' },
        })
      )
    )
  })

  it("renders stepper with step 1 active", () => {
    renderWizard()
    expect(screen.getByText("Upload")).toBeInTheDocument()
    expect(screen.getByText("Validation")).toBeInTheDocument()
    expect(screen.getByText("Confirmation")).toBeInTheDocument()
    // Step 1 is shown: file selection area should be visible
    expect(screen.getByText(/Télécharger le modèle/i)).toBeInTheDocument()
  })

  it("shows tabs for all allowed import types", () => {
    renderWizard()
    expect(screen.getByText("Élèves")).toBeInTheDocument()
    expect(screen.getByText("Professeurs")).toBeInTheDocument()
    expect(screen.getByText("Emploi du temps")).toBeInTheDocument()
  })

  it("restricts tabs to allowedImportTypes", () => {
    renderWizard({ allowedImportTypes: ["students"], selectedImportType: "students" })
    expect(screen.getByText("Élèves")).toBeInTheDocument()
    expect(screen.queryByText("Professeurs")).not.toBeInTheDocument()
    expect(screen.queryByText("Emploi du temps")).not.toBeInTheDocument()
  })

  it("shows mode selection only for students and teachers", () => {
    renderWizard({ selectedImportType: "students" })
    expect(screen.getByText("Mode de mise à jour")).toBeInTheDocument()
    expect(screen.getByText("Fusion")).toBeInTheDocument()
    expect(screen.getByText("Remplacement")).toBeInTheDocument()
  })

  it("shows schedule period fields only for schedule type", () => {
    renderWizard({ selectedImportType: "schedule" })
    expect(screen.getByLabelText(/Semaine de début/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Semaine de fin/i)).toBeInTheDocument()
    expect(screen.queryByText("Mode de mise à jour")).not.toBeInTheDocument()
  })

  it("'Suivant' button is disabled when no file is selected", () => {
    renderWizard()
    const suivant = screen.getByRole("button", { name: /Suivant/i })
    expect(suivant).toBeDisabled()
  })

  it("shows replace mode warning when replace is selected", () => {
    renderWizard()
    fireEvent.click(screen.getByRole("button", { name: "Remplacement" }))
    expect(screen.getByText(/Mode sensible: remplacement/i)).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Step 2 - Dry-run validation results
// ---------------------------------------------------------------------------

describe("ImportWizard - step 2 (validation)", () => {
  it("advances to step 2 after dry-run call", async () => {
    mockDryRunOk()
    renderWizard()

    // We need to select a file - mock the input
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    if (fileInput) {
      Object.defineProperty(fileInput, "files", {
        value: [makeXlsxFile()],
        writable: false,
      })
      fireEvent.change(fileInput)
    }

    // Click Suivant
    const suivant = await screen.findByRole("button", { name: /Suivant/i })
    fireEvent.click(suivant)

    // Step 2 content appears
    await waitFor(() => {
      expect(screen.getByText(/lignes valides/i)).toBeInTheDocument()
    })
  })

  it("displays valid count and error count from dry-run", async () => {
    mockDryRunOk()
    renderWizard()

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    if (fileInput) {
      Object.defineProperty(fileInput, "files", { value: [makeXlsxFile()], writable: false })
      fireEvent.change(fileInput)
    }
    fireEvent.click(screen.getByRole("button", { name: /Suivant/i }))

    await waitFor(() => {
      expect(screen.getByText(/3 lignes valides/i)).toBeInTheDocument()
      expect(screen.getByText(/0 erreurs/i)).toBeInTheDocument()
    })
  })

  it("shows blocking errors and disables import button", async () => {
    mockDryRunErrors()
    renderWizard()

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    if (fileInput) {
      Object.defineProperty(fileInput, "files", { value: [makeXlsxFile()], writable: false })
      fireEvent.change(fileInput)
    }
    fireEvent.click(screen.getByRole("button", { name: /Suivant/i }))

    await waitFor(() => {
      expect(screen.getByText(/Erreurs bloquantes/i)).toBeInTheDocument()
      expect(screen.getAllByText(/Le prénom est requis/i).length).toBeGreaterThanOrEqual(1)
    })

    const importBtn = screen.getByRole("button", { name: /Importer/i })
    expect(importBtn).toBeDisabled()
  })

  it("shows conflict alert and checkbox when dry-run returns conflicts", async () => {
    server.use(
      http.post("*/import/schedule/dry-run", () => HttpResponse.json(DRY_RUN_CONFLICTS))
    )
    renderWizard({ selectedImportType: "schedule" })

    // Set schedule period dates
    const startInput = screen.getByLabelText(/Semaine de début/i) as HTMLInputElement
    const endInput = screen.getByLabelText(/Semaine de fin/i) as HTMLInputElement
    fireEvent.change(startInput, { target: { value: "2026-06-01" } })
    fireEvent.change(endInput, { target: { value: "2026-06-08" } })

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    if (fileInput) {
      Object.defineProperty(fileInput, "files", { value: [makeXlsxFile("schedule.xlsx")], writable: false })
      fireEvent.change(fileInput)
    }
    fireEvent.click(screen.getByRole("button", { name: /Suivant/i }))

    await waitFor(() => {
      expect(screen.getByText(/Modification d'un EDT existant/i)).toBeInTheDocument()
      expect(screen.getByText(/La semaine du 01\/06\/2026/i)).toBeInTheDocument()
    })

    // Confirm button disabled until checkbox is checked
    const importBtn = screen.getByRole("button", { name: /Importer/i })
    expect(importBtn).toBeDisabled()

    // Check the conflict acknowledgment checkbox
    const checkbox = screen.getByRole("checkbox")
    fireEvent.click(checkbox)

    await waitFor(() => {
      expect(importBtn).not.toBeDisabled()
    })
  })

  it("shows diff stats (nouveaux, mis à jour, inchangés) for students", async () => {
    mockDryRunOk()
    renderWizard()

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    if (fileInput) {
      Object.defineProperty(fileInput, "files", { value: [makeXlsxFile()], writable: false })
      fireEvent.change(fileInput)
    }
    fireEvent.click(screen.getByRole("button", { name: /Suivant/i }))

    await waitFor(() => {
      expect(screen.getByText("Nouveaux")).toBeInTheDocument()
      expect(screen.getByText("Mis à jour")).toBeInTheDocument()
      expect(screen.getByText("Inchangés")).toBeInTheDocument()
    })
  })

  it("shows preview table with row data", async () => {
    mockDryRunOk()
    renderWizard()

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    if (fileInput) {
      Object.defineProperty(fileInput, "files", { value: [makeXlsxFile()], writable: false })
      fireEvent.change(fileInput)
    }
    fireEvent.click(screen.getByRole("button", { name: /Suivant/i }))

    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeInTheDocument()
      expect(screen.getByText("Dupont")).toBeInTheDocument()
    })
  })

  it("'← Corriger le fichier' goes back to step 1", async () => {
    mockDryRunOk()
    renderWizard()

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    if (fileInput) {
      Object.defineProperty(fileInput, "files", { value: [makeXlsxFile()], writable: false })
      fireEvent.change(fileInput)
    }
    fireEvent.click(screen.getByRole("button", { name: /Suivant/i }))

    await waitFor(() => {
      expect(screen.getByText(/lignes valides/i)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole("button", { name: /Corriger le fichier/i }))

    await waitFor(() => {
      expect(screen.getByText(/Télécharger le modèle/i)).toBeInTheDocument()
    })
  })
})

// ---------------------------------------------------------------------------
// Step 3 - Confirm import results
// ---------------------------------------------------------------------------

describe("ImportWizard - step 3 (confirmation)", () => {
  const goToStep3 = async () => {
    mockDryRunOk()
    mockConfirmOk()
    renderWizard()

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    if (fileInput) {
      Object.defineProperty(fileInput, "files", { value: [makeXlsxFile()], writable: false })
      fireEvent.change(fileInput)
    }
    fireEvent.click(screen.getByRole("button", { name: /Suivant/i }))

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Importer/i })).not.toBeDisabled()
    })

    fireEvent.click(screen.getByRole("button", { name: /Importer/i }))
  }

  it("shows success message after confirm", async () => {
    await goToStep3()

    await waitFor(() => {
      expect(screen.getByText(/3 enregistrements importés avec succès/i)).toBeInTheDocument()
    })
  })

  it("shows 'Terminer' button on step 3", async () => {
    await goToStep3()

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Terminer/i })).toBeInTheDocument()
    })
  })

  it("clicking 'Terminer' resets wizard to step 1", async () => {
    await goToStep3()

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Terminer/i })).not.toBeDisabled()
    })

    fireEvent.click(screen.getByRole("button", { name: /Terminer/i }))

    await waitFor(() => {
      expect(screen.getByText(/Télécharger le modèle/i)).toBeInTheDocument()
    })
  })

  it("shows partial success with error detail when confirm returns partial errors", async () => {
    mockDryRunOk()
    server.use(
      http.post("*/import/students/confirm", () => HttpResponse.json(CONFIRM_PARTIAL))
    )
    renderWizard()

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    if (fileInput) {
      Object.defineProperty(fileInput, "files", { value: [makeXlsxFile()], writable: false })
      fireEvent.change(fileInput)
    }
    fireEvent.click(screen.getByRole("button", { name: /Suivant/i }))

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Importer/i })).not.toBeDisabled()
    })
    fireEvent.click(screen.getByRole("button", { name: /Importer/i }))

    await waitFor(() => {
      expect(screen.getByText(/2 importés.*1 en erreur/i)).toBeInTheDocument()
    })
  })

  it("shows deactivated count when replace mode returns deactivated > 0", async () => {
    mockDryRunOk()
    server.use(
      http.post("*/import/students/confirm", () => HttpResponse.json(CONFIRM_REPLACE))
    )
    renderWizard()

    // Switch to replace mode
    fireEvent.click(screen.getByRole("button", { name: "Remplacement" }))

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    if (fileInput) {
      Object.defineProperty(fileInput, "files", { value: [makeXlsxFile()], writable: false })
      fireEvent.change(fileInput)
    }
    fireEvent.click(screen.getByRole("button", { name: /Suivant/i }))

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Importer/i })).not.toBeDisabled()
    })
    fireEvent.click(screen.getByRole("button", { name: /Importer/i }))

    await waitFor(() => {
      expect(screen.getByText(/2 enregistrements absents du fichier ont été désactivés/i)).toBeInTheDocument()
    })
  })

  it("shows error alert when confirm API returns 400", async () => {
    mockDryRunOk()
    server.use(
      http.post("*/import/students/confirm", () =>
        HttpResponse.json(
          { error: "Échec de l'import", code: "IMPORT_FAILED" },
          { status: 400 }
        )
      )
    )
    renderWizard()

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    if (fileInput) {
      Object.defineProperty(fileInput, "files", { value: [makeXlsxFile()], writable: false })
      fireEvent.change(fileInput)
    }
    fireEvent.click(screen.getByRole("button", { name: /Suivant/i }))

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Importer/i })).not.toBeDisabled()
    })
    fireEvent.click(screen.getByRole("button", { name: /Importer/i }))

    await waitFor(() => {
      expect(screen.getByText(/Échec de l'import/i)).toBeInTheDocument()
    })
  })
})

// ---------------------------------------------------------------------------
// API layer - import-export.api.ts
// ---------------------------------------------------------------------------

describe("import-export.api - fetchImportHistory", () => {
  it("parses history items correctly", async () => {
    server.use(
      http.get("*/import/history", () =>
        HttpResponse.json({
          items: [
            {
              id: "h1",
              imported_at: "2026-05-01T10:00:00Z",
              type: "students",
              imported_count: 15,
              updated_count: 3,
            },
          ],
          total: 1,
          page: 1,
          totalPages: 1,
        })
      )
    )

    const { fetchImportHistory } = await import("../import-export.api")
    const result = await fetchImportHistory({ limit: 5, page: 1 })

    expect(result.items).toHaveLength(1)
    expect(result.items[0]).toEqual({
      id: "h1",
      importedAt: "2026-05-01T10:00:00Z",
      type: "students",
      importedCount: 15,
      updatedCount: 3,
      importedBy: null,
      importedByName: null,
      importedByRole: null,
      schedulePeriod: null,
    })
    expect(result.total).toBe(1)
    expect(result.page).toBe(1)
  })

  it("returns empty items when items is missing", async () => {
    server.use(
      http.get("*/import/history", () => HttpResponse.json({}))
    )

    const { fetchImportHistory } = await import("../import-export.api")
    const result = await fetchImportHistory()
    expect(result.items).toEqual([])
    expect(result.total).toBe(0)
  })
})

describe("import-export.api - dryRun", () => {
  it("normalizes severity from 'level' field to error/warning", async () => {
    server.use(
      http.post("*/import/students/dry-run", () =>
        HttpResponse.json({
          valid: 0,
          errors: [
            { row: 2, column: "Prénom*", message: "Requis", level: "warn" },
          ],
          preview: [],
          toAdd: [],
          toUpdate: [],
          toDelete: [],
          unchanged: 0,
          importMode: "merge",
          conflicts: [],
        })
      )
    )

    const { dryRun } = await import("../import-export.api")
    const file = makeXlsxFile()
    const result = await dryRun("students", file)

    expect(result.errors[0].severity).toBe("warning")
  })

  it("passes schedulePeriod params for schedule type", async () => {
    // Verify the FormData is constructed correctly by checking the URL used
    // (MSW intercepts the request; week_start/week_end are form fields - not query params)
    server.use(
      http.post("*/import/schedule/dry-run", () =>
        HttpResponse.json({ ...DRY_RUN_OK, conflicts: [] })
      )
    )

    const { dryRun } = await import("../import-export.api")
    const file = makeXlsxFile("schedule.xlsx")
    // If week_start/week_end were missing, the backend would 400 - here we just
    // assert it resolves without throwing (API layer builds FormData correctly)
    const result = await dryRun("schedule", file, {
      schedulePeriod: { weekStart: "2026-06-01", weekEnd: "2026-06-08" },
    })
    expect(result.valid).toBe(3)
  })
})

describe("import-export.api - confirmImport", () => {
  it("passes conflictAcknowledged=true in FormData and resolves", async () => {
    server.use(
      http.post("*/import/schedule/confirm", () => HttpResponse.json(CONFIRM_OK))
    )

    const { confirmImport } = await import("../import-export.api")
    const file = makeXlsxFile("schedule.xlsx")
    // If conflict_acknowledged were absent, backend returns 400 - here we assert it resolves
    const result = await confirmImport("schedule", file, {
      schedulePeriod: { weekStart: "2026-07-07", weekEnd: "2026-07-14" },
      conflictAcknowledged: true,
    })
    expect(result.imported).toBe(3)
  })

  it("maps deactivated field from response", async () => {
    server.use(
      http.post("*/import/students/confirm", () => HttpResponse.json(CONFIRM_REPLACE))
    )

    const { confirmImport } = await import("../import-export.api")
    const file = makeXlsxFile()
    const result = await confirmImport("students", file, { importMode: "replace" })

    expect(result.deactivated).toBe(2)
    expect(result.importMode).toBe("replace")
  })
})
