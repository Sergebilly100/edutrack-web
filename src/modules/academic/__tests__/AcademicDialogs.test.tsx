import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { ClassDialog } from "@/modules/academic/components/AcademicDialogs"

describe("ClassDialog", () => {
  it("ouvre le formulaire de création sans erreur de contexte FormField", () => {
    render(
      <ClassDialog
        open
        isPending={false}
        schoolClass={null}
        levels={[
          {
            id: "level-1",
            name: "6ème",
            orderIndex: 1,
            isExamClass: false,
            createdAt: "2026-08-27T00:00:00.000Z",
            updatedAt: "2026-08-27T00:00:00.000Z",
          },
        ]}
        teachers={[]}
        teachersLoading={false}
        onOpenChange={vi.fn()}
        onSubmit={vi.fn()}
      />
    )

    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Ajouter une classe" })).toBeInTheDocument()
    expect(screen.getByLabelText("Rechercher un professeur principal")).toBeInTheDocument()
  })
})
