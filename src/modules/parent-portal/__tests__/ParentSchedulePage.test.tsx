import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import ParentSchedulePage from "../ParentSchedulePage"

const { listStudentsMock, getScheduleMock, getSubscriptionStatusMock } = vi.hoisted(() => ({
  listStudentsMock: vi.fn(),
  getScheduleMock: vi.fn(),
  getSubscriptionStatusMock: vi.fn(),
}))

vi.mock("@/modules/parent-portal/parent.api", () => ({
  listParentStudents: listStudentsMock,
  getParentSchedule: getScheduleMock,
  getParentSubscriptionStatus: getSubscriptionStatusMock,
}))

describe("ParentSchedulePage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    listStudentsMock.mockResolvedValue([
      { id: "student-1", first_name: "Yao", last_name: "Kouassi", class_name: "6e A" },
    ])
    getScheduleMock.mockResolvedValue({
      week_label: "Semaine courante",
      days: [
        {
          day: "2026-08-17",
          slots: [
            {
              time: "08:00 - 09:00",
              subject: "Mathématiques",
              teacher: "Mme Koné",
              room: "A1",
              status: "upcoming",
            },
          ],
        },
      ],
    })
  })

  it("charge l'emploi du temps sans vérifier l'existence d'un abonnement", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={queryClient}>
        <ParentSchedulePage />
      </QueryClientProvider>
    )

    expect(await screen.findByText("Mathématiques")).toBeInTheDocument()
    expect(getScheduleMock).toHaveBeenCalledWith("student-1", expect.any(String))
    expect(getSubscriptionStatusMock).not.toHaveBeenCalled()
  })
})
