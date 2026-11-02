import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, expect, it, vi } from "vitest"
import { useAuthStore } from "@/shared/store/auth.store"
import { OnboardingReturn } from "../OnboardingReturn"

const api = vi.hoisted(() => ({ school: vi.fn() }))
vi.mock("../onboarding.api", () => ({ fetchSchoolInfo: () => api.school() }))

function mount(path: string) {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={[path]}><OnboardingReturn /></MemoryRouter>
  </QueryClientProvider>)
}
beforeEach(() => {
  vi.clearAllMocks()
  useAuthStore.setState({ user: { id: "u", role: "director", tenantId: "A", schemaName: "school_a" } as NonNullable<ReturnType<typeof useAuthStore.getState>["user"]>, permissions: [] })
  api.school.mockResolvedValue({ id: "A" })
})
it("n’effectue aucune requête et n’affiche pas de retour hors du layout focus", () => {
  mount("/rooms?returnTo=%2Fonboarding%3Fstep%3D3%26school%3DA")
  expect(api.school).not.toHaveBeenCalled()
  expect(screen.queryByRole("link")).toBeNull()
  expect(screen.queryByRole("link")).toBeNull()
})
