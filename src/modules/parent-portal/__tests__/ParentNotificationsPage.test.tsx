import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"
import { beforeEach, expect, it, vi } from "vitest"

const api = vi.hoisted(() => ({
  notifications: vi.fn(),
  markRead: vi.fn(),
}))
vi.mock("../parent.api", () => ({
  listParentNotifications: api.notifications,
  markParentNotificationRead: api.markRead,
  markAllParentNotificationsRead: vi.fn(),
}))

import ParentNotificationsPage from "../ParentNotificationsPage"

function PaymentsRoute() {
  const location = useLocation()
  return <p>Payments student: {new URLSearchParams(location.search).get("student")}</p>
}

beforeEach(() => {
  api.notifications.mockReset()
  api.markRead.mockReset()
  api.notifications.mockResolvedValue({
    notifications: [{
      id: "notification-one",
      type: "payment_reminder",
      message: "Un versement est attendu.",
      createdAt: "2026-10-20T09:00:00.000Z",
      readAt: null,
      studentId: "student-target",
      studentName: "Awa",
    }],
    unreadCount: 1,
  })
  api.markRead.mockResolvedValue(undefined)
})

it("redirige une relance financière vers le paiement de l’enfant concerné", async () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const view = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/parent/notifications"]}>
        <Routes>
          <Route path="/parent/notifications" element={<ParentNotificationsPage />} />
          <Route path="/parent/payments" element={<PaymentsRoute />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )

  try {
    fireEvent.click(await screen.findByRole("button", { name: /Rappel de scolarité/ }))
    expect(await screen.findByText("Payments student: student-target")).toBeInTheDocument()
    expect(api.markRead.mock.calls[0]?.[0]).toBe("notification-one")
  } finally {
    view.unmount()
    queryClient.clear()
  }
})
