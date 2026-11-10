import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { beforeEach, describe, expect, it } from "vitest"

import { PermissionRoute } from "@/App"
import { useAuthStore } from "@/shared/store/auth.store"

type User = NonNullable<ReturnType<typeof useAuthStore.getState>["user"]>

const mount = (role: string, permissions: string[]) => {
  useAuthStore.setState({ user: { id: "u", role, schemaName: "s", tenantId: "t" } as unknown as User, permissions: permissions as never })
  return render(
    <QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={["/import?type=schedule"]}>
      <Routes>
        <Route path="/import" element={<PermissionRoute href="/import" standalone requiredAnyPermissions={["import.schedule", "import.students", "import.teachers"]} element={<p>Page import</p>} />} />
        <Route path="*" element={<p>Redirigé</p>} />
      </Routes>
    </MemoryRouter></QueryClientProvider>,
  )
}

describe("/import sans entrée de menu (point 15)", () => {
  beforeEach(() => useAuthStore.setState({ user: null, permissions: [] }))

  it("reste accessible à la direction, sans dépendre du menu (assistant, URL directe)", () => {
    mount("director", [])
    expect(screen.getByText("Page import")).toBeInTheDocument()
  })

  it("reste accessible à un profil détenant une permission d'import", () => {
    mount("staff", ["import.schedule"])
    expect(screen.getByText("Page import")).toBeInTheDocument()
  })

  it("redirige un profil sans permission d'import", () => {
    mount("staff", ["students.view"])
    expect(screen.getByText("Redirigé")).toBeInTheDocument()
  })

  it("refuse un professeur même avec une permission d'import", () => {
    mount("teacher", ["import.schedule"])
    expect(screen.getByText("Redirigé")).toBeInTheDocument()
  })
})
