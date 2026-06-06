import type { CSSProperties, KeyboardEvent } from "react"

import { cn } from "@/lib/utils"
import type { ScheduleRow } from "@/modules/schedule/schedule.api"
import { WarningIcon } from "@/shared/components/icons"

interface SlotCardProps {
  slot: ScheduleRow
  height: number
  /** Nombre de sous-colonnes du groupe de collision - détermine la densité d'info affichée */
  columnCount?: number
  onClick: () => void
  isBlockedTeacher?: boolean
  className?: string
  style?: CSSProperties
}

export default function SlotCard({
  slot,
  height,
  columnCount = 1,
  onClick,
  isBlockedTeacher = false,
  className,
  style,
}: SlotCardProps) {
  /**
   * FIX BUG 2 - Règles d'affichage adaptatif selon la densité :
   *
   * - compact  : height < 40 ou columnCount ≥ 4 → sujet seul
   * - reduced  : height < 56 ou columnCount ≥ 3 → sujet + classe (pas de prof)
   * - normal   : height ≥ 80 et columnCount ≤ 2 → sujet + classe + prof
   */
  const isNarrow = columnCount >= 3
  const compact = height < 40 || columnCount >= 4
  const showClass = !compact && height >= 36
  const showTeacher = !isNarrow && height >= 80

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      onClick()
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      style={style}
      className={cn(
        "absolute rounded-md border p-1 text-[10px] leading-tight shadow-sm transition-[background-color,border-color,box-shadow,transform] duration-150 ease-out-quint hover:-translate-y-px hover:shadow-md",
        "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        // FIX BUG 2 : taille de texte adaptative selon le nombre de colonnes
        columnCount >= 3 ? "text-[9px]" : "text-[11px]",
        isBlockedTeacher && "ring-1 ring-red-300",
        className
      )}
      aria-label={`${slot.subject} ${slot.class.name} ${slot.teacher.name}`}
    >
      {isBlockedTeacher ? (
        <WarningIcon className="absolute right-1 top-1 h-3 w-3 text-red-600" />
      ) : null}

      <p className="truncate font-semibold leading-tight">{slot.subject}</p>

      {showClass ? <p className="truncate opacity-75">{slot.class.name}</p> : null}

      {showTeacher ? <p className="truncate opacity-60">{slot.teacher.name}</p> : null}
    </div>
  )
}
