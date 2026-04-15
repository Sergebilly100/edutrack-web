import { useContext } from "react"

import { ThemeContext, type ThemeContextValue } from "@/shared/providers/ThemeProvider"

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)

  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider")
  }

  return context
}
