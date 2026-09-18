import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { Progress } from "../progress"

describe("Progress", () => {
  it("renders a visible primary indicator for the supplied percentage", () => {
    render(<Progress value={64} aria-label="Taux de conformité" />)

    const progress = screen.getByRole("progressbar", { name: "Taux de conformité" })
    const indicator = progress.firstElementChild

    expect(indicator).toHaveClass("bg-primary")
    expect(indicator).toHaveStyle({ transform: "translateX(-36%)" })
  })
})
