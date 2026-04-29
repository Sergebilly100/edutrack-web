import { useMemo, useState } from "react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { addDaysIso, addMonthsIso } from "@/shared/lib/business-date"

type PaymentMethod = "cash" | "momo_mtn" | "momo_orange"
type DurationMonths = 1 | 2 | 3

type RenewSubscriptionPayload = {
  duration_months: DurationMonths
  payment_method: PaymentMethod
  paid_now: boolean
}

type RenewSubscriptionModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  parentFullName: string
  studentsCount: number
  currentEndsAt: string
  unitPriceFcfa: number
  isSubmitting?: boolean
  onSubmit: (payload: RenewSubscriptionPayload) => Promise<void>
}

const formatFcfa = (value: number) =>
  `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value)} FCFA`

const formatDateFr = (isoDate: string) =>
  new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${isoDate}T00:00:00.000Z`))

const addMonths = (isoDate: string, months: number) => {
  const startsAt = addDaysIso(isoDate, 1)
  return addMonthsIso(startsAt, months)
}

export default function RenewSubscriptionModal({
  open,
  onOpenChange,
  parentFullName,
  studentsCount,
  currentEndsAt,
  unitPriceFcfa,
  isSubmitting = false,
  onSubmit,
}: RenewSubscriptionModalProps) {
  const [durationMonths, setDurationMonths] = useState<DurationMonths>(1)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash")
  const [paidNow, setPaidNow] = useState(true)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const nextEndsAt = useMemo(() => addMonths(currentEndsAt, durationMonths), [currentEndsAt, durationMonths])
  const amount = unitPriceFcfa * studentsCount * durationMonths

  const resetLocalState = () => {
    setDurationMonths(1)
    setPaymentMethod("cash")
    setPaidNow(true)
    setSubmitError(null)
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      resetLocalState()
    }
    onOpenChange(nextOpen)
  }

  const handleSubmit = async () => {
    setSubmitError(null)
    try {
      await onSubmit({
        duration_months: durationMonths,
        payment_method: paymentMethod,
        paid_now: paidNow,
      })
      handleOpenChange(false)
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Impossible de renouveler l'abonnement")
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Renouveler l'abonnement</DialogTitle>
          <DialogDescription>Renouvelez la souscription sans modifier les élèves rattachés.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
            <p>Parent : <span className="font-medium">{parentFullName}</span></p>
            <p>Élèves rattachés : <span className="font-medium">{studentsCount}</span></p>
            <p>Expiration actuelle : <span className="font-medium">{formatDateFr(currentEndsAt)}</span></p>
          </div>

          <div className="space-y-2">
            <Label>Durée</Label>
            <Select value={String(durationMonths)} onValueChange={(value) => setDurationMonths(Number(value) as DurationMonths)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 mois</SelectItem>
                <SelectItem value="2">2 mois</SelectItem>
                <SelectItem value="3">3 mois</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Méthode de paiement</Label>
            <Select value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Espèces</SelectItem>
                <SelectItem value="momo_mtn">MTN MoMo</SelectItem>
                <SelectItem value="momo_orange">Orange Money</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <label className="flex items-center justify-between rounded-lg border border-border p-3">
            <span className="text-sm font-medium">Payé maintenant</span>
            <Checkbox checked={paidNow} onCheckedChange={(value) => setPaidNow(value === true)} />
          </label>

          <div className="space-y-2 rounded-lg border border-border p-3 text-sm">
            <p className="font-medium">Projection</p>
            <Separator />
            <p>Montant total : <span className="font-semibold">{formatFcfa(amount)}</span></p>
            <p>Nouvel abonnement jusqu'au <span className="font-semibold">{formatDateFr(nextEndsAt)}</span></p>
          </div>

          {submitError ? (
            <Alert variant="destructive">
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          ) : null}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            Annuler
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Renouvellement..." : "Renouveler"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export type { DurationMonths, PaymentMethod, RenewSubscriptionModalProps, RenewSubscriptionPayload }
