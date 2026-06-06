import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { MemoryRouter } from "react-router-dom"

const { navigateMock } = vi.hoisted(() => ({ navigateMock: vi.fn() }))
const loginMock = vi.fn()
const fetchSchoolInfoMock = vi.fn()
const refreshPermissionsMock = vi.fn()

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom")
  return { ...actual, useNavigate: () => navigateMock }
})

vi.mock("@/modules/auth/auth.api", () => ({
  login: (...args: unknown[]) => loginMock(...args),
}))

vi.mock("@/modules/onboarding/onboarding.api", () => ({
  fetchSchoolInfo: () => fetchSchoolInfoMock(),
}))

vi.mock("@/shared/hooks/usePermissions", () => ({
  usePermissions: () => ({ refreshPermissions: refreshPermissionsMock }),
}))

vi.mock("@/shared/store/auth.store", () => ({
  useAuthStore: (selector: (s: Record<string, unknown>) => unknown) => {
    const store = {
      setUser: vi.fn(),
      setAccessToken: vi.fn(),
      setRefreshToken: vi.fn(),
      setPermissions: vi.fn(),
    }
    return selector(store)
  },
}))

vi.mock("@/shared/lib/dashboard-notifications", () => ({
  clearDashboardDismissedNotifications: vi.fn(),
}))

import LoginPage from "@/modules/auth/LoginPage"

const createQueryClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })

const renderLogin = () =>
  render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    </QueryClientProvider>
  )

const TEACHER_TOKEN =
  "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9." +
  btoa(JSON.stringify({ sub: "user-1", role: "teacher", schemaName: "school_test" })).replace(/=/g, "") +
  ".signature"

beforeEach(() => {
  vi.clearAllMocks()
  fetchSchoolInfoMock.mockResolvedValue({ onboarding_completed: true })
  refreshPermissionsMock.mockResolvedValue(undefined)
})

describe("LoginPage", () => {
  it("affiche les champs identifiant et mot de passe", () => {
    renderLogin()

    expect(screen.getByRole("textbox", { name: /identifiant/i })).toBeInTheDocument()
    expect(document.getElementById("password")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /se connecter/i })).toBeInTheDocument()
  })

  it("appelle POST /auth/login/teacher à la soumission", async () => {
    loginMock.mockResolvedValueOnce({
      accessToken: TEACHER_TOKEN,
      user: { id: "u1", role: "teacher", name: "Yao Marie", phone: null, email: null, profilePhotoUrl: null },
    })

    renderLogin()

    fireEvent.change(screen.getByRole("textbox", { name: /identifiant/i }), { target: { value: "yao.mar" } })
    fireEvent.change(document.getElementById("password")!, { target: { value: "pass123" } })
    fireEvent.submit(screen.getByRole("button", { name: /se connecter/i }).closest("form")!)

    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledWith("yao.mar", "pass123", undefined)
    })
  })

  it("affiche une Alert shadcn en cas d'erreur 401", async () => {
    const axiosError = Object.assign(new Error("Identifiant ou mot de passe incorrect"), {
      isAxiosError: true,
      response: { data: { error: "Identifiant ou mot de passe incorrect" } },
    })
    loginMock.mockRejectedValueOnce(axiosError)

    renderLogin()

    fireEvent.change(screen.getByRole("textbox", { name: /identifiant/i }), { target: { value: "mauvais" } })
    fireEvent.change(document.getElementById("password")!, { target: { value: "mauvais" } })
    fireEvent.submit(screen.getByRole("button", { name: /se connecter/i }).closest("form")!)

    await waitFor(() => {
      expect(screen.getByText(/identifiant ou mot de passe incorrect/i)).toBeInTheDocument()
    })
  })

  it("redirige vers /attendance après connexion réussie pour un prof", async () => {
    loginMock.mockResolvedValueOnce({
      accessToken: TEACHER_TOKEN,
      user: { id: "u1", role: "teacher", name: "Yao Marie", phone: null, email: null, profilePhotoUrl: null },
    })

    renderLogin()

    fireEvent.change(screen.getByRole("textbox", { name: /identifiant/i }), { target: { value: "yao.mar" } })
    fireEvent.change(document.getElementById("password")!, { target: { value: "pass123" } })
    fireEvent.submit(screen.getByRole("button", { name: /se connecter/i }).closest("form")!)

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith("/attendance")
    })
  })
})
