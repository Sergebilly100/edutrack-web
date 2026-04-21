import { useQuery } from "@tanstack/react-query"

import { Badge } from "@/components/ui/badge"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import {
  getStudentAbsenceRecords,
  type StudentAbsenceRecord,
  type StudentAbsenceStat,
} from "@/modules/students/students.api"
import { EmptyState } from "@/shared/components"

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
    className: "border-amber-200 bg-amber-100 text-amber-700",
  },
  not_sent: {
    label: "Non notifié",
    className: "border-red-200 bg-red-100 text-red-700",
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
  `${record.date}-${record.subject}-${record.start_time}-${record.end_time}-${index}`

export default function StudentAbsenceDetail({
  open,
  onOpenChange,
  student,
  from,
  to,
  subject,
}: StudentAbsenceDetailProps) {
  const detailQuery = useQuery({
    queryKey: ["students", "absence", "detail", student?.student_id, from, to, subject],
    queryFn: () =>
      getStudentAbsenceRecords(student!.student_id, {
        from,
        to,
        subject,
      }),
    enabled: open && Boolean(student),
  })

  const absences = detailQuery.data ?? []

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] overflow-y-auto p-4 sm:p-6">
        <SheetHeader>
          <SheetTitle>Absences de {student?.student_name ?? "—"}</SheetTitle>
          <SheetDescription>
            Classe {student?.class_name ?? "—"} • {student?.absence_count ?? 0} absences sur la période
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
              message="Aucune absence trouvée pour cet élève sur la période sélectionnée."
            />
          ) : null}

          {!detailQuery.isLoading
            ? absences.map((record, index) => (
                <div key={recordKey(record, index)} className="space-y-2 rounded-xl border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">
                      {formatDate(record.date)} — {record.subject}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatTime(record.start_time)}–{formatTime(record.end_time)}
                    </span>
                  </div>

                  {record.sms_phone_1.phone ? (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground">{record.sms_phone_1.phone}</span>
                      <Badge
                        variant="outline"
                        className={smsConfig[record.sms_phone_1.status].className}
                      >
                        {smsConfig[record.sms_phone_1.status].label}
                      </Badge>
                      {record.sms_phone_1.sent_at ? (
                        <span className="text-muted-foreground">
                          {formatDateTime(record.sms_phone_1.sent_at)}
                        </span>
                      ) : null}
                    </div>
                  ) : null}

                  {record.sms_phone_2.phone ? (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground">{record.sms_phone_2.phone} (2)</span>
                      <Badge
                        variant="outline"
                        className={smsConfig[record.sms_phone_2.status].className}
                      >
                        {smsConfig[record.sms_phone_2.status].label}
                      </Badge>
                      {record.sms_phone_2.sent_at ? (
                        <span className="text-muted-foreground">
                          {formatDateTime(record.sms_phone_2.sent_at)}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ))
            : null}
        </div>
      </SheetContent>
    </Sheet>
  )
}
