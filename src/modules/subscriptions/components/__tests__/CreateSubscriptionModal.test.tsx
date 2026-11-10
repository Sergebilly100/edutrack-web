import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
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
    listEnrolledParents: listParentsMock,
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
          phone: "2250700000001", full_name: "Awa Kouassi", email: null, subscription: null,
          students: [{ id: "student-1", full_name: "Yao Kouassi", class_name: "6e A", matricule: "M-001" }, { id: "student-2", full_name: "Mia Kouassi", class_name: "4e B", matricule: null }],
        },
        {
          phone: "2250700000002", full_name: "Koné Ibrahim", email: null,
          subscription: { id: "sub-1", parent_id: "parent-2", status: "active", ends_at: "2026-12-31" },
          students: [{ id: "student-3", full_name: "Fatou Koné", class_name: "6e A", matricule: "M-003" }],
        },
      ],
      pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
    })
  })

  it("cherche dans les parents des élèves inscrits, affiche leurs enfants (classe) une seule fois", async () => {
    renderModal()

    fireEvent.change(screen.getByLabelText("Rechercher un parent lié à un élève"), { target: { value: "Awa" } })
    const parent = await screen.findByRole("button", { name: /Awa Kouassi/ }, { timeout: 2000 })
    expect(listParentsMock).toHaveBeenLastCalledWith(expect.objectContaining({ search: "Awa" }))
    expect(parent).toHaveTextContent("Yao Kouassi (6e A · M-001)")
    expect(parent).toHaveTextContent("Mia Kouassi (4e B)")
    expect(screen.getAllByRole("button", { name: /Awa Kouassi/ })).toHaveLength(1)
    fireEvent.click(parent)
    fireEvent.click(screen.getByRole("button", { name: "Continuer" }))

    expect(await screen.findByText("Classe (vous pouvez changer à tout moment)")).toBeInTheDocument()
  })

  it("un parent déjà abonné affiche l’indicateur et un lien, sans pouvoir être sélectionné (pas de doublon)", async () => {
    const onViewExisting = vi.fn()
    render(<QueryClientProvider client={createQueryClient()}>
      <CreateSubscriptionModal open onOpenChange={vi.fn()} smsUnitPriceFcfa={500} onSubmit={vi.fn()} onViewExisting={onViewExisting} />
    </QueryClientProvider>)

    fireEvent.change(screen.getByLabelText("Rechercher un parent lié à un élève"), { target: { value: "kone" } })
    expect(await screen.findByText("Abonnement actif", {}, { timeout: 2000 })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Koné Ibrahim/ })).toBeDisabled()
    fireEvent.click(screen.getByRole("button", { name: "Voir l’abonnement" }))
    expect(onViewExisting).toHaveBeenCalledWith("2250700000002")
  })

  it("plafonne la durée aux mois restants de l’année scolaire", async () => {
    render(<QueryClientProvider client={createQueryClient()}>
      <CreateSubscriptionModal open onOpenChange={vi.fn()} smsUnitPriceFcfa={500} onSubmit={vi.fn()} maxDurationMonths={2} schoolYearLabel="2025-2026" />
    </QueryClientProvider>)
    fireEvent.click(screen.getByRole("button", { name: "Ajouter un autre parent" }))
    fireEvent.change(screen.getByLabelText("Nom complet"), { target: { value: "Autre Parent" } })
    fireEvent.change(screen.getByLabelText("Téléphone"), { target: { value: "2250700000009" } })
    fireEvent.click(screen.getByRole("button", { name: "Continuer" }))
    const duration = await screen.findByRole("spinbutton")
    expect(duration).toHaveAttribute("max", "2")
    fireEvent.change(duration, { target: { value: "9" } })
    expect(duration).toHaveValue(2)
    expect(screen.getByText(/1 à 2, jusqu’à la fin de l’année scolaire 2025-2026/)).toBeInTheDocument()
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
