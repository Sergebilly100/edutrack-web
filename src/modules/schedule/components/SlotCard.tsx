import type { CSSProperties, KeyboardEvent } from "react"

import { cn } from "@/lib/utils"
import type { ScheduleRow } from "@/modules/schedule/schedule.api"
import { WarningIcon } from "@/shared/components/icons"

interface SlotCardProps {
  slot: ScheduleRow
  height: number
  onClick: () => void
  isBlockedTeacher?: boolean
  className?: string
  style?: CSSProperties
}

export default function SlotCard({
  slot,
  height,
  onClick,
  isBlockedTeacher = false,
  className,
  style,
}: SlotCardProps) {
  const compact = height < 40
  const showTeacher = height >= 80

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
        "absolute left-1 right-1 rounded-md border border-l-2 p-1.5 text-[11px] leading-tight transition-all hover:brightness-95",
        "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        className
      )}
      aria-label={`${slot.subject} ${slot.class.name} ${slot.teacher.name}`}
    >
      {isBlockedTeacher ? (
        <WarningIcon className="absolute right-1 top-1 h-2.5 w-2.5 text-red-600" />
      ) : null}

      <p className="truncate font-semibold">{slot.subject}</p>

      {!compact ? <p className="truncate opacity-75">{slot.class.name}</p> : null}

      {showTeacher ? <p className="truncate opacity-60">{slot.teacher.name}</p> : null}
    </div>
  )
}
