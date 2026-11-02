import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useAuthStore } from "@/shared/store/auth.store"
import OnboardingFocusLayout from "../OnboardingFocusLayout"
import { configurationLink } from "../onboarding.progress"
import OnboardingFeesPage from "../OnboardingFeesPage"

const mocks = vi.hoisted(() => ({
  school: vi.fn(),
  years: vi.fn(),
  levels: vi.fn(),
  plans: vi.fn(),
  save: vi.fn(),
  toast: vi.fn(),
}))

vi.mock("../onboarding.api", () => ({ fetchSchoolInfo: mocks.school }))
vi.mock("@/modules/academic/academic.api", () => ({
  listSchoolYears: mocks.years,
  listLevels: mocks.levels,
}))
vi.mock("@/modules/finance/finance.api", () => ({
  listTuitionPlans: mocks.plans,
  upsertTuitionPlan: mocks.save,
}))
vi.mock("@/shared/hooks/usePermissions", () => ({
  usePermissions: () => ({ hasPermission: () => true }),
}))
vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}))

const year = {
  id: "year-1",
  label: "2026-2027",
  startDate: "2026-09-01",
  endDate: "2027-07-01",
  endOfYearReviewStartDate: "2027-06-01",
  gradingPeriodType: "trimester" as const,
  status: "active" as const,
  createdAt: "",
  updatedAt: "",
}
const levels = [
  { id: "level-1", name: "6ème", orderIndex: 1, isExamClass: false, createdAt: "", updatedAt: "" },
  { id: "level-2", name: "5ème", orderIndex: 2, isExamClass: false, createdAt: "", updatedAt: "" },
]
const plan = {
  id: "plan-1",
  levelId: "level-1",
  levelName: "6ème",
  schoolYearId: "year-1",
  schoolYearLabel: "2026-2027",
  totalAmount: 180000,
  registrationAmount: 25000,
  currency: "FCFA",
  scheduleSteps: [{ dueDate: "2026-10-01", cumulativeAmountExpected: 80000 }],
}

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[configurationLink("/onboarding/fees", "school-id", 3)]}>
        <Routes>
          <Route path="/onboarding/fees" element={<OnboardingFocusLayout />}>
            <Route index element={<OnboardingFeesPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  useAuthStore.setState({
    user: { id: "director", role: "director", schemaName: "school_test", tenantId: "school-id" } as NonNullable<ReturnType<typeof useAuthStore.getState>["user"]>,
    permissions: ["tuition.edit"],
  })
  mocks.school.mockResolvedValue({ id: "school-id" })
  mocks.years.mockResolvedValue([year])
  mocks.levels.mockResolvedValue(levels)
  mocks.plans.mockResolvedValue([])
  mocks.save.mockResolvedValue(plan)
})

describe("page focus des frais de scolarité", () => {
  it("affiche uniquement le formulaire dédié avec l’année active et le montant d’inscription", async () => {
    mount()

    expect(await screen.findByRole("heading", { name: "Frais de scolarité" })).toBeInTheDocument()
    expect(screen.getByText("Année 2026-2027")).toBeInTheDocument()
    expect(await screen.findByLabelText("Montant à verser à l’inscription (FCFA)")).toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "Paramètres école" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Revoir le guide" })).not.toBeInTheDocument()
    expect(screen.getByText("Étape 3 sur 5 · Salles et frais")).toBeInTheDocument()
  })

  it("enregistre le montant annuel et le versement à l’inscription sur le plan du niveau", async () => {
    mount()

    fireEvent.change(await screen.findByLabelText("Montant annuel (FCFA)"), { target: { value: "180000" } })
    fireEvent.change(screen.getByLabelText("Montant à verser à l’inscription (FCFA)"), { target: { value: "25000" } })
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer les frais" }))

    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith("level-1", {
      schoolYearId: "year-1",
      totalAmount: 180000,
      registrationAmount: 25000,
      currency: "FCFA",
      scheduleSteps: [],
    }))
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Frais enregistrés" }))
  })

  it("demande confirmation avant de remplacer les frais d’un autre niveau", async () => {
    mocks.plans.mockResolvedValue([plan, { ...plan, id: "plan-2", levelId: "level-2", levelName: "5ème" }])
    mount()

    fireEvent.click(await screen.findByRole("button", { name: "Copier ces frais vers 5ème" }))
    expect(await screen.findByRole("alertdialog")).toHaveTextContent("Remplacer le plan de frais existant")
    fireEvent.click(screen.getByRole("button", { name: "Remplacer le plan" }))

    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith("level-2", expect.objectContaining({
      totalAmount: 180000,
      registrationAmount: 25000,
    })))
  })
})
