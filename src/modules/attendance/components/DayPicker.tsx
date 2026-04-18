import { Button } from "@/components/ui/button"
import { ChevronLeftIcon, ChevronRightIcon } from "@/shared/components/icons"
import { cn } from "@/lib/utils"

interface DayPickerProps {
  selectedDate: Date
  onChange: (date: Date) => void
  highlightDates?: Date[]
}

// Lundi → Samedi (6 jours)
const WEEKDAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"]

const startOfWeekMonday = (date: Date) => {
  const copy = new Date(date)
  const day = copy.getDay()
  const diff = day === 0 ? -6 : 1 - day
  copy.setDate(copy.getDate() + diff)
  copy.setHours(0, 0, 0, 0)
  return copy
}

const addDays = (date: Date, amount: number) => {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + amount)
  return copy
}

const toDateKey = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

const isSameDay = (left: Date, right: Date) => toDateKey(left) === toDateKey(right)

export default function DayPicker({ selectedDate, onChange, highlightDates = [] }: DayPickerProps) {
  const weekStart = startOfWeekMonday(selectedDate)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // 6 jours : lundi (0) → samedi (5)
  const days = Array.from({ length: 6 }, (_, index) => addDays(weekStart, index))
  const highlights = new Set(highlightDates.map(toDateKey))

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0 rounded-xl"
          onClick={() => onChange(addDays(selectedDate, -7))}
          aria-label="Semaine précédente"
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </Button>

        {/* Les 6 boutons remplissent l'espace disponible avec flex-1 — pas de scroll */}
        <div className="flex flex-1 gap-1">
          {days.map((day, index) => {
            const selected = isSameDay(day, selectedDate)
            const isToday = isSameDay(day, today)
            const highlighted = highlights.has(toDateKey(day))

            return (
              <button
                key={toDateKey(day)}
                type="button"
                onClick={() => onChange(day)}
                className={cn(
                  "relative flex flex-1 flex-col items-center justify-center rounded-xl px-0.5 py-2 min-h-[56px] text-center transition-colors",
                  selected
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                )}
                aria-pressed={selected}
              >
                <span
                  className={cn(
                    "text-[10px] font-medium leading-none",
                    selected ? "text-primary-foreground/90" : "",
                    isToday && !selected ? "text-primary font-semibold" : ""
                  )}
                >
                  {isToday ? "Auj." : WEEKDAY_LABELS[index]}
                </span>
                <span className="mt-0.5 text-sm font-semibold tabular-nums leading-none">
                  {day.getDate()}
                </span>
                {highlighted ? (
                  <span
                    className={cn(
                      "mt-1 h-1 w-1 rounded-full",
                      selected ? "bg-primary-foreground" : "bg-primary"
                    )}
                  />
                ) : (
                  <span className="mt-1 h-1 w-1" />
                )}
              </button>
            )
          })}
        </div>

        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0 rounded-xl"
          onClick={() => onChange(addDays(selectedDate, 7))}
          aria-label="Semaine suivante"
        >
          <ChevronRightIcon className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

export { startOfWeekMonday, toDateKey }
