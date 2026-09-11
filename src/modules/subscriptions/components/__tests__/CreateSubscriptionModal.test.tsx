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

const createQueryClient = () => new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
})

const renderModal = (queryClient = createQueryClient()) => {
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

    fireEvent.change(screen.getByLabelText("Rechercher un parent lié à un élève"), { target: { value: "Awa" } })
    fireEvent.click(await screen.findByRole("button", { name: /Awa Kouassi/ }))
    fireEvent.click(screen.getByRole("button", { name: "Continuer" }))

    expect(await screen.findByText("Classe (vous pouvez changer à tout moment)")).toBeInTheDocument()
  })

  it("ne recherche ni n’affiche de parent avant une saisie", () => {
    renderModal()

    expect(listParentsMock).not.toHaveBeenCalled()
    expect(screen.queryByRole("button", { name: /Awa Kouassi/ })).not.toBeInTheDocument()
    expect(screen.queryByText("Aucun parent sans abonnement trouvé. Choisissez « Ajouter un autre parent »."))
      .not.toBeInTheDocument()
  })

  it("n’affiche pas un parent mis en cache avant une saisie", () => {
    const queryClient = createQueryClient()
    queryClient.setQueryData(["subscriptions", "parents", "create-modal", ""], {
      data: [
        {
          parent_id: "cached-parent",
          full_name: "Parent Mis En Cache",
          phone: "2250700000002",
          email: null,
          access_sent_at: null,
          created_by: null,
          created_by_name: null,
          latest_subscription: null,
          students: [{ id: "student-cached", full_name: "Élève Mis En Cache" }],
        },
      ],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      schemaName: "school_test",
    })

    renderModal(queryClient)

    expect(screen.queryByRole("button", { name: /Parent Mis En Cache/ })).not.toBeInTheDocument()
    expect(listParentsMock).not.toHaveBeenCalled()
  })

  it("permet de saisir un parent différent sans bloquer son numéro côté client", async () => {
    renderModal()

    fireEvent.click(screen.getByRole("button", { name: "Ajouter un autre parent" }))
    fireEvent.change(screen.getByLabelText("Nom complet"), { target: { value: "Autre Parent" } })
    fireEvent.change(screen.getByLabelText("Téléphone"), { target: { value: "2250700000001" } })

    expect(screen.getByRole("button", { name: "Continuer" })).toBeEnabled()
    expect(screen.queryByText(/Utiliser Renouveler/i)).not.toBeInTheDocument()
  })

  it("attend une saisie avant d’afficher les erreurs du nouveau parent", () => {
    renderModal()

    fireEvent.click(screen.getByRole("button", { name: "Ajouter un autre parent" }))

    expect(screen.queryByText("Minimum 2 caractères requis.")).not.toBeInTheDocument()
    expect(screen.queryByText("Format requis: 225 + 10 chiffres.")).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText("Nom complet"), { target: { value: "A" } })
    fireEvent.change(screen.getByLabelText("Téléphone"), { target: { value: "225" } })

    expect(screen.getByText("Minimum 2 caractères requis.")).toBeInTheDocument()
    expect(screen.getByText("Format requis: 225 + 10 chiffres.")).toBeInTheDocument()
  })
})
