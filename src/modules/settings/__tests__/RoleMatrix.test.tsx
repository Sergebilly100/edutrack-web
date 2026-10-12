import { useState } from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { apiClient } from "@/shared/api/client"
import RoleMatrix from "../components/RoleMatrix"
import { buildPermissionCatalogue } from "../../../../../edutrack-api/src/modules/permissions/permissions.catalogue"
import { PERMISSION_KEYS } from "../../../../../edutrack-api/src/modules/permissions/permissions.types"

vi.mock("@/shared/api/client", () => ({ apiClient: { get: vi.fn() } }))
const catalogue = (enabled = true) => buildPermissionCatalogue({
  canEditSmsTemplate: enabled, smsEnabled: enabled, monetizeParentAlerts: enabled,
})

async function openDomain(label: string) {
  fireEvent.click(await screen.findByRole("button", { name: `Permissions : ${label}` }))
}

function renderMatrix(initial: string[] = []) {
  const onChange = vi.fn()
  function ControlledMatrix() {
    const [permissions, setPermissions] = useState(initial)
    return <RoleMatrix position={{ permissions }} onChange={(next) => { onChange(next); setPermissions(next) }} />
  }
  const rendered = render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <ControlledMatrix />
  </QueryClientProvider>)
  return { ...rendered, onChange }
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(apiClient.get).mockResolvedValue({ data: catalogue() })
})

describe("RoleMatrix issue du contrat backend", () => {
  it("représente toutes les clés backend exactement une fois et préserve présence et annulation", async () => {
    const { container } = renderMatrix()
    for (const label of new Set(catalogue().permissions.map((entry) => entry.domainLabel))) await openDomain(label)
    const renderedKeys = [...container.querySelectorAll("[data-permission-key]")].map((row) => row.getAttribute("data-permission-key"))
    expect(renderedKeys).toEqual(PERMISSION_KEYS)
    expect(new Set(renderedKeys).size).toBe(PERMISSION_KEYS.length)
    for (const key of ["attendance.view", "attendance.mark_students", "payments.cancel"]) {
      expect(renderedKeys.filter((rendered) => rendered === key)).toHaveLength(1)
    }
    expect(apiClient.get).toHaveBeenCalledWith("/permissions/catalogue")
    expect(apiClient.get).toHaveBeenCalledTimes(1)
  })

  it("replie les domaines sans modifier les droits et garde les sélections collectives indépendantes", async () => {
    const { onChange } = renderMatrix(["attendance.view"])
    const trigger = await screen.findByRole("button", { name: "Permissions : Présences" })
    expect(trigger).toHaveAttribute("aria-expanded", "false")
    expect(trigger).toHaveTextContent("1/2")
    expect(screen.queryByRole("checkbox", { name: "Voir les présences" })).not.toBeInTheDocument()
    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByRole("checkbox", { name: "Voir les présences" })).toBeChecked()
    fireEvent.click(trigger)
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("checkbox", { name: "Tout sélectionner Présences" }))
    expect(trigger).toHaveAttribute("aria-expanded", "false")
    expect(trigger).toHaveTextContent("2/2")
    expect(onChange).toHaveBeenLastCalledWith(["attendance.mark_students", "attendance.view"])
    fireEvent.click(trigger)
    expect(screen.getByRole("checkbox", { name: "Marquer les présences des élèves" })).toBeChecked()
    await openDomain("Paiements")
    expect(trigger).toHaveAttribute("aria-expanded", "true")
  })

  it("affiche les dépendances des droits indisponibles sans les cocher ni perdre les attributions historiques", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: catalogue(false) })
    const { onChange } = renderMatrix(["subscriptions.view", "attendance.view"])
    const trigger = await screen.findByRole("button", { name: "Permissions : Abonnements parents" })
    expect(trigger).toHaveTextContent("7 droits indisponibles")
    await openDomain("Abonnements parents")
    await openDomain("Modèles SMS")
    const subscription = await screen.findByRole("checkbox", { name: "Voir les abonnements parents" })
    expect(subscription).toBeDisabled()
    expect(subscription).not.toBeChecked()
    expect(screen.getByRole("checkbox", { name: "Modifier les modèles SMS" })).toBeDisabled()
    expect(screen.getAllByText(/Le service Alertes Parents doit être activé/)).toHaveLength(7)
    expect(screen.getByText(/Attribution enregistrée, service indisponible/)).toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("checkbox", { name: "Tout sélectionner Présences" }))
    expect(onChange).toHaveBeenLastCalledWith(["attendance.mark_students", "attendance.view", "subscriptions.view"])
    fireEvent.click(screen.getByRole("button", { name: "Retirer Voir les abonnements parents" }))
    expect(onChange).toHaveBeenLastCalledWith(["attendance.mark_students", "attendance.view"])
  })

  it("préserve les dépendances de lecture et déduplique les sélections de domaine", async () => {
    const { onChange } = renderMatrix()
    await openDomain("Présences")
    const mark = await screen.findByRole("checkbox", { name: "Marquer les présences des élèves" })
    fireEvent.click(mark)
    expect(onChange).toHaveBeenLastCalledWith(["attendance.mark_students", "attendance.view"])
    expect(screen.getByRole("checkbox", { name: "Voir les présences" })).toBeDisabled()
    fireEvent.click(screen.getByRole("checkbox", { name: "Tout sélectionner Présences" }))
    expect(onChange).toHaveBeenLastCalledWith([])
    fireEvent.click(screen.getByRole("checkbox", { name: "Tout sélectionner Paiements" }))
    expect(onChange).toHaveBeenLastCalledWith(["payments.cancel", "payments.record", "payments.view"])
  })

  it("permet de déléguer la correction publiée avec les droits de lecture et publication", async () => {
    const { onChange } = renderMatrix()
    await openDomain("Bulletins")
    const correction = screen.getByRole("checkbox", { name: "Autoriser une correction exceptionnelle après publication" })
    expect(correction).toBeEnabled()
    fireEvent.click(correction)
    expect(onChange).toHaveBeenLastCalledWith([
      "report_cards.publish", "report_cards.published_correction", "report_cards.view",
    ])
  })

  it("affiche automatiquement une nouvelle entrée du catalogue reçu", async () => {
    const data = catalogue()
    vi.mocked(apiClient.get).mockResolvedValue({ data: {
      ...data, permissions: [...data.permissions, {
        key: "future.review", domain: "future", domainLabel: "Nouveau domaine", label: "Vérifier une nouvelle action",
        available: true, unavailableReason: null, activationDependencies: [], requiredPermissions: [],
      }],
    } })
    const { onChange } = renderMatrix()
    await openDomain("Nouveau domaine")
    fireEvent.click(await screen.findByRole("checkbox", { name: "Vérifier une nouvelle action" }))
    expect(onChange).toHaveBeenCalledWith(["future.review"])
  })

  it("rend l’état de chargement sans mutation", () => {
    vi.mocked(apiClient.get).mockImplementation(() => new Promise(() => {}))
    const { onChange } = renderMatrix(["attendance.view"])
    expect(screen.getByRole("status")).toHaveAccessibleName("Chargement du catalogue des permissions")
    expect(onChange).not.toHaveBeenCalled()
  })

  it("rend l’état vide sans effacer le rôle", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { version: 1, permissions: [] } })
    const { onChange } = renderMatrix(["attendance.view"])
    expect(await screen.findByText("Aucune permission disponible")).toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })

  it("signale un 403 sans repli vers les paramètres SMS ou les postes", async () => {
    vi.mocked(apiClient.get).mockRejectedValue({ isAxiosError: true, response: { status: 403 } })
    const { onChange } = renderMatrix()
    expect(await screen.findByRole("alert")).toHaveTextContent("Votre poste ne permet pas de consulter ou gérer les permissions.")
    expect(apiClient.get).toHaveBeenCalledTimes(1)
    expect(onChange).not.toHaveBeenCalled()
    vi.mocked(apiClient.get).mockResolvedValue({ data: catalogue() })
    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }))
    await openDomain("Présences")
    await screen.findByRole("checkbox", { name: "Voir les présences" })
    await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(2))
  })

  it("refuse un catalogue dupliqué au lieu de présenter une matrice ambiguë", async () => {
    const data = catalogue()
    vi.mocked(apiClient.get).mockResolvedValue({ data: { ...data, permissions: [...data.permissions, data.permissions[0]] } })
    renderMatrix()
    expect(await screen.findByRole("alert")).toHaveTextContent("Impossible de charger le catalogue")
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument()
  })

  it("reconnaît aussi le 403 enveloppé par le client HTTP de l’application", async () => {
    vi.mocked(apiClient.get).mockRejectedValue(Object.assign(new Error("Permission requise"), { status: 403, code: "FORBIDDEN" }))
    renderMatrix()
    expect(await screen.findByRole("alert")).toHaveTextContent("Votre poste ne permet pas")
  })
});
