import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/components/ui/use-toast"
import {
  fetchFinancialAlertLogs,
  fetchFinancialAlertRules,
  saveFinancialAlertRule,
  type FinancialAlertRuleRow,
} from "../finance.api"

const RULE_META: Array<{ type: "preventive" | "late" | "severe_late"; label: string; hint: string; unit: string }> = [
  { type: "preventive", label: "Préventive", hint: "Jours avant la prochaine échéance pour prévenir les parents.", unit: "jours avant l’échéance" },
  { type: "late", label: "Retard", hint: "Jours de retard avant la première relance.", unit: "jours de retard" },
  { type: "severe_late", label: "Retard important", hint: "Jours de retard avant la relance urgente.", unit: "jours de retard" },
]

const CHANNEL_LABELS: Record<string, string> = { sms: "SMS", in_app: "Dans l’application", both: "SMS + application" }

export function FinancialAlertRules({ canEdit }: { canEdit: boolean }) {
  return (
    <div className="space-y-6">
      <RulesEditor canEdit={canEdit} />
      <AlertsLog />
    </div>
  )
}

function RulesEditor({ canEdit }: { canEdit: boolean }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const rulesQuery = useQuery({
    queryKey: ["finance", "financial-alert-rules"],
    queryFn: fetchFinancialAlertRules,
  })

  const [drafts, setDrafts] = useState<Record<string, { daysOffset: string; channel: "sms" | "in_app" | "both"; isActive: boolean }>>({})

  const existing = (type: string): FinancialAlertRuleRow | undefined =>
    rulesQuery.data?.find((rule) => rule.type === type)

  const draftFor = (type: string) => {
    const found = existing(type)
    const fallback = {
      daysOffset: String(found?.daysOffset ?? found?.days_offset ?? (type === "preventive" ? 5 : 3)),
      channel: (found?.channel ?? "sms") as "sms" | "in_app" | "both",
      isActive: Boolean(found?.isActive ?? found?.is_active ?? true),
    }
    return drafts[type] ?? fallback
  }

  const saveMutation = useMutation({
    mutationFn: (input: { type: "preventive" | "late" | "severe_late"; daysOffset: number; channel: "sms" | "in_app" | "both"; isActive: boolean }) =>
      saveFinancialAlertRule(input.type, {
        daysOffset: input.daysOffset,
        channel: input.channel,
        isActive: input.isActive,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["finance", "financial-alert-rules"] })
      toast({ title: "Règle enregistrée", duration: 3000 })
    },
    onError: (error) =>
      toast({
        title: "Enregistrement impossible",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
        duration: 6000,
      }),
  })

  const isDirty = (type: string) => {
    const found = existing(type)
    if (!found) return true
    const draft = draftFor(type)
    return draft.daysOffset !== String(found.daysOffset ?? found.days_offset)
      || draft.channel !== (found.channel ?? "sms")
      || draft.isActive !== Boolean(found.isActive ?? found.is_active ?? true)
  }
  const lateDays = Number(draftFor("late").daysOffset)

  return (
    <Card className="rounded-lg shadow-sm" data-tour="settings-alert-rules">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold">Règles de relance</CardTitle>
        <CardDescription>
          Une seule règle par type. Les relances partent chaque matin aux parents concernés.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {rulesQuery.isLoading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
          </p>
        ) : (
          <div className="divide-y">
            {RULE_META.map((meta) => {
              const draft = draftFor(meta.type)
              const parsed = Number(draft.daysOffset)
              const valid = Number.isInteger(parsed) && parsed >= 0 && parsed <= 365
              const dirty = isDirty(meta.type)
              const overlaps = meta.type === "severe_late" && valid && Number.isInteger(lateDays) && parsed <= lateDays
              const inputId = `alert-days-${meta.type}`
              return (
                <div key={meta.type} className="flex flex-wrap items-center gap-3 py-4 last:pb-0 sm:grid sm:grid-cols-[minmax(0,1fr)_5.5rem_10.5rem_12rem_6.5rem_8.5rem]">
                  <div className="min-w-0 basis-full lg:basis-auto">
                    <div className="flex flex-wrap items-center gap-2">
                      <Label htmlFor={inputId} className="text-base font-medium">{meta.label}</Label>
                      {!existing(meta.type) ? <Badge variant="secondary">Non enregistrée</Badge> : null}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{meta.hint}</p>
                    {overlaps ? <p role="status" className="mt-1 text-sm text-amber-700">Le retard important devrait dépasser le délai de « Retard » ({lateDays} jours).</p> : null}
                  </div>
                  <>
                      <Input
                        id={inputId}
                        type="number"
                        min={0}
                        max={365}
                        className="min-h-12 w-24 lg:w-full"
                        value={draft.daysOffset}
                        disabled={!canEdit}
                        onChange={(event) =>
                          setDrafts((prev) => ({ ...prev, [meta.type]: { ...draft, daysOffset: event.target.value } }))
                        }
                      />
                      <span className="text-sm text-muted-foreground">{meta.unit}</span>
                    <Select
                      value={draft.channel}
                      disabled={!canEdit}
                      onValueChange={(value) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [meta.type]: { ...draft, channel: value as "sms" | "in_app" | "both" },
                        }))
                      }
                    >
                      <SelectTrigger className="min-h-12 w-48 lg:w-full" aria-label={`Canal d’envoi : ${meta.label}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sms">{CHANNEL_LABELS.sms}</SelectItem>
                        <SelectItem value="in_app">{CHANNEL_LABELS.in_app}</SelectItem>
                        <SelectItem value="both">{CHANNEL_LABELS.both}</SelectItem>
                      </SelectContent>
                    </Select>
                    <Label className="flex min-h-12 items-center gap-2 text-sm">
                      <Checkbox
                        checked={draft.isActive}
                        disabled={!canEdit}
                        onCheckedChange={(checked) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [meta.type]: { ...draft, isActive: Boolean(checked) },
                          }))
                        }
                      />
                      Active
                    </Label>
                    <Button
                      type="button"
                      variant={existing(meta.type) && dirty ? "default" : "outline"}
                      className="min-h-12"
                      disabled={!canEdit || !valid || !dirty || saveMutation.isPending}
                      onClick={() =>
                        saveMutation.mutate({ type: meta.type, daysOffset: parsed, channel: draft.channel, isActive: draft.isActive })
                      }
                    >
                      Enregistrer
                    </Button>
                  </>
                </div>
              )
            })}
          </div>
        )}
        {!canEdit ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Vous pouvez consulter ces règles, mais votre poste ne permet pas de les modifier.
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}

function AlertsLog() {
  const [page, setPage] = useState(1)
  const logsQuery = useQuery({
    queryKey: ["finance", "financial-alert-logs", page],
    queryFn: () => fetchFinancialAlertLogs(page),
  })
  const logsPage = logsQuery.data
  const pagination = logsPage?.pagination

  useEffect(() => {
    if (pagination && page !== pagination.page) setPage(pagination.page)
  }, [page, pagination])

  return (
    <Card className="rounded-lg shadow-sm" data-tour="settings-alert-log">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold">Historique des relances</CardTitle>
        <CardDescription>Toutes les relances envoyées par l&apos;école, de la plus récente à la plus ancienne.</CardDescription>
      </CardHeader>
      <CardContent>
        {logsQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : (logsPage?.logs.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground py-4">Aucune relance envoyée pour le moment. Elles apparaîtront ici dès qu’une règle se déclenche.</p>
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Élève</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Canal</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(logsPage?.logs ?? []).map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>{new Date(log.sent_at).toLocaleString("fr-FR")}</TableCell>
                      <TableCell className="font-medium">{log.student_name}</TableCell>
                      <TableCell>{RULE_LABELS[log.rule_type] ?? log.rule_type}</TableCell>
                      <TableCell>{CHANNEL_LABELS[log.channel] ?? log.channel}</TableCell>
                      <TableCell>
                        {log.status === "sent" ? (
                          <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">Envoyée</Badge>
                        ) : (
                          <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">Échec</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {pagination ? <div className="flex flex-col gap-3 border-t pt-4 text-sm sm:flex-row sm:items-center sm:justify-between">
              <p className="text-muted-foreground">{(pagination.page - 1) * pagination.limit + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} sur {pagination.total} relance{pagination.total > 1 ? "s" : ""}</p>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" className="min-h-12" disabled={pagination.page === 1 || logsQuery.isFetching} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft className="mr-1 h-4 w-4" />Précédent</Button>
                <span className="min-w-20 text-center tabular-nums" aria-live="polite">Page {pagination.page} / {pagination.totalPages}</span>
                <Button type="button" variant="outline" size="sm" className="min-h-12" disabled={pagination.page === pagination.totalPages || logsQuery.isFetching} onClick={() => setPage((current) => Math.min(pagination.totalPages, current + 1))}>Suivant<ChevronRight className="ml-1 h-4 w-4" /></Button>
              </div>
            </div> : null}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

const RULE_LABELS: Record<string, string> = {
  preventive: "Préventive",
  late: "Retard",
  severe_late: "Retard important",
}
