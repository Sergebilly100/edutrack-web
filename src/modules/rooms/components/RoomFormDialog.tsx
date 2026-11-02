import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"

type RoomFormState = {
  name: string
  building: string
  capacity: string
  isActive: boolean
  latitude: string
  longitude: string
  geoRadius: string
}

type RoomFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  form: RoomFormState
  setForm: React.Dispatch<React.SetStateAction<RoomFormState>>
  onSubmit: () => void
  isPending: boolean
  showActiveToggle?: boolean
  mode: "create" | "edit"
}

const toNullableCoordinate = (value: string): number | null => {
  const normalized = value.trim()
  if (!normalized) return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

export function RoomFormDialog({
  open,
  onOpenChange,
  form,
  setForm,
  onSubmit,
  isPending,
  showActiveToggle = false,
  mode,
}: RoomFormDialogProps) {
  const { toast } = useToast()

  const capturePosition = () => {
    if (!("geolocation" in navigator)) {
      toast({
        title: "GPS indisponible",
        description: "Ce navigateur ne permet pas de capturer la position.",
        variant: "destructive",
      })
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newLat = String(position.coords.latitude)
        const newLon = String(position.coords.longitude)

        // Ne toaster que si les coordonnées ont changé
        const latChanged = Math.abs(toNullableCoordinate(form.latitude) ?? 0 - position.coords.latitude) > 0.0001
        const lonChanged = Math.abs(toNullableCoordinate(form.longitude) ?? 0 - position.coords.longitude) > 0.0001

        setForm((prev) => ({
          ...prev,
          latitude: newLat,
          longitude: newLon,
        }))

        if (latChanged || lonChanged) {
          toast({ title: "Position capturée" })
        }
      },
      () => {
        toast({
          title: "Position non capturée",
          description: "Autorisez la géolocalisation puis réessayez.",
          variant: "destructive",
        })
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Ajouter une salle" : "Modifier la salle"}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Le QR token sera généré automatiquement."
              : "Mettez à jour les informations de salle."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor={`room-name-${mode}`}>Nom de la salle</Label>
            <Input id={`room-name-${mode}`} required value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`room-building-${mode}`}>Bâtiment (optionnel)</Label>
            <Input id={`room-building-${mode}`} value={form.building} onChange={(event) => setForm((prev) => ({ ...prev, building: event.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`room-capacity-${mode}`}>Capacité (optionnel)</Label>
            <Input id={`room-capacity-${mode}`} placeholder="Ex: 30" inputMode="numeric" value={form.capacity} onChange={(event) => setForm((prev) => ({ ...prev, capacity: event.target.value }))} />
          </div>
          {showActiveToggle ? (
            <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-border px-3 text-sm">
              <Checkbox checked={form.isActive} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, isActive: checked === true }))} />
              <span>Salle active</span>
            </label>
          ) : null}
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor={`room-latitude-${mode}`}>Latitude GPS</Label>
              <Input id={`room-latitude-${mode}`} inputMode="decimal" value={form.latitude} onChange={(event) => setForm((prev) => ({ ...prev, latitude: event.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`room-longitude-${mode}`}>Longitude GPS</Label>
              <Input id={`room-longitude-${mode}`} inputMode="decimal" value={form.longitude} onChange={(event) => setForm((prev) => ({ ...prev, longitude: event.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`room-georadius-${mode}`}>Rayon GPS (m)</Label>
              <Input id={`room-georadius-${mode}`} inputMode="numeric" value={form.geoRadius} onChange={(event) => setForm((prev) => ({ ...prev, geoRadius: event.target.value }))} />
            </div>
          </div>
          <Button type="button" variant="outline" onClick={capturePosition}>
            Capturer ma position
          </Button>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={onSubmit} disabled={isPending}>
            {mode === "create" ? "Ajouter" : "Sauvegarder"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
