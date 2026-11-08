import { cn } from "@/lib/utils"

export type StatusTone = "success" | "danger" | "warning" | "neutral" | "info"

const tones: Record<StatusTone, string> = {
  success: "bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-300",
  danger: "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-300",
  warning: "bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  neutral: "bg-muted text-muted-foreground",
  info: "bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
}

/** Pastille de statut : le texte porte toujours l'information, jamais la couleur seule. */
export function StatusPill({ tone, children, className }: { tone: StatusTone; children: string; className?: string }) {
  return <span className={cn("inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold", tones[tone], className)}>{children}</span>
}
