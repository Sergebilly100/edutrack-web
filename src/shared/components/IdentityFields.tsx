import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { NationalityCombobox } from "@/shared/components/NationalityCombobox"
import { BIRTH_PLACE_MAX, SEX_LABELS, birthPlaceError, type IdentityFormValues, type Sex } from "@/shared/lib/identity"

const UNSET = "unset"

type FieldProps = {
  idPrefix: string
  value: IdentityFormValues
  onChange: (next: IdentityFormValues) => void
  disabled?: boolean
  required?: boolean
}

export function SexField({ idPrefix, value, onChange, disabled = false, required = false }: FieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={`${idPrefix}-sex`}>Sexe{required ? " *" : ""}</Label>
      <Select value={value.sex || (required ? "" : UNSET)} disabled={disabled} onValueChange={(next) => onChange({ ...value, sex: next === UNSET ? "" : (next as Sex) })}>
        <SelectTrigger id={`${idPrefix}-sex`} className="min-h-12">
          <SelectValue placeholder={required ? "Choisir" : undefined} />
        </SelectTrigger>
        <SelectContent>
          {required ? null : <SelectItem value={UNSET} className="min-h-12 text-muted-foreground">Non renseigné</SelectItem>}
          {(Object.keys(SEX_LABELS) as Sex[]).map((sex) => <SelectItem key={sex} value={sex} className="min-h-12">{SEX_LABELS[sex]}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  )
}

export function NationalityField({ idPrefix, value, onChange, disabled = false, required = false }: FieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={`${idPrefix}-nationality`}>Nationalité{required ? " *" : ""}</Label>
      <NationalityCombobox id={`${idPrefix}-nationality`} value={value.nationality} disabled={disabled} required={required}
        onChange={(code) => onChange({ ...value, nationality: code })} />
    </div>
  )
}

export function BirthPlaceField({ idPrefix, value, onChange, disabled = false, required = false }: FieldProps) {
  const placeError = birthPlaceError(value.birthPlace)
  return (
    <div className="space-y-2">
      <Label htmlFor={`${idPrefix}-birth-place`}>Lieu de naissance{required ? " *" : ""}</Label>
      <Input id={`${idPrefix}-birth-place`} value={value.birthPlace} maxLength={BIRTH_PLACE_MAX + 20} disabled={disabled}
        placeholder="Ville ou localité" aria-invalid={Boolean(placeError)}
        aria-describedby={placeError ? `${idPrefix}-birth-place-error` : undefined}
        onChange={(event) => onChange({ ...value, birthPlace: event.target.value })} />
      {placeError ? <p id={`${idPrefix}-birth-place-error`} role="alert" className="text-sm text-destructive">{placeError}</p> : null}
    </div>
  )
}

/** Sexe et nationalité (les deux champs d’une ligne). Le lieu de naissance se place à côté de la date de naissance. */
export function IdentityFields(props: FieldProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <SexField {...props} />
      <NationalityField {...props} />
    </div>
  )
}

/** Valeur discrète pour les fiches : « Non renseigné » en texte atténué, jamais de valeur inventée. */
export function IdentityValue({ children }: { children: string | null | undefined }) {
  return children ? <span>{children}</span> : <span className="text-muted-foreground">Non renseigné</span>
}
