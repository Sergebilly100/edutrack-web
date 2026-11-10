import { useEffect, useState } from "react"
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link, useSearchParams } from "react-router-dom"
import { Plus, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import type { StudentItem } from "@/modules/students/students.api"
import { EmptyState } from "@/shared/components/EmptyState"
import { QueryErrorState } from "@/shared/components/QueryErrorState"
import { useDebounce } from "@/shared/hooks/useDebounce"
import { usePermissions } from "@/shared/hooks/usePermissions"
import { formatFcfa } from "@/shared/utils/formatting"
import { getStudentTuitionSchedule, grantTuitionOverride, listAgreementsRegister, replaceTuitionOverride, saveStudentTuitionSchedule, type AgreementRegisterEntry } from "../finance.api"
import { AGREEMENT_STATUS_LABELS } from "../agreement-detail.helpers"
import { AgreementActionDialog, Metric } from "./AgreementActionDialog"
import { AgreementDetailDialog } from "./AgreementDetailDialog"
import { StudentSearch } from "./StudentSearch"

type AgreementKind = "overrides" | "schedules"
type Installment = { dueDate: string; amount: number }

const statuses = AGREEMENT_STATUS_LABELS
const formatDate = (value: string | null) => value ? new Intl.DateTimeFormat("fr-CI", { dateStyle: "medium" }).format(new Date(`${value.slice(0, 10)}T12:00:00`)) : "Non planifiée"

function NewOverrideModal({ schoolYearId, editing, open, onChange }: { schoolYearId: string; editing: AgreementRegisterEntry | null; open: boolean; onChange: (open: boolean) => void }) {
  const client = useQueryClient(); const { toast } = useToast(); const [student, setStudent] = useState<StudentItem | null>(null); const [type, setType] = useState<"discount" | "total">("discount"); const [amount, setAmount] = useState(""); const [reason, setReason] = useState("")
  const resetForm = () => { setStudent(null); setType("discount"); setAmount(""); setReason("") }
  const close = (next: boolean) => { if (!next) resetForm(); onChange(next) }
  useEffect(() => { if (open && editing) { setType(editing.override_total_amount > 0 ? "total" : "discount"); setAmount(String(editing.override_total_amount > 0 ? editing.override_total_amount : editing.discount_amount)); setReason(""); setStudent(null) } }, [editing, open])
  const studentId = editing?.student_id ?? student?.id
  const mutation = useMutation({ mutationFn: () => { const payload = { studentId: studentId!, schoolYearId, ...(type === "discount" ? { discountAmount: Number(amount) } : { overrideTotalAmount: Number(amount) }), reason: reason.trim() }; return editing ? replaceTuitionOverride(payload) : grantTuitionOverride(payload) }, onSuccess: async () => { await client.invalidateQueries({ queryKey: ["finance"] }); toast({ title: editing ? "Ajustement remplacé" : "Ajustement enregistré", description: editing ? "L’ancien ajustement est conservé dans l’historique." : "Le registre et le dossier financier ont été actualisés." }); close(false) }, onError: (error) => toast({ title: "Ajustement impossible", description: error instanceof Error ? error.message : "Vérifiez les informations saisies.", variant: "destructive" }) })
  return <Dialog open={open} onOpenChange={close}><DialogContent><DialogHeader><DialogTitle>{editing ? "Modifier l’ajustement individuel" : "Nouvel ajustement individuel"}</DialogTitle><DialogDescription>{editing ? "Le nouvel ajustement remplacera l’accord actif, sans effacer son historique." : "Cette décision est tracée et recalcule le montant dû de l’élève."}</DialogDescription></DialogHeader><div className="space-y-4"><div><Label>Élève</Label><div className="mt-2">{editing ? <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm font-medium">{editing.student_name} · {editing.matricule ?? "Sans matricule"}</p> : <StudentSearch schoolYearId={schoolYearId} value={student} onChange={setStudent} />}</div></div><div className="grid gap-3 sm:grid-cols-2"><div><Label>Type</Label><Select value={type} onValueChange={(value) => setType(value as "discount" | "total")}><SelectTrigger className="mt-2 min-h-12"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="discount">Remise sur frais</SelectItem><SelectItem value="total">Montant total personnalisé</SelectItem></SelectContent></Select></div><div><Label>Montant FCFA</Label><Input className="mt-2 min-h-12" inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value.replace(/\D/g, ""))} /></div></div><div><Label>{editing ? "Motif de la modification obligatoire" : "Motif obligatoire"}</Label><Textarea className="mt-2" value={reason} maxLength={1000} onChange={(event) => setReason(event.target.value)} /></div></div><DialogFooter><Button variant="outline" onClick={() => close(false)}>Annuler</Button><Button disabled={!studentId || Number(amount) <= 0 || !reason.trim() || mutation.isPending} onClick={() => mutation.mutate()}>{mutation.isPending ? "Enregistrement…" : editing ? "Remplacer l’ajustement" : "Accorder"}</Button></DialogFooter></DialogContent></Dialog>
}

function NewScheduleModal({ schoolYearId, editing, open, onChange }: { schoolYearId: string; editing: AgreementRegisterEntry | null; open: boolean; onChange: (open: boolean) => void }) {
  const client = useQueryClient(); const { toast } = useToast(); const [student, setStudent] = useState<StudentItem | null>(null); const [reason, setReason] = useState(""); const [steps, setSteps] = useState<Installment[]>([{ dueDate: "", amount: 0 }])
  const resetForm = () => { setStudent(null); setReason(""); setSteps([{ dueDate: "", amount: 0 }]) }
  const close = (next: boolean) => { if (!next) resetForm(); onChange(next) }
  const studentId = editing?.student_id ?? student?.id
  const current = useQuery({ queryKey: ["finance", "new-schedule", schoolYearId, studentId], queryFn: () => getStudentTuitionSchedule(studentId!, schoolYearId), enabled: Boolean(studentId) })
  useEffect(() => {
    if (!open || !editing || !current.data) return
    if (!current.data.agreement?.scheduleSteps.length) { setSteps([]); return }
    let previousCumulative = current.data.confirmedPaid
    setSteps(current.data.agreement.scheduleSteps.map((step) => {
      const amount = Math.max(0, step.cumulativeAmountExpected - previousCumulative)
      previousCumulative = step.cumulativeAmountExpected
      return { dueDate: step.dueDate, amount }
    }))
    setReason("")
  }, [editing?.id, current.data?.agreement?.id, current.data?.confirmedPaid, open])
  const remainingToPlan = current.data?.remainingToPlan ?? 0; const total = steps.reduce((sum, step) => sum + step.amount, 0); const hasActualSchedule = !editing || Boolean(current.data?.agreement?.scheduleSteps.length); const valid = Boolean(studentId && current.isSuccess && hasActualSchedule && steps.length > 0 && reason.trim() && remainingToPlan > 0 && total === remainingToPlan && steps.every((step, index) => step.dueDate && step.amount > 0 && (!steps[index - 1] || step.dueDate > steps[index - 1]!.dueDate)))
  const mutation = useMutation({ mutationFn: () => saveStudentTuitionSchedule({ studentId: studentId!, schoolYearId, reason: reason.trim(), installments: steps }), onSuccess: async () => { await client.invalidateQueries({ queryKey: ["finance"] }); toast({ title: editing ? "Échéancier remplacé" : "Échéancier négocié enregistré", description: editing ? "L’ancien échéancier reste disponible dans l’historique." : "Les échéances et les relances ont été recalculées." }); close(false) }, onError: (error) => toast({ title: "Échéancier impossible", description: error instanceof Error ? error.message : "Vérifiez les dates et les montants.", variant: "destructive" }) })
  return <Dialog open={open} onOpenChange={close}><DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>{editing ? "Modifier l’échéancier négocié" : current.data?.agreement ? "Remplacer l’échéancier négocié" : "Nouvel échéancier négocié"}</DialogTitle><DialogDescription>Seul le reste à payer est planifié : les paiements déjà confirmés ne sont jamais reprogrammés.</DialogDescription></DialogHeader><div className="space-y-4"><div><Label>Élève</Label><div className="mt-2">{editing ? <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm font-medium">{editing.student_name} · {editing.matricule ?? "Sans matricule"}</p> : <StudentSearch schoolYearId={schoolYearId} value={student} onChange={setStudent} />}</div></div>{studentId ? current.isLoading ? <Skeleton className="h-24 w-full" /> : <><div className="grid gap-3 rounded-lg bg-muted/50 p-3 sm:grid-cols-2"><Metric label="Frais de scolarité" value={formatFcfa(current.data?.totalTuitionAmount ?? 0)} /><Metric label="Déjà encaissé" value={formatFcfa(current.data?.confirmedPaid ?? 0)} /><Metric label="Total à couvrir" value={formatFcfa(remainingToPlan)} /><Metric label="Total saisi" value={formatFcfa(total)} /></div>{editing && !hasActualSchedule ? <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">Le calendrier de cet échéancier n’est pas disponible. Aucune échéance n’est inventée ; actualisez le registre avant de le modifier.</p> : null}{current.data?.agreement && !editing ? <p className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950">Un échéancier actif existe. L’enregistrement le remplacera de façon atomique ; l’ancien restera consultable dans l’historique.</p> : null}{remainingToPlan <= 0 ? <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">Aucun échéancier ne peut être créé : il ne reste aucun montant de scolarité à planifier.</p> : null}</> : null}<div><Label>{editing ? "Motif de la modification obligatoire" : "Motif obligatoire"}</Label><Textarea className="mt-2" value={reason} maxLength={1000} onChange={(event) => setReason(event.target.value)} /></div><div className="space-y-2"><div className="flex items-center justify-between"><Label>Échéances</Label><Button type="button" size="sm" variant="outline" disabled={Boolean(editing && !hasActualSchedule)} onClick={() => setSteps((items) => [...items, { dueDate: "", amount: 0 }])}><Plus className="mr-1 h-4 w-4" />Ajouter</Button></div>{steps.map((step, index) => <div className="grid grid-cols-[1fr_1fr_auto] gap-2" key={index}><Input type="date" value={step.dueDate} onChange={(event) => setSteps((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, dueDate: event.target.value } : item))} /><Input inputMode="numeric" placeholder="Montant FCFA" value={step.amount || ""} onChange={(event) => setSteps((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, amount: Number(event.target.value.replace(/\D/g, "")) } : item))} /><Button type="button" variant="ghost" disabled={steps.length === 1} onClick={() => setSteps((items) => items.filter((_, itemIndex) => itemIndex !== index))}>Retirer</Button></div>)}</div>{studentId && current.isSuccess && total !== remainingToPlan ? <p className="text-sm text-amber-700">{formatFcfa(Math.abs(remainingToPlan - total))}{total > remainingToPlan ? " en trop" : " reste à planifier"}.</p> : null}</div><DialogFooter><Button variant="outline" onClick={() => close(false)}>Annuler</Button><Button disabled={!valid || mutation.isPending} onClick={() => mutation.mutate()}>{mutation.isPending ? "Enregistrement…" : editing || current.data?.agreement ? "Remplacer l’échéancier" : "Enregistrer"}</Button></DialogFooter></DialogContent></Dialog>
}

export function AgreementsRegister({ schoolYearId }: { schoolYearId: string }) {
  const [params, setParams] = useSearchParams();
  const { hasPermission } = usePermissions();
  const kind: AgreementKind =
    params.get("kind") === "schedules" ? "schedules" : "overrides";
  const rawStatus = params.get("status");
  const status =
    rawStatus === "active" ||
    rawStatus === "withdrawn" ||
    rawStatus === "replaced" ||
    rawStatus === "reset"
      ? rawStatus
      : "all";
  const search = params.get("q") ?? "";
  // Saisie locale instantanée ; l'URL (donc la requête) n'est mise à jour qu'après 300 ms de pause.
  const [searchInput, setSearchInput] = useState(search);
  const debouncedSearch = useDebounce(searchInput.trim(), 300);
  const page = Math.max(1, Number(params.get("page")) || 1);
  const id = params.get("detail");
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [editingOverride, setEditingOverride] =
    useState<AgreementRegisterEntry | null>(null);
  const [editingSchedule, setEditingSchedule] =
    useState<AgreementRegisterEntry | null>(null);
  const set = (next: Record<string, string>) =>
    setParams((current) => {
      Object.entries(next).forEach(([key, value]) =>
        value ? current.set(key, value) : current.delete(key),
      );
      return current;
    });
  useEffect(() => {
    if (debouncedSearch === search) return;
    setParams(
      (current) => {
        if (debouncedSearch) current.set("q", debouncedSearch);
        else current.delete("q");
        current.set("page", "1");
        return current;
      },
      { replace: true },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);
  const query = useQuery({
    queryKey: [
      "finance",
      "agreements",
      schoolYearId,
      kind,
      status,
      search,
      page,
    ],
    queryFn: () =>
      listAgreementsRegister({ schoolYearId, kind, status, search, page }),
    enabled: Boolean(schoolYearId),
    placeholderData: keepPreviousData,
  });
  const entries = query.data?.entries ?? [];
  const pagination = query.data?.pagination;
  return (
    <section className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div
          data-tour="finance-agreements-tabs"
          role="tablist"
          aria-label="Types d’accord"
          className="flex w-full gap-1 rounded-lg bg-muted p-1 sm:w-auto"
        >
          <Button
            role="tab"
            className="min-h-12"
            aria-selected={kind === "overrides"}
            variant={kind === "overrides" ? "outline" : "ghost"}
            onClick={() =>
              set({ kind: "overrides", status: "all", page: "1", detail: "" })
            }
          >
            Remises et ajustements
          </Button>
          <Button
            role="tab"
            className="min-h-12"
            aria-selected={kind === "schedules"}
            variant={kind === "schedules" ? "outline" : "ghost"}
            onClick={() =>
              set({ kind: "schedules", status: "all", page: "1", detail: "" })
            }
          >
            Échéanciers négociés
          </Button>
        </div>
        {kind === "overrides" && hasPermission("tuition.grant_discount") ? (
          <Button
            data-tour="finance-agreements-new"
            onClick={() => {
              setEditingOverride(null);
              setOverrideOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Nouvel ajustement
          </Button>
        ) : null}
        {kind === "schedules" &&
        hasPermission("tuition.manage_student_schedule") ? (
          <Button
            data-tour="finance-agreements-new"
            onClick={() => {
              setEditingSchedule(null);
              setScheduleOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Nouvel échéancier
          </Button>
        ) : null}
      </div>
      <div className="grid gap-3 rounded-lg border bg-muted/20 p-4 md:grid-cols-2">
        <div className="relative">
          <Input
            className="min-h-12 pr-24"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            data-tour="finance-agreements-search"
            placeholder="Élève, matricule, classe ou niveau"
            aria-label="Rechercher un accord"
          />
          <div className="absolute inset-y-0 right-1 flex items-center gap-1">
            {query.isFetching && !query.isLoading ? (
              <span role="status" className="text-xs text-muted-foreground">
                Recherche…
              </span>
            ) : null}
            {searchInput ? (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-10 w-10"
                aria-label="Effacer la recherche"
                onClick={() => setSearchInput("")}
              >
                <X className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        </div>
        <Select
          value={status}
          onValueChange={(value) => set({ status: value, page: "1" })}
        >
          <SelectTrigger className="min-h-12" data-tour="finance-agreements-status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="active">Actifs</SelectItem>
            {kind === "overrides" ? (
              <SelectItem value="withdrawn">Retirés</SelectItem>
            ) : (
              <>
                <SelectItem value="replaced">Remplacés</SelectItem>
                <SelectItem value="reset">Réinitialisés</SelectItem>
              </>
            )}
          </SelectContent>
        </Select>
      </div>
      {query.isLoading ? (
        <Skeleton className="h-72 w-full" />
      ) : query.isError ? (
        <QueryErrorState
          message="Impossible de charger le registre des accords."
          onRetry={() => void query.refetch()}
        />
      ) : entries.length ? (
        <>
          <div className="overflow-x-auto rounded-lg border" data-tour="finance-agreements-table">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Élève</TableHead>
                  <TableHead>
                    {kind === "overrides"
                      ? "Remise ou ajustement"
                      : "Arrangement d’échéancier"}
                  </TableHead>
                  <TableHead>Situation financière</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <AgreementRow
                    entry={entry}
                    key={entry.id}
                    onDetail={() => set({ detail: entry.id })}
                    onEditOverride={() => {
                      setEditingOverride(entry);
                      setOverrideOpen(true);
                    }}
                    onEditSchedule={() => {
                      setEditingSchedule(entry);
                      setScheduleOpen(true);
                    }}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {pagination?.total ?? 0} accord
              {(pagination?.total ?? 0) > 1 ? "s" : ""}
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => set({ page: String(page - 1) })}
              >
                Précédent
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!pagination || page >= pagination.totalPages}
                onClick={() => set({ page: String(page + 1) })}
              >
                Suivant
              </Button>
            </div>
          </div>
        </>
      ) : (
        <EmptyState
          title="Aucun accord trouvé"
          description="Aucun ajustement ou échéancier ne correspond aux filtres sélectionnés."
        />
      )}
      <AgreementDetailDialog
        kind={kind}
        id={id}
        onClose={() => set({ detail: "" })}
        onEdit={(entry) => {
          set({ detail: "" });
          if (entry.kind === "override") {
            setEditingOverride(entry);
            setOverrideOpen(true);
          } else {
            setEditingSchedule(entry);
            setScheduleOpen(true);
          }
        }}
      />
      <NewOverrideModal
        schoolYearId={schoolYearId}
        editing={editingOverride}
        open={overrideOpen}
        onChange={(open) => {
          if (!open) setEditingOverride(null);
          setOverrideOpen(open);
        }}
      />
      <NewScheduleModal
        schoolYearId={schoolYearId}
        editing={editingSchedule}
        open={scheduleOpen}
        onChange={(open) => {
          if (!open) setEditingSchedule(null);
          setScheduleOpen(open);
        }}
      />
    </section>
  );
}

function AgreementRow({ entry, onDetail, onEditOverride, onEditSchedule }: { entry: AgreementRegisterEntry; onDetail: () => void; onEditOverride: () => void; onEditSchedule: () => void }) {
  const { hasPermission } = usePermissions(); const [actionOpen, setActionOpen] = useState(false)
  const adjustment = entry.override_total_amount > 0 ? `Montant personnalisé : ${formatFcfa(entry.override_total_amount)}` : `Remise sur frais : ${formatFcfa(entry.discount_amount)}`
  const action = entry.kind === "override" ? "withdraw" : "reset"
  const canAct = entry.status === "active" && (entry.kind === "override" ? hasPermission("tuition.grant_discount") : hasPermission("tuition.manage_student_schedule"))
  return <TableRow><TableCell><Link className="font-medium text-primary underline-offset-4 hover:underline" to={`/students/${entry.student_id}`}>{entry.student_name}</Link><p className="text-xs text-muted-foreground">{entry.matricule ?? "Sans matricule"} · {entry.class_name} · {entry.level_name}</p></TableCell><TableCell>{entry.kind === "override" ? <><p className="font-medium tabular-nums">{adjustment}</p><p className="text-xs text-muted-foreground">Plan : {formatFcfa(entry.plan_total_amount)} · {statuses[entry.status]} · Créée le {formatDate(entry.created_at)}</p></> : <><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{entry.step_count} échéance{entry.step_count > 1 ? "s" : ""} · {formatFcfa(entry.schedule_total_amount)}</p>{entry.active_discount_amount > 0 ? <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-800">Remise</Badge> : null}</div><p className="text-xs text-muted-foreground">Prochaine : {formatDate(entry.next_due_date)} · {statuses[entry.status]}</p></>}</TableCell><TableCell><p className="tabular-nums">Encaissé : {formatFcfa(entry.total_paid)}</p><p className="text-xs text-muted-foreground">Solde : {formatFcfa(entry.remaining_due)}</p><Badge variant="outline" className={entry.financial_status === "late" ? "mt-1 border-amber-200 bg-amber-50 text-amber-700" : "mt-1 border-green-200 bg-green-50 text-green-700"}>{entry.financial_status === "late" ? "En retard" : "À jour"}</Badge></TableCell><TableCell><div className="flex flex-wrap items-center gap-1.5 whitespace-nowrap"><Button size="sm" variant="ghost" onClick={onDetail}>Détail</Button>{canAct ? <Button size="sm" variant="outline" onClick={entry.kind === "override" ? onEditOverride : onEditSchedule}>Modifier</Button> : null}{canAct ? <Button size="sm" variant="outline" className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setActionOpen(true)}>{action === "withdraw" ? "Retirer" : "Réinitialiser"}</Button> : null}</div>{canAct ? <AgreementActionDialog agreement={entry} action={action} open={actionOpen} onOpenChange={setActionOpen} /> : null}</TableCell></TableRow>
}
