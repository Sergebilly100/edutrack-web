import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import CreateSubscriptionModal from "../CreateSubscriptionModal"

const { listParentsMock, listClassesMock, listStudentsMock } = vi.hoisted(() => ({
  listParentsMock: vi.fn(),
  listClassesMock: vi.fn(),
  listStudentsMock: vi.fn(),
}))

vi.mock("@/modules/subscriptions/subscriptions.api", async () => {
  const actual = await vi.importActual<typeof import("@/modules/subscriptions/subscriptions.api")>(
    "@/modules/subscriptions/subscriptions.api"
  )
  return {
    ...actual,
    listSubscriptionParents: listParentsMock,
    listSubscriptionClasses: listClassesMock,
    listSubscriptionClassStudents: listStudentsMock,
  }
})

const renderModal = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <CreateSubscriptionModal
        open
        onOpenChange={vi.fn()}
        smsUnitPriceFcfa={500}
        onSubmit={vi.fn()}
      />
    </QueryClientProvider>
  )
}

describe("CreateSubscriptionModal", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listClassesMock.mockResolvedValue([{ id: "class-1", name: "6e A", students_count: 1 }])
    listStudentsMock.mockResolvedValue({ data: [], pagination: { page: 1, limit: 25, total: 0, totalPages: 0 } })
    listParentsMock.mockResolvedValue({
      data: [
        {
          parent_id: "parent-1",
          full_name: "Awa Kouassi",
          phone: "2250700000001",
          email: null,
          access_sent_at: null,
          created_by: null,
          created_by_name: null,
          latest_subscription: null,
          students: [{ id: "student-1", full_name: "Yao Kouassi" }],
        },
      ],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      schemaName: "school_test",
    })
  })

  it("permet de sélectionner un parent déjà lié à un élève", async () => {
    renderModal()

    fireEvent.click(await screen.findByRole("button", { name: /Awa Kouassi/ }))
    fireEvent.click(screen.getByRole("button", { name: "Continuer" }))

    expect(await screen.findByText("Classe (vous pouvez changer à tout moment)")).toBeInTheDocument()
  })

  it("permet de saisir un parent différent sans bloquer son numéro côté client", async () => {
    renderModal()

    fireEvent.click(screen.getByRole("button", { name: "Ajouter un autre parent" }))
    fireEvent.change(screen.getByLabelText("Nom complet"), { target: { value: "Autre Parent" } })
    fireEvent.change(screen.getByLabelText("Téléphone"), { target: { value: "2250700000001" } })

    expect(screen.getByRole("button", { name: "Continuer" })).toBeEnabled()
    expect(screen.queryByText(/Utiliser Renouveler/i)).not.toBeInTheDocument()
  })
})
