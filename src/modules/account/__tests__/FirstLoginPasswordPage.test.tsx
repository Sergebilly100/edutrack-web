import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { MemoryRouter } from "react-router-dom"

const { navigateMock } = vi.hoisted(() => ({ navigateMock: vi.fn() }))
const changePasswordMock = vi.fn()
const setAccessTokenMock = vi.fn()
const setUserMock = vi.fn()
const refreshPermissionsMock = vi.fn()

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom")
  return { ...actual, useNavigate: () => navigateMock }
})

vi.mock("@/modules/settings/settings.api", () => ({
  changePassword: (...args: unknown[]) => changePasswordMock(...args),
}))

vi.mock("@/shared/store/auth.store", () => ({
  useAuthStore: (selector: (s: Record<string, unknown>) => unknown) => {
    const store = {
      user: { id: "u1", role: "teacher", mustChangePassword: true },
      setUser: setUserMock,
      setAccessToken: setAccessTokenMock,
    }
    return selector(store)
  },
}))

vi.mock("@/shared/hooks/usePermissions", () => ({
  usePermissions: () => ({ refreshPermissions: refreshPermissionsMock }),
}))

import FirstLoginPasswordPage from "@/modules/account/FirstLoginPasswordPage"

const createQueryClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })

const renderPage = () =>
  render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter>
        <FirstLoginPasswordPage />
      </MemoryRouter>
    </QueryClientProvider>
  )

beforeEach(() => {
  vi.clearAllMocks()
  refreshPermissionsMock.mockResolvedValue(undefined)
})

describe("FirstLoginPasswordPage", () => {
  it("affiche le formulaire de changement de mot de passe", () => {
    renderPage()

    expect(document.getElementById("first-login-current-password")).toBeInTheDocument()
    expect(document.getElementById("first-login-new-password")).toBeInTheDocument()
    expect(document.getElementById("first-login-confirm-password")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /mettre à jour/i })).toBeInTheDocument()
  })

  it("affiche une erreur si les mots de passe ne correspondent pas", async () => {
    renderPage()

    fireEvent.change(document.getElementById("first-login-current-password")!, {
      target: { value: "Temp123!" },
    })
    fireEvent.change(document.getElementById("first-login-new-password")!, {
      target: { value: "Nouveau1A!" },
    })
    fireEvent.change(document.getElementById("first-login-confirm-password")!, {
      target: { value: "Different1A!" },
    })
    fireEvent.submit(screen.getByRole("button", { name: /mettre à jour/i }).closest("form")!)

    expect(
      screen.getByText(/les deux mots de passe ne correspondent pas/i)
    ).toBeInTheDocument()
    expect(changePasswordMock).not.toHaveBeenCalled()
  })

  it("affiche une erreur si le nouveau MDP est identique au temporaire", async () => {
    renderPage()

    fireEvent.change(document.getElementById("first-login-current-password")!, {
      target: { value: "Temp1234!" },
    })
    fireEvent.change(document.getElementById("first-login-new-password")!, {
      target: { value: "Temp1234!" },
    })
    fireEvent.change(document.getElementById("first-login-confirm-password")!, {
      target: { value: "Temp1234!" },
    })
    fireEvent.submit(screen.getByRole("button", { name: /mettre à jour/i }).closest("form")!)

    expect(
      screen.getByText(/doit être différent du temporaire/i)
    ).toBeInTheDocument()
    expect(changePasswordMock).not.toHaveBeenCalled()
  })

  it("appelle setAccessToken AVANT refreshPermissions et navigue vers /dashboard (teacher)", async () => {
    const newToken = "new-access-token-xyz"
    changePasswordMock.mockResolvedValueOnce({ accessToken: newToken })

    // Vérifier l'ordre des appels
    const callOrder: string[] = []
    setAccessTokenMock.mockImplementation(() => callOrder.push("setAccessToken"))
    refreshPermissionsMock.mockImplementation(async () => {
      callOrder.push("refreshPermissions")
    })

    renderPage()

    fireEvent.change(document.getElementById("first-login-current-password")!, {
      target: { value: "Temp1234!" },
    })
    fireEvent.change(document.getElementById("first-login-new-password")!, {
      target: { value: "Nouveau1A!" },
    })
    fireEvent.change(document.getElementById("first-login-confirm-password")!, {
      target: { value: "Nouveau1A!" },
    })
    fireEvent.submit(screen.getByRole("button", { name: /mettre à jour/i }).closest("form")!)

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith("/dashboard", { replace: true })
    })

    expect(callOrder[0]).toBe("setAccessToken")
    expect(callOrder[1]).toBe("refreshPermissions")
    expect(setAccessTokenMock).toHaveBeenCalledWith(newToken)
    expect(setUserMock).toHaveBeenCalledWith(
      expect.objectContaining({ mustChangePassword: false })
    )
  })

  it("affiche l'erreur backend en cas d'échec API", async () => {
    const axiosError = Object.assign(new Error("Mot de passe actuel incorrect"), {
      isAxiosError: true,
      response: { data: { error: "Mot de passe actuel incorrect" } },
    })
    changePasswordMock.mockRejectedValueOnce(axiosError)

    renderPage()

    fireEvent.change(document.getElementById("first-login-current-password")!, {
      target: { value: "Mauvais1!" },
    })
    fireEvent.change(document.getElementById("first-login-new-password")!, {
      target: { value: "Nouveau1A!" },
    })
    fireEvent.change(document.getElementById("first-login-confirm-password")!, {
      target: { value: "Nouveau1A!" },
    })
    fireEvent.submit(screen.getByRole("button", { name: /mettre à jour/i }).closest("form")!)

    await waitFor(() => {
      expect(
        screen.getByText(/mot de passe actuel incorrect/i)
      ).toBeInTheDocument()
    })

    expect(navigateMock).not.toHaveBeenCalled()
  })
})
