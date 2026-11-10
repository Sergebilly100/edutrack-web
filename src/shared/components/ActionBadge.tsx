import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

type ActionBadgeProps = {
  count: number | undefined
  /** Une ligne par action à effectuer : affichée en infobulle et lue par les lecteurs d'écran. */
  details?: string[]
  label?: string
  className?: string
}

const pillClass = "inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10px] font-semibold text-white"

/** Pastille « action à effectuer » (menu, groupes, onglets). N'affiche rien à 0. */
export function ActionBadge({ count, details, label, className }: ActionBadgeProps) {
  if (!count || count <= 0) return null
  const summary = details?.length ? details.join(" ; ") : undefined
  const ariaLabel = label ?? `${count} action${count > 1 ? "s" : ""} à effectuer${summary ? ` : ${summary}` : ""}`
  if (!details?.length) {
    return <span aria-label={ariaLabel} className={cn(pillClass, className)}>{count}</span>
  }
  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          {/* title : repli au toucher (appui long) ; l'infobulle s'ouvre au survol. */}
          <span aria-label={ariaLabel} title={summary} className={cn(pillClass, className)}>{count}</span>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-xs">
          <p className="mb-1 font-medium">{count} action{count > 1 ? "s" : ""} à effectuer</p>
          <ul className="list-disc space-y-0.5 pl-4">{details.map((line) => <li key={line}>{line}</li>)}</ul>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
