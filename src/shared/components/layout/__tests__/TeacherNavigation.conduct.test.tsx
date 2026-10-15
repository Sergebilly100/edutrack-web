import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { teacherActions } = vi.hoisted(() => ({ teacherActions: vi.fn() }))
vi.mock("@/modules/academic/academic.api", () => ({
  fetchConductTeacherActions: () => teacherActions(),
}))

import { TeacherNavigation } from "@/App"
import { useAuthStore } from "@/shared/store/auth.store"

describe("navigation professeur et conduite", () => {
  beforeEach(() => {
    teacherActions.mockReset()
    useAuthStore.setState({
      user: {
        id: "teacher-1", name: "Mariam Coulibaly", role: "teacher", phone: null,
        email: "mariam@example.com", profilePhotoUrl: null, mustChangePassword: false,
        tenantId: "tenant-1", schemaName: "school_test", plan: "standard",
      },
      permissions: [], accessToken: null,
    })
  })

  it("affiche les avis en attente sur Notes sur desktop et mobile, puis retire les badges à la fermeture", async () => {
    teacherActions.mockResolvedValue({ teacherOpenScopes: [{ classId: "c1", pendingCount: 12 }], teacherActions: [{ classId: "c1", pendingCount: 12 }] })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<MemoryRouter><QueryClientProvider client={client}>
      <TeacherNavigation variant="desktop" />
      <TeacherNavigation variant="mobile" />
    </QueryClientProvider></MemoryRouter>)

    expect(await screen.findAllByLabelText("12 avis de conduite à renseigner")).toHaveLength(2)
    expect(screen.queryByRole("link", { name: /^Conduite$/ })).not.toBeInTheDocument()
    teacherActions.mockResolvedValue({ teacherOpenScopes: [], teacherActions: [] })
    await client.invalidateQueries({ queryKey: ["conduct", "teacher-actions"] })
    await waitFor(() => expect(screen.queryByLabelText("12 avis de conduite à renseigner")).not.toBeInTheDocument())
  })
})
