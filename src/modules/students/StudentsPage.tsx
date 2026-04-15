import { useEffect, useMemo, useState } from "react"
import { Navigate } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { Alert, AlertDescription } from "@/components/ui/alert"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"
import { fetchActiveSchedules } from "@/modules/schedule/schedule.api"
import AttendanceSheet from "@/modules/students/components/AttendanceSheet"
import {
  bulkMarkAbsent,
  createStudent,
  getAttendanceHistory,
  getTodayAbsences,
  listStudents,
} from "@/modules/students/students.api"
import { AddIcon, FilterIcon } from "@/shared/components/icons"
import { useAuthStore } from "@/shared/store/auth.store"

const CLASS_TABS = [
  { key: "3eme-a", label: "3ème A" },
  { key: "3eme-b", label: "3ème B" },
  { key: "term-c", label: "Terminale C" },
] as const

const normalizeClassName = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()

const formatDate = (value: string) =>
  new Date(`${value}T00:00:00.000Z`).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })

const formatTimeSlotLabel = (label: string) => label.replace("-", " - ")

type TabValue = (typeof CLASS_TABS)[number]["key"] | "absences"

export default function StudentsPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const user = useAuthStore((state) => state.user)
  const [tabValue, setTabValue] = useState<TabValue>(CLASS_TABS[0].key)
  const [scheduleByClassTab, setScheduleByClassTab] = useState<Record<string, string>>({})
  const [sheetOpen, setSheetOpen] = useState(false)
  const [studentModalOpen, setStudentModalOpen] = useState(false)
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [parentPhone, setParentPhone] = useState("")
  const [parentPhone2, setParentPhone2] = useState("")

  const [historyClassId, setHistoryClassId] = useState<string>("all")
  const [historyStudentId, setHistoryStudentId] = useState<string>("all")
  const [historyScheduleId, setHistoryScheduleId] = useState<string>("all")
  const [historyDateFrom, setHistoryDateFrom] = useState("")
  const [historyDateTo, setHistoryDateTo] = useState("")

  const activeSchedulesQuery = useQuery({
    queryKey: ["schedule", "active"],
    queryFn: fetchActiveSchedules,
  })

  const activeSchedules = activeSchedulesQuery.data?.schedules ?? []

  const classMap = useMemo(() => {
    const byNormalizedName = new Map(
      activeSchedules.map((schedule) => [normalizeClassName(schedule.class.name), schedule.class.id])
    )

    return CLASS_TABS.reduce<Record<string, string | null>>((acc, tab) => {
      acc[tab.key] = byNormalizedName.get(normalizeClassName(tab.label)) ?? null
      return acc
    }, {})
  }, [activeSchedules])

  const currentClassId = tabValue === "absences" ? null : classMap[tabValue]

  const currentClassSchedules = useMemo(() => {
    if (!currentClassId) {
      return []
    }

    return activeSchedules
      .filter((schedule) => schedule.class.id === currentClassId)
      .sort((left, right) => left.timeSlot.sortOrder - right.timeSlot.sortOrder)
  }, [activeSchedules, currentClassId])

  useEffect(() => {
    if (tabValue === "absences") {
      return
    }

    if (currentClassSchedules.length === 0) {
      return
    }

    const selected = scheduleByClassTab[tabValue]
    const exists = currentClassSchedules.some((schedule) => schedule.id === selected)
    if (!selected || !exists) {
      setScheduleByClassTab((previous) => ({
        ...previous,
        [tabValue]: currentClassSchedules[0]!.id,
      }))
    }
  }, [currentClassSchedules, scheduleByClassTab, tabValue])

  const selectedScheduleId = tabValue === "absences" ? null : (scheduleByClassTab[tabValue] ?? null)
  const selectedSchedule = currentClassSchedules.find((schedule) => schedule.id === selectedScheduleId) ?? null

  const studentsQuery = useQuery({
    queryKey: ["students", "class", currentClassId],
    queryFn: () => listStudents({ classId: currentClassId ?? undefined, page: 1, limit: 100 }),
    enabled: Boolean(currentClassId),
  })

  const students = studentsQuery.data?.data ?? []
  const studentsCount = studentsQuery.data?.pagination.total ?? 0

  const historyStudentsQuery = useQuery({
    queryKey: ["students", "history-filter", historyClassId],
    queryFn: () =>
      listStudents({
        classId: historyClassId === "all" ? undefined : historyClassId,
        page: 1,
        limit: 100,
      }),
    enabled: tabValue === "absences",
  })

  const historyQuery = useQuery({
    queryKey: [
      "attendance",
      "students",
      historyClassId,
      historyStudentId,
      historyScheduleId,
      historyDateFrom,
      historyDateTo,
    ],
    queryFn: () =>
      getAttendanceHistory({
        page: 1,
        limit: 50,
        classId: historyClassId === "all" ? undefined : historyClassId,
        studentId: historyStudentId === "all" ? undefined : historyStudentId,
        scheduleId: historyScheduleId === "all" ? undefined : historyScheduleId,
        dateFrom: historyDateFrom || undefined,
        dateTo: historyDateTo || undefined,
      }),
    enabled: tabValue === "absences",
  })

  const todayAbsencesQuery = useQuery({
    queryKey: ["attendance", "students", "today"],
    queryFn: getTodayAbsences,
    enabled: tabValue === "absences",
  })

  const createStudentMutation = useMutation({
    mutationFn: () =>
      createStudent({
        classId: currentClassId ?? "",
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        parentPhone: parentPhone.trim() || null,
        parentPhone2: parentPhone2.trim() || null,
      }),
    onSuccess: async () => {
      setStudentModalOpen(false)
      setFirstName("")
      setLastName("")
      setParentPhone("")
      setParentPhone2("")
      await queryClient.invalidateQueries({ queryKey: ["students", "class", currentClassId] })
      toast({
        title: "Élève ajouté",
        description: "Le nouvel élève a été enregistré.",
      })
    },
  })

  const bulkMutation = useMutation({
    mutationFn: (absentStudentIds: string[]) =>
      bulkMarkAbsent(
        selectedScheduleId ?? "",
        activeSchedulesQuery.data?.date ?? new Date().toISOString().slice(0, 10),
        absentStudentIds
      ),
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["attendance", "students", "today"] }),
        queryClient.invalidateQueries({ queryKey: ["attendance", "students"] }),
      ])
      toast({
        title: "Absences enregistrées",
        description: `${result.createdAttendances} absence(s), ${result.emittedEvents} notification(s) SMS en file.`,
      })
    },
  })

  if (!user) {
    return <Navigate to="/" replace />
  }

  if (user.role !== "director" && user.role !== "secretary") {
    return (
      <div className="p-4 md:p-6">
        <Alert variant="destructive">
          <AlertDescription>Cette page est réservée au secrétariat et à la direction.</AlertDescription>
        </Alert>
      </div>
    )
  }

  const scheduleLabelMap = new Map(
    activeSchedules.map((schedule) => [
      schedule.id,
      `${schedule.subject} · ${formatTimeSlotLabel(schedule.timeSlot.label)}`,
    ])
  )

  const historySchedules = historyClassId === "all"
    ? activeSchedules
    : activeSchedules.filter((schedule) => schedule.class.id === historyClassId)

  const historyStudents = historyStudentsQuery.data?.data ?? []
  const historyRows = historyQuery.data?.data ?? []
  const todayGroups = todayAbsencesQuery.data ?? []

  return (
    <div className="space-y-6 px-4 py-6 md:px-6 md:py-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Élèves & absences</h1>
        <p className="text-sm text-muted-foreground">
          Sélectionnez la classe, le créneau, puis faites l&apos;appel en quelques secondes.
        </p>
      </header>

      <Tabs value={tabValue} onValueChange={(value) => setTabValue(value as TabValue)} className="space-y-4">
        <TabsList className="h-auto flex-wrap">
          {CLASS_TABS.map((item) => (
            <TabsTrigger key={item.key} value={item.key}>
              {item.label}
            </TabsTrigger>
          ))}
          <TabsTrigger value="absences">Absences</TabsTrigger>
        </TabsList>

        {CLASS_TABS.map((item) => {
          const classId = classMap[item.key]
          const isCurrent = tabValue === item.key
          const schedules = isCurrent ? currentClassSchedules : []
          const scheduleId = scheduleByClassTab[item.key]

          return (
            <TabsContent key={item.key} value={item.key} className="space-y-4">
              {!classId ? (
                <Alert>
                  <AlertDescription>
                    Aucune classe active correspondant à {item.label} aujourd&apos;hui.
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  <div className="space-y-3 rounded-lg border border-border p-4">
                    <p className="text-sm font-medium">
                      Élèves actifs:{" "}
                      <span className="font-semibold">{studentsCount}</span>
                    </p>
                    <div className="space-y-2">
                      <Label>Créneau du jour</Label>
                      <Select
                        value={scheduleId}
                        onValueChange={(value) =>
                          setScheduleByClassTab((previous) => ({
                            ...previous,
                            [item.key]: value,
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Choisir un créneau" />
                        </SelectTrigger>
                        <SelectContent>
                          {schedules.map((schedule) => (
                            <SelectItem key={schedule.id} value={schedule.id}>
                              {schedule.subject} · {formatTimeSlotLabel(schedule.timeSlot.label)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" onClick={() => setSheetOpen(true)} disabled={!selectedScheduleId}>
                        Faire l&apos;appel
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setStudentModalOpen(true)}
                        disabled={!currentClassId}
                      >
                        <AddIcon className="mr-2 h-4 w-4" />
                        Ajouter un élève
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {studentsQuery.isLoading ? (
                      <p className="text-sm text-muted-foreground">Chargement des élèves...</p>
                    ) : null}
                    {!studentsQuery.isLoading && students.length === 0 ? (
                      <Alert>
                        <AlertDescription>Aucun élève actif dans cette classe.</AlertDescription>
                      </Alert>
                    ) : null}
                    {students.slice(0, 10).map((student) => (
                      <div
                        key={student.id}
                        className="flex items-center justify-between rounded-md border border-border p-2"
                      >
                        <span className="text-sm font-medium">
                          {student.lastName} {student.firstName}
                        </span>
                        {student.parentPhone ? (
                          <Badge variant="outline">{student.parentPhone}</Badge>
                        ) : (
                          <Badge variant="secondary">Parent non renseigné</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </TabsContent>
          )
        })}

        <TabsContent value="absences" className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <FilterIcon className="h-4 w-4" />
            Filtres d&apos;historique
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Classe</Label>
              <Select
                value={historyClassId}
                onValueChange={(value) => {
                  setHistoryClassId(value)
                  setHistoryStudentId("all")
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Toutes les classes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les classes</SelectItem>
                  {CLASS_TABS.map((tab) => {
                    const classId = classMap[tab.key]
                    if (!classId) {
                      return null
                    }
                    return (
                      <SelectItem key={classId} value={classId}>
                        {tab.label}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Élève</Label>
              <Select value={historyStudentId} onValueChange={setHistoryStudentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Tous les élèves" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les élèves</SelectItem>
                  {historyStudents.map((student) => (
                    <SelectItem key={student.id} value={student.id}>
                      {student.lastName} {student.firstName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Créneau</Label>
              <Select value={historyScheduleId} onValueChange={setHistoryScheduleId}>
                <SelectTrigger>
                  <SelectValue placeholder="Tous les créneaux" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les créneaux</SelectItem>
                  {historySchedules.map((schedule) => (
                    <SelectItem key={schedule.id} value={schedule.id}>
                      {schedule.subject} · {formatTimeSlotLabel(schedule.timeSlot.label)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>Date début</Label>
                <Input type="date" value={historyDateFrom} onChange={(e) => setHistoryDateFrom(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Date fin</Label>
                <Input type="date" value={historyDateTo} onChange={(e) => setHistoryDateTo(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Élève</TableHead>
                  <TableHead>Classe</TableHead>
                  <TableHead>Créneau</TableHead>
                  <TableHead>SMS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historyRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{formatDate(row.date)}</TableCell>
                    <TableCell>{row.studentLastName} {row.studentFirstName}</TableCell>
                    <TableCell>{row.className}</TableCell>
                    <TableCell>{row.scheduleId ? (scheduleLabelMap.get(row.scheduleId) ?? "N/A") : "N/A"}</TableCell>
                    <TableCell>
                      {row.smsNotified ? (
                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100">✓ SMS</Badge>
                      ) : (
                        <Badge variant="secondary">{row.smsStatus ?? "non envoyé"}</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {historyQuery.isLoading ? <p className="text-sm text-muted-foreground">Chargement historique...</p> : null}
          {!historyQuery.isLoading && historyRows.length === 0 ? (
            <Alert>
              <AlertDescription>Aucune absence trouvée avec les filtres actuels.</AlertDescription>
            </Alert>
          ) : null}

          <div className="space-y-2 rounded-lg border border-border p-4">
            <p className="text-sm font-medium">Absences du jour</p>
            {todayGroups.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune absence signalée aujourd&apos;hui.</p>
            ) : (
              todayGroups.map((group) => (
                <div key={group.classId} className="space-y-2">
                  <p className="text-sm font-semibold">{group.className}</p>
                  {group.absences.map((absence) => (
                    <div
                      key={`${group.classId}-${absence.studentId}-${absence.scheduleId ?? "na"}-${absence.date}`}
                      className="flex items-center justify-between rounded-md border border-border p-2"
                    >
                      <span className="text-sm">
                        {absence.studentLastName} {absence.studentFirstName}
                      </span>
                      {absence.smsNotified ? (
                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100">✓ SMS</Badge>
                      ) : (
                        <Badge variant="secondary">{absence.smsStatus ?? "non envoyé"}</Badge>
                      )}
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      <AttendanceSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        students={students}
        scheduleLabel={selectedSchedule ? formatTimeSlotLabel(selectedSchedule.timeSlot.label) : "N/A"}
        isPending={bulkMutation.isPending}
        onSubmit={async (absentStudentIds) => {
          if (!selectedScheduleId) {
            throw new Error("Aucun créneau sélectionné")
          }
          await bulkMutation.mutateAsync(absentStudentIds)
        }}
      />

      <AttendanceAddDialog
        open={studentModalOpen}
        onOpenChange={setStudentModalOpen}
        firstName={firstName}
        setFirstName={setFirstName}
        lastName={lastName}
        setLastName={setLastName}
        parentPhone={parentPhone}
        setParentPhone={setParentPhone}
        parentPhone2={parentPhone2}
        setParentPhone2={setParentPhone2}
        onSave={() => void createStudentMutation.mutateAsync()}
        isPending={createStudentMutation.isPending}
      />
    </div>
  )
}

type AttendanceAddDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  firstName: string
  setFirstName: (value: string) => void
  lastName: string
  setLastName: (value: string) => void
  parentPhone: string
  setParentPhone: (value: string) => void
  parentPhone2: string
  setParentPhone2: (value: string) => void
  onSave: () => void
  isPending: boolean
}

function AttendanceAddDialog({
  open,
  onOpenChange,
  firstName,
  setFirstName,
  lastName,
  setLastName,
  parentPhone,
  setParentPhone,
  parentPhone2,
  setParentPhone2,
  onSave,
  isPending,
}: AttendanceAddDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajouter un élève</DialogTitle>
          <DialogDescription>Formulaire rapide secrétariat.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Prénom</Label>
            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Nom</Label>
            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Téléphone parent</Label>
            <Input
              placeholder="2250700000001"
              value={parentPhone}
              onChange={(e) => setParentPhone(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Téléphone parent 2</Label>
            <Input
              placeholder="2250700000002"
              value={parentPhone2}
              onChange={(e) => setParentPhone2(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button type="button" onClick={onSave} disabled={isPending}>
            {isPending ? "Enregistrement..." : "Ajouter"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
