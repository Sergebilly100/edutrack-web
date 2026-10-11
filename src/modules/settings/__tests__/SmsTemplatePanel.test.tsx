import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { apiClient } from "@/shared/api/client"
import SmsTemplatePanel from "../components/SmsTemplatePanel"

const { toast } = vi.hoisted(() => ({ toast: vi.fn() }))
vi.mock("@/shared/api/client", () => ({ apiClient: { get: vi.fn(), put: vi.fn(), delete: vi.fn() } }))
vi.mock("@/components/ui/use-toast", () => ({ useToast: () => ({ toast }) }))
vi.mock("@/shared/hooks/useStudentLabel", () => ({ useStudentLabels: () => ({ singularLower: "élève" }) }))

const defaultTemplate = {
  enabledBySuperAdmin: true,
  source: "default",
  messageTemplate: "Message système pour une absence",
  variables: [],
  updatedAt: null,
}

function renderPanel(canReadTemplate = true) {
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
    <SmsTemplatePanel canReadTemplate={canReadTemplate} />
  </QueryClientProvider>)
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(apiClient.get).mockResolvedValue({ data: defaultTemplate })
  vi.mocked(apiClient.put).mockResolvedValue({ data: { success: true } })
  vi.mocked(apiClient.delete).mockResolvedValue({ data: { success: true } })
})

describe("modèles SMS de l’école", () => {
  it("explique la désactivation sans requête refusée ni fausse alerte d’erreur", () => {
    renderPanel(false)
    expect(screen.getByText(/La personnalisation des modèles SMS n’est pas activée/)).toBeInTheDocument()
    expect(screen.getByRole("alert")).not.toHaveClass("border-destructive/50")
    expect(apiClient.get).not.toHaveBeenCalled()
    expect(screen.queryByRole("button", { name: "Créer le modèle SMS" })).not.toBeInTheDocument()
  })

  it("présente l’absence de modèle comme un état vide et permet de créer un message", async () => {
    renderPanel()
    expect(await screen.findByText("Aucun modèle SMS personnalisé")).toBeInTheDocument()
    expect(screen.queryByText(/Impossible de charger/)).not.toBeInTheDocument()
    const message = screen.getByRole("textbox", { name: "Texte du SMS d’absence élève" })
    expect(message).toHaveValue(defaultTemplate.messageTemplate)
    fireEvent.click(screen.getByRole("button", { name: "Ajouter un message" }))
    expect(message).toHaveFocus()
    fireEvent.change(message, { target: { value: "Votre enfant est absent aujourd’hui." } })
    fireEvent.click(screen.getByRole("button", { name: "Créer le modèle SMS" }))
    await waitFor(() => expect(apiClient.put).toHaveBeenCalledWith("/notifications/templates/student-absence", {
      message_template: "Votre enfant est absent aujourd’hui.", variables: [],
    }))
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Modèle SMS créé" })))
    expect(screen.queryByRole("button", { name: "Réinitialiser" })).not.toBeInTheDocument()
  })

  it("permet de réinitialiser uniquement un modèle propre à l’école", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { ...defaultTemplate, source: "school" } })
    renderPanel()
    fireEvent.click(await screen.findByRole("button", { name: "Réinitialiser" }))
    await waitFor(() => expect(apiClient.delete).toHaveBeenCalledWith("/notifications/templates/student-absence"))
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Modèle SMS de l’école réinitialisé" })))
  })

  it("sépare le chargement et un vrai refus d’accès, avec nouvelle tentative", async () => {
    vi.mocked(apiClient.get).mockRejectedValueOnce(Object.assign(new Error("Permission requise"), { status: 403 }))
      .mockResolvedValue({ data: defaultTemplate })
    renderPanel()
    expect(screen.getByRole("status")).toHaveAccessibleName("Chargement du modèle SMS")
    expect(await screen.findByText(/L’accès au modèle SMS est refusé/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }))
    expect(await screen.findByText("Aucun modèle SMS personnalisé")).toBeInTheDocument()
    expect(apiClient.get).toHaveBeenCalledTimes(2)
  })
})
