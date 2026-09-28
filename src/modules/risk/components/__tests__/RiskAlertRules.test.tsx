import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import type { RiskAlertRule, SaveRiskAlertRuleInput } from "../../risk.api"

const { fetchRulesMock, saveRuleMock, toastMock } = vi.hoisted(() => ({
  fetchRulesMock: vi.fn(), saveRuleMock: vi.fn(), toastMock: vi.fn(),
}))
vi.mock("@/modules/risk/risk.api", () => ({ fetchRiskAlertRules: fetchRulesMock, saveRiskAlertRule: saveRuleMock }))
vi.mock("@/components/ui/use-toast", () => ({ useToast: () => ({ toast: toastMock }) }))

import { RiskAlertRules } from "../RiskAlertRules"

let rules: RiskAlertRule[]
beforeAll(() => vi.stubGlobal("ResizeObserver", class {
  observe() {}
  unobserve() {}
  disconnect() {}
}))
afterAll(() => vi.unstubAllGlobals())
const renderRules = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(<QueryClientProvider client={client}><RiskAlertRules /></QueryClientProvider>)
  return client
}
const editor = async (name: string) => within(await screen.findByRole("form", { name, exact: true }))
const save = (scope: ReturnType<typeof within>) => scope.getByRole("button", { name: /^Enregistrer :/ })

describe("RiskAlertRules", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    rules = [
      { id: "1", subjectType: "student", signalType: "absences", thresholdValue: 3, periodDays: 30, isActive: true },
      { id: "2", subjectType: "student", signalType: "grades", thresholdValue: 2, periodDays: 0, isActive: true },
      { id: "3", subjectType: "student", signalType: "payments", thresholdValue: 1, periodDays: 0, isActive: true },
      { id: "4", subjectType: "teacher", signalType: "absences", thresholdValue: 3, periodDays: 30, isActive: true },
    ]
    fetchRulesMock.mockImplementation(async () => rules)
    saveRuleMock.mockImplementation(async (input: SaveRiskAlertRuleInput) => {
      const previous = rules.find((rule) => rule.subjectType === input.subjectType && rule.signalType === input.signalType)
      rules = [...rules.filter((rule) => rule !== previous), { id: previous?.id ?? "5", ...input }]
    })
  })

  it("sépare les populations et affiche la période fixe sans faux champ financier", async () => {
    renderRules()
    expect(await screen.findByRole("region", { name: "Élèves", exact: true })).toBeInTheDocument()
    expect(screen.getByRole("region", { name: "Professeurs", exact: true })).toBeInTheDocument()
    expect(screen.getAllByRole("form")).toHaveLength(5)
    expect(screen.getAllByRole("button", { name: /^Enregistrer :/ })).toHaveLength(5)
    for (const button of screen.getAllByRole("button", { name: /^Enregistrer :/ })) expect(button).toBeDisabled()
    const financial = await editor("Situation financière en retard")
    expect(financial.queryByRole("spinbutton")).not.toBeInTheDocument()
    const lateness = await editor("Retards professeur")
    expect(lateness.getAllByRole("spinbutton")).toHaveLength(2)
    expect(lateness.getByText("Sur les 30 derniers jours, période fixe.")).toBeInTheDocument()
    expect(screen.queryByText(/cache financier/)).not.toBeInTheDocument()
  })

  it("requiert un seuil explicite et enregistre les minutes sur 30 jours", async () => {
    renderRules()
    const scope = await editor("Retards professeur")
    expect(scope.getByLabelText("Nombre de retards")).toHaveValue(null)
    expect(scope.getByLabelText("Tolérance en minutes")).toHaveValue(15)
    expect(scope.getByRole("status")).toHaveTextContent("À configurer")
    expect(save(scope)).toBeDisabled()
    fireEvent.change(scope.getByLabelText("Nombre de retards"), { target: { value: "4" } })
    fireEvent.change(scope.getByLabelText("Tolérance en minutes"), { target: { value: "5" } })
    fireEvent.click(scope.getByRole("checkbox"))
    await waitFor(() => expect(save(scope)).toBeEnabled())
    fireEvent.click(save(scope))
    await waitFor(() => expect(saveRuleMock).toHaveBeenCalledWith({
      subjectType: "teacher", signalType: "lateness", thresholdValue: 4, periodDays: 30, lateMinutes: 5, isActive: true,
    }))
    await waitFor(() => expect(scope.getByRole("status")).toHaveTextContent("Enregistré"))
    expect(save(scope)).toBeDisabled()
  })

  it("enregistre les absences modifiées sans ajouter de réglage de pointage", async () => {
    renderRules()
    const scope = await editor("Absences élèves")
    fireEvent.change(scope.getByLabelText("Nombre d'absences"), { target: { value: "4" } })
    await waitFor(() => expect(save(scope)).toBeEnabled())
    fireEvent.click(save(scope))
    await waitFor(() => expect(saveRuleMock).toHaveBeenCalledWith({
      subjectType: "student", signalType: "absences", thresholdValue: 4, periodDays: 30, isActive: true,
    }))
    await waitFor(() => expect(scope.getByRole("status")).toHaveTextContent("Enregistré"))
  })

  it("explique le seuil manquant même lorsque le signal des retards est désactivé", async () => {
    renderRules()
    const scope = await editor("Retards professeur")
    fireEvent.change(scope.getByLabelText("Tolérance en minutes"), { target: { value: "0" } })
    expect(await scope.findByRole("alert")).toHaveTextContent("Saisissez un nombre entier de retards entre 1 et 999.")
    expect(scope.getByLabelText("Nombre de retards")).toHaveAttribute("aria-invalid", "true")
    expect(scope.getByRole("checkbox")).not.toBeChecked()
    expect(save(scope)).toBeDisabled()
    fireEvent.change(scope.getByLabelText("Nombre de retards"), { target: { value: "2" } })
    await waitFor(() => expect(save(scope)).toBeEnabled())
    fireEvent.click(save(scope))
    await waitFor(() => expect(saveRuleMock).toHaveBeenCalledWith(expect.objectContaining({ lateMinutes: 0, isActive: false })))
  })

  it("annule uniquement les modifications de la règle concernée", async () => {
    renderRules()
    const student = await editor("Absences élèves")
    const teacher = await editor("Absences professeur")
    fireEvent.change(student.getByLabelText("Nombre d'absences"), { target: { value: "4" } })
    fireEvent.change(teacher.getByLabelText("Nombre d'absences"), { target: { value: "6" } })
    fireEvent.click(await student.findByRole("button", { name: /^Annuler les modifications :/ }))
    expect(student.getByLabelText("Nombre d'absences")).toHaveValue(3)
    expect(save(student)).toBeDisabled()
    expect(teacher.getByLabelText("Nombre d'absences")).toHaveValue(6)
    expect(teacher.getByRole("status")).toHaveTextContent("Modifications non enregistrées")
  })

  it("isole la sauvegarde et conserve les changements effectués pendant la requête", async () => {
    let finish!: () => void
    saveRuleMock.mockImplementationOnce((input: SaveRiskAlertRuleInput) => new Promise<void>((resolve) => {
      finish = () => {
        rules = rules.map((rule) => rule.subjectType === input.subjectType && rule.signalType === input.signalType ? { ...rule, ...input } : rule)
        resolve()
      }
    }))
    renderRules()
    const student = await editor("Absences élèves")
    const teacher = await editor("Absences professeur")
    fireEvent.change(student.getByLabelText("Nombre d'absences"), { target: { value: "4" } })
    fireEvent.change(teacher.getByLabelText("Nombre d'absences"), { target: { value: "6" } })
    await waitFor(() => expect(save(student)).toBeEnabled())
    fireEvent.click(save(student))
    await waitFor(() => expect(student.getByRole("status")).toHaveTextContent("Enregistrement en cours"))
    expect(teacher.getByRole("status")).toHaveTextContent("Modifications non enregistrées")
    expect(save(teacher)).toBeEnabled()
    fireEvent.click(save(student))
    expect(saveRuleMock).toHaveBeenCalledTimes(1)
    fireEvent.change(student.getByLabelText("Nombre d'absences"), { target: { value: "5" } })
    await act(async () => finish())
    await waitFor(() => expect(student.getByRole("status")).toHaveTextContent("Modifications non enregistrées"))
    expect(student.getByLabelText("Nombre d'absences")).toHaveValue(5)
    expect(teacher.getByLabelText("Nombre d'absences")).toHaveValue(6)
    fireEvent.click(student.getByRole("button", { name: /^Annuler les modifications :/ }))
    expect(student.getByLabelText("Nombre d'absences")).toHaveValue(4)
  })

  it("ne restaure pas une ancienne valeur après deux sauvegardes successives", async () => {
    let finishWrite!: () => void
    let finishRead!: () => void
    saveRuleMock.mockImplementationOnce((input: SaveRiskAlertRuleInput) => new Promise<void>((resolve) => {
      finishWrite = () => {
        rules = rules.map((rule) => rule.subjectType === input.subjectType && rule.signalType === input.signalType ? { ...rule, ...input } : rule)
        resolve()
      }
    }))
    renderRules()
    const scope = await editor("Absences élèves")
    const threshold = scope.getByLabelText("Nombre d'absences")
    fireEvent.change(threshold, { target: { value: "4" } })
    await waitFor(() => expect(save(scope)).toBeEnabled())
    fireEvent.click(save(scope))
    await waitFor(() => expect(scope.getByRole("status")).toHaveTextContent("Enregistrement en cours"))
    fireEvent.change(threshold, { target: { value: "5" } })
    await act(async () => finishWrite())
    await waitFor(() => expect(fetchRulesMock).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(scope.getByRole("status")).toHaveTextContent("Modifications non enregistrées"))
    fetchRulesMock.mockImplementationOnce(() => new Promise<RiskAlertRule[]>((resolve) => { finishRead = () => resolve(rules) }))
    fireEvent.click(save(scope))
    await waitFor(() => expect(scope.getByRole("status")).toHaveTextContent("Enregistré"))
    expect(threshold).toHaveValue(5)
    expect(save(scope)).toBeDisabled()
    await act(async () => finishRead())
    expect(threshold).toHaveValue(5)
  })

  it("conserve les valeurs après un échec et permet de réessayer", async () => {
    saveRuleMock.mockRejectedValueOnce(new Error("Internal API details"))
    renderRules()
    const scope = await editor("Absences élèves")
    fireEvent.change(scope.getByLabelText("Nombre d'absences"), { target: { value: "7" } })
    await waitFor(() => expect(save(scope)).toBeEnabled())
    fireEvent.click(save(scope))
    await waitFor(() => expect(scope.getByRole("status")).toHaveTextContent("Enregistrement impossible"))
    expect(scope.getByLabelText("Nombre d'absences")).toHaveValue(7)
    expect(scope.queryByText("Internal API details")).not.toBeInTheDocument()
    fireEvent.click(save(scope))
    await waitFor(() => expect(scope.getByRole("status")).toHaveTextContent("Enregistré"))
    expect(saveRuleMock).toHaveBeenCalledTimes(2)
  })

  it("préserve le brouillon si une actualisation échoue", async () => {
    const client = renderRules()
    const scope = await editor("Absences professeur")
    fireEvent.change(scope.getByLabelText("Nombre d'absences"), { target: { value: "8" } })
    fetchRulesMock.mockRejectedValueOnce(new Error("Offline"))
    await act(async () => { await client.invalidateQueries({ queryKey: ["risk", "rules"] }) })
    expect(await screen.findByText("Actualisation impossible")).toBeInTheDocument()
    expect(scope.getByLabelText("Nombre d'absences")).toHaveValue(8)
    expect(scope.getByRole("status")).toHaveTextContent("Modifications non enregistrées")
  })

  it("permet de relancer le chargement initial", async () => {
    fetchRulesMock.mockRejectedValueOnce(new Error("Offline"))
    renderRules()
    const retry = await screen.findByRole("button", { name: "Réessayer" })
    fireEvent.click(retry)
    expect(await screen.findByRole("form", { name: "Absences élèves" })).toBeInTheDocument()
  })
})
