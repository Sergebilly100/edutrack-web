import { useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import type { SalarySummaryItem, SalaryTeacherDetails } from "@/modules/salaries/salaries.api"
import {
  computePayAmount,
  formatHoursCount,
  getHoursAlreadyPaid,
  getHoursRemainingToPay,
  validateHoursToPay,
} from "@/modules/salaries/salaries.helpers"
import { DetailDialog } from "@/shared/components/DetailDialog"
import { KeyFigure } from "@/shared/components/KeyFigure"
import { QueryErrorState } from "@/shared/components/QueryErrorState"
import { formatFcfa } from "@/shared/utils/formatting"

type PayMode = "all" | "precise"

export type MarkPaidDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  row: SalarySummaryItem | null
  details: SalaryTeacherDetails | null
  isLoading: boolean
  isError: boolean
  onRetry: () => void
  /** « septembre 2026 » : libellé du mois payé. */
  monthLabel: string
  isSubmitting: boolean
  /** Même charge utile qu'avant : heures à payer + notes. Peut être asynchrone. */
  onConfirm: (input: { hoursToPay: number; notes: string }) => void | Promise<void>
}

export function MarkPaidDialog({ open, onOpenChange, row, details, isLoading, isError, onRetry, monthLabel, isSubmitting, onConfirm }: MarkPaidDialogProps) {
  const [mode, setMode] = useState<PayMode>("all")
  const [hoursInput, setHoursInput] = useState("")
  const [notes, setNotes] = useState("")
  // Verrou synchrone : empêche un double clic de partir avant que isSubmitting ne soit rendu.
  const submitLock = useRef(false)

  const hourlyRate = details?.teacher.hourlyRate ?? null
  const hoursDone = details?.summary.hoursDone ?? 0
  const hoursPlanned = details?.summary.hoursPlanned ?? 0
  const hoursPaid = getHoursAlreadyPaid(details)
  const remainingHours = getHoursRemainingToPay(details)
  const remainingAmount = computePayAmount(remainingHours, hourlyRate)

  const validation = validateHoursToPay(hoursInput, remainingHours)
  const hoursToPay = mode === "all" ? remainingHours : validation.hours
  const payAmount = hoursToPay === null ? null : computePayAmount(hoursToPay, hourlyRate)
  const remainingAfterHours = hoursToPay === null ? null : Math.max(0, Math.round((remainingHours - hoursToPay) * 100) / 100)
  const nothingToPay = Boolean(details) && remainingHours <= 0
  const canConfirm = Boolean(row?.salaryRecordId) && Boolean(details) && !nothingToPay && hoursToPay !== null && hoursToPay > 0 && !isSubmitting

  const handleConfirm = async () => {
    if (!canConfirm || hoursToPay === null || submitLock.current) return
    submitLock.current = true
    try {
      await onConfirm({ hoursToPay, notes: notes.trim() })
    } finally {
      submitLock.current = false
    }
  }

  const confirmLabel = isSubmitting
    ? "Enregistrement…"
    : payAmount !== null && !nothingToPay
      ? `Confirmer le paiement de ${formatFcfa(payAmount)}`
      : "Confirmer le paiement"

  return (
    <DetailDialog
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      title="Marquer comme payé"
      initialsOf={row?.teacherName}
      subtitle={row ? `${row.teacherName} · Vacataire · ${monthLabel}` : undefined}
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {nothingToPay ? "Fermer" : "Annuler"}
          </Button>
          {nothingToPay ? null : (
            <Button type="button" disabled={!canConfirm} onClick={() => void handleConfirm()} className="sm:min-w-64">
              {confirmLabel}
            </Button>
          )}
        </div>
      }
    >
      {isLoading ? (
        <div className="space-y-4" aria-busy="true" aria-label="Chargement des informations de paiement">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : isError || !details ? (
        <QueryErrorState message="Impossible de charger les informations de paiement." onRetry={onRetry} />
      ) : (
        <>
          <div className="grid grid-cols-3 divide-x">
            <KeyFigure variant="plain" label="Heures prévues" value={formatHoursCount(hoursPlanned)} className="pr-4" />
            <KeyFigure variant="plain" label="Heures effectuées" value={formatHoursCount(hoursDone)} className="px-4" />
            <KeyFigure variant="plain" label="Déjà payées" value={formatHoursCount(hoursPaid)} className="pl-4" />
          </div>

          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 rounded-lg bg-blue-50 p-4 dark:bg-blue-950/40">
            <div>
              <p className="text-sm font-medium text-blue-700 dark:text-blue-200">Reste à payer</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {formatHoursCount(remainingHours)} · {formatFcfa(remainingAmount)}
              </p>
            </div>
            {hourlyRate !== null ? (
              <p className="text-sm text-muted-foreground">Taux horaire : {formatFcfa(hourlyRate)} / h</p>
            ) : null}
          </div>

          {nothingToPay ? (
            <p className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">Rien à payer pour cette période.</p>
          ) : (
            <>
              <fieldset className="space-y-3">
                <legend className="text-base font-semibold">Que souhaitez-vous payer ?</legend>
                <RadioGroup value={mode} onValueChange={(value) => setMode(value as PayMode)} className="gap-3">
                  <Label
                    htmlFor="pay-mode-all"
                    className={cn("flex min-h-14 cursor-pointer items-center justify-between gap-3 rounded-lg border px-4 py-3 text-base font-semibold", mode === "all" && "border-primary bg-blue-50 dark:bg-blue-950/40")}
                  >
                    <span className="flex items-center gap-3">
                      <RadioGroupItem id="pay-mode-all" value="all" />
                      Tout le reste
                    </span>
                    <span className="text-sm font-normal text-muted-foreground tabular-nums">
                      {formatHoursCount(remainingHours)} · {formatFcfa(remainingAmount)}
                    </span>
                  </Label>
                  <Label
                    htmlFor="pay-mode-precise"
                    className={cn("flex min-h-14 cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-base font-semibold", mode === "precise" && "border-primary bg-blue-50 dark:bg-blue-950/40")}
                  >
                    <RadioGroupItem id="pay-mode-precise" value="precise" />
                    Un nombre d'heures précis
                  </Label>
                </RadioGroup>
              </fieldset>

              {mode === "precise" ? (
                <div className="grid gap-x-6 gap-y-2 sm:grid-cols-[minmax(0,14rem)_1fr]">
                  <div className="space-y-1.5">
                    <Label htmlFor="hours-to-pay">Nombre d'heures à payer</Label>
                    <div className="relative">
                      <Input
                        id="hours-to-pay"
                        inputMode="decimal"
                        autoComplete="off"
                        autoFocus
                        className="min-h-12 pr-10"
                        value={hoursInput}
                        aria-invalid={Boolean(validation.error)}
                        aria-describedby="hours-to-pay-help"
                        onChange={(event) => setHoursInput(event.target.value)}
                        placeholder="Ex : 12.5"
                      />
                      <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">h</span>
                    </div>
                    {validation.error ? (
                      <p id="hours-to-pay-help" role="alert" className="text-sm text-red-700 dark:text-red-300">{validation.error}</p>
                    ) : (
                      <p id="hours-to-pay-help" className="text-sm text-muted-foreground">Maximum : {formatHoursCount(remainingHours)}</p>
                    )}
                  </div>
                  {payAmount !== null && remainingAfterHours !== null ? (
                    <div className="sm:pt-6">
                      <p className="text-xl font-semibold tabular-nums">= {formatFcfa(payAmount)}</p>
                      <p className="mt-1 text-sm text-muted-foreground tabular-nums">
                        Reste après paiement : {formatHoursCount(remainingAfterHours)} · {formatFcfa(computePayAmount(remainingAfterHours, hourlyRate))}
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="space-y-1.5">
                <Label htmlFor="salary-notes">Notes (optionnel)</Label>
                <Input
                  id="salary-notes"
                  className="min-h-12"
                  placeholder="Ex : virement effectué le 5 du mois"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </div>
            </>
          )}
        </>
      )}
    </DetailDialog>
  )
}
