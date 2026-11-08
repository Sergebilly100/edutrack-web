import { useRef, useState, type RefObject } from "react"
import { useQuery } from "@tanstack/react-query"
import axios from "axios"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { DetailDialog } from "@/shared/components/DetailDialog"
import { KeyFigure } from "@/shared/components/KeyFigure"
import { LabelValueList, type LabelValueRow } from "@/shared/components/LabelValueList"
import { ProgressMeter } from "@/shared/components/ProgressMeter"
import { QueryErrorState } from "@/shared/components/QueryErrorState"
import { StatusPill, type StatusTone } from "@/shared/components/StatusPill"
import { usePermissions } from "@/shared/hooks/usePermissions"
import { todayInBusinessTimezone } from "@/shared/lib/business-date"
import { formatFcfa } from "@/shared/utils/formatting"
import {
  AGREEMENT_STATUS_LABELS,
  AGREEMENT_VIEW_PERMISSIONS,
  ARCHIVED_USER_LABEL,
  EMPTY_AGREEMENT_HISTORY,
  buildInstallmentRows,
  buildOverrideBreakdown,
  getAgreementTitle,
  installmentStatusLabel,
  isCustomTotalOverride,
  scheduleCollectedPercent,
  type InstallmentStatus,
} from "../agreement-detail.helpers"
import { getAgreementDetail, listAgreementsRegister, type AgreementDetail, type AgreementRegisterEntry } from "../finance.api"
import { AgreementActionDialog } from "./AgreementActionDialog"

type AgreementKind = "overrides" | "schedules"

const eventNames: Record<string, string> = {
  "tuition.override.created": "Ajustement accordé",
  "tuition.override.withdrawn": "Ajustement retiré",
  "tuition.student_schedule.created": "Échéancier créé",
  "tuition.student_schedule.updated": "Échéancier remplacé",
  "tuition.student_schedule.reset": "Échéancier réinitialisé",
}

const formatDate = (value: string | null): string =>
  value ? new Intl.DateTimeFormat("fr-CI", { dateStyle: "medium" }).format(new Date(`${value.slice(0, 10)}T12:00:00`)) : "Non planifiée"

const installmentTone = (status: InstallmentStatus): StatusTone =>
  status.kind === "paid" ? "success" : status.kind === "overdue" ? "danger" : "neutral"

export const isNotFoundError = (error: unknown): boolean => axios.isAxiosError(error) && error.response?.status === 404

/** Peut-on consulter les accords ? Même règle que l'API (`any` de ces trois permissions). */
export const useCanViewAgreements = (): boolean => {
  const { hasPermission } = usePermissions()
  return AGREEMENT_VIEW_PERMISSIONS.some((permission) => hasPermission(permission))
}

export type AgreementDetailDialogProps = {
  kind: AgreementKind
  /** Identifiant de l'accord ; `null` = fenêtre fermée. */
  id: string | null
  onClose: () => void
  /** « Modifier » : la page parente ouvre sa fenêtre d'édition et referme les détails. */
  onEdit?: (entry: AgreementRegisterEntry) => void
  /** Élément à refocaliser à la fermeture (fenêtre ouverte depuis un lien d'une autre fenêtre). */
  returnFocusRef?: RefObject<HTMLElement | null>
}

export function AgreementDetailDialog({ kind, id, onClose, onEdit, returnFocusRef }: AgreementDetailDialogProps) {
  const query = useQuery({
    queryKey: ["finance", "agreement-detail", kind, id],
    queryFn: () => getAgreementDetail(kind, id!),
    enabled: Boolean(id),
    retry: (count, error) => !isNotFoundError(error) && count < 1,
  })
  const detail = query.data
  const entry = detail?.agreement
  const title = entry ? getAgreementTitle(entry) : kind === "schedules" ? "Échéancier négocié" : "Remise sur frais"
  const subtitle = entry ? [entry.student_name, entry.class_name, entry.matricule].filter(Boolean).join(" · ") : undefined

  return (
    <DetailDialog
      open={Boolean(id)}
      onOpenChange={(open) => { if (!open) onClose() }}
      size="xl"
      title={title}
      subtitle={subtitle}
      badges={entry ? <AgreementBadges entry={entry} /> : null}
      onCloseAutoFocus={(event) => {
        if (returnFocusRef?.current) {
          event.preventDefault()
          returnFocusRef.current.focus()
        }
      }}
      footer={detail && entry ? <AgreementFooter entry={entry} onClose={onClose} onEdit={onEdit} /> : <Button type="button" variant="outline" className="sm:ml-auto" onClick={onClose}>Fermer</Button>}
    >
      {query.isLoading ? (
        <div className="space-y-4" aria-busy="true" aria-label="Chargement du détail de l'accord">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : query.isError ? (
        isNotFoundError(query.error) ? (
          <p role="alert" className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">Cet accord n'existe plus ou a été retiré.</p>
        ) : (
          <QueryErrorState message="Impossible de charger le détail de cet accord." onRetry={() => void query.refetch()} isRetrying={query.isFetching} />
        )
      ) : detail ? (
        <AgreementBody detail={detail} onEdit={onEdit} />
      ) : null}
    </DetailDialog>
  )
}

function AgreementBadges({ entry }: { entry: AgreementRegisterEntry }) {
  return (
    <>
      <StatusPill tone={entry.status === "active" ? "success" : "neutral"}>{AGREEMENT_STATUS_LABELS[entry.status]}</StatusPill>
      {entry.financial_status === "late" ? <StatusPill tone="warning">En retard</StatusPill> : null}
      {entry.financial_status === "up_to_date" ? <StatusPill tone="success">À jour</StatusPill> : null}
    </>
  )
}

function AgreementFooter({ entry, onClose, onEdit }: { entry: AgreementRegisterEntry; onClose: () => void; onEdit?: (entry: AgreementRegisterEntry) => void }) {
  const { hasPermission } = usePermissions()
  const [actionOpen, setActionOpen] = useState(false)
  const isOverride = entry.kind === "override"
  // Mêmes codes que les routes API : PUT/POST /tuition/overrides* → grant_discount ; /tuition/student-schedules → manage_student_schedule.
  const canAct = entry.status === "active" && hasPermission(isOverride ? "tuition.grant_discount" : "tuition.manage_student_schedule")
  const dangerLabel = isOverride ? (isCustomTotalOverride(entry) ? "Retirer l'ajustement" : "Retirer la remise") : "Réinitialiser"
  return (
    <>
      <div>
        {canAct ? (
          <Button type="button" variant="outline" className="w-full border-red-300 text-red-700 hover:bg-red-50 hover:text-red-800 sm:w-auto dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950" onClick={() => setActionOpen(true)}>
            {dangerLabel}
          </Button>
        ) : null}
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row">
        <Button type="button" variant="outline" onClick={onClose}>Fermer</Button>
        {canAct && onEdit ? <Button type="button" onClick={() => onEdit(entry)}>Modifier</Button> : null}
      </div>
      {canAct ? <AgreementActionDialog agreement={entry} action={isOverride ? "withdraw" : "reset"} open={actionOpen} onOpenChange={setActionOpen} /> : null}
    </>
  )
}

function AgreementBody({ detail, onEdit }: { detail: AgreementDetail; onEdit?: (entry: AgreementRegisterEntry) => void }) {
  const entry = detail.agreement
  const isSchedule = entry.kind === "schedule"
  return (
    <>
      {isSchedule ? <ScheduleSummary entry={entry} steps={entry.schedule_steps ?? []} onEdit={onEdit} /> : <OverrideSummary entry={entry} />}

      <dl className="grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium text-muted-foreground">Créé le</dt>
          <dd className="mt-1 font-semibold">{formatDate(entry.created_at)}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-muted-foreground">Responsable</dt>
          <dd className="mt-1 font-semibold">{entry.created_by_name ?? ARCHIVED_USER_LABEL}</dd>
        </div>
      </dl>

      <section>
        <h3 className="text-sm font-semibold">Motif</h3>
        <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{entry.reason}</p>
        {entry.withdrawal_reason ? <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">Motif de clôture : {entry.withdrawal_reason}</p> : null}
      </section>

      <section>
        <h3 className="text-sm font-semibold">Historique</h3>
        {detail.events.length ? (
          <ol className="mt-2 space-y-2">
            {detail.events.map((event) => (
              <li className="rounded-lg border p-3 text-sm" key={event.id}>
                <p className="font-medium">{eventNames[event.action] ?? event.action}</p>
                <p className="text-muted-foreground">
                  {event.actor_name ?? ARCHIVED_USER_LABEL} · {event.actor_role} · {new Intl.DateTimeFormat("fr-CI", { dateStyle: "medium", timeStyle: "short" }).format(new Date(event.created_at))}
                </p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-2 rounded-lg bg-muted/50 px-4 py-6 text-center text-sm text-muted-foreground">{EMPTY_AGREEMENT_HISTORY}</p>
        )}
      </section>
    </>
  )
}

function OverrideSummary({ entry }: { entry: AgreementRegisterEntry }) {
  const breakdown = buildOverrideBreakdown(entry)
  const isReduction = breakdown.adjustment < 0
  const rows: LabelValueRow[] = [
    { key: "plan", label: "Plan de référence", value: formatFcfa(breakdown.planAmount) },
    {
      key: "adjustment",
      label: isCustomTotalOverride(entry) ? "Ajustement du montant" : "Remise accordée",
      value: breakdown.adjustment === 0 ? formatFcfa(0) : `${isReduction ? "−" : "+"} ${formatFcfa(Math.abs(breakdown.adjustment))}`,
      tone: isReduction ? "success" : "default",
    },
    { key: "due", label: "Montant dû", value: formatFcfa(breakdown.amountDue), strong: true, separated: true },
    { key: "paid", label: "Déjà encaissé", value: `− ${formatFcfa(breakdown.collected)}`, tone: "muted", separated: true },
    { key: "balance", label: "Solde à payer", value: formatFcfa(breakdown.balance), highlight: true, separated: true },
  ]
  return (
    <>
      <LabelValueList rows={rows} />
      <ProgressMeter
        percent={breakdown.percent}
        label="Progression des encaissements"
        caption={`${formatFcfa(breakdown.collected)} encaissés sur ${formatFcfa(breakdown.amountDue)} (${breakdown.percent} %)`}
      />
    </>
  )
}

function ScheduleSummary({ entry, steps, onEdit }: { entry: AgreementRegisterEntry; steps: AgreementDetail["agreement"]["schedule_steps"]; onEdit?: (entry: AgreementRegisterEntry) => void }) {
  const linkRef = useRef<HTMLButtonElement>(null)
  const canViewAgreements = useCanViewAgreements()
  const [discountOpen, setDiscountOpen] = useState(false)
  const hasActiveDiscount = entry.active_discount_amount > 0
  const rows = buildInstallmentRows(steps ?? [], entry.total_paid, todayInBusinessTimezone())
  const percent = scheduleCollectedPercent(entry)
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <KeyFigure variant="plain" label="Plan de référence" value={formatFcfa(entry.plan_total_amount)} />
        <KeyFigure variant="plain" label="Encaissé" value={formatFcfa(entry.total_paid)} />
        <KeyFigure variant="plain" label="Solde" value={formatFcfa(entry.remaining_due)} />
      </div>
      <ProgressMeter percent={percent} label="Progression des encaissements" caption={`${percent} % encaissé`} />

      {hasActiveDiscount ? (
        <div className="flex flex-wrap items-center gap-3">
          <StatusPill tone="neutral" className="px-4 py-1.5 text-sm">{`Remise active : ${formatFcfa(entry.active_discount_amount)}`}</StatusPill>
          {canViewAgreements ? (
            <Button ref={linkRef} type="button" variant="link" className="h-auto min-h-10 p-0" onClick={() => setDiscountOpen(true)}>
              Voir l'accord de remise
            </Button>
          ) : null}
        </div>
      ) : null}

      {hasActiveDiscount && canViewAgreements && discountOpen ? (
        <LinkedDiscountDialog entry={entry} onClose={() => setDiscountOpen(false)} onEdit={onEdit} returnFocusRef={linkRef} />
      ) : null}

      {rows.length ? (
        <section className="space-y-2">
          <h3 className="text-base font-semibold">Arrangement convenu</h3>
          <div className="hidden rounded-lg border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14 px-4">N°</TableHead>
                  <TableHead>Date prévue</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Cumul attendu</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.dueDate} className={cn(row.status.kind === "overdue" && "bg-red-50/70 hover:bg-red-50 dark:bg-red-950/20")}>
                    <TableCell className="px-4 py-3 text-muted-foreground">{row.number}</TableCell>
                    <TableCell className="py-3">{formatDate(row.dueDate)}</TableCell>
                    <TableCell className="py-3 font-semibold tabular-nums">{formatFcfa(row.amount)}</TableCell>
                    <TableCell className="py-3 tabular-nums text-muted-foreground">{formatFcfa(row.cumulativeExpected)}</TableCell>
                    <TableCell className="py-3"><StatusPill tone={installmentTone(row.status)}>{installmentStatusLabel(row.status)}</StatusPill></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <ul className="space-y-2 md:hidden">
            {rows.map((row) => (
              <li key={row.dueDate} className={cn("rounded-lg border p-3 text-sm", row.status.kind === "overdue" && "bg-red-50/70 dark:bg-red-950/20")}>
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">{row.number}. {formatDate(row.dueDate)}</p>
                  <StatusPill tone={installmentTone(row.status)}>{installmentStatusLabel(row.status)}</StatusPill>
                </div>
                <p className="mt-1 font-semibold tabular-nums">{formatFcfa(row.amount)}</p>
                <p className="text-muted-foreground tabular-nums">Cumul attendu : {formatFcfa(row.cumulativeExpected)}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  )
}

/**
 * Fenêtre empilée « accord de remise » ouverte depuis un échéancier. Retrouve la remise active de l'élève ;
 * gère chargement, erreur (réessayer) et remise disparue entre-temps.
 */
export function LinkedDiscountDialog({ entry, onClose, onEdit, returnFocusRef }: { entry: AgreementRegisterEntry; onClose: () => void; onEdit?: (entry: AgreementRegisterEntry) => void; returnFocusRef: RefObject<HTMLElement | null> }) {
  const lookup = useQuery({
    queryKey: ["finance", "agreements", "linked-discount", entry.school_year_id, entry.student_id],
    queryFn: () => listAgreementsRegister({ schoolYearId: entry.school_year_id, kind: "overrides", studentId: entry.student_id, status: "active", limit: 1 }),
  })
  const discountId = lookup.data?.entries[0]?.id ?? null
  if (discountId) {
    return <AgreementDetailDialog kind="overrides" id={discountId} onClose={onClose} onEdit={onEdit} returnFocusRef={returnFocusRef} />
  }
  return (
    <DetailDialog
      open
      onOpenChange={(open) => { if (!open) onClose() }}
      size="md"
      title="Remise sur frais"
      subtitle={entry.student_name}
      onCloseAutoFocus={(event) => {
        if (returnFocusRef.current) {
          event.preventDefault()
          returnFocusRef.current.focus()
        }
      }}
      footer={<Button type="button" variant="outline" className="sm:ml-auto" onClick={onClose}>Fermer</Button>}
    >
      {lookup.isLoading ? (
        <div className="space-y-3" aria-busy="true" aria-label="Chargement de la remise"><Skeleton className="h-32 w-full" /><Skeleton className="h-4 w-1/2" /></div>
      ) : lookup.isError ? (
        <QueryErrorState message="Impossible de charger l'accord de remise." onRetry={() => void lookup.refetch()} isRetrying={lookup.isFetching} />
      ) : (
        <p role="alert" className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">Cette remise n'existe plus ou a été retirée.</p>
      )}
    </DetailDialog>
  )
}
