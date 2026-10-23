import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { beforeEach, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  user: {
    id: "parent-one",
    role: "parent" as const,
    phone: "2250700000000",
    studentIds: ["student-one"],
    mustChangePassword: false,
  },
  logout: vi.fn(),
}))

vi.mock("../parent-auth.store", () => ({
  useParentAuthStore: (selector: (state: { user: typeof mocks.user; logout: typeof mocks.logout }) => unknown) =>
    selector({ user: mocks.user, logout: mocks.logout }),
}))
vi.mock("@/modules/parent-portal/parent.api", () => ({
  fetchParentSchoolInfo: vi.fn().mockResolvedValue({ name: "École" }),
  listParentNotifications: vi.fn().mockResolvedValue({ notifications: [], unreadCount: 0 }),
}))
vi.mock("@/shared/hooks/useTheme", () => ({
  useTheme: () => ({ resolvedTheme: "light", setTheme: vi.fn() }),
}))
vi.mock("@/shared/components/TourGuide", () => ({ TourGuide: () => null }))
vi.mock("@/shared/hooks/useTourGuide", () => ({
  useTourGuide: () => ({
    run: false,
    stepIndex: 0,
    setStepIndex: vi.fn(),
    markDone: vi.fn(),
    restart: vi.fn(),
  }),
}))

import ParentPortalLayout from "../ParentPortalLayout"

beforeEach(() => {
  sessionStorage.clear()
})

it("garde cinq entrées parent et rend Notes actif sans entrée Paiements", () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const view = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/parent/grades"]}>
        <Routes>
          <Route path="/parent" element={<ParentPortalLayout />}>
            <Route path="grades" element={<p>Page notes</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )

  try {
    const navigation = screen.getByRole("navigation", { name: "Navigation principale" })
    expect(navigation.querySelectorAll("a")).toHaveLength(5)
    expect(screen.getByRole("link", { name: "Notes" })).toHaveAttribute("aria-current", "page")
    expect(screen.getByRole("link", { name: "Accueil" })).toHaveAttribute("href", "/parent/dashboard")
    expect(screen.getByRole("link", { name: "Absences" })).toHaveAttribute("href", "/parent/absences")
    expect(screen.getByRole("link", { name: "EDT" })).toHaveAttribute("href", "/parent/schedule")
    expect(screen.getByRole("link", { name: "Compte" })).toHaveAttribute("href", "/parent/account")
    expect(screen.queryByRole("link", { name: "Paiements" })).not.toBeInTheDocument()
    expect(screen.getByText("Page notes")).toBeInTheDocument()
  } finally {
    view.unmount()
    queryClient.clear()
  }
})
