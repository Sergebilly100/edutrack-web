import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Navigate } from "react-router-dom"
import { CalendarDays, Pencil, Plus, Trash2 } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"
import { useAuthStore, type AuthRole } from "@/shared/store/auth.store"
import {
  createScheduleSlot,
  deleteScheduleSlot,
  fetchWeeklySchedule,
  type ScheduleCreatePayload,
  type ScheduleRow,
  type WeeklyScheduleData,
  updateScheduleSlot
} from "./schedule.api"

const DAYS = [
  { value: 1, label: "Lun" },
  { value: 2, label: "Mar" },
  { value: 3, label: "Mer" },
  { value: 4, label: "Jeu" },
  { value: 5, label: "Ven" },
  { value: 6, label: "Sam" }
] as const

const TEACHER_COLOR_CLASSES = [
  "border-blue-200 bg-blue-50 text-blue-900",
  "border-emerald-200 bg-emerald-50 text-emerald-900",
  "border-amber-200 bg-amber-50 text-amber-900",
  "border-rose-200 bg-rose-50 text-rose-900",
  "border-cyan-200 bg-cyan-50 text-cyan-900",
  "border-lime-200 bg-lime-50 text-lime-900",
  "border-indigo-200 bg-indigo-50 text-indigo-900",
  "border-orange-200 bg-orange-50 text-orange-900"
] as const

type SlotFormState = {
  teacherId: string
  classId: string
  dayOfWeek: string
  timeSlotId: string
  roomId: string
  subject: string
}

const emptyFormState: SlotFormState = {
  teacherId: "",
  classId: "",
  dayOfWeek: "",
  timeSlotId: "",
  roomId: "",
  subject: ""
}

const canManageSchedule = (role: AuthRole | undefined) => role === "director" || role === "secretary"

const sortSchedules = (items: ScheduleRow[]) =>
  [...items].sort((a, b) => {
    if (a.dayOfWeek !== b.dayOfWeek) {
      return a.dayOfWeek - b.dayOfWeek
    }

    if (a.timeSlot.sortOrder !== b.timeSlot.sortOrder) {
      return a.timeSlot.sortOrder - b.timeSlot.sortOrder
    }

    return a.teacher.name.localeCompare(b.teacher.name)
  })

const toPayload = (formState: SlotFormState, periodId: string): ScheduleCreatePayload => ({
  schedulePeriodId: periodId,
  teacherId: formState.teacherId,
  classId: formState.classId,
  dayOfWeek: Number(formState.dayOfWeek),
  timeSlotId: formState.timeSlotId,
  roomId: formState.roomId,
  subject: formState.subject.trim()
})

const defaultFormStateFromData = (data: WeeklyScheduleData): SlotFormState => ({
  teacherId: data.catalog.teachers[0]?.id ?? "",
  classId: data.catalog.classes[0]?.id ?? "",
  dayOfWeek: "1",
  timeSlotId: data.catalog.timeSlots[0]?.id ?? "",
  roomId: data.catalog.rooms[0]?.id ?? "",
  subject: ""
})

const createOptimisticSchedule = (
  id: string,
  payload: ScheduleCreatePayload,
  data: WeeklyScheduleData
): ScheduleRow | null => {
  const teacher = data.catalog.teachers.find((item) => item.id === payload.teacherId)
  const klass = data.catalog.classes.find((item) => item.id === payload.classId)
  const room = data.catalog.rooms.find((item) => item.id === payload.roomId)
  const timeSlot = data.catalog.timeSlots.find((item) => item.id === payload.timeSlotId)

  if (!teacher || !klass || !room || !timeSlot) {
    return null
  }

  return {
    id,
    schedulePeriodId: payload.schedulePeriodId,
    dayOfWeek: payload.dayOfWeek,
    subject: payload.subject,
    teacher,
    class: klass,
    room,
    timeSlot
  }
}

export default function SchedulePage() {
  const user = useAuthStore((state) => state.user)
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [teacherFilter, setTeacherFilter] = useState("all")
  const [classFilter, setClassFilter] = useState("all")
  const [mobileDay, setMobileDay] = useState("1")

  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleRow | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const [formOpen, setFormOpen] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<ScheduleRow | null>(null)
  const [formState, setFormState] = useState<SlotFormState>(emptyFormState)

  const scheduleQuery = useQuery({
    queryKey: ["schedule-weekly"],
    queryFn: fetchWeeklySchedule
  })

  const data = scheduleQuery.data
  const canManage = canManageSchedule(user?.role)

  const teacherColorById = useMemo(() => {
    if (!data) {
      return new Map<string, string>()
    }

    return new Map(
      data.catalog.teachers.map((teacher, index) => [
        teacher.id,
        TEACHER_COLOR_CLASSES[index % TEACHER_COLOR_CLASSES.length]
      ])
    )
  }, [data])

  const filteredSchedules = useMemo(() => {
    if (!data) {
      return []
    }

    return sortSchedules(
      data.schedules.filter((item) => {
        const teacherOk = teacherFilter === "all" || item.teacher.id === teacherFilter
        const classOk = classFilter === "all" || item.class.id === classFilter
        return teacherOk && classOk
      })
    )
  }, [classFilter, data, teacherFilter])

  const scheduleByCell = useMemo(() => {
    const map = new Map<string, ScheduleRow[]>()

    for (const item of filteredSchedules) {
      const key = `${item.dayOfWeek}-${item.timeSlot.id}`
      const list = map.get(key) ?? []
      list.push(item)
      map.set(key, list)
    }

    return map
  }, [filteredSchedules])

  const resetFormState = (fromData?: WeeklyScheduleData) => {
    if (!fromData) {
      setFormState(emptyFormState)
      return
    }

    setFormState(defaultFormStateFromData(fromData))
  }

  const openCreateModal = () => {
    if (!data) {
      return
    }

    setEditingSchedule(null)
    setDetailOpen(false)
    resetFormState(data)
    setFormOpen(true)
  }

  const openEditModal = (schedule: ScheduleRow) => {
    setEditingSchedule(schedule)
    setDetailOpen(false)
    setFormState({
      teacherId: schedule.teacher.id,
      classId: schedule.class.id,
      dayOfWeek: String(schedule.dayOfWeek),
      timeSlotId: schedule.timeSlot.id,
      roomId: schedule.room.id,
      subject: schedule.subject
    })
    setFormOpen(true)
  }

  const upsertMutation = useMutation({
    mutationFn: async (values: { id?: string; payload: ScheduleCreatePayload }) => {
      if (values.id) {
        return updateScheduleSlot(values.id, values.payload)
      }

      return createScheduleSlot(values.payload)
    },
    onMutate: async (values) => {
      await queryClient.cancelQueries({ queryKey: ["schedule-weekly"] })
      const previous = queryClient.getQueryData<WeeklyScheduleData>(["schedule-weekly"])

      if (!previous) {
        return { previous }
      }

      const optimisticId = values.id ?? `optimistic-${Date.now()}`
      const optimisticSchedule = createOptimisticSchedule(optimisticId, values.payload, previous)

      if (!optimisticSchedule) {
        return { previous }
      }

      const nextSchedules = values.id
        ? previous.schedules.map((item) => (item.id === values.id ? optimisticSchedule : item))
        : [optimisticSchedule, ...previous.schedules]

      queryClient.setQueryData<WeeklyScheduleData>(["schedule-weekly"], {
        ...previous,
        schedules: nextSchedules
      })

      return { previous }
    },
    onError: (_error, _values, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["schedule-weekly"], context.previous)
      }

      toast({
        variant: "destructive",
        title: "Action impossible",
        description: "Impossible d'enregistrer ce créneau."
      })
    },
    onSuccess: () => {
      toast({
        title: editingSchedule ? "Créneau modifié" : "Créneau ajouté"
      })
      setFormOpen(false)
      setEditingSchedule(null)
      if (data) {
        resetFormState(data)
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["schedule-weekly"] })
    }
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteScheduleSlot(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["schedule-weekly"] })
      const previous = queryClient.getQueryData<WeeklyScheduleData>(["schedule-weekly"])

      if (previous) {
        queryClient.setQueryData<WeeklyScheduleData>(["schedule-weekly"], {
          ...previous,
          schedules: previous.schedules.filter((item) => item.id !== id)
        })
      }

      return { previous }
    },
    onError: (_error, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["schedule-weekly"], context.previous)
      }

      toast({
        variant: "destructive",
        title: "Suppression impossible"
      })
    },
    onSuccess: () => {
      toast({ title: "Créneau supprimé" })
      setDetailOpen(false)
      setSelectedSchedule(null)
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["schedule-weekly"] })
    }
  })

  const handleSubmit = async () => {
    if (!data?.period) {
      return
    }

    const payload = toPayload(formState, data.period.id)

    if (!payload.teacherId || !payload.classId || !payload.timeSlotId || !payload.roomId || !payload.subject) {
      toast({
        variant: "destructive",
        title: "Formulaire incomplet",
        description: "Renseignez tous les champs requis."
      })
      return
    }

    await upsertMutation.mutateAsync({
      id: editingSchedule?.id,
      payload
    })
  }

  if (!user) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="space-y-6 px-4 py-6 md:px-6 md:py-8">
      <header className="space-y-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Emploi du temps</h1>
          <p className="text-sm text-muted-foreground">
            Vue hebdomadaire et gestion des créneaux de cours.
          </p>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="grid gap-2 sm:grid-cols-2 md:w-auto">
            <Select value={teacherFilter} onValueChange={setTeacherFilter} disabled={!data}>
              <SelectTrigger className="w-full md:w-[220px]">
                <SelectValue placeholder="Filtrer par professeur" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les professeurs</SelectItem>
                {(data?.catalog.teachers ?? []).map((teacher) => (
                  <SelectItem key={teacher.id} value={teacher.id}>
                    {teacher.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={classFilter} onValueChange={setClassFilter} disabled={!data}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="Filtrer par classe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les classes</SelectItem>
                {(data?.catalog.classes ?? []).map((klass) => (
                  <SelectItem key={klass.id} value={klass.id}>
                    {klass.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {canManage ? (
            <Button onClick={openCreateModal} disabled={!data?.period}>
              <Plus className="mr-2 h-4 w-4" />
              Ajouter un créneau
            </Button>
          ) : (
            <Badge variant="outline">Lecture seule</Badge>
          )}
        </div>
      </header>

      {scheduleQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement de l'emploi du temps...</p>
      ) : null}

      {scheduleQuery.isError ? (
        <Alert variant="destructive">
          <AlertDescription>Impossible de charger l'emploi du temps.</AlertDescription>
        </Alert>
      ) : null}

      {!scheduleQuery.isLoading && data && !data.period ? (
        <Alert>
          <AlertDescription>
            Aucune période d'emploi du temps active. Activez une période pour créer des créneaux.
          </AlertDescription>
        </Alert>
      ) : null}

      {!scheduleQuery.isLoading && data ? (
        <>
          <Card className="hidden md:block">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5" />
                Vue hebdomadaire
              </CardTitle>
              <CardDescription>
                {data.period
                  ? `${data.period.name} · ${data.period.validFrom} → ${data.period.validTo}`
                  : "Sans période active"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      <th className="w-[140px] border p-2 text-left font-medium">Créneau</th>
                      {DAYS.map((day) => (
                        <th key={day.value} className="border p-2 text-left font-medium">
                          {day.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.catalog.timeSlots.map((slot) => (
                      <tr key={slot.id}>
                        <td className="align-top border p-2 font-medium text-muted-foreground">
                          {slot.label}
                        </td>
                        {DAYS.map((day) => {
                          const cellItems = scheduleByCell.get(`${day.value}-${slot.id}`) ?? []

                          return (
                            <td key={`${day.value}-${slot.id}`} className="h-[92px] align-top border p-2">
                              <div className="space-y-1">
                                {cellItems.map((item) => (
                                  <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => {
                                      setSelectedSchedule(item)
                                      setDetailOpen(true)
                                    }}
                                    className={`w-full rounded-md border p-2 text-left transition hover:opacity-90 ${teacherColorById.get(item.teacher.id) ?? "border-muted bg-muted/40"}`}
                                  >
                                    <p className="text-xs font-semibold">{item.teacher.name}</p>
                                    <p className="text-xs">{item.class.name}</p>
                                    <p className="text-xs">{item.subject}</p>
                                  </button>
                                ))}
                              </div>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card className="md:hidden">
            <CardHeader>
              <CardTitle>Vue mobile</CardTitle>
              <CardDescription>375px et plus: liste par jour</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Tabs value={mobileDay} onValueChange={setMobileDay}>
                <TabsList className="grid w-full grid-cols-6">
                  {DAYS.map((day) => (
                    <TabsTrigger key={day.value} value={String(day.value)}>
                      {day.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>

              <div className="space-y-2">
                {filteredSchedules
                  .filter((item) => String(item.dayOfWeek) === mobileDay)
                  .map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setSelectedSchedule(item)
                        setDetailOpen(true)
                      }}
                      className={`w-full rounded-lg border p-3 text-left ${teacherColorById.get(item.teacher.id) ?? "border-muted bg-muted/40"}`}
                    >
                      <p className="text-xs font-semibold">{item.timeSlot.label}</p>
                      <p className="text-sm font-medium">{item.subject}</p>
                      <p className="text-xs">{item.teacher.name} · {item.class.name}</p>
                    </button>
                  ))}

                {filteredSchedules.filter((item) => String(item.dayOfWeek) === mobileDay).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucun créneau pour ce jour.</p>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Détail du créneau</DialogTitle>
            <DialogDescription>
              {selectedSchedule ? `${selectedSchedule.timeSlot.label} · ${DAYS[selectedSchedule.dayOfWeek - 1]?.label}` : ""}
            </DialogDescription>
          </DialogHeader>

          {selectedSchedule ? (
            <div className="space-y-2 text-sm">
              <p><span className="font-medium">Matière:</span> {selectedSchedule.subject}</p>
              <p><span className="font-medium">Professeur:</span> {selectedSchedule.teacher.name}</p>
              <p><span className="font-medium">Classe:</span> {selectedSchedule.class.name}</p>
              <p><span className="font-medium">Salle:</span> {selectedSchedule.room.name}</p>
            </div>
          ) : null}

          {canManage && selectedSchedule ? (
            <DialogFooter className="gap-2 sm:justify-between">
              <Button
                variant="destructive"
                onClick={() => void deleteMutation.mutateAsync(selectedSchedule.id)}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Supprimer
              </Button>
              <Button variant="outline" onClick={() => openEditModal(selectedSchedule)}>
                <Pencil className="mr-2 h-4 w-4" />
                Modifier
              </Button>
            </DialogFooter>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open)
          if (!open) {
            setEditingSchedule(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSchedule ? "Modifier un créneau" : "Ajouter un créneau"}</DialogTitle>
            <DialogDescription>
              Choisissez le professeur, la classe, le jour et le créneau.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Professeur</Label>
              <Select
                value={formState.teacherId}
                onValueChange={(value) => setFormState((prev) => ({ ...prev, teacherId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choisir" />
                </SelectTrigger>
                <SelectContent>
                  {(data?.catalog.teachers ?? []).map((teacher) => (
                    <SelectItem key={teacher.id} value={teacher.id}>
                      {teacher.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Classe</Label>
              <Select
                value={formState.classId}
                onValueChange={(value) => setFormState((prev) => ({ ...prev, classId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choisir" />
                </SelectTrigger>
                <SelectContent>
                  {(data?.catalog.classes ?? []).map((klass) => (
                    <SelectItem key={klass.id} value={klass.id}>
                      {klass.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Jour</Label>
                <Select
                  value={formState.dayOfWeek}
                  onValueChange={(value) => setFormState((prev) => ({ ...prev, dayOfWeek: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir" />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS.map((day) => (
                      <SelectItem key={day.value} value={String(day.value)}>
                        {day.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Créneau</Label>
                <Select
                  value={formState.timeSlotId}
                  onValueChange={(value) => setFormState((prev) => ({ ...prev, timeSlotId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir" />
                  </SelectTrigger>
                  <SelectContent>
                    {(data?.catalog.timeSlots ?? []).map((slot) => (
                      <SelectItem key={slot.id} value={slot.id}>
                        {slot.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label>Salle</Label>
              <Select
                value={formState.roomId}
                onValueChange={(value) => setFormState((prev) => ({ ...prev, roomId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choisir" />
                </SelectTrigger>
                <SelectContent>
                  {(data?.catalog.rooms ?? []).map((room) => (
                    <SelectItem key={room.id} value={room.id}>
                      {room.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Matière</Label>
              <Input
                value={formState.subject}
                onChange={(event) => setFormState((prev) => ({ ...prev, subject: event.target.value }))}
                placeholder="Ex: Mathématiques"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Annuler
            </Button>
            <Button onClick={() => void handleSubmit()} disabled={upsertMutation.isPending || !data?.period}>
              {upsertMutation.isPending ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
