import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { useEffect } from "react"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useAuthStore } from "@/shared/store/auth.store"
import { AcademicNavigation } from "@/modules/academic/components/AcademicNavigation"
import OnboardingFocusLayout from "../OnboardingFocusLayout"
import { OnboardingReturn, useOnboardingContext } from "../OnboardingReturn"
import { configurationLink } from "../onboarding.progress"

const api = vi.hoisted(() => ({ school: vi.fn() }))
const child = vi.hoisted(() => ({ mounted: vi.fn() }))
vi.mock("../onboarding.api", () => ({ fetchSchoolInfo: () => api.school() }))

function FocusChild() {
  const { target, focusStep } = useOnboardingContext()
  useEffect(() => child.mounted(), [])
  return (
    <>
      <h1>Gestion des salles</h1>
      <p>{target}</p>
      <p>{focusStep}</p>
      <OnboardingReturn />
    </>
  )
}

function AcademicFocusPage({ title }: { title: string }) {
  const { target } = useOnboardingContext()
  const location = useLocation()
  return (
    <>
      <h1>{title}</h1>
      <AcademicNavigation />
      <p data-testid="focus-return-target">{target}</p>
      <p data-testid="current-location">{location.pathname}{location.search}</p>
    </>
  )
}

function mount(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return {
    client,
    ...render(<QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/rooms" element={<OnboardingFocusLayout />}>
            <Route index element={<FocusChild />} />
          </Route>
          <Route path="/academic" element={<OnboardingFocusLayout />}>
            <Route path="levels" element={<AcademicFocusPage title="Niveaux" />} />
            <Route path="subjects" element={<AcademicFocusPage title="Matières" />} />
            <Route path="school-years" element={<AcademicFocusPage title="Années scolaires" />} />
            <Route path="classes" element={<AcademicFocusPage title="Classes" />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  child.mounted.mockClear()
  useAuthStore.setState({
    user: { id: "u", role: "director", tenantId: "A", schemaName: "school_a" } as NonNullable<ReturnType<typeof useAuthStore.getState>["user"]>,
    permissions: [],
  })
  api.school.mockResolvedValue({ id: "A" })
})

describe("retour du layout focus", () => {
  it("retrouve l’étape d’origine après un chargement direct de la page liée", async () => {
    mount(configurationLink("/rooms", "A", 3))

    expect(await screen.findByRole("heading", { name: "Gestion des salles" })).toBeInTheDocument()
    expect(screen.getByText("Étape 3 sur 5 · Salles et frais")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Retour à la configuration" })).toHaveAttribute(
      "href",
      "/onboarding?step=3&school=A",
    )
    expect(screen.getByRole("link", { name: "Terminer et revenir à l'assistant" })).toHaveAttribute(
      "href",
      "/onboarding?step=3&school=A",
    )
    expect(api.school).toHaveBeenCalledOnce()
    expect(child.mounted).toHaveBeenCalledOnce()
  })

  it("ne démonte pas la page enfant pendant un rechargement et partage le contexte sans requêtes dupliquées", async () => {
    api.school.mockResolvedValueOnce({ id: "A" })
    const { client } = mount(configurationLink("/rooms", "A", 3))
    expect(await screen.findByRole("heading", { name: "Gestion des salles" })).toBeInTheDocument()
    expect(api.school).toHaveBeenCalledOnce()
    expect(child.mounted).toHaveBeenCalledOnce()

    api.school.mockReturnValue(new Promise(() => {}))
    void client.invalidateQueries({ queryKey: ["school-info"] })
    await waitFor(() => expect(api.school).toHaveBeenCalledTimes(2))
    expect(screen.getByRole("heading", { name: "Gestion des salles" })).toBeInTheDocument()
    expect(child.mounted).toHaveBeenCalledOnce()
  })

  it("conserve le mode focus et l’étape d’origine lors des changements d’onglet Structure scolaire", async () => {
    useAuthStore.setState({ permissions: ["classes.view", "school_years.view"] })
    mount(configurationLink("/academic/levels", "A", 2))
    expect(await screen.findByRole("heading", { name: "Niveaux" })).toBeInTheDocument()

    fireEvent.mouseDown(screen.getByRole("tab", { name: "Matières" }), { button: 0, ctrlKey: false })
    expect(await screen.findByRole("heading", { name: "Matières" })).toBeInTheDocument()
    expect(screen.getByTestId("current-location")).toHaveTextContent(
      "/academic/subjects?returnTo=%2Fonboarding%3Fstep%3D2%26school%3DA",
    )
    expect(screen.getByText("Étape 2 sur 5 · Référentiel scolaire")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Terminer et revenir à l'assistant" })).toHaveAttribute(
      "href",
      "/onboarding?step=2&school=A",
    )

    fireEvent.mouseDown(screen.getByRole("tab", { name: "Années scolaires" }), { button: 0, ctrlKey: false })
    expect(await screen.findByRole("heading", { name: "Années scolaires" })).toBeInTheDocument()
    expect(screen.getByText("Étape 2 sur 5 · Référentiel scolaire")).toBeInTheDocument()
    expect(screen.queryByRole("tab", { name: "Classes" })).not.toBeInTheDocument()
  })
})
