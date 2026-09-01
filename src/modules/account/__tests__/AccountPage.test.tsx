import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { MemoryRouter } from "react-router-dom"

const toastMock = vi.fn()

vi.mock("@/modules/auth/auth.api", () => ({
  updateMyProfile: vi.fn(),
}))

vi.mock("@/modules/settings/settings.api", () => ({
  changePassword: vi.fn(),
}))

vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}))

vi.mock("@/shared/components", () => ({
  OfflineGuard: ({ children }: { children: ReactNode }) => <>{children}</>,
  OfflineIndicator: () => null,
}))

vi.mock("@/shared/store/auth.store", () => ({
  useAuthStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      user: {
        id: "teacher-1",
        name: "Mariam Coulibaly",
        role: "teacher",
        phone: "+225070100004",
        email: "mariam.coulibaly@sainte-marie.ci",
        profilePhotoUrl: null,
      },
      setUser: vi.fn(),
      setAccessToken: vi.fn(),
    }),
}))

import AccountPage from "@/modules/account/AccountPage"

const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AccountPage />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe("Compte professeur", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("garde le sélecteur de photo hors du flux de largeur et l'action de sauvegarde dans le formulaire", () => {
    renderPage()

    const fileInput = document.querySelector('input[type="file"]')
    const saveButton = screen.getByRole("button", { name: "Enregistrer le profil" })

    expect(fileInput).toHaveClass("!absolute", "!w-px", "!h-px")
    expect(saveButton).not.toHaveClass("fixed")
    expect(screen.getByRole("button", { name: "Modifier la photo de profil" })).toBeVisible()
  })
})
