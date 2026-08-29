import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { afterEach, describe, expect, it } from "vitest"

import { TeacherAcademicShellRoute } from "@/App"
import { ThemeProvider } from "@/shared/providers/ThemeProvider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useAuthStore, type AuthUser, type PermissionKey } from "@/shared/store/auth.store"

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: () => ({ matches: false, addEventListener: () => undefined, removeEventListener: () => undefined }),
})

const teacher: AuthUser = {
  id: "teacher-1", name: "Awa Koné", role: "teacher", phone: null, email: null, profilePhotoUrl: null,
  mustChangePassword: false, tenantId: "tenant-1", schemaName: "school-demo", plan: "pro",
}

const renderTeacherRoute = (path: string, label: string, permissions: PermissionKey[] = []) => {
  useAuthStore.setState({ user: teacher, permissions, isSessionRestored: true })
  return render(
    <TooltipProvider>
      <ThemeProvider>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <MemoryRouter initialEntries={[path]}>
            <Routes>
              <Route element={<TeacherAcademicShellRoute />}>
                <Route path="/academic/notes" element={<p>{label}</p>} />
                <Route path="/academic/conduct" element={<p>{label}</p>} />
                <Route path="/academic/conduct/decision" element={<p>{label}</p>} />
              </Route>
              <Route path="/attendance" element={<p>Pointage</p>} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      </ThemeProvider>
    </TooltipProvider>
  )
}

describe("teacher academic routes", () => {
  afterEach(() => useAuthStore.setState({ user: null, permissions: [], isSessionRestored: false }))

  it("laisse un professeur atteindre Notes sans redirection vers le pointage", () => {
    renderTeacherRoute("/academic/notes", "Écran notes")
    expect(screen.getByText("Écran notes")).toBeInTheDocument()
    expect(screen.queryByText("Pointage")).not.toBeInTheDocument()
  })

  it("laisse un professeur atteindre Conduite dans le shell professeur", () => {
    renderTeacherRoute("/academic/conduct", "Écran conduite")
    expect(screen.getByText("Écran conduite")).toBeInTheDocument()
    expect(screen.getByRole("navigation", { name: "Navigation professeur" })).toBeInTheDocument()
  })

  it("laisse le professeur détenteur de conduct.finalize atteindre la décision finale", () => {
    renderTeacherRoute("/academic/conduct/decision", "Décision finale", ["conduct.finalize"])
    expect(screen.getByText("Décision finale")).toBeInTheDocument()
  })
})
