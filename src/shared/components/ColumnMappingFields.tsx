import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export type ColumnMappingField<TTarget extends string> = {
  targetField: TTarget
  sourceColumnLabel: string
  isRequired?: boolean
}

type ColumnMappingFieldsProps<TTarget extends string> = {
  fields: Array<ColumnMappingField<TTarget>>
  headers: string[]
  idPrefix: string
  labels: Record<TTarget, string>
  disabled?: boolean
  onChange: (targetField: TTarget, sourceColumnLabel: string) => void
}

/**
 * Sélecteurs de correspondance communs aux imports Excel.
 * Les règles métier (champs requis, traductions et sauvegarde) restent dans
 * chaque module, afin que ce composant reste purement présentatif.
 */
export function ColumnMappingFields<TTarget extends string>({
  fields,
  headers,
  idPrefix,
  labels,
  disabled = false,
  onChange,
}: ColumnMappingFieldsProps<TTarget>) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {fields.map((field) => (
        <div key={field.targetField} className="space-y-2">
          <Label htmlFor={`${idPrefix}-${field.targetField}`}>
            {labels[field.targetField]} {field.isRequired !== false ? <span className="text-destructive">*</span> : <span className="text-muted-foreground">(facultatif)</span>}
          </Label>
          <Select
            disabled={disabled}
            value={field.sourceColumnLabel || "none"}
            onValueChange={(value) => onChange(field.targetField, value === "none" ? "" : value)}
          >
            <SelectTrigger id={`${idPrefix}-${field.targetField}`} className="min-h-12">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Choisir une colonne</SelectItem>
              {headers.map((header) => (
                <SelectItem key={header} value={header}>{header}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ))}
    </div>
  )
}
