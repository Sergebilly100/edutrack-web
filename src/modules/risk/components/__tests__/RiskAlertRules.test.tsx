import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { fetchRulesMock, saveRuleMock, toastMock } = vi.hoisted(() => ({
  fetchRulesMock: vi.fn(),
  saveRuleMock: vi.fn(),
  toastMock: vi.fn(),
}))

vi.mock("@/modules/risk/risk.api", () => ({
  fetchRiskAlertRules: fetchRulesMock,
  saveRiskAlertRule: saveRuleMock,
}))

vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}))

vi.mock("@/components/ui/checkbox", () => ({
  Checkbox: ({ checked, onCheckedChange }: { checked?: boolean; onCheckedChange?: (checked: boolean) => void }) => (
    <input
      type="checkbox"
      aria-label="Active"
      checked={checked}
      onChange={(event) => onCheckedChange?.(event.target.checked)}
    />
  ),
}))

import { RiskAlertRules } from "../RiskAlertRules"

const renderRules = () =>
  render(
    <QueryClientProvider
      client={new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      })}
    >
      <RiskAlertRules />
    </QueryClientProvider>
  )

describe("RiskAlertRules", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchRulesMock.mockResolvedValue([
      { id: "1", subjectType: "student", signalType: "absences", thresholdValue: 3, periodDays: 30, isActive: true },
      { id: "2", subjectType: "student", signalType: "grades", thresholdValue: 2, periodDays: 0, isActive: true },
      { id: "3", subjectType: "student", signalType: "payments", thresholdValue: 1, periodDays: 0, isActive: true },
      { id: "4", subjectType: "teacher", signalType: "absences", thresholdValue: 3, periodDays: 30, isActive: true },
    ])
    saveRuleMock.mockResolvedValue(undefined)
  })

  it("présente les quatre signaux sans faux seuil pour le retard financier", async () => {
    renderRules()

    expect(await screen.findByText("Situation financière en retard")).toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: "Enregistrer" })).toHaveLength(4)
    expect(screen.queryByLabelText("student:payments-threshold")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("student:payments-period")).not.toBeInTheDocument()
  })

  it("enregistre le seuil d'absence élève modifié", async () => {
    renderRules()

    const threshold = (await screen.findAllByLabelText("Absences"))[0]!
    fireEvent.change(threshold, { target: { value: "4" } })
    fireEvent.click(screen.getAllByRole("button", { name: "Enregistrer" })[0]!)

    await waitFor(() =>
      expect(saveRuleMock.mock.calls[0]?.[0]).toEqual({
        subjectType: "student",
        signalType: "absences",
        thresholdValue: 4,
        periodDays: 30,
        isActive: true,
      })
    )
  })
})
