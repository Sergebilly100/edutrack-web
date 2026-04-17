import { createContext, useEffect, useMemo, useState, type ReactNode } from "react"

export type Theme = "light" | "dark"
export type ResolvedTheme = "light" | "dark"

export interface ThemeContextValue {
  theme: Theme
  resolvedTheme: ResolvedTheme
  setTheme: (theme: Theme) => void
}

export const THEME_STORAGE_KEY = "edutrack-theme"
const DEFAULT_THEME: Theme = "light"
const SYSTEM_THEME_QUERY = "(prefers-color-scheme: dark)"

export const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

function isTheme(value: string | null): value is Theme {
  return value === "light" || value === "dark"
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") {
    return "light"
  }

  return window.matchMedia(SYSTEM_THEME_QUERY).matches ? "light" : "dark" 
}

function resolveTheme(theme: Theme): ResolvedTheme {
  return theme === "light" ? getSystemTheme() : theme
}

function applyThemeClass(resolvedTheme: ResolvedTheme): void {
  document.documentElement.classList.toggle("dark", resolvedTheme === "dark")
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") {
      return DEFAULT_THEME
    }

    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)
    return isTheme(storedTheme) ? storedTheme : DEFAULT_THEME
  })
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => resolveTheme(theme))

  useEffect(() => {
    const nextResolvedTheme = resolveTheme(theme)
    setResolvedTheme(nextResolvedTheme)
    applyThemeClass(nextResolvedTheme)
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  useEffect(() => {
    const mediaQuery = window.matchMedia(SYSTEM_THEME_QUERY)

    const handleSystemThemeChange = () => {
      if (theme !== "light") {
        return
      }

      const nextResolvedTheme = mediaQuery.matches ? "dark" : "light"
      setResolvedTheme(nextResolvedTheme)
      applyThemeClass(nextResolvedTheme)
    }

    mediaQuery.addEventListener("change", handleSystemThemeChange)
    return () => mediaQuery.removeEventListener("change", handleSystemThemeChange)
  }, [theme])

  const value = useMemo(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
    }),
    [theme, resolvedTheme]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
