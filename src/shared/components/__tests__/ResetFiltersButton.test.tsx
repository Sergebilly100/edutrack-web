import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ResetFiltersButton } from "../ResetFiltersButton"

describe("ResetFiltersButton", () => {
  it("reste absent sans filtre actif et appelle la remise à zéro", () => {
    const onReset = vi.fn()
    const { rerender } = render(<ResetFiltersButton active={false} onReset={onReset} />)
    expect(screen.queryByRole("button", { name: "Réinitialiser les filtres" })).not.toBeInTheDocument()
    rerender(<ResetFiltersButton active onReset={onReset} />)
    fireEvent.click(screen.getByRole("button", { name: "Réinitialiser les filtres" }))
    expect(onReset).toHaveBeenCalledOnce()
  })
})
