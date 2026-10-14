import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { FILTER_HELP, type FilterDependency } from "./filter-help"

export type DependentSelectOption = { id: string; label: string }

type DependentSelectProps = {
  id: string
  label: string
  value: string
  onValueChange: (value: string) => void
  options: DependentSelectOption[]
  dependsOn: { field: FilterDependency; value: string }
  placeholder?: string
  allLabel?: string
  helperText?: string
  disabled?: boolean
  loading?: boolean
  invalid?: boolean
}

export function DependentSelect({ id, label, value, onValueChange, options, dependsOn,
  placeholder, allLabel, helperText, disabled = false, loading = false, invalid = false }: DependentSelectProps) {
  const missingParent = !dependsOn.value
  const isDisabled = missingParent || disabled || loading || !options.length
  const help = missingParent ? FILTER_HELP[dependsOn.field]
    : loading ? FILTER_HELP.loading
      : isDisabled ? FILTER_HELP.unavailable : helperText

  return <div className="min-w-0 space-y-2">
    <Label htmlFor={id}>{label}</Label>
    <Select value={value || (allLabel ? "all" : "")} onValueChange={(next) => onValueChange(next === "all" ? "" : next)} disabled={isDisabled}>
      <SelectTrigger id={id} aria-invalid={invalid || undefined} aria-describedby={help ? `${id}-help` : undefined} className={cn("min-h-12 w-full", invalid && "border-destructive")}>
        <SelectValue placeholder={placeholder ?? allLabel ?? `Choisir ${label.toLowerCase()}`} />
      </SelectTrigger>
      <SelectContent>
        {allLabel ? <SelectItem value="all">{allLabel}</SelectItem> : null}
        {options.map((option) => <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>)}
      </SelectContent>
    </Select>
    {help ? <p id={`${id}-help`} className="text-xs text-muted-foreground">{help}</p> : null}
  </div>
}
