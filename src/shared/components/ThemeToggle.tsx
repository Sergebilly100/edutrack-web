import { Moon, Sun } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { useTheme } from "@/shared/hooks/useTheme"
import type { Theme } from "@/shared/providers/ThemeProvider"

const themeCycle: Theme[] = ["light", "dark", "system"]

const themeLabelMap: Record<Theme, string> = {
  light: "Clair",
  dark: "Sombre",
  system: "Système",
}

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, resolvedTheme, setTheme } = useTheme()

  const currentThemeIndex = themeCycle.indexOf(theme)
  const nextTheme = themeCycle[(currentThemeIndex + 1) % themeCycle.length]

  const tooltipLabel =
    theme === "system"
      ? `Thème ${themeLabelMap[theme]} (${resolvedTheme === "dark" ? "sombre" : "clair"})`
      : `Thème ${themeLabelMap[theme]}`

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn("shrink-0", className)}
          onClick={() => setTheme(nextTheme)}
          aria-label={`Basculer le thème (actuel: ${themeLabelMap[theme]}, prochain: ${themeLabelMap[nextTheme]})`}
        >
          {resolvedTheme === "dark" ? (
            <Moon className="animate-in fade-in zoom-in-75 duration-150" />
          ) : (
            <Sun className="animate-in fade-in zoom-in-75 duration-150" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{tooltipLabel}</TooltipContent>
    </Tooltip>
  )
}
