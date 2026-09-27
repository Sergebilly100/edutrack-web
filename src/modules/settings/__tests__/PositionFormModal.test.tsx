import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { apiClient } from "@/shared/api/client"
import PositionFormModal from "../components/PositionFormModal"
import { buildPermissionCatalogue } from "../../../../../edutrack-api/src/modules/permissions/permissions.catalogue"

const { toast } = vi.hoisted(() => ({ toast: vi.fn() }))
vi.mock("@/shared/api/client", () => ({ apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }))
vi.mock("@/components/ui/use-toast", () => ({ useToast: () => ({ toast }) }))

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubGlobal("ResizeObserver", class {
    observe = vi.fn()
    unobserve = vi.fn()
    disconnect = vi.fn()
  })
  vi.mocked(apiClient.get).mockResolvedValue({ data: buildPermissionCatalogue({ canEditSmsTemplate: true, smsEnabled: true, monetizeParentAlerts: true }) })
  vi.mocked(apiClient.post).mockResolvedValue({ data: { position: { id: "post-1", name: "Poste", permissions: [] } } })
  vi.mocked(apiClient.put).mockResolvedValue({ data: { position: { id: "post-1", name: "Poste", permissions: [] } } })
})
afterEach(() => vi.unstubAllGlobals())

function renderForm(initialPosition?: { id: string; name: string; permissions: string[] }) {
  const onOpenChange = vi.fn()
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
    <PositionFormModal open onOpenChange={onOpenChange} initialPosition={initialPosition} />
  </QueryClientProvider>)
  return onOpenChange
}

describe("sauvegarde du poste avec catalogue", () => {
  it("sauvegarde une sélection complète et affiche une confirmation", async () => {
    const onOpenChange = renderForm()
    fireEvent.click(await screen.findByRole("button", { name: "Permissions : Paiements" }))
    await screen.findByRole("checkbox", { name: "Annuler un paiement" })
    fireEvent.change(screen.getByLabelText("Nom du poste"), { target: { value: "Censeur" } })
    fireEvent.click(screen.getByRole("checkbox", { name: "Annuler un paiement" }))
    fireEvent.click(screen.getByRole("button", { name: "Créer le poste" }))
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith("/permissions/positions", { name: "Censeur", permissions: ["payments.cancel", "payments.view"] }))
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Poste créé" })))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("reproduit exactement le message métier de l’exclusivité conduct.finalize", async () => {
    const message = "Cette permission est déjà attribuée au poste Éducateur, retirez-la d'abord avant de l'attribuer à un autre poste"
    // ApiError transmet ce message dans Error.message dans l’application réelle.
    vi.mocked(apiClient.post).mockRejectedValue(Object.assign(new Error(message), { status: 409, code: "CONDUCT_FINALIZE_ALREADY_HELD" }))
    const onOpenChange = renderForm()
    fireEvent.click(await screen.findByRole("button", { name: "Permissions : Conduite" }))
    fireEvent.click(await screen.findByRole("checkbox", { name: "Finaliser les notes de conduite" }))
    fireEvent.change(screen.getByLabelText("Nom du poste"), { target: { value: "Surveillant" } })
    fireEvent.click(screen.getByRole("button", { name: "Créer le poste" }))
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ description: message, variant: "destructive" })))
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it("renomme un poste avec attribution inactive sans envoyer une nouvelle sélection", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: buildPermissionCatalogue({ canEditSmsTemplate: false, smsEnabled: false, monetizeParentAlerts: false }) })
    renderForm({ id: "post-1", name: "Ancien nom", permissions: ["subscriptions.view"] })
    fireEvent.click(await screen.findByRole("button", { name: "Permissions : Abonnements parents" }))
    await screen.findByRole("checkbox", { name: "Voir les abonnements parents" })
    fireEvent.change(screen.getByLabelText("Nom du poste"), { target: { value: "Nouveau nom" } })
    fireEvent.click(screen.getByRole("button", { name: "Mettre à jour" }))
    await waitFor(() => expect(apiClient.put).toHaveBeenCalledWith("/permissions/positions/post-1", { name: "Nouveau nom" }))
  })

  it("bloque la soumission si le catalogue est refusé", async () => {
    vi.mocked(apiClient.get).mockRejectedValue({ isAxiosError: true, response: { status: 403 } })
    renderForm()
    expect(await screen.findByRole("alert")).toHaveTextContent("Votre poste ne permet pas")
    expect(screen.getByRole("button", { name: "Créer le poste" })).toBeDisabled()
    expect(apiClient.post).not.toHaveBeenCalled()
  })
});
