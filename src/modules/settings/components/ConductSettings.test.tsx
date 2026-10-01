import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeAll, describe, expect, it, vi } from "vitest"

const { updatePolicy, createAssignment } = vi.hoisted(() => ({
  updatePolicy: vi.fn().mockResolvedValue({ mode: "direction", coefficient: 2 }),
  createAssignment: vi.fn().mockResolvedValue({ assignment: { id: "a1" } }),
}))

vi.mock("@/modules/academic/academic.api", () => ({
  listSchoolYears: async () => [{ id: "y1", label: "2026-2027", status: "active" }],
  fetchConductPolicy: async () => ({ mode: "homeroom", coefficient: 1 }),
  updateConductPolicy: (...args: unknown[]) => updatePolicy(...args),
  fetchEducatorAssignments: async () => ({ assignments: [] }),
  fetchEligibleEducators: async () => ({ users: [{ id: "u1", name: "Éducatrice Koffi" }] }),
  listClasses: async () => ({ classes: [{ id: "c1", name: "6e A" }] }),
  listLevels: async () => [{ id: "l1", name: "6e" }],
  createEducatorAssignment: (...args: unknown[]) => createAssignment(...args),
  deleteEducatorAssignment: vi.fn(),
}))

import { ConductSettings } from "./ConductSettings"

beforeAll(() => {
  Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: vi.fn() })
})

const renderSettings = () => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <ConductSettings canEditPolicy canManageAssignments />
  </QueryClientProvider>,
)

describe("ConductSettings", () => {
  it("enregistre le décideur et le coefficient de l’année", async () => {
    renderSettings()
    fireEvent.click(await screen.findByRole("combobox", { name: "Responsable de la décision" }))
    fireEvent.click(screen.getByRole("option", { name: "Direction de l’école" }))
    fireEvent.change(screen.getByLabelText("Coefficient annuel"), { target: { value: "2" } })
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }))
    await waitFor(() => expect(updatePolicy).toHaveBeenCalledWith("y1", { mode: "direction", coefficient: 2 }))
  })

  it("affecte un éducateur habilité à une classe en mode délégué", async () => {
    renderSettings()
    fireEvent.click(await screen.findByRole("combobox", { name: "Responsable de la décision" }))
    fireEvent.click(screen.getByRole("option", { name: "Éducateur délégué" }))
    fireEvent.click(screen.getByRole("combobox", { name: "Classe ou niveau" }))
    fireEvent.click(await screen.findByRole("option", { name: "6e A" }))
    fireEvent.click(screen.getByRole("combobox", { name: "Éducateur" }))
    fireEvent.click(await screen.findByRole("option", { name: "Éducatrice Koffi" }))
    fireEvent.click(screen.getByRole("button", { name: "Affecter" }))
    await waitFor(() => expect(createAssignment).toHaveBeenCalledWith({ user_id: "u1", class_id: "c1" }))
  })
})
