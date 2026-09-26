import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, expect, it, vi } from "vitest"
import { useAuthStore } from "@/shared/store/auth.store"
import { OnboardingReturn } from "../OnboardingReturn"
import { configurationLink } from "../onboarding.progress"
const api = vi.hoisted(() => ({ school: vi.fn() }))
vi.mock("../onboarding.api", () => ({ fetchSchoolInfo: () => api.school() }))
function mount(path: string) {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={[path]}><OnboardingReturn /></MemoryRouter>
  </QueryClientProvider>)
}
beforeEach(() => {
  vi.clearAllMocks()
  useAuthStore.setState({ user: null, permissions: ["settings.school"] })
  api.school.mockResolvedValue({ id: "A" })
})
it.each([["/academic/levels", 2], ["/academic/subjects", 2], ["/rooms", 3], ["/settings?tab=finance", 3], ["/import?type=teachers", 4]] as const)("retour depuis %s vers la bonne étape", async (path, step) => {
  mount(configurationLink(path, "A", step))
  expect(await screen.findByRole("link", { name: "Retour à la configuration initiale" })).toHaveAttribute("href", `/onboarding?step=${step}&school=A`)
})
it("ne charge pas de données sans retour guidé", () => {
  mount("/rooms")
  expect(api.school).not.toHaveBeenCalled()
  expect(screen.queryByRole("link")).toBeNull()
})
it("masque le retour sans permission", () => {
  useAuthStore.setState({ permissions: [] })
  mount(configurationLink("/rooms", "A", 3))
  expect(api.school).not.toHaveBeenCalled()
  expect(screen.queryByRole("link")).toBeNull()
})
it("ne conserve pas un lien provenant d’une autre école", async () => {
  api.school.mockResolvedValue({ id: "B" })
  mount(configurationLink("/rooms", "A", 3))
  await vi.waitFor(() => expect(api.school).toHaveBeenCalledOnce())
  expect(screen.queryByRole("link")).toBeNull()
})
