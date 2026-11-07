import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  listStudents: vi.fn(),
  getParentAccessMode: vi.fn(),
  sendPendingStudentParentAccess: vi.fn(),
  toast: vi.fn(),
  permissions: new Set<string>(),
}))

vi.mock("@/modules/students/students.api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/students/students.api")>()
  return {
    ...actual,
    listStudents: mocks.listStudents,
    getParentAccessMode: mocks.getParentAccessMode,
    sendPendingStudentParentAccess: mocks.sendPendingStudentParentAccess,
  }
})
vi.mock("@/components/ui/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }))
vi.mock("@/shared/hooks/usePermissions", () => ({
  usePermissions: () => ({ hasPermission: (permission: string) => mocks.permissions.has(permission) }),
}))
vi.mock("@/shared/hooks/useTourGuide", () => ({
  useTourGuide: () => ({
    run: false,
    stepIndex: 0,
    setStepIndex: vi.fn(),
    markDone: vi.fn(),
    restart: vi.fn(),
  }),
}))
vi.mock("@/shared/store/auth.store", () => ({
  isStaffRole: () => false,
  useAuthStore: (selector: (state: { user: { role: string } }) => unknown) =>
    selector({ user: { role: "director" } }),
}))
vi.mock("@/shared/hooks/useStudentLabel", () => ({
  useStudentLabels: () => ({ plural: "Élèves", pluralLower: "élèves", singular: "Élève", singularLower: "élève" }),
}))
vi.mock("@/shared/components/HomeroomTeacherReminder", () => ({ HomeroomTeacherReminder: () => null }))

import StudentsPage from "../StudentsPage"

const renderPage = () => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={["/students"]}>
      <StudentsPage />
    </MemoryRouter>
  </QueryClientProvider>,
)

describe("StudentsPage parent access dispatch", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.permissions.clear()
    mocks.permissions.add("students.view")
    mocks.permissions.add("students.edit")
    mocks.listStudents.mockResolvedValue({
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    })
    mocks.getParentAccessMode.mockResolvedValue({ available: true })
    mocks.sendPendingStudentParentAccess.mockResolvedValue({
      queued: 1,
      items: [
        { parentId: "parent-1", status: "queued" },
        { parentId: "parent-2", status: "already_sent" },
        { parentId: "parent-3", status: "not_found" },
        { parentId: "parent-4", status: "failed" },
      ],
    })
  })

  it("affiche les résultats par statut après l’envoi groupé", async () => {
    renderPage()

    const sendButton = await screen.findByRole("button", { name: "Envoyer les accès parents en attente" })
    fireEvent.click(sendButton)

    expect(await screen.findByText(/1 en file · 1 déjà transmis · 1 introuvable\(s\) · 1 échec\(s\)/)).toBeInTheDocument()
    expect(mocks.sendPendingStudentParentAccess).toHaveBeenCalledOnce()
  })

  it("indique quand aucun compte parent éligible n’a été trouvé", async () => {
    mocks.sendPendingStudentParentAccess.mockResolvedValue({ queued: 0, items: [] })
    renderPage()

    fireEvent.click(await screen.findByRole("button", { name: "Envoyer les accès parents en attente" }))

    expect(await screen.findByText("Aucun compte parent éligible n’est lié à un élève confirmé.")).toBeInTheDocument()
  })

  it("n’affiche pas l’action avant la disponibilité du mode et bloque en chargement", async () => {
    let resolveMode: ((value: { available: boolean }) => void) | undefined
    mocks.getParentAccessMode.mockImplementation(
      () => new Promise((resolve) => { resolveMode = resolve }),
    )
    renderPage()

    expect(screen.queryByRole("button", { name: "Envoyer les accès parents en attente" })).not.toBeInTheDocument()
    resolveMode?.({ available: true })
    expect(await screen.findByRole("button", { name: "Envoyer les accès parents en attente" })).toBeInTheDocument()
  })

  it("montre un feedback explicite si le mode gratuit est indisponible", async () => {
    mocks.getParentAccessMode.mockResolvedValue({ available: false })
    renderPage()

    await waitFor(() => expect(mocks.getParentAccessMode).toHaveBeenCalledOnce())
    expect(screen.queryByRole("button", { name: "Envoyer les accès parents en attente" })).not.toBeInTheDocument()
  })

  it("signale une erreur de chargement du mode parent", async () => {
    mocks.getParentAccessMode.mockRejectedValue(new Error("network"))
    renderPage()

    expect(await screen.findByText("Impossible de vérifier le mode d’accès parent.")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Envoyer les accès parents en attente" })).not.toBeInTheDocument()
  })
})
