import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  permissions: ["report_cards.view", "report_cards.publish"] as string[],
  listClaims: vi.fn(), createClaim: vi.fn(), decideClaim: vi.fn(),
  listVersions: vi.fn(), listAudit: vi.fn(), listStudents: vi.fn(),
}))

vi.mock("@/shared/hooks/usePermissions", () => ({
  usePermissions: () => ({ hasPermission: (key: string) => mocks.permissions.includes(key) }),
}))
vi.mock("@/components/ui/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock("@/modules/academic/academic.api", () => ({
  listSchoolYears: vi.fn().mockResolvedValue([{ id: "year-1", label: "2026–2027", status: "active" }]),
  listGradingPeriods: vi.fn().mockResolvedValue([{ id: "period-1", schoolYearId: "year-1", label: "Trimestre 1" }]),
  listGradingPeriodsForYear: vi.fn().mockResolvedValue([{ id: "period-1", schoolYearId: "year-1", label: "Trimestre 1" }]),
  listClasses: vi.fn().mockResolvedValue({ classes: [{ id: "class-1", name: "6ème A", schoolYear: { id: "year-1" }, level: { id: "level-1" } }] }),
  listReportCardClasses: vi.fn().mockResolvedValue([{ id: "class-1", name: "6ème A", isActive: true, level: { id: "level-1" } }]),
  listSubjects: vi.fn().mockResolvedValue([{ id: "subject-1", name: "Mathématiques", levelId: "level-1" }]),
  listReportCardClaims: (...args: unknown[]) => mocks.listClaims(...args),
  listReportCardClaimStudents: (...args: unknown[]) => mocks.listStudents(...args),
  createReportCardClaim: (...args: unknown[]) => mocks.createClaim(...args),
  decideReportCardClaim: (...args: unknown[]) => mocks.decideClaim(...args),
  listReportCardVersions: (...args: unknown[]) => mocks.listVersions(...args),
  listReportCardAcademicAudit: (...args: unknown[]) => mocks.listAudit(...args),
}))

import ReportCardClaimsPage from "@/modules/academic/ReportCardClaimsPage"

const claim = {
  id: "claim-1", class_id: "class-1", class_name: "6ème A", subject_id: "subject-1",
  student_id: "student-1", student_name: "Aya Test",
  subject_name: "Mathématiques", grading_period_id: "period-1", school_year_id: "year-1",
  status: "pending_exceptional_authorization", phase: "published", reason: "La note de devoir est erronée",
  requested_by_user_id: "user-1", decided_by_user_id: null, decision_reason: null,
  created_at: "2026-10-01T00:00:00Z", decided_at: null, revalidated_at: null,
  regenerated_at: null, republished_at: null,
}

const renderPage = () => render(<MemoryRouter initialEntries={["/academic/report-card-claims?schoolYearId=year-1&gradingPeriodId=period-1&classId=class-1&subjectId=subject-1"]}>
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <ReportCardClaimsPage />
  </QueryClientProvider>
</MemoryRouter>)

describe("ReportCardClaimsPage", () => {
  beforeAll(() => {
    Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: vi.fn() })
  })
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.permissions = ["report_cards.view", "report_cards.publish"]
    mocks.listClaims.mockResolvedValue([claim])
    mocks.createClaim.mockResolvedValue({ id: "claim-2" })
    mocks.decideClaim.mockResolvedValue({ status: "approved" })
    mocks.listVersions.mockResolvedValue([])
    mocks.listAudit.mockResolvedValue([])
    mocks.listStudents.mockResolvedValue([{ id: "student-1", fullName: "Aya Test" }])
  })

  it("annonce l'impact publié sans offrir le déverrouillage à un poste ordinaire", async () => {
    renderPage()
    expect(await screen.findByText("Autorisation exceptionnelle requise")).toBeInTheDocument()
    expect(screen.getByText("Élève concerné : Aya Test")).toBeInTheDocument()
    expect(screen.getByText(/retirera tous les bulletins publiés/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText("Motif de la décision"), { target: { value: "Erreur confirmée par contrôle" } })
    expect(screen.getByRole("button", { name: "Approuver et ouvrir la correction" })).toBeDisabled()
    expect(mocks.listVersions).not.toHaveBeenCalled()
  })

  it("permet au censeur délégué d'approuver avec un motif", async () => {
    mocks.permissions.push("report_cards.published_correction")
    renderPage()
    expect(await screen.findByText("Autorisation exceptionnelle requise")).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText("Motif de la décision"), { target: { value: "Erreur confirmée par contrôle" } })
    fireEvent.click(screen.getByRole("button", { name: "Approuver et ouvrir la correction" }))
    await waitFor(() => expect(mocks.decideClaim).toHaveBeenCalledWith("claim-1", {
      decision: "approved", reason: "Erreur confirmée par contrôle",
    }))
    expect(mocks.listVersions).toHaveBeenCalled()
  })

  it("exige un motif détaillé pour ouvrir la réclamation", async () => {
    mocks.listClaims.mockResolvedValue([])
    renderPage()
    expect(await screen.findByText("Aucune réclamation")).toBeInTheDocument()
    const button = screen.getByRole("button", { name: "Ouvrir la réclamation" })
    expect(button).toBeDisabled()
    fireEvent.change(screen.getByLabelText("Motif détaillé"), { target: { value: "Erreur sur la note finale" } })
    await waitFor(() => expect(button).toBeEnabled())
    fireEvent.click(button)
    await waitFor(() => expect(mocks.createClaim).toHaveBeenCalledWith({
      classId: "class-1", subjectId: "subject-1", gradingPeriodId: "period-1", reason: "Erreur sur la note finale",
      studentId: undefined,
    }))
  })
})
