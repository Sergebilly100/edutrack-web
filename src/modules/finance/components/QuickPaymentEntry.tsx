import { useMemo, useRef, useState } from "react"
import { CheckCircle2, CircleAlert, CornerDownLeft, Loader2, Plus, RotateCcw } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/components/ui/use-toast"
import type { StudentItem } from "@/modules/students/students.api"
import { formatFcfa } from "@/shared/utils/formatting"
import { generateId } from "@/shared/utils/generateId"
import { recordPayment, type PaymentMethod } from "../finance.api"
import { StudentSearch } from "./StudentSearch"

type EntryRow = {
  id: string
  student: StudentItem | null
  amount: string
  reference: string
  status: "draft" | "saving" | "saved" | "error"
  error?: string
}

const newRow = (): EntryRow => ({ id: generateId(), student: null, amount: "", reference: "", status: "draft" })

const methodLabels: Record<PaymentMethod, string> = {
  cash: "Espèces",
  mobile_money: "Mobile Money manuel",
  bank_transfer: "Virement bancaire",
}

type QuickPaymentEntryProps = {
  schoolYearId: string
  schoolYearLabel: string
}

export function QuickPaymentEntry({ schoolYearId, schoolYearLabel }: QuickPaymentEntryProps) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [method, setMethod] = useState<PaymentMethod>("cash")
  const [rows, setRows] = useState<EntryRow[]>([newRow()])
  const inputRefs = useRef(new Map<string, HTMLInputElement>())
  const pendingRowIds = useRef(new Set<string>())

  const savedRows = rows.filter((row) => row.status === "saved")
  const savedTotal = useMemo(
    () => savedRows.reduce((sum, row) => sum + Number(row.amount || 0), 0),
    [savedRows],
  )

  const updateRow = (id: string, patch: Partial<EntryRow>) => {
    setRows((current) => current.map((row) => row.id === id ? { ...row, ...patch } : row))
  }

  const focusRow = (id: string) => requestAnimationFrame(() => inputRefs.current.get(id)?.focus())

  const addRowAfter = (id?: string) => {
    const created = newRow()
    setRows((current) => {
      if (!id) return [...current, created]
      const index = current.findIndex((row) => row.id === id)
      return [...current.slice(0, index + 1), created, ...current.slice(index + 1)]
    })
    focusRow(created.id)
  }

  const saveRow = async (row: EntryRow) => {
    if (row.status === "saved" || pendingRowIds.current.has(row.id)) return
    const amount = Number(row.amount)
    if (!row.student || !Number.isFinite(amount) || amount <= 0) {
      updateRow(row.id, { status: "error", error: "Sélectionnez un élève et saisissez un montant positif." })
      return
    }

    pendingRowIds.current.add(row.id)
    updateRow(row.id, { status: "saving", error: undefined })
    try {
      await recordPayment({
        studentId: row.student.id,
        schoolYearId,
        amount,
        method,
        ...(row.reference.trim() ? { schoolReceiptReference: row.reference.trim() } : {}),
      })
      updateRow(row.id, { status: "saved" })
      await queryClient.invalidateQueries({ queryKey: ["finance", "payments"] })
      toast({
        title: "Paiement enregistré",
        description: `${row.student.lastName} ${row.student.firstName} · ${formatFcfa(amount)}`,
      })
      const index = rows.findIndex((item) => item.id === row.id)
      const next = rows[index + 1]
      if (next) focusRow(next.id)
      else addRowAfter(row.id)
    } catch (error) {
      updateRow(row.id, {
        status: "error",
        error: error instanceof Error ? error.message : "Le paiement n’a pas pu être enregistré.",
      })
    } finally {
      pendingRowIds.current.delete(row.id)
    }
  }

  const resetSession = () => {
    const first = newRow()
    setRows([first])
    focusRow(first.id)
  }

  const rowStatus = (row: EntryRow) => {
    if (row.status === "saving") return <Loader2 className="h-4 w-4 animate-spin text-primary" aria-label="Enregistrement en cours" />
    if (row.status === "saved") return <CheckCircle2 className="h-4 w-4 text-green-600" aria-label="Paiement enregistré" />
    if (row.status === "error") return <CircleAlert className="h-4 w-4 text-red-600" aria-label="Erreur" />
    return <span className="h-2 w-2 rounded-full bg-muted-foreground/40" aria-label="Ligne à compléter" />
  }

  return (
    <section className="space-y-5">
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="bg-[var(--surface-chrome)] px-4 py-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-4 pb-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl space-y-1">
              <h2 className="text-lg font-semibold">Saisie rapide</h2>
              <p className="text-xs text-muted-foreground">
                Recherchez l’élève, saisissez le montant, puis appuyez sur Entrée. Chaque ligne est enregistrée séparément et reste traçable.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-[minmax(15rem,1fr)_auto] lg:min-w-[29rem]">
              <div className="space-y-1.5">
                <Label htmlFor="quick-payment-method">Mode appliqué aux nouvelles lignes</Label>
                <Select value={method} onValueChange={(value) => setMethod(value as PaymentMethod)}>
                  <SelectTrigger id="quick-payment-method" className="min-h-12"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(methodLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button type="button" variant="outline" className="min-h-12 w-full" onClick={resetSession} disabled={rows.some((row) => row.status === "saving")}>
                  <RotateCcw className="mr-2 h-4 w-4" />Nouvelle session
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border bg-muted/30 px-4 py-3 text-sm">
        <span><strong>{savedRows.length}</strong> paiement{savedRows.length > 1 ? "s" : ""} enregistré{savedRows.length > 1 ? "s" : ""}</span>
        <span className="font-semibold tabular-nums text-primary">{formatFcfa(savedTotal)}</span>
        <span className="text-muted-foreground">Année {schoolYearLabel}</span>
        <span className="ml-auto hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex"><CornerDownLeft className="h-3.5 w-3.5" /> Entrée valide la ligne</span>
      </div>

      <div className="hidden overflow-visible rounded-lg border bg-card shadow-sm md:block">
        <Table className="min-w-[780px] overflow-visible">
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="w-10 text-center">État</TableHead>
              <TableHead className="w-[42%]">Élève</TableHead>
              <TableHead className="w-[20%]">Montant</TableHead>
              <TableHead>Référence école</TableHead>
              <TableHead className="w-28"><span className="sr-only">Action</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, index) => (
              <TableRow key={row.id} className={row.status === "saved" ? "bg-green-50/50 dark:bg-green-950/10" : row.status === "error" ? "bg-red-50/40 dark:bg-red-950/10" : ""}>
                <TableCell className="text-center">{rowStatus(row)}</TableCell>
                <TableCell className="overflow-visible">
                  <StudentSearch
                    compact
                    value={row.student}
                    disabled={row.status === "saving" || row.status === "saved"}
                    inputRef={(element) => {
                      if (element) inputRefs.current.set(row.id, element)
                      else inputRefs.current.delete(row.id)
                    }}
                    onChange={(student) => updateRow(row.id, { student, status: "draft", error: undefined })}
                  />
                  {row.error ? <p className="mt-1 text-xs text-red-600">{row.error}</p> : null}
                </TableCell>
                <TableCell>
                  <Input
                    aria-label={`Montant ligne ${index + 1}`}
                    inputMode="numeric"
                    className="h-10 tabular-nums"
                    placeholder="Ex. 25 000"
                    value={row.amount}
                    disabled={row.status === "saving" || row.status === "saved"}
                    onChange={(event) => updateRow(row.id, { amount: event.target.value.replace(/\D/g, ""), status: "draft", error: undefined })}
                    onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void saveRow(row) } }}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    aria-label={`Référence école ligne ${index + 1}`}
                    className="h-10"
                    placeholder="Facultatif"
                    value={row.reference}
                    disabled={row.status === "saving" || row.status === "saved"}
                    onChange={(event) => updateRow(row.id, { reference: event.target.value, status: "draft" })}
                    onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void saveRow(row) } }}
                  />
                </TableCell>
                <TableCell className="text-right">
                  {row.status === "saved" ? <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">Validé</Badge> : (
                    <Button type="button" size="sm" variant="outline" className="min-h-10" disabled={row.status === "saving"} onClick={() => void saveRow(row)}>
                      Valider
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="space-y-3 md:hidden">
        {rows.map((row, index) => (
          <div key={row.id} className="space-y-3 rounded-lg border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between"><span className="text-sm font-medium">Paiement {index + 1}</span>{rowStatus(row)}</div>
            <StudentSearch value={row.student} disabled={row.status === "saving" || row.status === "saved"} onChange={(student) => updateRow(row.id, { student, status: "draft", error: undefined })} />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label htmlFor={`amount-${row.id}`}>Montant</Label><Input id={`amount-${row.id}`} inputMode="numeric" value={row.amount} disabled={row.status === "saving" || row.status === "saved"} onChange={(event) => updateRow(row.id, { amount: event.target.value.replace(/\D/g, ""), status: "draft", error: undefined })} /></div>
              <div className="space-y-1.5"><Label htmlFor={`reference-${row.id}`}>Référence</Label><Input id={`reference-${row.id}`} value={row.reference} disabled={row.status === "saving" || row.status === "saved"} onChange={(event) => updateRow(row.id, { reference: event.target.value, status: "draft" })} /></div>
            </div>
            {row.error ? <p className="text-sm text-red-600">{row.error}</p> : null}
            {row.status === "saved" ? <div className="flex min-h-12 items-center gap-2 text-sm font-medium text-green-700"><CheckCircle2 className="h-4 w-4" />Paiement enregistré</div> : <Button type="button" className="min-h-12 w-full" disabled={row.status === "saving"} onClick={() => void saveRow(row)}>{row.status === "saving" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Enregistrer et continuer</Button>}
          </div>
        ))}
      </div>

      <Button type="button" variant="outline" className="min-h-12" onClick={() => addRowAfter()}><Plus className="mr-2 h-4 w-4" />Ajouter une ligne</Button>
    </section>
  )
}
