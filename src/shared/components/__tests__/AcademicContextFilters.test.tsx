import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { AcademicContextFilters } from "../AcademicContextFilters"

const years = [
  { id: "active", label: "2026-2027", status: "active" as const },
  { id: "archived", label: "2025-2026", status: "closed" as const },
]
const periods = [{ id: "first", label: "Premier trimestre" }]

describe("AcademicContextFilters", () => {
  it("shows the active year, current period and matching help", () => {
    render(<AcademicContextFilters yearIdPrefix="test" years={years} yearId="active" activeYear={years[0]}
      onYearChange={vi.fn()} showPeriod allowAllYears={false} periods={periods} periodId="first" onPeriodChange={vi.fn()} />)
    expect(screen.getByRole("combobox", { name: "Année scolaire" })).toHaveTextContent("2026-2027")
    expect(screen.getByRole("combobox", { name: "Période" })).toHaveTextContent("Premier trimestre")
    expect(screen.getByText("Active")).toBeInTheDocument()
    expect(screen.getByText("Année active : 2026-2027")).toBeInTheDocument()
    expect(screen.queryByText("Vous consultez une année archivée.")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("combobox", { name: "Année scolaire" }))
    expect(screen.queryByRole("option", { name: "Toutes les années" })).not.toBeInTheDocument()
  })

  it("shows archive help, omits period and keeps the existing all years option", () => {
    const onYearChange = vi.fn()
    render(<AcademicContextFilters yearIdPrefix="archive" years={years} yearId="archived" activeYear={years[0]}
      onYearChange={onYearChange} showPeriod={false} allowAllYears yearLabel="Année d’origine clôturée" />)
    expect(screen.getByRole("combobox", { name: "Année d’origine clôturée" })).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "Année d’origine clôturée" }).closest(".grid")).not.toHaveClass("sm:grid-cols-2")
    expect(screen.queryByRole("combobox", { name: "Période" })).not.toBeInTheDocument()
    expect(screen.getByText("Archive")).toBeInTheDocument()
    expect(screen.getByText("Vous consultez une année archivée.")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("combobox", { name: "Année d’origine clôturée" }))
    fireEvent.click(screen.getByRole("option", { name: "Toutes les années" }))
    expect(onYearChange).toHaveBeenCalledWith("")
  })

  it("annonce l'année précise requise pour une période désactivée", () => {
    render(<AcademicContextFilters yearIdPrefix="all" years={years} yearId="" onYearChange={vi.fn()}
      showPeriod allowAllYears periods={periods} periodDisabled onPeriodChange={vi.fn()} />)
    expect(screen.getByRole("combobox", { name: "Période" })).toBeDisabled()
    expect(screen.getByRole("combobox", { name: "Période" })).toHaveAccessibleDescription("Choisissez une année précise.")
  })
})
