import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { MoonIcon, SunIcon } from "@/shared/components/icons"
import { useTheme } from "@/shared/hooks/useTheme"
import type { Theme } from "@/shared/providers/ThemeProvider"

const themeCycle: Theme[] = ["light", "dark"]

const themeLabelMap: Record<Theme, string> = {
  light: "Clair",
  dark: "Sombre",
}

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, resolvedTheme, setTheme } = useTheme()

  const currentThemeIndex = themeCycle.indexOf(theme)
  const nextTheme = themeCycle[(currentThemeIndex + 1) % themeCycle.length]

  const tooltipLabel =
    theme === "light"
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
            <MoonIcon className="animate-in fade-in zoom-in-75 duration-150" />
          ) : (
            <SunIcon className="animate-in fade-in zoom-in-75 duration-150" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{tooltipLabel}</TooltipContent>
    </Tooltip>
  )
}
