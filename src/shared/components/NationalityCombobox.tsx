import { useMemo, useState } from "react"
import { Check, ChevronDown, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { foldText, getCountryName, listCountries } from "@/shared/lib/nationality"

type NationalityComboboxProps = {
  id: string
  value: string
  onChange: (code: string) => void
  disabled?: boolean
  required?: boolean
  "aria-describedby"?: string
}

/** Liste de pays en français, Côte d’Ivoire en tête, filtrée par saisie (accents et casse ignorés). */
export function NationalityCombobox({ id, value, onChange, disabled = false, required = false, ...rest }: NationalityComboboxProps) {
  const [search, setSearch] = useState("")
  const [open, setOpen] = useState(false)
  const countries = useMemo(() => listCountries(), [])
  const filtered = useMemo(() => {
    const needle = foldText(search)
    return needle ? countries.filter((country) => foldText(country.name).includes(needle)) : countries
  }, [countries, search])

  const select = (code: string) => { onChange(code); setSearch(""); setOpen(false) }

  return (
    <DropdownMenu modal={false} open={open} onOpenChange={(next) => { setOpen(next); if (!next) setSearch("") }}>
      <DropdownMenuTrigger asChild>
        <Button id={id} type="button" variant="outline" disabled={disabled} aria-describedby={rest["aria-describedby"]}
          className="min-h-12 w-full justify-between font-normal">
          <span className={cn("truncate", !value && "text-muted-foreground")}>{value ? getCountryName(value) : required ? "Choisir un pays" : "Non renseignée"}</span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-[16rem] p-0">
        <div className="relative p-2" onKeyDown={(event) => event.stopPropagation()}>
          <Search className="pointer-events-none absolute left-5 top-5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher un pays"
            className="pl-9" aria-label="Rechercher un pays" autoFocus />
        </div>
        <div className="max-h-64 overflow-y-auto p-1" role="listbox" aria-label="Nationalité">
          {!search && !required ? (
            <Button type="button" variant="ghost" role="option" aria-selected={!value} className="min-h-12 w-full justify-start font-normal text-muted-foreground" onClick={() => select("")}>
              Non renseignée
            </Button>
          ) : null}
          {filtered.length === 0 ? <p className="p-3 text-sm text-muted-foreground">Aucun pays trouvé.</p> : filtered.map((country) => (
            <Button key={country.code} type="button" variant="ghost" role="option" aria-selected={country.code === value}
              className={cn("min-h-12 w-full justify-between font-normal", country.code === value && "bg-primary/5")} onClick={() => select(country.code)}>
              <span className="truncate">{country.name}</span>
              {country.code === value ? <Check className="h-4 w-4 shrink-0" aria-hidden="true" /> : null}
            </Button>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
