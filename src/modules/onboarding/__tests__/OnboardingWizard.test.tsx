import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { MemoryRouter, useNavigate } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useAuthStore } from "@/shared/store/auth.store"
import OnboardingWizard from "../OnboardingWizard"
import type { OnboardingStatus } from "../onboarding.api"

const api = vi.hoisted(() => ({ school: vi.fn(), status: vi.fn(), save: vi.fn(), complete: vi.fn(), history: vi.fn() }))
const theme = vi.hoisted(() => ({ setTheme: vi.fn() }))
vi.mock("../onboarding.api", () => ({
  fetchSchoolInfo: () => api.school(), fetchOnboardingStatus: () => api.status(),
  patchSchoolInfo: (body: unknown) => api.save(body), completeOnboarding: () => api.complete(),
}))
vi.mock("@/modules/academic/academic.api", () => ({ listClasses: vi.fn().mockResolvedValue([]) }))
vi.mock("@/modules/import-export/import-export.api", () => ({
  fetchImportHistory: (filter: unknown) => api.history(filter),
}))
vi.mock("@/shared/hooks/useTheme", () => ({
  useTheme: () => ({ theme: "system", resolvedTheme: "light", setTheme: theme.setTheme }),
}))
const ready: OnboardingStatus = { schoolId: "A", schoolInfoComplete: true, activeYear: true,
  levels: true, subjects: true, rooms: true, fees: true, teachers: false, missing: [], canComplete: true }
function mount(path = "/onboarding", role: "director" | "staff" = "director", future = false) {
  const user = useAuthStore.getState().user
  if (user) useAuthStore.setState({ user: { ...user, role } })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return {
    client,
    ...render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[path]} future={future ? { v7_startTransition: true } : undefined}><OnboardingWizard /></MemoryRouter></QueryClientProvider>),
  }
}

function BrowserBackControl() {
  const navigate = useNavigate()
  return <button type="button" onClick={() => navigate(-1)}>Précédent navigateur</button>
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  useAuthStore.setState({ user: { id: "u", role: "director", tenantId: "A", schemaName: "school_a", name: "Director", phone: null, email: null, profilePhotoUrl: null, mustChangePassword: false, plan: "pro" }, permissions: [] })
  api.school.mockResolvedValue({ id: "A", name: "École A", address: "Abidjan", phone: "2250700000000", onboarding_completed: false })
  api.status.mockResolvedValue(ready)
  api.save.mockResolvedValue({})
  api.complete.mockResolvedValue({})
  api.history.mockResolvedValue({ items: [], total: 0, page: 1, totalPages: 1 })
})
describe("assistant de configuration", () => {
  it.each([
    ["schoolInfoComplete", "Informations de l'école"],
    ["activeYear", "Informations de l'école"],
    ["levels", "Référentiel scolaire"],
    ["subjects", "Référentiel scolaire"],
    ["rooms", "Salles et frais"],
    ["fees", "Salles et frais"],
  ] as const)("redirige vers la première étape non validée sans %s", async (key, heading) => {
    api.status.mockResolvedValue({ ...ready, [key]: false, canComplete: false, missing: [key] })
    mount("/onboarding?step=5&school=A")
    await screen.findByRole("heading", { name: heading })
    expect(screen.queryByRole("button", { name: "Accéder au tableau de bord" })).not.toBeInTheDocument()
    expect(api.complete).not.toHaveBeenCalled()
    if (key === "activeYear") expect(screen.getByText(/L’administration doit ouvrir l’année/)).toBeInTheDocument()
    if (key === "levels") expect(screen.getByText(/Ajoutez au moins un niveau/)).toBeInTheDocument()
    if (key === "subjects") expect(screen.getByText(/Ajoutez au moins une matière/)).toBeInTheDocument()
    if (key === "rooms" || key === "fees") expect(screen.getByText(/pour continuer/)).toBeInTheDocument()
  })
  it("autorise sans professeur et explique les opérations après inscriptions", async () => {
    mount("/onboarding?step=5&school=A")
    const button = await screen.findByRole("button", { name: "Accéder au tableau de bord" })
    await waitFor(() => expect(button).toBeEnabled())
    expect(screen.getByText(/Désigner le professeur principal/)).toBeInTheDocument()
    fireEvent.click(button)
    await waitFor(() => expect(api.complete).toHaveBeenCalledOnce())
  })
  it("affiche l’import des profils historiques comme effectué d’après l’historique serveur", async () => {
    api.history.mockResolvedValue({
      items: [{
        id: "history-1",
        importedAt: "2026-10-01T10:00:00Z",
        type: "students",
        importedCount: 12,
        updatedCount: 0,
        schedulePeriod: null,
        historicalSchoolYearLabel: "2024-2025",
        importedBy: "director-id",
        importedByName: "Direction",
        importedByRole: "director",
      }],
      total: 1,
      page: 1,
      totalPages: 1,
    })
    mount("/onboarding?step=4&school=A")

    expect(await screen.findByText(/Import historique 2024-2025 effectué · 12 profil\(s\) créé\(s\)/)).toBeInTheDocument()
    expect(screen.getByText("Import effectué")).toBeInTheDocument()
    expect(api.history).toHaveBeenCalledWith({ limit: 100, page: 1, type: "students" })
  })
  it("permet de revenir par le bouton intégré jusqu’à l’étape 1", async () => {
    mount("/onboarding?step=5&school=A")
    await screen.findByRole("heading", { name: "Terminer la configuration" })

    fireEvent.click(screen.getByRole("button", { name: "Retour" }))
    await screen.findByRole("heading", { name: "Profils à préparer" })

    fireEvent.click(screen.getByRole("button", { name: "Retour" }))
    await screen.findByRole("heading", { name: "Salles et frais" })

    fireEvent.click(screen.getByRole("button", { name: "Retour" }))
    await screen.findByRole("heading", { name: "Référentiel scolaire" })

    fireEvent.click(screen.getByRole("button", { name: "Retour" }))
    await screen.findByRole("heading", { name: "Informations de l'école" })
  })
  it("permet le retour de l’étape 2 vers l’étape 1 même si le statut est en cours de chargement", async () => {
    api.status.mockResolvedValueOnce(ready).mockReturnValue(new Promise(() => {}))
    const { client } = mount("/onboarding?step=2&school=A")
    await screen.findByRole("heading", { name: "Référentiel scolaire" })
    void client.invalidateQueries({ queryKey: ["onboarding-status"] })
    await screen.findByText("Mise à jour des prérequis…")
    fireEvent.click(screen.getByRole("button", { name: "Retour" }))
    await screen.findByRole("heading", { name: "Informations de l'école" })
  })
  it.each([false, true])("le bouton précédent du navigateur revient à l’étape antérieure avec v7_startTransition=%s", async (future) => {
    api.status.mockResolvedValue(ready)
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/onboarding?step=1&school=A"]} future={future ? { v7_startTransition: true } : undefined}>
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
  it("actualise automatiquement les prérequis invalidés", async () => {
    api.status.mockResolvedValueOnce({ ...ready, rooms: false, canComplete: false }).mockResolvedValue(ready)
    const { client } = mount()
    await screen.findByRole("heading", { name: "Salles et frais" })
    await client.invalidateQueries({ queryKey: ["onboarding-status"] })
    await waitFor(() => expect(screen.getByText("Au moins une salle")).toBeInTheDocument())
    expect(api.status).toHaveBeenCalledTimes(2)
  })
  it("affiche l’année active en premier dans le suivi", async () => {
    mount()
    const list = await screen.findByRole("list", { name: "Suivi des prérequis" })
    expect(within(list).getAllByRole("listitem")[0]).toHaveTextContent("Année scolaire active")
  })
  it("choisit l’étape 1 par défaut si les prérequis sont incomplets et l’étape 5 s’ils sont complets", async () => {
    api.status.mockResolvedValueOnce({ ...ready, activeYear: false, canComplete: false })
    mount("/onboarding")
    await screen.findByRole("heading", { name: "Informations de l'école" })
    expect(api.status).toHaveBeenCalledOnce()

    cleanup()
    api.school.mockResolvedValue({ id: "A", onboarding_completed: false })
    api.status.mockResolvedValue(ready)
    mount("/onboarding")
    await screen.findByRole("heading", { name: "Terminer la configuration" })
  })
  it("bascule le thème avec un bouton accessible à icône", async () => {
    mount()
    fireEvent.click(await screen.findByRole("button", { name: "Passer au thème sombre" }))
    expect(theme.setTheme).toHaveBeenCalledWith("dark")
  })
  it("affiche une erreur et empêche la finalisation quand la lecture échoue", async () => {
    api.status.mockRejectedValue(new Error("network"))
    mount("/onboarding?step=5&school=A")
    await screen.findByText(/Impossible de vérifier les prérequis/)
    expect(screen.getByRole("button", { name: "Réessayer" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Accéder au tableau de bord" })).not.toBeInTheDocument()
  })
  it("montre les états de chargement sans autoriser une validation en cache", async () => {
    api.status.mockReturnValue(new Promise(() => {}))
    mount("/onboarding?step=5&school=A")
    expect(await screen.findByLabelText("Vérification des prérequis")).toBeInTheDocument()
  })
  it("conserve les champs de l’école pendant le rechargement du statut au retour sur l’onglet", async () => {
    api.status.mockResolvedValueOnce(ready).mockReturnValue(new Promise(() => {}))
    mount("/onboarding?step=1&school=A")
    const nameInput = await screen.findByLabelText("Nom de l’école")
    fireEvent.change(nameInput, { target: { value: "École modifiée" } })
    window.dispatchEvent(new Event("visibilitychange"))
    await screen.findByText("Mise à jour des prérequis…")
    expect(screen.getByLabelText("Nom de l’école")).toHaveValue("École modifiée")
    expect(screen.getByRole("heading", { name: "Informations de l'école" })).toBeInTheDocument()
  })
  it("bloque une réponse d’état qui appartient à une autre école", async () => {
    api.status.mockResolvedValue({ ...ready, schoolId: "B" })
    mount("/onboarding?step=5&school=A")
    await screen.findByText(/Impossible de vérifier les prérequis/)
    expect(screen.queryByRole("button", { name: "Accéder au tableau de bord" })).toBeNull()
  })
  it("relit l’état lorsque l’API refuse une finalisation devenue invalide", async () => {
    api.status.mockResolvedValueOnce(ready).mockResolvedValue({ ...ready, activeYear: false, canComplete: false })
    api.complete.mockRejectedValue(new Error("Année fermée"))
    mount("/onboarding?step=5&school=A")
    const button = await screen.findByRole("button", { name: "Accéder au tableau de bord" })
    await waitFor(() => expect(button).toBeEnabled())
    fireEvent.click(button)
    await screen.findByRole("heading", { name: "Informations de l'école" })
    expect(screen.queryByRole("button", { name: "Accéder au tableau de bord" })).not.toBeInTheDocument()
    expect(api.status).toHaveBeenCalledTimes(2)
  })
  it("enregistre les infos puis relit l’état serveur", async () => {
    api.status
      .mockResolvedValueOnce({ ...ready, schoolInfoComplete: false, levels: false, subjects: false, rooms: false, fees: false, canComplete: false })
      .mockResolvedValue(ready)
    mount("/onboarding?step=1&school=A")
    const save = await screen.findByRole("button", { name: "Enregistrer et continuer" })
    fireEvent.click(save)
    await screen.findByRole("heading", { name: "Référentiel scolaire" })
    expect(api.save).toHaveBeenCalledWith({ name: "École A", address: "Abidjan", phone: "2250700000000" })
    expect(api.status).toHaveBeenCalledTimes(2)
  })
  it.each([false, true])("avance vers l’étape 2 après enregistrement avec v7_startTransition=%s", async (future) => {
    api.status.mockResolvedValue(ready)
    mount("/onboarding?step=1&school=A", "director", future)
    fireEvent.click(await screen.findByRole("button", { name: "Enregistrer et continuer" }))
    await screen.findByRole("heading", { name: "Référentiel scolaire" })
  })
  it.each([false, true])("revient de l’étape 3 à 2 puis 1 avec v7_startTransition=%s", async (future) => {
    mount("/onboarding?step=3&school=A", "director", future)
    await screen.findByRole("heading", { name: "Salles et frais" })
    fireEvent.click(screen.getByRole("button", { name: "Retour" }))
    await screen.findByRole("heading", { name: "Référentiel scolaire" })
    fireEvent.click(screen.getByRole("button", { name: "Retour" }))
    await screen.findByRole("heading", { name: "Informations de l'école" })
  })
  it("reste à l’étape 1 si le statut frais ne confirme pas les informations de l’école", async () => {
    api.status.mockResolvedValueOnce({ ...ready, schoolInfoComplete: false }).mockResolvedValue({ ...ready, schoolInfoComplete: false })
    mount("/onboarding?step=1&school=A")
    fireEvent.click(await screen.findByRole("button", { name: "Enregistrer et continuer" }))
    await screen.findByText(/Le serveur ne confirme pas encore/)
    expect(screen.getByRole("heading", { name: "Informations de l'école" })).toBeInTheDocument()
    expect(api.status).toHaveBeenCalledTimes(2)
  })
  it("reste à l’étape 1 si le statut frais ne confirme pas l’année active", async () => {
    api.status.mockResolvedValueOnce({ ...ready, activeYear: false }).mockResolvedValue({ ...ready, activeYear: false })
    mount("/onboarding?step=1&school=A")
    fireEvent.click(await screen.findByRole("button", { name: "Enregistrer les informations" }))
    await screen.findByText(/L’administration doit ouvrir l’année scolaire/)
    expect(screen.getByRole("heading", { name: "Informations de l'école" })).toBeInTheDocument()
  })
  it("masque les actions sans droits et ne charge pas l’état", async () => {
    mount("/onboarding", "staff")
    expect(screen.getByText(/Seul le directeur de l’école peut accéder/)).toBeInTheDocument()
    expect(api.school).not.toHaveBeenCalled()
    expect(api.status).not.toHaveBeenCalled()
  })
  it("masque les liens de configuration non autorisés", async () => {
    mount("/onboarding?step=2&school=A", "staff")
    await screen.findByText(/Seul le directeur de l’école peut accéder/)
    expect(screen.queryByRole("link")).not.toBeInTheDocument()
  })
  it.each([
    [2, "Configurer les niveaux", "/academic/levels"], [2, "Configurer les matières", "/academic/subjects"],
    [3, "Configurer les salles", "/rooms"], [3, "Configurer les frais", "/onboarding/fees"],
    [4, "Importer les professeurs", "/import"],
  ])("transmet l’étape %i avec le lien %s", async (step, label, path) => {
    mount(`/onboarding?step=${step}&school=A`)
    const link = await screen.findByRole("link", { name: label as string })
    const url = new URL(link.getAttribute("href")!, "https://school.test")
    expect(url.pathname).toBe(path)
    expect(url.searchParams.get("returnTo")).toBe(`/onboarding?step=${step}&school=A`)
    expect(within(await screen.findByRole("list", { name: "Suivi des prérequis" })).queryByText(/EDT|emploi du temps/)).toBeNull()
    expect(screen.queryByText(/Ajouter le professeur|Ajouter l’élève|Ajouter un créneau/)).not.toBeInTheDocument()
  })
})
