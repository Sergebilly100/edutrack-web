import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useAuthStore } from "@/shared/store/auth.store"
import OnboardingWizard from "../OnboardingWizard"
import { progressKey } from "../onboarding.progress"
import type { OnboardingStatus } from "../onboarding.api"

const api = vi.hoisted(() => ({ school: vi.fn(), status: vi.fn(), save: vi.fn(), complete: vi.fn() }))
vi.mock("../onboarding.api", () => ({
  fetchSchoolInfo: () => api.school(), fetchOnboardingStatus: () => api.status(),
  patchSchoolInfo: (body: unknown) => api.save(body), completeOnboarding: () => api.complete(),
}))
const ready: OnboardingStatus = { schoolId: "A", schoolInfoComplete: true, activeYear: true,
  levels: true, subjects: true, rooms: true, fees: true, teachers: false, missing: [], canComplete: true }
function mount(path = "/onboarding") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}><OnboardingWizard /></MemoryRouter></QueryClientProvider>)
}
beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  useAuthStore.setState({ user: { id: "u", role: "director", tenantId: "A", schemaName: "school_a", name: "Director", phone: null, email: null, profilePhotoUrl: null, mustChangePassword: false, plan: "pro" }, permissions: [] })
  api.school.mockResolvedValue({ id: "A", name: "École A", address: "Abidjan", phone: "2250700000000", onboarding_completed: false })
  api.status.mockResolvedValue(ready)
  api.save.mockResolvedValue({})
  api.complete.mockResolvedValue({})
})
describe("assistant de configuration", () => {
  it.each(["schoolInfoComplete", "activeYear", "levels", "subjects", "rooms", "fees"] as const)("bloque la finalisation sans %s", async (key) => {
    api.status.mockResolvedValue({ ...ready, [key]: false, canComplete: false, missing: [key] })
    mount("/onboarding?step=5&school=A")
    const button = await screen.findByRole("button", { name: "Accéder au tableau de bord" })
    await screen.findByRole("list", { name: "Prérequis de configuration" })
    expect(button).toBeDisabled()
    expect(api.complete).not.toHaveBeenCalled()
    if (key === "activeYear") expect(screen.getByText(/Le super administrateur doit d’abord ouvrir/)).toBeInTheDocument()
  })
  it("autorise sans professeur et explique les opérations après inscriptions", async () => {
    mount("/onboarding?step=5&school=A")
    const button = await screen.findByRole("button", { name: "Accéder au tableau de bord" })
    await waitFor(() => expect(button).toBeEnabled())
    expect(screen.getByText(/Désignez le professeur principal/)).toBeInTheDocument()
    fireEvent.click(button)
    await waitFor(() => expect(api.complete).toHaveBeenCalledOnce())
    await waitFor(() => expect(localStorage.getItem(progressKey("A"))).toBeNull())
  })
  it("relit les prérequis et ne se fie pas à une ancienne étape finale", async () => {
    localStorage.setItem(progressKey("A"), JSON.stringify({ step: 5 }))
    api.status.mockResolvedValueOnce({ ...ready, rooms: false, canComplete: false }).mockResolvedValue(ready)
    mount()
    await screen.findByText("Complétez les prérequis indiqués ci-dessus avant de terminer.")
    fireEvent.click(screen.getByRole("button", { name: "Actualiser les prérequis" }))
    await waitFor(() => expect(screen.getByRole("button", { name: "Accéder au tableau de bord" })).toBeEnabled())
    expect(api.status).toHaveBeenCalledTimes(2)
  })
  it("affiche une erreur et empêche la finalisation quand la lecture échoue", async () => {
    api.status.mockRejectedValue(new Error("network"))
    mount("/onboarding?step=5&school=A")
    await screen.findByText(/Impossible de vérifier les prérequis/)
    expect(screen.getByRole("button", { name: "Accéder au tableau de bord" })).toBeDisabled()
  })
  it("montre les états de chargement sans autoriser une validation en cache", async () => {
    api.status.mockReturnValue(new Promise(() => {}))
    mount("/onboarding?step=5&school=A")
    await screen.findByText("Vérification des prérequis...")
    expect(screen.getByRole("button", { name: "Accéder au tableau de bord" })).toBeDisabled()
  })
  it("bloque une réponse d’état qui appartient à une autre école", async () => {
    api.status.mockResolvedValue({ ...ready, schoolId: "B" })
    mount("/onboarding?step=5&school=A")
    const button = await screen.findByRole("button", { name: "Accéder au tableau de bord" })
    expect(button).toBeDisabled()
    expect(screen.queryByRole("list", { name: "Prérequis de configuration" })).toBeNull()
  })
  it("relit l’état lorsque l’API refuse une finalisation devenue invalide", async () => {
    api.status.mockResolvedValueOnce(ready).mockResolvedValue({ ...ready, activeYear: false, canComplete: false })
    api.complete.mockRejectedValue(new Error("Année fermée"))
    mount("/onboarding?step=5&school=A")
    const button = await screen.findByRole("button", { name: "Accéder au tableau de bord" })
    await waitFor(() => expect(button).toBeEnabled())
    fireEvent.click(button)
    await screen.findByText(/Le super administrateur doit d’abord ouvrir/)
    await waitFor(() => expect(button).toBeDisabled())
    expect(api.status).toHaveBeenCalledTimes(2)
  })
  it("enregistre les infos puis relit l’état serveur", async () => {
    mount()
    const save = await screen.findByRole("button", { name: "Enregistrer et continuer" })
    fireEvent.click(save)
    await screen.findByRole("heading", { name: "Référentiel scolaire" })
    expect(api.save).toHaveBeenCalledWith({ name: "École A", address: "Abidjan", phone: "2250700000000" })
    expect(api.status).toHaveBeenCalledTimes(2)
  })
  it("masque les actions sans droits et ne charge pas l’état", async () => {
    useAuthStore.setState({ user: { ...useAuthStore.getState().user!, role: "staff" }, permissions: [] })
    mount()
    expect(screen.getByText(/pas le droit de configurer/)).toBeInTheDocument()
    expect(api.school).not.toHaveBeenCalled()
    expect(api.status).not.toHaveBeenCalled()
  })
  it("masque les liens de configuration non autorisés", async () => {
    useAuthStore.setState({ user: { ...useAuthStore.getState().user!, role: "staff" }, permissions: ["settings.school"] })
    mount("/onboarding?step=2&school=A")
    await screen.findByRole("heading", { name: "Référentiel scolaire" })
    expect(screen.queryByRole("link")).not.toBeInTheDocument()
  })
  it.each([
    [2, "Configurer les niveaux", "/academic/levels"], [2, "Configurer les matières", "/academic/subjects"],
    [3, "Configurer les salles", "/rooms"], [3, "Configurer les frais", "/settings"],
    [4, "Importer les profils et contrats", "/import"],
  ])("transmet l’étape %i avec le lien %s", async (step, label, path) => {
    mount(`/onboarding?step=${step}&school=A`)
    const link = await screen.findByRole("link", { name: label as string })
    const url = new URL(link.getAttribute("href")!, "https://school.test")
    expect(url.pathname).toBe(path)
    expect(url.searchParams.get("returnTo")).toBe(`/onboarding?step=${step}&school=A`)
    expect(within(await screen.findByRole("list", { name: "Prérequis de configuration" })).queryByText(/EDT|emploi du temps/)).toBeNull()
    expect(screen.queryByText(/Ajouter le professeur|Ajouter l’élève|Ajouter un créneau/)).not.toBeInTheDocument()
  })
})
