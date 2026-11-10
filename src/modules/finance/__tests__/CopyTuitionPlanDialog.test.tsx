import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ preview: vi.fn(), copy: vi.fn() }))
vi.mock("../finance.api", () => ({ getTuitionCopyPreview: mocks.preview, copyTuitionPlan: mocks.copy }))

import { CopyTuitionPlanDialog } from "../components/CopyTuitionPlanDialog"

const plan = { totalAmount: 300000, registrationAmount: 50000, currency: "FCFA", scheduleSteps: [{ dueDate: "2026-10-01", cumulativeAmountExpected: 100000 }, { dueDate: "2027-01-10", cumulativeAmountExpected: 300000 }] }
const preview = {
  schoolYearId: "y", schoolYearLabel: "2026-2027",
  source: { levelId: "src", levelName: "6ème", plan },
  targets: [
    { levelId: "blank", levelName: "5ème", existingPlan: null, enrolledStudents: 0, studentsWithIndividualTerms: 0 },
    { levelId: "plan", levelName: "4ème", existingPlan: { ...plan, totalAmount: 90000, scheduleSteps: [] }, enrolledStudents: 0, studentsWithIndividualTerms: 0 },
    { levelId: "enrolled", levelName: "3ème", existingPlan: null, enrolledStudents: 12, studentsWithIndividualTerms: 2 },
  ],
}

const renderDialog = (onCopied = vi.fn()) => {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <CopyTuitionPlanDialog open onOpenChange={vi.fn()} schoolYearId="y" sourceLevelId="src" onCopied={onCopied} />
    </QueryClientProvider>,
  )
  return onCopied
}
const waitLoaded = () => screen.findByText("Copier vers", {}, { timeout: 4000 })

describe("CopyTuitionPlanDialog", () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.preview.mockResolvedValue(preview) })

  it("résume ce qui sera copié (montants, échéances, dates) et l'état de chaque niveau", async () => {
    renderDialog()
    await waitLoaded()
    const source = screen.getByRole("region", { name: "Frais à copier" })
    expect(source).toHaveTextContent("300 000 FCFA par an")
    expect(source).toHaveTextContent("01/10/2026 · cumul attendu 100 000 FCFA")
    expect(source).toHaveTextContent("10/01/2027 · cumul attendu 300 000 FCFA")
    expect(screen.getAllByText("Pas encore de frais")).toHaveLength(2)
    expect(screen.getByText("A déjà des frais")).toBeInTheDocument()
    expect(screen.getByText("12 élèves inscrits")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Copier" })).toBeDisabled()
  })

  it("copie vers un niveau vierge sans aucune confirmation supplémentaire", async () => {
    mocks.copy.mockResolvedValue({ results: [{ levelId: "blank", levelName: "5ème", status: "copied" }], cacheRefreshed: true })
    const onCopied = renderDialog()
    await waitLoaded()
    fireEvent.click(screen.getByRole("checkbox", { name: /5ème/ }))
    fireEvent.click(screen.getByRole("button", { name: "Copier vers 1 niveau" }))
    await waitFor(() => expect(mocks.copy).toHaveBeenCalledWith("src", { schoolYearId: "y", targets: [{ levelId: "blank", overwrite: false, confirmEnrolled: false }] }))
    expect(await screen.findByText("5ème · Copié")).toBeInTheDocument()
    expect(onCopied).toHaveBeenCalled()
  })

  it("n'écrase pas par défaut : l'écrasement exige une case à cocher propre au niveau", async () => {
    renderDialog()
    await waitLoaded()
    fireEvent.click(screen.getByRole("checkbox", { name: /4ème/ }))
    const submit = screen.getByRole("button", { name: "Copier vers 1 niveau" })
    expect(submit).toBeDisabled()
    expect(screen.getByText(/Actuellement : 90 000 FCFA par an/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole("checkbox", { name: /Remplacer les frais actuels de 4ème/ }))
    expect(submit).toBeEnabled()
  })

  it("avertit des élèves inscrits et exige une confirmation, en précisant que les conditions individuelles sont conservées", async () => {
    renderDialog()
    await waitLoaded()
    fireEvent.click(screen.getByRole("checkbox", { name: /3ème/ }))
    const submit = screen.getByRole("button", { name: "Copier vers 1 niveau" })
    expect(submit).toBeDisabled()
    const confirm = screen.getByRole("checkbox", { name: /12 élèves inscrits sur 3ème verront ces frais s’appliquer/ })
    expect(screen.getByText(/2 gardent leur remise ou échéancier négocié/)).toBeInTheDocument()
    fireEvent.click(confirm)
    expect(submit).toBeEnabled()
  })

  it("affiche un résultat par niveau en cas de réussite partielle", async () => {
    mocks.copy.mockResolvedValue({
      results: [
        { levelId: "blank", levelName: "5ème", status: "copied" },
        { levelId: "plan", levelName: "", status: "error", code: "COPY_FAILED", message: "La copie a échoué : rien n’a été modifié pour ce niveau." },
        { levelId: "enrolled", levelName: "3ème", status: "skipped", code: "ENROLLED_CONFIRMATION_REQUIRED", message: "12 élève(s) inscrit(s) sur ce niveau : confirmation requise, rien n’a été modifié." },
      ],
      cacheRefreshed: false,
    })
    renderDialog()
    await waitLoaded()
    fireEvent.click(screen.getByRole("checkbox", { name: /5ème/ }))
    fireEvent.click(screen.getByRole("button", { name: "Copier vers 1 niveau" }))
    expect(await screen.findByText("5ème · Copié")).toBeInTheDocument()
    expect(screen.getByText("4ème · Erreur")).toBeInTheDocument()
    expect(screen.getByText("3ème · Ignoré")).toBeInTheDocument()
    expect(screen.getByText(/indicateurs financiers seront mis à jour avec un léger retard/)).toBeInTheDocument()
  })

  it("propose de réessayer quand les frais ne peuvent pas être chargés", async () => {
    mocks.preview.mockRejectedValueOnce(new Error("x"))
    renderDialog()
    expect(await screen.findByText(/Impossible de charger les frais de ce niveau/, {}, { timeout: 4000 })).toBeInTheDocument()
    mocks.preview.mockResolvedValue(preview)
    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }))
    await waitLoaded()
  })
})
