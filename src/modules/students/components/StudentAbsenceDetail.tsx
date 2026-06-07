import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"

import {
  OfflineMutationQueuedError,
  useOfflineMutation,
} from "@/shared/hooks/useOfflineMutation"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import {
  excuseAbsence,
  getStudentAbsenceRecords,
  type StudentAbsenceRecord,
  type StudentAbsenceStat,
} from "@/modules/students/students.api"
import { EmptyState } from "@/shared/components"
import { usePermissions } from "@/shared/hooks/usePermissions"
import { useStudentLabels } from "@/shared/hooks/useStudentLabel"

type StudentAbsenceDetailProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  student: StudentAbsenceStat | null
  from: string
  to: string
  subject?: string
}

const smsConfig: Record<
  "sent" | "failed" | "not_sent",
  { label: string; className: string }
> = {
  sent: {
    label: "Notifié",
    className: "border-green-200 bg-green-100 text-green-700",
  },
  failed: {
    label: "Échec",
    className: "border-amber-200 bg-amber-100 text-amber-900",
  },
  not_sent: {
    label: "Non notifié",
    className: "border-red-200 bg-red-100 text-red-700",
  },
}

const absenceStatusConfig: Record<
  "absent" | "excused",
  { label: string; className: string }
> = {
  absent: {
    label: "Absent",
    className: "border-red-200 bg-red-100 text-red-700",
  },
  excused: {
    label: "Excusé",
    className: "border-emerald-200 bg-emerald-100 text-emerald-700",
  },
}

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("fr-CI", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00Z`))

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat("fr-CI", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Africa/Abidjan",
  }).format(new Date(value))

const formatTime = (value: string) => value.slice(0, 5)

const recordKey = (record: StudentAbsenceRecord, index: number) =>
  `${record.date}-${record.subject}-${record.startTime}-${record.endTime}-${index}`

export default function StudentAbsenceDetail({
  open,
  onOpenChange,
  student,
  from,
  to,
  subject,
}: StudentAbsenceDetailProps) {
  const queryClient = useQueryClient()
  const { hasPermission } = usePermissions()
  const studentLabels = useStudentLabels()
  const canExcuse = hasPermission("students.excuse")

  const [excuseDialogId, setExcuseDialogId] = useState<string | null>(null)
  const [excuseReason, setExcuseReason] = useState("")

  const absenceQueryKey = ["students", "absence", "detail", student?.studentId, from, to, subject]

  const detailQuery = useQuery({
    queryKey: absenceQueryKey,
    queryFn: () =>
      getStudentAbsenceRecords(student!.studentId, { from, to, subject }),
    enabled: open && Boolean(student),
  })

  const excuseMutation = useOfflineMutation<
    { id: string; status: string; excuseReason: string },
    { id: string; reason: string }
  >(
    ({ id, reason }) => excuseAbsence(id, reason),
    {
      queueKey: "student-absence-excuse",
      onSync: () => {
        void queryClient.invalidateQueries({ queryKey: absenceQueryKey })
        void queryClient.invalidateQueries({
          queryKey: ["students", "detail", student?.studentId],
        })
      },
    }
  )

  const absences = detailQuery.data ?? []

  const handleConfirmExcuse = async () => {
    if (!excuseDialogId || !excuseReason.trim()) return
    try {
      await excuseMutation.mutateAsync({ id: excuseDialogId, reason: excuseReason.trim() })
      void queryClient.invalidateQueries({ queryKey: absenceQueryKey })
      void queryClient.invalidateQueries({
        queryKey: ["students", "detail", student?.studentId],
      })
      setExcuseDialogId(null)
      setExcuseReason("")
    } catch (error) {
      // Offline path: mutation was queued - close the dialog so the user sees the optimistic state
      if (error instanceof OfflineMutationQueuedError) {
        setExcuseDialogId(null)
        setExcuseReason("")
      }
    }
  }

  const handleDialogOpenChange = (dialogOpen: boolean) => {
    if (!dialogOpen) {
      setExcuseDialogId(null)
      setExcuseReason("")
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-[85vh] overflow-y-auto p-4 sm:p-6">
          <SheetHeader>
            <SheetTitle>Absences de {student?.studentName ?? "—"}</SheetTitle>
            <SheetDescription>
              Classe {student?.className ?? "—"} • {student?.absenceCount ?? 0} absences sur la période
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4 space-y-3 pb-6">
            {detailQuery.isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={`absence-detail-skeleton-${index}`} className="h-24 w-full" />
                ))}
              </div>
            ) : null}

            {!detailQuery.isLoading && absences.length === 0 ? (
              <EmptyState
                title="Aucune absence"
                message={`Aucune absence trouvée pour cet ${studentLabels.singularLower} sur la période sélectionnée.`}
              />
            ) : null}

            {!detailQuery.isLoading
              ? absences.map((record, index) => (
                  <div key={recordKey(record, index)} className="space-y-2 rounded-xl border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {formatDate(record.date)} - {record.subject}
                        </span>
                        <Badge
                          variant="outline"
                          className={absenceStatusConfig[record.status].className}
                        >
                          {absenceStatusConfig[record.status].label}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatTime(record.startTime)}–{formatTime(record.endTime)}
                      </span>
                    </div>

                    {record.excuseReason ? (
                      <p className="text-xs text-muted-foreground italic">
                        Motif : {record.excuseReason}
                      </p>
                    ) : null}

                    {record.smsPhone1.phone ? (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground">{record.smsPhone1.phone}</span>
                        <Badge
                          variant="outline"
                          className={smsConfig[record.smsPhone1.status].className}
                        >
                          {smsConfig[record.smsPhone1.status].label}
                        </Badge>
                        {record.smsPhone1.sentAt ? (
                          <span className="text-muted-foreground">
                            {formatDateTime(record.smsPhone1.sentAt)}
                          </span>
                        ) : null}
                      </div>
                    ) : null}

                    {record.smsPhone2.phone ? (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground">{record.smsPhone2.phone} (2)</span>
                        <Badge
                          variant="outline"
                          className={smsConfig[record.smsPhone2.status].className}
                        >
                          {smsConfig[record.smsPhone2.status].label}
                        </Badge>
                        {record.smsPhone2.sentAt ? (
                          <span className="text-muted-foreground">
                            {formatDateTime(record.smsPhone2.sentAt)}
                          </span>
                        ) : null}
                      </div>
                    ) : null}

                    {canExcuse && record.status === "absent" ? (
                      <div className="pt-1">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => setExcuseDialogId(record.id)}
                        >
                          Excuser
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ))
              : null}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={excuseDialogId !== null} onOpenChange={handleDialogOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excuser l&apos;absence</DialogTitle>
            <DialogDescription>
              {`Saisissez le motif d'excuse. Ce motif sera enregistré sur le dossier de l'${studentLabels.singularLower}.`}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Motif de l'excuse…"
            value={excuseReason}
            onChange={(e) => setExcuseReason(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => handleDialogOpenChange(false)}
              disabled={excuseMutation.isPending}
            >
              Annuler
            </Button>
            <Button
              onClick={handleConfirmExcuse}
              disabled={!excuseReason.trim() || excuseMutation.isPending}
            >
              {excuseMutation.isPending ? "Enregistrement…" : "Confirmer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
