import { useEffect, useMemo, useState } from "react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { StudentItem } from "@/modules/students/students.api"

type AttendanceSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  students: StudentItem[]
  scheduleLabel: string
  isPending: boolean
  onSubmit: (absentStudentIds: string[]) => Promise<void>
}

export default function AttendanceSheet({
  open,
  onOpenChange,
  students,
  scheduleLabel,
  isPending,
  onSubmit,
}: AttendanceSheetProps) {
  const [absentStudentIds, setAbsentStudentIds] = useState<Set<string>>(new Set())
  const [confirmationMode, setConfirmationMode] = useState(false)

  useEffect(() => {
    if (!open) {
      setAbsentStudentIds(new Set())
      setConfirmationMode(false)
    }
  }, [open])

  const sortedStudents = useMemo(
    () =>
      [...students].sort((left, right) => {
        if (left.lastName !== right.lastName) {
          return left.lastName.localeCompare(right.lastName, "fr", { sensitivity: "base" })
        }

        return left.firstName.localeCompare(right.firstName, "fr", { sensitivity: "base" })
      }),
    [students]
  )

  const toggleAbsent = (studentId: string) => {
    setAbsentStudentIds((previous) => {
      const next = new Set(previous)
      if (next.has(studentId)) {
        next.delete(studentId)
      } else {
        next.add(studentId)
      }
      return next
    })
  }

  const handleConfirmSubmit = async () => {
    await onSubmit([...absentStudentIds])
    onOpenChange(false)
  }

  const absentCount = absentStudentIds.size

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Faire l&apos;appel</DialogTitle>
          <DialogDescription>
            {students.length} élèves · Créneau {scheduleLabel}
          </DialogDescription>
        </DialogHeader>

        {!confirmationMode ? (
          <div className="space-y-4">
            <div className="space-y-2">
              {sortedStudents.map((student) => {
                const isAbsent = absentStudentIds.has(student.id)
                const fullName = `${student.lastName} ${student.firstName}`

                return (
                  <div
                    key={student.id}
                    className="flex items-center justify-between rounded-md border border-border p-2"
                  >
                    <span className="text-sm font-medium">{fullName}</span>
                    <Button
                      type="button"
                      size="sm"
                      variant={isAbsent ? "destructive" : "secondary"}
                      className="min-h-[40px] min-w-[96px]"
                      onClick={() => toggleAbsent(student.id)}
                    >
                      {isAbsent ? "Absent" : "Présent"}
                    </Button>
                  </div>
                )
              })}
            </div>

            <Button type="button" className="w-full min-h-[52px]" onClick={() => setConfirmationMode(true)}>
              Enregistrer {absentCount} absence{absentCount > 1 ? "s" : ""}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Alert>
              <AlertDescription>
                Confirmer l&apos;enregistrement de {absentCount} absence
                {absentCount > 1 ? "s" : ""} pour ce créneau.
              </AlertDescription>
            </Alert>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                onClick={() => setConfirmationMode(false)}
                disabled={isPending}
              >
                Retour
              </Button>
              <Button type="button" className="w-full" onClick={() => void handleConfirmSubmit()} disabled={isPending}>
                {isPending ? "Enregistrement..." : "Confirmer"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
