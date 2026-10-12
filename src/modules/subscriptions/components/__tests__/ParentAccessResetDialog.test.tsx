import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { ParentAccessResetDialog } from "../ParentAccessResetDialog"
import type { SubscriptionListItem } from "@/modules/subscriptions/subscriptions.api"

const { resetMock, statusMock, toastMock } = vi.hoisted(() => ({
  resetMock: vi.fn(), statusMock: vi.fn(), toastMock: vi.fn(),
}))

vi.mock("@/modules/subscriptions/subscriptions.api", async () => {
  const actual = await vi.importActual<typeof import("@/modules/subscriptions/subscriptions.api")>("@/modules/subscriptions/subscriptions.api")
  return { ...actual, resetParentSubscriptionPassword: resetMock, getParentAccessStatuses: statusMock }
})
vi.mock("@/components/ui/use-toast", () => ({ useToast: () => ({ toast: toastMock }) }))

const parent: SubscriptionListItem = {
  parent_id: "11111111-1111-4111-8111-111111111111",
  full_name: "Awa Kouassi",
  phone: "2250700000001",
  email: "awa@example.ci",
  access_sent_at: null,
  created_by: null,
  created_by_name: null,
  latest_subscription: null,
  students: [],
}

const renderDialog = (item = parent, onClose = vi.fn()) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const view = render(
    <QueryClientProvider client={queryClient}>
      <ParentAccessResetDialog parent={item} onClose={onClose} />
    </QueryClientProvider>
  )
  return { ...view, onClose, queryClient }
}

describe("ParentAccessResetDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    statusMock.mockResolvedValue([{ channel: "sms", status: "sent" }, { channel: "email", status: "queued" }])
    resetMock.mockResolvedValue({
      parent_id: parent.parent_id, login: parent.phone, new_temp_password: "SAFE234567",
      rotation_id: "22222222-2222-4222-8222-222222222222",
      channels: [{ channel: "sms", status: "queued" }, { channel: "email", status: "queued" }],
    })
  })

  it("choisit les canaux, soumet une seule fois et montre les états sans cache du secret", async () => {
    const { queryClient } = renderDialog()
    fireEvent.click(screen.getByRole("checkbox", { name: "Envoyer par e-mail" }))
    const submit = screen.getByRole("button", { name: "Réinitialiser et envoyer" })
    fireEvent.click(submit)
    fireEvent.click(submit)
    await screen.findByText("SAFE234567")
    expect(resetMock).toHaveBeenCalledTimes(1)
    expect(resetMock.mock.calls[0]?.[1]).toEqual(["sms", "email"])
    expect(await screen.findByText(/SMS : envoyé/)).toBeInTheDocument()
    expect(JSON.stringify(queryClient.getQueryCache().getAll().map((query) => query.state.data))).not.toContain("SAFE234567")
  })

  it("efface le secret quand le dialogue est fermé", async () => {
    const onClose = vi.fn()
    const view = renderDialog(parent, onClose)
    fireEvent.click(screen.getByRole("button", { name: "Réinitialiser et envoyer" }))
    await screen.findByText("SAFE234567")
    fireEvent.click(screen.getByRole("button", { name: "Fermer et effacer" }))
    expect(onClose).toHaveBeenCalledOnce()
    view.unmount()
    expect(screen.queryByText("SAFE234567")).not.toBeInTheDocument()
  })

  it("permet la remise manuelle si les deux coordonnées sont inutilisables", async () => {
    renderDialog({ ...parent, phone: "", email: null })
    expect(screen.getByRole("checkbox", { name: "Envoyer par SMS" })).toBeDisabled()
    expect(screen.getByRole("checkbox", { name: "Envoyer par e-mail" })).toBeDisabled()
    fireEvent.click(screen.getByRole("button", { name: "Réinitialiser pour copier" }))
    await waitFor(() => expect(resetMock).toHaveBeenCalledWith(parent.parent_id, [], true, expect.any(AbortSignal)))
  })
})
