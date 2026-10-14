import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FILTER_HELP } from "./filter-help"

export type AcademicYearOption = { id: string; label: string; status: "active" | "closed" | "draft" }
export type AcademicPeriodOption = { id: string; label: string }

type AcademicContextFiltersProps = {
  years: AcademicYearOption[]
  yearId: string
  onYearChange: (id: string) => void
  activeYear?: AcademicYearOption
  showPeriod: boolean
  allowAllYears: boolean
  allYearsLabel?: string
  yearLabel?: string
  yearIdPrefix: string
  periods?: AcademicPeriodOption[]
  periodId?: string
  onPeriodChange?: (id: string) => void
  allowAllPeriods?: boolean
  yearDisabled?: boolean
  periodDisabled?: boolean
  yearHint?: string
}

export function AcademicContextFilters({
  years, yearId, onYearChange, activeYear, showPeriod, allowAllYears, allYearsLabel = "Toutes les années",
  yearLabel = "Année scolaire", yearIdPrefix, periods = [], periodId = "", onPeriodChange,
  allowAllPeriods = false, yearDisabled = false, periodDisabled = false, yearHint,
}: AcademicContextFiltersProps) {
  const selectedYear = years.find((year) => year.id === yearId)
  const isArchive = selectedYear?.status === "closed"
  const yearControlId = `${yearIdPrefix}-year`
  const periodControlId = `${yearIdPrefix}-period`

  return <div className="space-y-4 border-b border-border pb-4">
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="min-w-0 space-y-2">
        <div className="flex min-h-6 items-center gap-2">
          <Label htmlFor={yearControlId}>{yearLabel}</Label>
          {selectedYear ? <Badge variant="outline" className={isArchive
            ? "border-amber-200 bg-amber-50 text-amber-700"
            : selectedYear.status === "active" ? "border-green-200 bg-green-50 text-green-700" : "text-muted-foreground"}>
            {isArchive ? "Archive" : selectedYear.status === "active" ? "Active" : "En préparation"}
          </Badge> : null}
        </div>
        <Select value={yearDisabled && !years.length ? "" : yearId || (allowAllYears ? "all" : "")} onValueChange={(value) => onYearChange(value === "all" ? "" : value)} disabled={yearDisabled}>
          <SelectTrigger id={yearControlId} className="min-h-12 w-full"><SelectValue placeholder={yearDisabled && !years.length && !activeYear ? "Chargement des années…" : "Choisir une année"} /></SelectTrigger>
          <SelectContent>
            {allowAllYears ? <SelectItem value="all">{allYearsLabel}</SelectItem> : null}
            {years.map((year) => <SelectItem key={year.id} value={year.id}>
              {year.label}{year.status === "active" ? " · Année active" : year.status === "closed" ? " · Année clôturée" : " · En préparation"}
            </SelectItem>)}
          </SelectContent>
        </Select>
        {activeYear ? <p className="text-xs text-muted-foreground">Année active : {activeYear.label}</p> : null}
        {yearHint ? <p className="text-xs text-muted-foreground">{yearHint}</p> : null}
        {isArchive ? <p className="text-xs font-medium text-amber-700">Vous consultez une année archivée.</p> : null}
      </div>
      {showPeriod ? <div className="min-w-0 space-y-2">
        <div className="flex min-h-6 items-center"><Label htmlFor={periodControlId}>Période</Label></div>
        <Select value={periodDisabled && !periods.length ? "" : periodId || (allowAllPeriods ? "all" : "")} onValueChange={(value) => onPeriodChange?.(value === "all" ? "" : value)} disabled={periodDisabled}>
          <SelectTrigger id={periodControlId} aria-describedby={periodDisabled ? `${periodControlId}-help` : undefined} className="min-h-12 w-full"><SelectValue placeholder="Choisir une période" /></SelectTrigger>
          <SelectContent>
            {allowAllPeriods ? <SelectItem value="all">Toutes les périodes</SelectItem> : null}
            {periods.map((period) => <SelectItem key={period.id} value={period.id}>{period.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {periodDisabled ? <p id={`${periodControlId}-help`} className="text-xs text-muted-foreground">
          {!yearId ? FILTER_HELP.year : !periods.length ? FILTER_HELP.unavailable : FILTER_HELP.loading}
        </p> : null}
      </div> : null}
    </div>
  </div>
}
