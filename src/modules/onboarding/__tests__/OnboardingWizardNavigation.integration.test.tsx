import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { MemoryRouter, useNavigate } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { useAuthStore } from "@/shared/store/auth.store"
import { server } from "@/test/msw/server"
import OnboardingWizard from "../OnboardingWizard"

const theme = vi.hoisted(() => ({ setTheme: vi.fn() }))
vi.mock("@/shared/hooks/useTheme", () => ({
  useTheme: () => ({ theme: "system", resolvedTheme: "light", setTheme: theme.setTheme }),
}))
vi.mock("@/modules/academic/academic.api", () => ({ listClasses: vi.fn().mockResolvedValue([]) }))

const school = {
  id: "school-a",
  name: "École A",
  address: "Abidjan",
  phone: "2250700000000",
  onboarding_completed: false,
}

const completeStatus = {
  schoolId: "school-a",
  schoolInfoComplete: true,
  activeYear: true,
  levels: true,
  subjects: true,
  rooms: true,
  fees: true,
  teachers: false,
  missing: [],
  canComplete: true,
}

function renderWizard(path: string, future = false) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter
        initialEntries={[path]}
        future={future ? { v7_startTransition: true } : undefined}
      >
        <OnboardingWizard />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function BrowserBackControl() {
  const navigate = useNavigate()
  return <button type="button" onClick={() => navigate(-1)}>Précédent navigateur</button>
}

beforeEach(() => {
  vi.clearAllMocks()
  useAuthStore.setState({
    user: {
      id: "director-a",
      role: "director",
      tenantId: "tenant-a",
      schemaName: "school_a",
      name: "Directeur",
      phone: null,
      email: null,
      profilePhotoUrl: null,
      mustChangePassword: false,
      plan: "pro",
    },
    permissions: [],
  })
  server.use(
    http.get("*/school/info", () => HttpResponse.json(school)),
    http.get("*/school/onboarding-status", () => HttpResponse.json(completeStatus)),
    http.patch("*/school/info", () => HttpResponse.json(school)),
  )
})

describe("navigation de l’assistant avec API simulée par MSW", () => {
  it.each([false, true])("avance après vérification serveur avec v7_startTransition=%s", async (future) => {
    let statusCalls = 0
    server.use(
      http.get("*/school/onboarding-status", () => {
        statusCalls += 1
        return HttpResponse.json(completeStatus)
      }),
    )
    renderWizard("/onboarding?step=1&school=school-a", future)

    fireEvent.click(await screen.findByRole("button", { name: "Enregistrer et continuer" }))
    await screen.findByRole("heading", { name: "Référentiel scolaire" })
    expect(statusCalls).toBe(2)
  })

  it.each([false, true])("utilise le statut frais plutôt que le cache initial avec v7_startTransition=%s", async (future) => {
    let statusCalls = 0
    server.use(
      http.get("*/school/onboarding-status", () => {
        statusCalls += 1
        return HttpResponse.json(statusCalls === 1
          ? { ...completeStatus, activeYear: false, canComplete: false }
          : completeStatus)
      }),
    )
    renderWizard("/onboarding?step=1&school=school-a", future)

    fireEvent.click(await screen.findByRole("button", { name: "Enregistrer les informations" }))
    await screen.findByRole("heading", { name: "Référentiel scolaire" })
    expect(statusCalls).toBe(2)
  })

  it.each([false, true])("reste à l’étape 1 si le serveur ne confirme pas les informations de l’école avec v7_startTransition=%s", async (future) => {
    let statusCalls = 0
    server.use(
      http.get("*/school/onboarding-status", () => {
        statusCalls += 1
        return HttpResponse.json({ ...completeStatus, schoolInfoComplete: false, canComplete: false })
      }),
    )
    renderWizard("/onboarding?step=1&school=school-a", future)

    fireEvent.click(await screen.findByRole("button", { name: "Enregistrer et continuer" }))
    expect(await screen.findByRole("alert")).toHaveTextContent(/Le serveur ne confirme pas encore/)
    expect(screen.getByRole("heading", { name: "Informations de l'école" })).toBeInTheDocument()
    expect(statusCalls).toBe(2)
  })

  it.each([false, true])("reste à l’étape 1 si l’année active manque avec v7_startTransition=%s", async (future) => {
    let statusCalls = 0
    server.use(
      http.get("*/school/onboarding-status", () => {
        statusCalls += 1
        return HttpResponse.json({ ...completeStatus, activeYear: false, canComplete: false })
      }),
    )
    renderWizard("/onboarding?step=1&school=school-a", future)

    fireEvent.click(await screen.findByRole("button", { name: "Enregistrer les informations" }))
    expect(await screen.findByRole("alert")).toHaveTextContent(/L’administration doit ouvrir l’année scolaire/)
    expect(screen.getByRole("heading", { name: "Informations de l'école" })).toBeInTheDocument()
    expect(statusCalls).toBe(2)
  })

  it.each([false, true])("revient de l’étape 3 à 2 puis 1 avec v7_startTransition=%s", async (future) => {
    renderWizard("/onboarding?step=3&school=school-a", future)

    await screen.findByRole("heading", { name: "Salles et frais" })
    fireEvent.click(screen.getByRole("button", { name: "Retour" }))
    await screen.findByRole("heading", { name: "Référentiel scolaire" })
    fireEvent.click(screen.getByRole("button", { name: "Retour" }))
    await screen.findByRole("heading", { name: "Informations de l'école" })
  })

  it.each([false, true])("le précédent navigateur revient à l’étape précédente avec v7_startTransition=%s", async (future) => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/onboarding?step=1&school=school-a"]} future={future ? { v7_startTransition: true } : undefined}>
          <BrowserBackControl />
          <OnboardingWizard />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    fireEvent.click(await screen.findByRole("button", { name: "Enregistrer et continuer" }))
    await screen.findByRole("heading", { name: "Référentiel scolaire" })
    fireEvent.click(screen.getByRole("button", { name: "Précédent navigateur" }))
    await screen.findByRole("heading", { name: "Informations de l'école" })
  })
})
