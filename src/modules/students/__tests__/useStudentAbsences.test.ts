import { renderHook, act } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter } from "react-router-dom"
import { createElement } from "react"
import { describe, expect, it, vi } from "vitest"

import { useStudentAbsences } from "@/modules/students/hooks/useStudentAbsences"

vi.mock("@/modules/schedule/schedule.api", () => ({
  fetchWeeklySchedule: vi.fn(async () => ({ catalog: { classes: [] } })),
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
})
