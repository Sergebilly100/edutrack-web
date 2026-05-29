import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import AttendanceSheet from "@/modules/students/components/AttendanceSheet"
import type { StudentItem } from "@/modules/students/students.api"

const students: StudentItem[] = [
  {
    id: "student-2",
    classId: "class-1",
    className: "3eme A",
    firstName: "Awa",
    lastName: "Zadi",
    matricule: null,
    birthDate: null,
    parentPhone: "2250700000001",
    parentPhone2: null,
    isActive: true,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "student-1",
    classId: "class-1",
    className: "3eme A",
    firstName: "Mariam",
    lastName: "Bamba",
    matricule: null,
    birthDate: null,
    parentPhone: "2250700000002",
    parentPhone2: null,
    isActive: true,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
]

describe("AttendanceSheet", () => {
  it("trie la liste par nom de famille", () => {
    render(
      <AttendanceSheet
        open
        onOpenChange={vi.fn()}
        students={students}
        scheduleLabel="07h30 - 09h00"
        isPending={false}
        onSubmit={vi.fn(async () => undefined)}
      />
    )

    const firstStudent = screen.getByText("Bamba Mariam")
    expect(firstStudent).toBeInTheDocument()
  })

  it("toggle absent puis soumet les ids sélectionnés", async () => {
    const onSubmit = vi.fn<(ids: string[]) => Promise<void>>(async () => undefined)

    render(
      <AttendanceSheet
        open
        onOpenChange={vi.fn()}
        students={students}
        scheduleLabel="07h30 - 09h00"
        isPending={false}
        onSubmit={onSubmit}
      />
    )

    fireEvent.click(screen.getAllByRole("button", { name: "Présent" })[0]!)
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer 1 absence" }))
    fireEvent.click(screen.getByRole("button", { name: "Confirmer" }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit.mock.calls[0]?.[0]).toHaveLength(1)
  })
})
