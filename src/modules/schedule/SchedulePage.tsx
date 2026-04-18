import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Navigate } from "react-router-dom"

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
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"
import { getTeachers } from "@/modules/teachers/teachers.api"
import { WeekCoverageAlert } from "@/shared/components"
import {
  AddIcon,
  DeleteIcon,
  EditIcon,
  LayoutGridIcon,
  ListIcon,
  ScheduleIcon,
} from "@/shared/components/icons"
import { useAuthStore, type AuthRole } from "@/shared/store/auth.store"

import WeekGrid from "./components/WeekGrid"
import {
  createScheduleSlot,
  deleteScheduleSlot,
  fetchNextWeekCoverage,
  fetchWeeklySchedule,
  type ScheduleCreatePayload,
  type ScheduleRow,
  type TimeSlotCatalogItem,
  type WeeklyScheduleData,
  updateScheduleSlot,
} from "./schedule.api"

// ─── Constantes ────────────────────────────────────────────────────────────────

const DAYS = [
  { value: 1, label: "Lun" },
  { value: 2, label: "Mar" },
  { value: 3, label: "Mer" },
  { value: 4, label: "Jeu" },
  { value: 5, label: "Ven" },
  { value: 6, label: "Sam" },
] as const

const generateTimeOptions = (): { label: string; value: string }[] => {
  const options: { label: string; value: string }[] = []
  for (let h = 6; h <= 22; h++) {
    for (const m of [0, 30]) {
      if (h === 22 && m === 30) continue
      const hStr = String(h).padStart(2, "0")
      const mStr = String(m).padStart(2, "0")
      options.push({ label: `${hStr}:${mStr}`, value: `${hStr}:${mStr}` })
    }
  }
  return options
}

const TIME_OPTIONS = generateTimeOptions()

// ─── Types ──────────────────────────────────────────────────────────────────────

type ViewMode = "grid" | "list"

type SlotFormState = {
  teacherId: string
  classId: string
  dayOfWeek: string
  startTime: string
  endTime: string
  roomId: string
  subject: string
  schedulePeriodId: string
}

type SlotCreatePrefill = {
  dayOfWeek?: number
  hour?: number
}

const emptyFormState: SlotFormState = {
  teacherId: "",
  classId: "",
  dayOfWeek: "",
  startTime: "08:00",
  endTime: "09:00",
  roomId: "",
  subject: "",
  schedulePeriodId: "",
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

const canManageSchedule = (role: AuthRole | undefined) =>
  role === "director" || role === "secretary"

const toISODate = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

const fromISODate = (value: string): Date => {
  const [year, month, day] = value.split("-").map((part) => Number(part))
  return new Date(year || 1970, (month || 1) - 1, day || 1)
}

const getMonday = (baseDate: Date) => {
  const copy = new Date(baseDate)
  copy.setHours(0, 0, 0, 0)
  const weekday = copy.getDay()
  const shift = weekday === 0 ? -6 : 1 - weekday
  copy.setDate(copy.getDate() + shift)
  return copy
}

const getMondayForWeek = (weekOffset: 0 | 1): string => {
  const today = new Date()
  const monday = getMonday(today)
  monday.setDate(monday.getDate() + weekOffset * 7)
  return toISODate(monday)
}

const sortSchedules = (items: ScheduleRow[]) =>
  [...items].sort((a, b) => {
    if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek
    if (a.timeSlot.sortOrder !== b.timeSlot.sortOrder)
      return a.timeSlot.sortOrder - b.timeSlot.sortOrder
    return a.teacher.name.localeCompare(b.teacher.name)
  })

const toPayload = (formState: SlotFormState): ScheduleCreatePayload => ({
  schedulePeriodId: formState.schedulePeriodId,
  teacherId: formState.teacherId,
  classId: formState.classId,
  dayOfWeek: Number(formState.dayOfWeek),
  timeSlotId: "",
  startTime: formState.startTime,
  endTime: formState.endTime,
  roomId: formState.roomId,
  subject: formState.subject.trim(),
})

const defaultFormStateFromData = (data: WeeklyScheduleData): SlotFormState => ({
  teacherId: "",
  classId: data.catalog.classes[0]?.id ?? "",
  dayOfWeek: "1",
  startTime: "08:00",
  endTime: "09:00",
  roomId: data.catalog.rooms[0]?.id ?? "",
  subject: "",
  schedulePeriodId: data.period?.id ?? "",
})

const createOptimisticSchedule = (
  id: string,
  payload: ScheduleCreatePayload,
  data: WeeklyScheduleData
): ScheduleRow | null => {
  const teacher = data.catalog.teachers.find((item) => item.id === payload.teacherId)
  const klass = data.catalog.classes.find((item) => item.id === payload.classId)
  const room = data.catalog.rooms.find((item) => item.id === payload.roomId)
  if (!teacher || !klass || !room) return null

  // Chercher un time_slot existant dans le catalog (startTime déjà normalisé "HH:MM")
  const existingSlot = data.catalog.timeSlots.find(
    (ts) => ts.startTime === payload.startTime && ts.endTime === payload.endTime
  )

  const timeSlot = existingSlot ?? {
    id: `optimistic-ts-${Date.now()}`,
    label: `${payload.startTime ?? "?"} – ${payload.endTime ?? "?"}`,
    startTime: payload.startTime ?? "00:00",
    endTime: payload.endTime ?? "00:00",
    sortOrder: 0,
  }

  return {
    id,
    schedulePeriodId: payload.schedulePeriodId,
    dayOfWeek: payload.dayOfWeek,
    subject: payload.subject,
    teacher,
    class: klass,
    room,
    timeSlot,
  }
}

const getInitialViewMode = (): ViewMode => {
  if (typeof window === "undefined") return "list"
  const stored = window.localStorage.getItem("schedule-view-mode")
  if (stored === "grid" || stored === "list") return stored
  return window.matchMedia("(min-width: 768px)").matches ? "grid" : "list"
}

/**
 * Construit les lignes de la vue liste en fusionnant le catalog de time_slots
 * avec les time_slots réellement utilisés par les créneaux.
 *
 * Problème résolu : `findOrCreateTimeSlot` crée de nouveaux time_slots en base
 * pour les horaires libres. Ces nouveaux time_slots apparaissent dans
 * `catalog.timeSlots` MAIS avec des `startTime` différents des time_slots
 * préexistants (ex: "08:00" vs "07:30"). La vue liste affichait alors des
 * lignes séparées pour chaque time_slot, même ceux sans aucun créneau.
 *
 * Solution : on construit les lignes en union de :
 * 1. Tous les time_slots du catalog (triés par sortOrder/startTime)
 * 2. Les time_slots des créneaux qui ne sont pas encore dans le catalog
 *    (cas optimistic update avec id synthétique)
 *
 * On déduplique par `startTime` pour éviter les doublons entre time_slots
 * préexistants et ceux créés à la volée avec les mêmes horaires.
 */
const buildListRows = (
  catalogTimeSlots: TimeSlotCatalogItem[],
  schedules: ScheduleRow[]
): TimeSlotCatalogItem[] => {
  // Index des time_slots du catalog par startTime (déjà normalisé "HH:MM")
  const byStartTime = new Map<string, TimeSlotCatalogItem>()
  for (const ts of catalogTimeSlots) {
    byStartTime.set(ts.startTime, ts)
  }

  // Ajouter les time_slots des créneaux manquants dans le catalog
  for (const schedule of schedules) {
    const key = schedule.timeSlot.startTime
    if (!byStartTime.has(key)) {
      byStartTime.set(key, schedule.timeSlot)
    }
  }

  // Trier : d'abord par sortOrder, puis par startTime lexicographique ("HH:MM")
  return [...byStartTime.values()].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
    return a.startTime.localeCompare(b.startTime)
  })
}

// ─── Composant ──────────────────────────────────────────────────────────────────

export default function SchedulePage() {
  const user = useAuthStore((state) => state.user)
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [teacherFilter, setTeacherFilter] = useState("all")
  const [classFilter, setClassFilter] = useState("all")
  const [mobileDay, setMobileDay] = useState("1")
  const [weekView, setWeekView] = useState<"current" | "next">("current")
  const [viewMode, setViewMode] = useState<ViewMode>(() => getInitialViewMode())

  const currentWeekMonday = useMemo(() => getMondayForWeek(0), [])
  const nextWeekMonday = useMemo(() => getMondayForWeek(1), [])
  const [selectedWeekMonday, setSelectedWeekMonday] = useState(currentWeekMonday)

  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleRow | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<ScheduleRow | null>(null)
  const [formState, setFormState] = useState<SlotFormState>(emptyFormState)

  // ── Queries ─────────────────────────────────────────────────────────────────

  const weeklyQueryKey = useMemo(
    () => ["schedule-weekly", selectedWeekMonday] as const,
    [selectedWeekMonday]
  )

  useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem("schedule-view-mode", viewMode)
  }, [viewMode])

  const scheduleQuery = useQuery({
    queryKey: weeklyQueryKey,
    queryFn: () => fetchWeeklySchedule(selectedWeekMonday),
    placeholderData: undefined,
  })

  const nextWeekCoverageQuery = useQuery({
    queryKey: ["schedule", "next-week-coverage", nextWeekMonday],
    queryFn: () => fetchNextWeekCoverage(nextWeekMonday),
  })

  const teachersQuery = useQuery({
    queryKey: ["teachers", "schedule-page", "blocked-state"],
    queryFn: () => getTeachers({ page: 1, limit: 200 }),
  })

  const data = scheduleQuery.data
  const canManage = canManageSchedule(user?.role)

  const blockedTeachers = useMemo(
    () =>
      new Set(
        (teachersQuery.data?.data ?? []).filter((t) => t.isBlocked).map((t) => t.id)
      ),
    [teachersQuery.data?.data]
  )

  // ── Matières du prof sélectionné ────────────────────────────────────────────
  const selectedTeacherSubjects = useMemo<string[]>(() => {
    if (!formState.teacherId || !data) return []
    const teacher = data.catalog.teachers.find((t) => t.id === formState.teacherId)
    return teacher?.subjects ?? []
  }, [formState.teacherId, data])

  useEffect(() => {
    if (!formState.subject) return
    if (
      selectedTeacherSubjects.length > 0 &&
      !selectedTeacherSubjects.includes(formState.subject)
    ) {
      setFormState((prev) => ({ ...prev, subject: "" }))
    }
  }, [formState.subject, selectedTeacherSubjects])

  // ── Créneaux filtrés ────────────────────────────────────────────────────────
  const filteredSchedules = useMemo(() => {
    if (!data?.period) return []
    return sortSchedules(
      data.schedules.filter((item) => {
        const teacherOk = teacherFilter === "all" || item.teacher.id === teacherFilter
        const classOk = classFilter === "all" || item.class.id === classFilter
        return teacherOk && classOk
      })
    )
  }, [classFilter, data, teacherFilter])

  /**
   * Lignes de la vue liste : union catalog + time_slots des créneaux,
   * dédupliqués par startTime normalisé.
   */
  const listRows = useMemo(
    () => buildListRows(data?.catalog.timeSlots ?? [], filteredSchedules),
    [data?.catalog.timeSlots, filteredSchedules]
  )

  /**
   * Index des créneaux par `${dayOfWeek}-${startTime}`.
   * Les deux valeurs sont normalisées en "HH:MM" → clé toujours cohérente.
   */
  const scheduleByDayAndTime = useMemo(() => {
    const map = new Map<string, ScheduleRow[]>()
    for (const item of filteredSchedules) {
      const key = `${item.dayOfWeek}-${item.timeSlot.startTime}`
      const list = map.get(key) ?? []
      list.push(item)
      map.set(key, list)
    }
    return map
  }, [filteredSchedules])

  // ── Helpers formulaire ──────────────────────────────────────────────────────

  const setWeekFromIso = (weekIso: string) => {
    setSelectedWeekMonday(weekIso)
    if (weekIso === currentWeekMonday) { setWeekView("current"); return }
    if (weekIso === nextWeekMonday) setWeekView("next")
  }

  const openCreateModal = (prefill?: SlotCreatePrefill) => {
    if (!data) return
    setEditingSchedule(null)
    setDetailOpen(false)
    const startHour = prefill?.hour ?? 8
    const startTime = `${String(startHour).padStart(2, "0")}:00`
    const endTime = `${String(Math.min(startHour + 1, 22)).padStart(2, "0")}:00`
    setFormState({
      ...defaultFormStateFromData(data),
      dayOfWeek: prefill?.dayOfWeek ? String(prefill.dayOfWeek) : "1",
      startTime,
      endTime,
    })
    setFormOpen(true)
  }

  const openEditModal = (schedule: ScheduleRow) => {
    setEditingSchedule(schedule)
    setDetailOpen(false)
    setFormState({
      teacherId: schedule.teacher.id,
      classId: schedule.class.id,
      dayOfWeek: String(schedule.dayOfWeek),
      startTime: schedule.timeSlot.startTime,
      endTime: schedule.timeSlot.endTime,
      roomId: schedule.room.id,
      subject: schedule.subject,
      schedulePeriodId: schedule.schedulePeriodId,
    })
    setFormOpen(true)
  }

  // ── Mutations ───────────────────────────────────────────────────────────────

  const upsertMutation = useMutation({
    mutationFn: async (values: { id?: string; payload: ScheduleCreatePayload }) => {
      if (values.id) return updateScheduleSlot(values.id, values.payload)
      return createScheduleSlot(values.payload)
    },
    onMutate: async (values) => {
      await queryClient.cancelQueries({ queryKey: weeklyQueryKey })
      const previous = queryClient.getQueryData<WeeklyScheduleData>(weeklyQueryKey)
      if (!previous) return { previous }

      const optimisticId = values.id ?? `optimistic-${Date.now()}`
      const optimisticSchedule = createOptimisticSchedule(optimisticId, values.payload, previous)
      if (!optimisticSchedule) return { previous }

      const nextSchedules = values.id
        ? previous.schedules.map((item) =>
            item.id === values.id ? optimisticSchedule : item
          )
        : [optimisticSchedule, ...previous.schedules]

      queryClient.setQueryData<WeeklyScheduleData>(weeklyQueryKey, {
        ...previous,
        schedules: nextSchedules,
      })
      return { previous }
    },
    onError: (_error, _values, context) => {
      if (context?.previous) queryClient.setQueryData(weeklyQueryKey, context.previous)
      toast({
        variant: "destructive",
        title: "Action impossible",
        description: "Impossible d'enregistrer ce créneau.",
      })
    },
    onSuccess: () => {
      toast({ title: editingSchedule ? "Créneau modifié" : "Créneau ajouté" })
      setFormOpen(false)
      setEditingSchedule(null)
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: weeklyQueryKey })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteScheduleSlot(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: weeklyQueryKey })
      const previous = queryClient.getQueryData<WeeklyScheduleData>(weeklyQueryKey)
      if (previous) {
        queryClient.setQueryData<WeeklyScheduleData>(weeklyQueryKey, {
          ...previous,
          schedules: previous.schedules.filter((item) => item.id !== id),
        })
      }
      return { previous }
    },
    onError: (_error, _id, context) => {
      if (context?.previous) queryClient.setQueryData(weeklyQueryKey, context.previous)
      toast({ variant: "destructive", title: "Suppression impossible" })
    },
    onSuccess: () => {
      toast({ title: "Créneau supprimé" })
      setDetailOpen(false)
      setSelectedSchedule(null)
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: weeklyQueryKey })
    },
  })

  const handleSubmit = async () => {
    if (!formState.schedulePeriodId) {
      toast({ variant: "destructive", title: "Aucune période", description: "Sélectionnez une période d'emploi du temps." })
      return
    }
    if (formState.startTime >= formState.endTime) {
      toast({ variant: "destructive", title: "Horaire invalide", description: "L'heure de fin doit être après l'heure de début." })
      return
    }
    const payload = toPayload(formState)
    if (!payload.teacherId || !payload.classId || !payload.roomId || !payload.subject) {
      toast({ variant: "destructive", title: "Formulaire incomplet", description: "Renseignez tous les champs requis." })
      return
    }
    await upsertMutation.mutateAsync({ id: editingSchedule?.id, payload })
  }

  if (!user) return <Navigate to="/" replace />

  const weekStartDate = fromISODate(selectedWeekMonday)

  // ── Rendu ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 px-4 py-6 md:px-6 md:py-8">
      <header className="space-y-4">
        <WeekCoverageAlert
          nextWeekHasCoverage={nextWeekCoverageQuery.data ?? true}
          onNavigateToSchedule={() => { setWeekView("next"); setWeekFromIso(nextWeekMonday) }}
        />
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Emploi du temps</h1>
          <p className="text-sm text-muted-foreground">Vue hebdomadaire et gestion des créneaux de cours.</p>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Tabs
              value={weekView}
              onValueChange={(value) => {
                const next = value as "current" | "next"
                setWeekView(next)
                setWeekFromIso(next === "current" ? currentWeekMonday : nextWeekMonday)
              }}
            >
              <TabsList className="grid grid-cols-2">
                <TabsTrigger value="current">Semaine courante</TabsTrigger>
                <TabsTrigger value="next">Semaine prochaine</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="inline-flex items-center rounded-lg border bg-muted/40 p-1">
              <button type="button" onClick={() => setViewMode("grid")}
                className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition ${viewMode === "grid" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}>
                <LayoutGridIcon className="h-4 w-4" />Grille
              </button>
              <button type="button" onClick={() => setViewMode("list")}
                className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition ${viewMode === "list" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}>
                <ListIcon className="h-4 w-4" />Liste
              </button>
            </div>

            <Select value={teacherFilter} onValueChange={setTeacherFilter} disabled={!data}>
              <SelectTrigger className="w-full md:w-[220px]">
                <SelectValue placeholder="Filtrer par professeur" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les professeurs</SelectItem>
                {(data?.catalog.teachers ?? []).map((teacher) => (
                  <SelectItem key={teacher.id} value={teacher.id}>{teacher.name}</SelectItem>
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
                  <SelectItem key={klass.id} value={klass.id}>{klass.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {canManage ? (
            <Button onClick={() => openCreateModal()} disabled={!data?.period}>
              <AddIcon className="mr-2 h-4 w-4" />Ajouter un créneau
            </Button>
          ) : (
            <Badge variant="outline">Lecture seule</Badge>
          )}
        </div>
      </header>

      {scheduleQuery.isLoading ? <p className="text-sm text-muted-foreground">Chargement…</p> : null}
      {scheduleQuery.isError ? (
        <Alert variant="destructive"><AlertDescription>Impossible de charger l'emploi du temps.</AlertDescription></Alert>
      ) : null}
      {!scheduleQuery.isLoading && data && !data.period && viewMode === "list" ? (
        <Alert><AlertDescription>Aucune période active pour cette semaine.</AlertDescription></Alert>
      ) : null}

      {!scheduleQuery.isLoading && data && viewMode === "grid" ? (
        <WeekGrid
          slots={filteredSchedules}
          weekStart={weekStartDate}
          hasPeriod={!!data.period}
          isLoading={scheduleQuery.isFetching}
          onSlotClick={(slot) => { setSelectedSchedule(slot); setDetailOpen(true) }}
          onSlotAdd={(day, hour) => { if (!canManage) return; openCreateModal({ dayOfWeek: day, hour }) }}
          onWeekChange={(next) => setWeekFromIso(toISODate(next))}
          onToday={() => setWeekFromIso(currentWeekMonday)}
          isBlockedTeacher={(teacherId) => blockedTeachers.has(teacherId)}
        />
      ) : null}

      {!scheduleQuery.isLoading && data && viewMode === "list" ? (
        <>
          <Card className="hidden md:block">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ScheduleIcon className="h-5 w-5" />Vue liste
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
                        <th key={day.value} className="border p-2 text-left font-medium">{day.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {/*
                      On itère sur `listRows` (union catalog + time_slots des créneaux)
                      plutôt que sur `data.catalog.timeSlots` seul.
                      Chaque ligne est identifiée par son `startTime` normalisé "HH:MM".
                    */}
                    {listRows.map((slot) => (
                      <tr key={`${slot.id}-${slot.startTime}`}>
                        <td className="align-top border p-2 font-medium text-muted-foreground">
                          {slot.label}
                        </td>
                        {DAYS.map((day) => {
                          const cellItems =
                            scheduleByDayAndTime.get(`${day.value}-${slot.startTime}`) ?? []
                          return (
                            <td
                              key={`${day.value}-${slot.startTime}`}
                              className="h-[92px] align-top border p-2"
                            >
                              <div className="space-y-1">
                                {cellItems.map((item) => (
                                  <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => { setSelectedSchedule(item); setDetailOpen(true) }}
                                    className="w-full rounded-md border bg-muted/30 p-2 text-left transition hover:opacity-90"
                                  >
                                    <p className="text-xs font-semibold">{item.teacher.name}</p>
                                    <p className="text-xs">{item.class.name}</p>
                                    <p className="text-xs">{item.subject}</p>
                                    {blockedTeachers.has(item.teacher.id) ? (
                                      <Badge variant="destructive" className="mt-1">Prof bloqué</Badge>
                                    ) : null}
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
              <CardDescription>Liste par jour</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Tabs value={mobileDay} onValueChange={setMobileDay}>
                <TabsList className="grid w-full grid-cols-6">
                  {DAYS.map((day) => (
                    <TabsTrigger key={day.value} value={String(day.value)}>{day.label}</TabsTrigger>
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
                      onClick={() => { setSelectedSchedule(item); setDetailOpen(true) }}
                      className="w-full rounded-lg border bg-muted/30 p-3 text-left"
                    >
                      <p className="text-xs font-semibold">{item.timeSlot.label}</p>
                      <p className="text-sm font-medium">{item.subject}</p>
                      <p className="text-xs">{item.teacher.name} · {item.class.name}</p>
                      {blockedTeachers.has(item.teacher.id) ? (
                        <Badge variant="destructive" className="mt-1">Prof bloqué</Badge>
                      ) : null}
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

      {/* ── Dialog détail ────────────────────────────────────────────────────── */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Détail du créneau</DialogTitle>
            <DialogDescription>
              {selectedSchedule
                ? `${selectedSchedule.timeSlot.label} · ${DAYS[selectedSchedule.dayOfWeek - 1]?.label}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          {selectedSchedule ? (
            <div className="space-y-2 text-sm">
              <p><span className="font-medium">Matière :</span> {selectedSchedule.subject}</p>
              <p><span className="font-medium">Professeur :</span> {selectedSchedule.teacher.name}</p>
              <p><span className="font-medium">Classe :</span> {selectedSchedule.class.name}</p>
              <p><span className="font-medium">Salle :</span> {selectedSchedule.room.name}</p>
              <p><span className="font-medium">Horaire :</span> {selectedSchedule.timeSlot.startTime} → {selectedSchedule.timeSlot.endTime}</p>
            </div>
          ) : null}
          {canManage && selectedSchedule ? (
            <DialogFooter className="gap-2 sm:justify-between">
              <Button variant="destructive"
                onClick={() => void deleteMutation.mutateAsync(selectedSchedule.id)}
                disabled={deleteMutation.isPending}>
                <DeleteIcon className="mr-2 h-4 w-4" />Supprimer
              </Button>
              <Button variant="outline" onClick={() => openEditModal(selectedSchedule)}>
                <EditIcon className="mr-2 h-4 w-4" />Modifier
              </Button>
            </DialogFooter>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* ── Dialog formulaire ────────────────────────────────────────────────── */}
      <Dialog
        open={formOpen}
        onOpenChange={(open) => { setFormOpen(open); if (!open) setEditingSchedule(null) }}
      >
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{editingSchedule ? "Modifier un créneau" : "Ajouter un créneau"}</DialogTitle>
            <DialogDescription>Choisissez le professeur, la classe, le jour et les horaires.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {/* Période */}
            <div className="space-y-1">
              <Label>Période</Label>
              <Select value={formState.schedulePeriodId}
                onValueChange={(v) => setFormState((p) => ({ ...p, schedulePeriodId: v }))}>
                <SelectTrigger><SelectValue placeholder="Choisir une période" /></SelectTrigger>
                <SelectContent>
                  {data?.period ? (
                    <SelectItem value={data.period.id}>
                      {data.period.name}
                    </SelectItem>
                  ) : (
                    <SelectItem value="__none__" disabled>Aucune période active</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Professeur */}
            <div className="space-y-1">
              <Label>Professeur</Label>
              <Select
                value={formState.teacherId}
                onValueChange={(v) => setFormState((p) => ({ ...p, teacherId: v, subject: "" }))}
              >
                <SelectTrigger><SelectValue placeholder="Choisir un professeur" /></SelectTrigger>
                <SelectContent>
                  {(data?.catalog.teachers ?? []).map((teacher) => (
                    <SelectItem key={teacher.id} value={teacher.id}>{teacher.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Matière — 3 états */}
            <div className="space-y-1">
              <Label>Matière</Label>
              {!formState.teacherId ? (
                <Select disabled>
                  <SelectTrigger><SelectValue placeholder="Sélectionnez d'abord un professeur" /></SelectTrigger>
                  <SelectContent />
                </Select>
              ) : selectedTeacherSubjects.length > 0 ? (
                <Select value={formState.subject}
                  onValueChange={(v) => setFormState((p) => ({ ...p, subject: v }))}>
                  <SelectTrigger><SelectValue placeholder="Choisir une matière" /></SelectTrigger>
                  <SelectContent>
                    {selectedTeacherSubjects.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="space-y-1">
                  <Input
                    value={formState.subject}
                    onChange={(e) => setFormState((p) => ({ ...p, subject: e.target.value }))}
                    placeholder="Ex: Mathématiques"
                  />
                  <p className="text-[11px] text-amber-600">
                    Ce professeur n'a pas de matières configurées dans son profil.
                  </p>
                </div>
              )}
            </div>

            {/* Classe */}
            <div className="space-y-1">
              <Label>Classe</Label>
              <Select value={formState.classId}
                onValueChange={(v) => setFormState((p) => ({ ...p, classId: v }))}>
                <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                <SelectContent>
                  {(data?.catalog.classes ?? []).map((klass) => (
                    <SelectItem key={klass.id} value={klass.id}>{klass.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Jour + Horaires */}
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label>Jour</Label>
                <Select value={formState.dayOfWeek}
                  onValueChange={(v) => setFormState((p) => ({ ...p, dayOfWeek: v }))}>
                  <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                  <SelectContent>
                    {DAYS.map((day) => (
                      <SelectItem key={day.value} value={String(day.value)}>{day.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Début</Label>
                <Select value={formState.startTime}
                  onValueChange={(v) => setFormState((p) => ({ ...p, startTime: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIME_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Fin</Label>
                <Select value={formState.endTime}
                  onValueChange={(v) => setFormState((p) => ({ ...p, endTime: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIME_OPTIONS.filter((opt) => opt.value > formState.startTime).map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Salle */}
            <div className="space-y-1">
              <Label>Salle</Label>
              <Select value={formState.roomId}
                onValueChange={(v) => setFormState((p) => ({ ...p, roomId: v }))}>
                <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                <SelectContent>
                  {(data?.catalog.rooms ?? []).map((room) => (
                    <SelectItem key={room.id} value={room.id}>{room.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Annuler</Button>
            <Button onClick={() => void handleSubmit()}
              disabled={upsertMutation.isPending || !formState.schedulePeriodId}>
              {upsertMutation.isPending ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
