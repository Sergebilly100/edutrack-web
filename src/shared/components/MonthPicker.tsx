import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatMonthLabel, getCurrentMonth } from "@/shared/utils/month"

type MonthPickerProps = {
  value: string
  onChange: (month: string) => void
  /**
   * Liste des mois à afficher (du plus récent au plus ancien), déjà filtrée.
   * Quand fournie (via useSchoolYearMonths ou useParentSchoolYearMonths),
   * elle est utilisée telle quelle.
   * Sans cette prop, fallback sur les 12 derniers mois sans mois futurs.
   */
  months?: string[]
  className?: string
  placeholder?: string
}

export function MonthPicker({ value, onChange, months, className, placeholder }: MonthPickerProps) {
  const today = getCurrentMonth()

  const options: string[] = months && months.length > 0
    ? months
    : Array.from({ length: 12 }, (_, i) => {
        const [y, mo] = today.split("-").map(Number)
        const d = new Date(Date.UTC(y, (mo ?? 1) - 1 - i, 1))
        return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
      })

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder ?? "Sélectionner un mois"} />
      </SelectTrigger>
      <SelectContent>
        {options.map((m) => (
          <SelectItem key={m} value={m}>
            {formatMonthLabel(m)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
