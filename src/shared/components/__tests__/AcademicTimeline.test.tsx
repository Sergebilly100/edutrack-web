import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { AcademicTimeline } from "../AcademicTimeline"
import type { GradingPeriod, SchoolYear } from "@/modules/academic/academic.api"

const year = { label: "09/2026 - 06/2027", startDate: "2026-09-01", endDate: "2027-06-30", endOfYearReviewStartDate: "2027-05-31", status: "active" } as SchoolYear
const periods = [
  { id: "first", label: "Semestre 1", startDate: "2026-09-01", reviewStartDate: "2026-12-15", endDate: "2027-01-15", isClosed: true },
  { id: "second", label: "Semestre 2", startDate: "2026-12-15", reviewStartDate: "2027-05-31", endDate: "2027-06-30", isClosed: false },
] as GradingPeriod[]

describe("AcademicTimeline", () => {
  it("adapte ses lignes aux semestres et reprend les mêmes couleurs dans la légende", () => {
    const { container } = render(<AcademicTimeline year={year} periods={periods} currentPeriodId="second" today="2027-02-01" />)
    expect(screen.getByRole("img")).toHaveAttribute("aria-label", expect.stringContaining("Semestre 2"))
    expect(container.querySelectorAll("rect")).toHaveLength(4)
    expect(container.querySelector("rect.fill-blue-300")).toBeTruthy()
    expect(container.querySelector("span.bg-blue-300")).toBeTruthy()
    expect(container.querySelector("rect.fill-blue-700")).toBeTruthy()
    expect(container.querySelector("span.bg-blue-700")).toBeTruthy()
    expect(container.querySelector("rect.fill-slate-300")).toBeTruthy()
    expect(container.querySelector("span.bg-slate-300")).toBeTruthy()
    expect(container.querySelector("rect.fill-slate-600")).toBeTruthy()
    expect(container.querySelector("span.bg-slate-600")).toBeTruthy()
    expect(container.querySelector("path.fill-amber-700")).toBeTruthy()
    expect(container.querySelector("span.bg-amber-700")).toBeTruthy()
    expect(screen.getByText("Période")).toBeVisible()
    expect(screen.getByText("Revue et préparation des bulletins")).toBeVisible()
    expect(screen.getByText("Période clôturée")).toBeVisible()
  })

  it("n’affiche que les statuts et marqueurs présents sur l’année sélectionnée", () => {
    render(<AcademicTimeline year={{ ...year, status: "closed" }} periods={periods} currentPeriodId="" today="2028-01-01" />)
    expect(screen.queryByText("Courante")).not.toBeInTheDocument()
    expect(screen.getByText("Période clôturée")).toBeVisible()
    expect(screen.queryByText("Revue et préparation des bulletins")).not.toBeInTheDocument()
    expect(screen.getByRole("img")).toHaveAttribute("aria-label", expect.stringContaining("hors de cette année"))
  })
})
