import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { MoonIcon, SunIcon } from "@/shared/components/icons"
import { useTheme } from "@/shared/hooks/useTheme"

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme()
  const isDark = resolvedTheme === "dark"
  const nextTheme = isDark ? "light" : "dark"
  const tooltipLabel = `Thème ${isDark ? "sombre" : "clair"}`

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn("shrink-0", className)}
          onClick={() => setTheme(nextTheme)}
          aria-label={`Basculer le thème (actuel: ${isDark ? "Sombre" : "Clair"}, prochain: ${isDark ? "Clair" : "Sombre"})`}
        >
          {isDark ? (
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
