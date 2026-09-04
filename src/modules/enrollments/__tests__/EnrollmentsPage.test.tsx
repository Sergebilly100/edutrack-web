import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  listEnrollments: vi.fn(),
  listClassDecisions: vi.fn(),
  listSchoolYears: vi.fn(),
  listClasses: vi.fn(),
}))

vi.mock("../enrollments.api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../enrollments.api")>()),
  listEnrollments: mocks.listEnrollments,
  createEnrollment: vi.fn(),
}))
vi.mock("@/modules/class-decisions/class-decisions.api", () => ({
  listClassDecisions: mocks.listClassDecisions,
}))
vi.mock("@/modules/academic/academic.api", () => ({
  listSchoolYears: mocks.listSchoolYears,
  listClasses: mocks.listClasses,
}))
vi.mock("@/shared/hooks/usePermissions", () => ({
  usePermissions: () => ({ hasPermission: () => true }),
}))
vi.mock("@/components/ui/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }))

import EnrollmentsPage from "../EnrollmentsPage"

const enrollment = (id: string, firstName: string) => ({
  id,
  studentId: `student-${id}`,
  studentFirstName: firstName,
  studentLastName: "Koné",
  classId: "class-1",
  className: "6e A",
  schoolYearId: "year-1",
  schoolYearLabel: "2026-2027",
  type: "new_registration" as const,
  status: "pending_cashier" as const,
  enrolledAt: "2026-09-01T08:00:00.000Z",
  confirmedByUserId: null,
  documentStatus: "incomplete" as const,
  missingMandatoryDocumentCount: 1,
})

describe("EnrollmentsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.listClassDecisions.mockResolvedValue({ decisions: [] })
    mocks.listSchoolYears.mockResolvedValue([])
    mocks.listClasses.mockResolvedValue({ classes: [] })
    mocks.listEnrollments.mockImplementation(({ page = 1 }: { page?: number }) => Promise.resolve({
      enrollments: [page === 1 ? enrollment("1", "Awa") : enrollment("2", "Aya")],
      pagination: { page, limit: 20, total: 21, totalPages: 2 },
    }))
  })

  it("affiche les dossiers dans un tableau paginé", async () => {
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter><EnrollmentsPage /></MemoryRouter>
      </QueryClientProvider>,
    )

    expect(await screen.findByRole("table")).toBeInTheDocument()
    expect(screen.getByText("Koné Awa")).toBeInTheDocument()
    expect(screen.getByText("Page 1 sur 2, 21 dossiers")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Suivant" }))

    expect(await screen.findByText("Koné Aya")).toBeInTheDocument()
    await waitFor(() => expect(mocks.listEnrollments).toHaveBeenCalledWith({ page: 2, limit: 20 }))
  })

  it("ne plante pas quand une ancienne donnée imbriquée subsiste dans le cache", async () => {
    mocks.listEnrollments.mockResolvedValueOnce({
      enrollments: {
        enrollments: [enrollment("legacy", "Adjoua")],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      },
    })

    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter><EnrollmentsPage /></MemoryRouter>
      </QueryClientProvider>,
    )

    expect(await screen.findByText("Koné Adjoua")).toBeInTheDocument()
    expect(screen.getByRole("table")).toBeInTheDocument()
  })
})
