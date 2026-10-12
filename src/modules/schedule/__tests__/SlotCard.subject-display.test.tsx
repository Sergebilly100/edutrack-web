import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import SlotCard from "../components/SlotCard"
import type { ScheduleRow } from "../schedule.api"

const slot = {
  id: "slot-1",
  subject: "Mathématiques",
  subjectDisplay: "Maths",
  class: { id: "class-1", name: "6ème A" },
  teacher: { id: "teacher-1", name: "Mme Koné" },
  timeSlot: { id: "time-slot-1", label: "07:15 – 08:05", startTime: "07:15", endTime: "08:05", sortOrder: 435 },
} as ScheduleRow

describe("SlotCard subject display", () => {
  it("shows exact flexible minutes in the grid card", () => {
    render(<SlotCard slot={slot} height={54} onClick={vi.fn()} />)
    expect(screen.getByText("07:15–08:05")).toBeInTheDocument()
    expect(screen.getByRole("button")).toHaveAttribute("title", "07:15 – 08:05")
  })
  it("shows the abbreviation while retaining the canonical name in its accessible label", () => {
    render(<SlotCard slot={slot} height={90} onClick={vi.fn()} />)
    expect(screen.getByText("Maths")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Mathématiques/ })).toBeInTheDocument()
  })

  it("falls back to the stored subject", () => {
    render(<SlotCard slot={{ ...slot, subjectDisplay: "" }} height={90} onClick={vi.fn()} />)
    expect(screen.getByText("Mathématiques")).toBeInTheDocument()
  })
})
