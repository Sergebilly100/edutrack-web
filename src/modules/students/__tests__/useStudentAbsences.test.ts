import { renderHook, act, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter } from "react-router-dom"
import { createElement } from "react"
import { describe, expect, it, vi } from "vitest"

import { useStudentAbsences } from "@/modules/students/hooks/useStudentAbsences"

vi.mock("@/modules/academic/academic.api", () => ({
  listClasses: vi.fn(async () => ({ classes: [
    { id: "cls-1", name: "3ème A", level: { id: "level-1", name: "3ème" } },
    { id: "cls-2", name: "4ème A", level: { id: "level-2", name: "4ème" } },
  ] })),
  listLevels: vi.fn(async () => [{ id: "level-1", name: "3ème" }, { id: "level-2", name: "4ème" }]),
  listSubjects: vi.fn(async (levelId: string) => levelId === "level-1"
    ? [{ id: "subject-1", name: "Math", levelId: "level-1" }]
    : [{ id: "subject-2", name: "SVT", levelId: "level-2" }]),
}))

vi.mock("@/modules/teachers/teachers.api", () => ({
  fetchTeacherOptions: vi.fn(async () => []),
}))

vi.mock("@/modules/students/students.api", () => ({
  getStudentAbsenceStats: vi.fn(async () => []),
}))

const makeWrapper = (initialSearch = "") => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: React.ReactNode }) =>
    createElement(
      MemoryRouter,
      { initialEntries: [`/?${initialSearch}`] },
      createElement(QueryClientProvider, { client: qc }, children)
    )
}

describe("useStudentAbsences", () => {
  it("initialise les valeurs par défaut au mois courant", () => {
    const { result } = renderHook(() => useStudentAbsences(), {
      wrapper: makeWrapper(),
    })

    const now = new Date()
    const monthStr = String(now.getMonth() + 1).padStart(2, "0")
    const yearStr = String(now.getFullYear())

    expect(result.current.formValues.from).toMatch(`${yearStr}-${monthStr}`)
    expect(result.current.formValues.sms_status).toBe("all")
    expect(result.current.formValues.min_absences).toBe(1)
  })

  it("queryEnabled est false sans run=1 dans l'URL", () => {
    const { result } = renderHook(() => useStudentAbsences(), {
      wrapper: makeWrapper(),
    })

    expect(result.current.queryEnabled).toBe(false)
  })

  it("queryEnabled est true avec run=1 dans l'URL", () => {
    const { result } = renderHook(() => useStudentAbsences(), {
      wrapper: makeWrapper("run=1"),
    })

    expect(result.current.queryEnabled).toBe(true)
  })

  it("handleReset supprime run des params", () => {
    const { result } = renderHook(() => useStudentAbsences(), {
      wrapper: makeWrapper("run=1&class_id=cls-1"),
    })

    act(() => {
      result.current.handleReset()
    })

    expect(result.current.queryEnabled).toBe(false)
    expect(result.current.formValues.class_id).toBe("all")
  })

  it("setFormValues met à jour les valeurs du formulaire", () => {
    const { result } = renderHook(() => useStudentAbsences(), {
      wrapper: makeWrapper(),
    })

    act(() => {
      result.current.setFormValues((current) => ({ ...current, min_absences: 5 }))
    })

    expect(result.current.formValues.min_absences).toBe(5)
  })

  it("lit class_id depuis l'URL", () => {
    const { result } = renderHook(() => useStudentAbsences(), {
      wrapper: makeWrapper("class_id=cls-abc&run=1"),
    })

    expect(result.current.filters.classId).toBe("cls-abc")
  })

  it("sms_status=all produit undefined dans filters.smsStatus", () => {
    const { result } = renderHook(() => useStudentAbsences(), {
      wrapper: makeWrapper("run=1&sms_status=all"),
    })

    expect(result.current.filters.smsStatus).toBeUndefined()
  })

  it("lit le niveau de l'URL et l'envoie avec la classe à l'analyse", () => {
    const { result } = renderHook(() => useStudentAbsences(), {
      wrapper: makeWrapper("tab=absences&run=1&level_id=level-1&class_id=cls-1"),
    })
    expect(result.current.filters.levelId).toBe("level-1")
    expect(result.current.filters.classId).toBe("cls-1")
  })

  it("réinitialise le niveau sans toucher au filtre de liste", () => {
    const { result } = renderHook(() => useStudentAbsences(), {
      wrapper: makeWrapper("tab=absences&run=1&level_id=level-1&list_level=level-2"),
    })
    act(() => result.current.handleReset())
    expect(result.current.filters.levelId).toBeUndefined()
    expect(result.current.formValues.level_id).toBe("all")
  })

  it("efface une classe d'un autre niveau avant l'application", async () => {
    const { result } = renderHook(() => useStudentAbsences(), {
      wrapper: makeWrapper("tab=absences&level_id=level-1&class_id=cls-1"),
    })
    await waitFor(() => expect(result.current.classesQuery.isSuccess).toBe(true))
    act(() => result.current.setFormValues((current) => ({ ...current, level_id: "level-2" })))
    await waitFor(() => expect(result.current.formValues.class_id).toBe("all"))
    act(() => result.current.handleApply())
    expect(result.current.filters.levelId).toBe("level-2")
    expect(result.current.filters.classId).toBeUndefined()
  })

  it("adapte les matières au niveau et retire la matière précédente", async () => {
    const { result } = renderHook(() => useStudentAbsences(), {
      wrapper: makeWrapper("tab=absences&level_id=level-1&subject=Math"),
    })
    await waitFor(() => expect(result.current.subjectsOptions).toEqual(["Math"]))
    act(() => result.current.setFormValues((current) => ({ ...current, level_id: "level-2", subject: "" })))
    await waitFor(() => expect(result.current.subjectsOptions).toEqual(["SVT"]))
    expect(result.current.formValues.subject).toBe("")
  })
})
