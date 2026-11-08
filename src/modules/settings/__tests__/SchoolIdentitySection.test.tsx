import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"

const api = vi.hoisted(() => ({
  fetchSchoolIdentity: vi.fn(),
  previewSchoolImage: vi.fn(),
  saveSchoolSeal: vi.fn(),
  setSealRemoveWhite: vi.fn(),
  deleteSchoolSeal: vi.fn(),
  fetchSealImage: vi.fn(),
  fetchLegacySealImage: vi.fn(),
  deleteLegacySeal: vi.fn(),
  uploadSchoolLogo: vi.fn(),
  importSchoolLogoFromUrl: vi.fn(),
  deleteSchoolLogo: vi.fn(),
}))
const toastMock = vi.hoisted(() => vi.fn())

vi.mock("../settings.api", () => api)
vi.mock("@/components/ui/use-toast", () => ({ useToast: () => ({ toast: toastMock }) }))

import { SchoolIdentitySection } from "../identity/SchoolIdentitySection"

const EMPTY = { logo: null, seal: null, legacy: { stamp: false, signature: false } }
const SAVED_SEAL = { fileName: "cachet.png", mime: "image/png", sizeBytes: 128 * 1024, width: 1200, height: 600, removeWhite: false, updatedAt: "2026-11-04T10:00:00.000Z" }

const renderSection = (canManage = true) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <SchoolIdentitySection canManage={canManage} />
    </QueryClientProvider>
  )

const pickFile = (container: HTMLElement, within_: HTMLElement, file: File) => {
  const input = within_.querySelector<HTMLInputElement>('input[type="file"]')!
  expect(input).toBeTruthy()
  fireEvent.change(input, { target: { files: [file] } })
  return container
}

const sealCard = async () => within(await screen.findByRole("region", { name: /Cachet et signature/ }))
const sealRegion = async () => (await screen.findByRole("region", { name: /Cachet et signature/ })) as HTMLElement
const logoRegion = async () => (await screen.findByRole("region", { name: /Logo de l'établissement/ })) as HTMLElement

beforeEach(() => {
  vi.resetAllMocks()
  api.fetchSchoolIdentity.mockResolvedValue(EMPTY)
  api.previewSchoolImage.mockResolvedValue(new Blob(["png"], { type: "image/png" }))
  api.fetchSealImage.mockResolvedValue(new Blob(["png"], { type: "image/png" }))
  api.fetchLegacySealImage.mockResolvedValue(new Blob(["png"], { type: "image/png" }))
  URL.createObjectURL = vi.fn(() => "blob:preview")
  URL.revokeObjectURL = vi.fn()
  globalThis.createImageBitmap = vi.fn(async () => ({ width: 1200, height: 600, close: vi.fn() })) as never
})

describe("Identité visuelle des documents", () => {
  it("état initial : « Non défini », zone de dépôt personnalisée, aucun champ natif tronqué", async () => {
    const { container } = renderSection()
    const card = await sealCard()
    expect(card.getByText("Non défini")).toBeInTheDocument()
    expect(card.getByText("Glissez-déposez votre image ici")).toBeInTheDocument()
    expect(card.getByRole("button", { name: "Parcourir" })).toBeInTheDocument()
    expect(card.getByText(/PNG à fond transparent recommandé/)).toBeInTheDocument()
    expect(card.getByText("Aucune image")).toBeInTheDocument()
    expect(container.textContent).not.toMatch(/paraphe|responsable/i)
    expect(screen.getByText("Utilisés sur les bulletins PDF, dans le cadre « Le chef de l'établissement »."))
  })

  it("dépôt : aperçu avant enregistrement, rien n’est enregistré sans confirmation", async () => {
    const { container } = renderSection()
    const region = await sealRegion()
    pickFile(container, region, new File(["x"], "cachet-signature-directeur.jpg", { type: "image/jpeg" }))

    expect(await within(region).findByText("cachet-signature-directeur.jpg")).toBeInTheDocument()
    expect(within(region).getByText("Non enregistrée")).toBeInTheDocument()
    expect(within(region).getByText("Rien n'est enregistré avant confirmation.")).toBeInTheDocument()
    expect(within(region).getByRole("switch", { name: "Retirer le fond blanc" })).toBeChecked() // scan JPEG : activé par défaut
    expect(api.previewSchoolImage).toHaveBeenCalledWith("seal", expect.any(File), true)
    expect(api.saveSchoolSeal).not.toHaveBeenCalled()
  })

  it("annuler abandonne l’aperçu sans rien enregistrer", async () => {
    const { container } = renderSection()
    const region = await sealRegion()
    pickFile(container, region, new File(["x"], "a.png", { type: "image/png" }))
    fireEvent.click(await within(region).findByRole("button", { name: "Annuler" }))
    expect(await within(region).findByText("Non défini")).toBeInTheDocument()
    expect(api.saveSchoolSeal).not.toHaveBeenCalled()
  })

  it("le retrait du fond blanc recalcule l’aperçu serveur ; enregistrer envoie le choix puis affiche l’état enregistré", async () => {
    api.saveSchoolSeal.mockResolvedValue({ ...EMPTY, seal: SAVED_SEAL })
    const { container } = renderSection()
    const region = await sealRegion()
    pickFile(container, region, new File(["x"], "c.png", { type: "image/png" }))
    const toggle = await within(region).findByRole("switch", { name: "Retirer le fond blanc" })
    expect(toggle).not.toBeChecked() // PNG : pas activé par défaut
    fireEvent.click(toggle)
    await waitFor(() => expect(api.previewSchoolImage).toHaveBeenLastCalledWith("seal", expect.any(File), true))

    fireEvent.click(within(region).getByRole("button", { name: "Enregistrer" }))
    await waitFor(() => expect(api.saveSchoolSeal).toHaveBeenCalledWith(expect.any(File), true, expect.any(Function)))
    expect(await within(region).findByText("Enregistré")).toBeInTheDocument()
    expect(within(region).getByRole("button", { name: "Remplacer" })).toBeInTheDocument()
    expect(within(region).getByText(/importé le/)).toBeInTheDocument()
    expect(toastMock).toHaveBeenCalledWith({ title: "Image enregistrée" })
  })

  it("erreurs lisibles : format, taille, et refus serveur (fichier corrompu)", async () => {
    const { container } = renderSection()
    const region = await sealRegion()
    pickFile(container, region, new File(["x"], "a.svg", { type: "image/svg+xml" }))
    expect(await within(region).findByRole("alert")).toHaveTextContent(/Format non supporté/)
    expect(api.previewSchoolImage).not.toHaveBeenCalled()

    api.previewSchoolImage.mockRejectedValueOnce({ response: { data: { error: "Le fichier est corrompu ou illisible." } } })
    pickFile(container, region, new File(["x"], "b.png", { type: "image/png" }))
    expect(await within(region).findByText("Le fichier est corrompu ou illisible.")).toBeInTheDocument()
  })

  it("image enregistrée : suppression avec confirmation, annulable", async () => {
    api.fetchSchoolIdentity.mockResolvedValue({ ...EMPTY, seal: SAVED_SEAL })
    api.deleteSchoolSeal.mockResolvedValue(EMPTY)
    renderSection()
    const region = await sealRegion()
    fireEvent.click(await within(region).findByRole("button", { name: "Supprimer" }))

    const dialog = await screen.findByRole("alertdialog", { name: "Supprimer le cachet et la signature ?" })
    fireEvent.click(within(dialog).getByRole("button", { name: "Annuler" }))
    expect(api.deleteSchoolSeal).not.toHaveBeenCalled()

    fireEvent.click(within(region).getByRole("button", { name: "Supprimer" }))
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Supprimer" }))
    await waitFor(() => expect(api.deleteSchoolSeal).toHaveBeenCalledTimes(1))
    expect(await within(region).findByText("Non défini")).toBeInTheDocument()
  })

  it("sans permission : aperçu visible mais aucun bouton d’action ni zone de dépôt", async () => {
    api.fetchSchoolIdentity.mockResolvedValue({ logo: { url: "https://cdn.test/logo.png", fileName: "logo.png", mime: "image/png", sizeBytes: 1000, width: 100, height: 100, updatedAt: null }, seal: SAVED_SEAL, legacy: { stamp: false, signature: false } })
    renderSection(false)
    const seal = await sealRegion()
    const logo = await logoRegion()
    expect(await within(seal).findByText("cachet.png")).toBeInTheDocument()
    for (const region of [seal, logo]) {
      expect(within(region).queryByRole("button", { name: /Remplacer|Supprimer|Parcourir|Enregistrer/ })).toBeNull()
    }
    expect(screen.queryByText(/Options avancées/)).toBeNull()
  })

  it("anciens fichiers : zone repliée avec message et suppression individuelle confirmée", async () => {
    api.fetchSchoolIdentity.mockResolvedValue({ ...EMPTY, legacy: { stamp: true, signature: true } })
    api.deleteLegacySeal.mockResolvedValue({ ...EMPTY, legacy: { stamp: false, signature: true } })
    renderSection()
    const region = await sealRegion()
    expect(await within(region).findByText(/Vous utilisez encore deux images séparées/)).toBeInTheDocument()
    fireEvent.click(within(region).getByRole("button", { name: /Anciens fichiers \(cachet et signature séparés\) · 2/ }))
    expect(await within(region).findByText(/Importez une image unique pour remplacer ces deux fichiers/)).toBeInTheDocument()

    fireEvent.click(within(region).getAllByRole("button", { name: "Supprimer" })[0])
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Supprimer" }))
    await waitFor(() => expect(api.deleteLegacySeal).toHaveBeenCalled())
    expect(api.deleteLegacySeal.mock.calls[0]?.[0]).toBe("stamp")
  })

  it("erreur de chargement : message et réessai", async () => {
    api.fetchSchoolIdentity.mockRejectedValueOnce(new Error("réseau"))
    renderSection()
    expect(await screen.findByRole("alert")).toHaveTextContent(/Impossible de charger/)
    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }))
    expect(await sealCard()).toBeTruthy()
  })
})

describe("Logo", () => {
  it("même parcours aperçu puis confirmation, sans option fond blanc", async () => {
    api.uploadSchoolLogo.mockResolvedValue({ ...EMPTY, logo: { url: "https://cdn.test/l.png", fileName: "logo.png", mime: "image/png", sizeBytes: 1000, width: 400, height: 400, updatedAt: "2026-11-07T10:00:00.000Z" } })
    const { container } = renderSection()
    const region = await logoRegion()
    pickFile(container, region, new File(["x"], "logo.png", { type: "image/png" }))
    expect(await within(region).findByText("Non enregistré")).toBeInTheDocument()
    expect(within(region).queryByRole("switch")).toBeNull()
    expect(api.uploadSchoolLogo).not.toHaveBeenCalled()
    fireEvent.click(within(region).getByRole("button", { name: "Enregistrer" }))
    await waitFor(() => expect(api.uploadSchoolLogo).toHaveBeenCalled())
    expect(await within(region).findByText("Enregistré")).toBeInTheDocument()
  })

  it("refuse un nouveau SVG avant envoi", async () => {
    const { container } = renderSection()
    const region = await logoRegion()
    pickFile(container, region, new File(["<svg/>"], "logo.svg", { type: "image/svg+xml" }))
    expect(await within(region).findByRole("alert")).toHaveTextContent(/PNG, JPEG ou WebP/)
    expect(api.previewSchoolImage).not.toHaveBeenCalled()
  })

  it("adresse d’image : discrète, replie par défaut ; l’erreur serveur est affichée", async () => {
    api.importSchoolLogoFromUrl.mockRejectedValueOnce({ response: { data: { error: "Cette adresse n’est pas autorisée." } } })
    renderSection()
    const region = await logoRegion()
    expect(within(region).queryByLabelText(/Adresse de l'image/)).toBeNull()
    fireEvent.click(within(region).getByRole("button", { name: /Options avancées : utiliser une adresse d'image/ }))
    fireEvent.change(await within(region).findByLabelText(/Adresse de l'image/), { target: { value: "https://127.0.0.1/logo.png" } })
    fireEvent.click(within(region).getByRole("button", { name: "Importer depuis cette adresse" }))
    expect(await within(region).findByRole("alert")).toHaveTextContent("Cette adresse n’est pas autorisée.")
  })

  it("logo enregistré : Remplacer et Supprimer visibles", async () => {
    api.fetchSchoolIdentity.mockResolvedValue({ ...EMPTY, logo: { url: "https://cdn.test/l.png", fileName: "logo-flamboyants.png", mime: "image/png", sizeBytes: 128 * 1024, width: 400, height: 400, updatedAt: "2026-11-04T10:00:00.000Z" } })
    renderSection()
    const region = await logoRegion()
    expect(await within(region).findByText("logo-flamboyants.png")).toBeInTheDocument()
    expect(within(region).getByRole("button", { name: "Remplacer" })).toBeInTheDocument()
    expect(within(region).getByRole("button", { name: "Supprimer" })).toBeInTheDocument()
  })
})
