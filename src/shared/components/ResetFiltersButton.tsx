import { Button } from "@/components/ui/button"

type ResetFiltersButtonProps = {
  active: boolean
  onReset: () => void
}

export function ResetFiltersButton({ active, onReset }: ResetFiltersButtonProps) {
  if (!active) return null
  return <Button type="button" variant="outline" className="min-h-12" onClick={onReset}>Réinitialiser les filtres</Button>
}
