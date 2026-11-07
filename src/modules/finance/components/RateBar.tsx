import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

/** Taux 0–1 → pourcentage entier borné à 0–100. */
export const ratePercent = (rate: number): number => Math.min(100, Math.max(0, Math.round(rate * 100)))

type RateBarProps = { rate: number; label: string; className?: string; barClassName?: string }

/** Barre de progression fine. Le texte du pourcentage reste affiché à côté par l'appelant. */
export function RateBar({ rate, label, className, barClassName }: RateBarProps) {
  return <div className={cn("min-w-0", className)}><Progress value={ratePercent(rate)} aria-label={label} className={cn("h-1.5", barClassName)} /></div>
}
