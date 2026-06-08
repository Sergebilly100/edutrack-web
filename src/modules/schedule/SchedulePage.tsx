import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Navigate } from "react-router-dom"

import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useToast } from "@/components/ui/use-toast"
import { getTeachers } from "@/modules/teachers/teachers.api"
import { OfflineIndicator, WeekCoverageAlert } from "@/shared/components"
import { EmptyState } from "@/shared/components/EmptyState"
import {
  AddIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DeleteIcon,
  EditIcon,
  InfoIcon,
  LayoutGridIcon,
  ListIcon,
  ScheduleIcon,
} from "@/shared/components/icons"
import { useNetworkStatus } from "@/shared/hooks/useNetworkStatus"
import {
  OfflineMutationQueuedError,
  useOfflineMutation,
} from "@/shared/hooks/useOfflineMutation"
import {
  OFFLINE_QUEUE_KEYS,
  type ScheduleDeleteFromDateOfflinePayload,
  type ScheduleUpdateOfflinePayload,
} from "@/shared/store/offline-processors"
import { useAuthStore } from "@/shared/store/auth.store"
import { TourGuide } from "@/shared/components/TourGuide"
import { useTourGuide } from "@/shared/hooks/useTourGuide"
import { scheduleTourSteps } from "@/shared/lib/tour-steps"
import { usePermissions } from "@/shared/hooks/usePermissions"

import WeekGrid from "./components/WeekGrid"
import {
  createScheduleSlot,
  deleteScheduleSlotFromDate,
  fetchActiveSchedulePeriods,
  fetchNextWeekCoverage,
  fetchWeeklySchedule,
  type ScheduleCreatePayload,
  type ScheduleRow,
  type SchedulePeriodSummary,
  type TimeSlotCatalogItem,
  type WeeklyScheduleData,
  updateScheduleSlot,
} from "./schedule.api"
import {
  DAYS,
  TIME_OPTIONS,
  createOptimisticSchedule,
  defaultFormStateFromData,
  emptyFormState,
  formatWeekRange,
  fromISODate,
  getInitialViewMode,
  getMonday,
  getMondayForWeek,
  getScheduleConflictMessage,
  isPastScheduleSelection,
  isoDayOfWeek,
  occurrenceDateFromWeek,
  weekMondayAndDayFromDate,
  shiftWeekIso,
  sortSchedules,
  timeToMinutes,
  toISODate,
  toPayload,
  type SlotCreatePrefill,
  type SlotFormState,
  type ViewMode,
} from "./schedule.helpers"

// ─── Logique de regroupement vue liste ────────────────────────────────────────

/**
 * Construit les lignes de la vue liste et associe chaque créneau à sa ligne.
 *
 * PROBLÈME RÉSOLU :
 * La vue liste itère sur les time_slots du catalog (ex : 07h30, 09h15, 11h00,
 * 13h00). Les créneaux ajoutés avec horaires libres ont un startTime différent
 * (ex : 08:00, 12:00). Avec une clé par égalité exacte de startTime, ces
 * créneaux ne matchaient aucune ligne et créaient des lignes orphelines en bas.
 *
 * SOLUTION : algorithme d'affectation par plage horaire.
 * Un créneau est affecté à la ligne dont le startTime est le plus proche
 * par en-dessous (≤ startTime du créneau) ET dont le endTime est le plus
 * proche par en-dessus (≥ startTime du créneau).
 *
 * Si aucune ligne du catalog ne contient le créneau, on crée une nouvelle
 * ligne pour lui (tri par startTime → elle apparaît à la bonne position).
 *
 * Retourne :
 * - `rows`   : time_slots ordonnés à afficher comme lignes du tableau
 * - `assign` : Map<rowKey, Map<dayOfWeek, ScheduleRow[]>>
 */
const buildListStructure = (
  catalogSlots: TimeSlotCatalogItem[],
  schedules: ScheduleRow[]
): {
  rows: TimeSlotCatalogItem[]
  assign: Map<string, Map<number, ScheduleRow[]>>
} => {
  // Trier le catalog par startTime
  const sortedCatalog = [...catalogSlots].sort(
    (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
  )

  // Pour chaque créneau, trouver la ligne catalog qui le contient.
  //
  // Stratégie en deux passes pour éviter tout faux positif :
  //
  // Passe 1 - correspondance exacte :
  //   Si schedule.startTime === slot.startTime, c'est la bonne ligne sans ambiguïté.
  //   Ex : créneau "17:00" → ligne "17:00–17:30" ✓
  //   Cela évite qu'un créneau dont le startTime coïncide avec le endTime d'une
  //   ligne précédente (ex : "17:00" dans "16:30–17:00") soit mal affecté.
  //
  // Passe 2 - containment par plage stricte :
  //   slot.startTime < schedule.startTime < slot.endTime
  //   (les deux bornes sont STRICTES pour ne pas capturer les égalités
  //    qui appartiennent à la passe 1)
  //   Ex : créneau "08:00" → ligne "07:30–09:00" ✓
  const findContainingRow = (schedule: ScheduleRow): TimeSlotCatalogItem | null => {
    const schedStart = timeToMinutes(schedule.timeSlot.startTime)

    // Passe 1 : correspondance exacte sur startTime
    for (const slot of sortedCatalog) {
      if (timeToMinutes(slot.startTime) === schedStart) {
        return slot
      }
    }

    // Passe 2 : containment strict (startTime du créneau est ENTRE les bornes)
    for (const slot of sortedCatalog) {
      const slotStart = timeToMinutes(slot.startTime)
      const slotEnd = timeToMinutes(slot.endTime)
      if (schedStart > slotStart && schedStart < slotEnd) {
        return slot
      }
    }

    return null
  }

  // Construire les lignes : catalog + lignes synthétiques pour les créneaux
  // qui ne sont contenus dans aucune ligne catalog
  const rowMap = new Map<string, TimeSlotCatalogItem>()
  for (const slot of sortedCatalog) {
    rowMap.set(slot.startTime, slot)
  }

  for (const schedule of schedules) {
    const containing = findContainingRow(schedule)
    if (!containing) {
      // Pas de ligne catalog correspondante → créer une ligne synthétique
      const key = schedule.timeSlot.startTime
      if (!rowMap.has(key)) {
        rowMap.set(key, schedule.timeSlot)
      }
    }
  }

  // Trier les lignes par startTime
  const rows = [...rowMap.values()].sort(
    (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
  )

  // Construire l'index d'affectation : rowKey → dayOfWeek → créneaux
  const assign = new Map<string, Map<number, ScheduleRow[]>>()

  for (const schedule of schedules) {
    const containing = findContainingRow(schedule)
    // Utiliser la ligne catalog si trouvée, sinon la ligne synthétique
    const rowKey = containing ? containing.startTime : schedule.timeSlot.startTime

    if (!assign.has(rowKey)) {
      assign.set(rowKey, new Map())
    }
    const dayMap = assign.get(rowKey)!
    const existing = dayMap.get(schedule.dayOfWeek) ?? []
    existing.push(schedule)
    dayMap.set(schedule.dayOfWeek, existing)
  }

  return { rows, assign }
}

// ─── Composant ──────────────────────────────────────────────────────────────────

export default function SchedulePage() {
  const user = useAuthStore((state) => state.user)
  const { hasPermission } = usePermissions()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const tour = useTourGuide("schedule", !!user)

  const [teacherFilter, setTeacherFilter] = useState("all")
  const [classFilter, setClassFilter] = useState("all")
  const [mobileDay, setMobileDay] = useState("1")
  const [viewMode, setViewMode] = useState<ViewMode>(() => getInitialViewMode())

  const currentWeekMonday = useMemo(() => getMondayForWeek(0), [])
  const nextWeekMonday = useMemo(() => getMondayForWeek(1), [])
  const [selectedWeekMonday, setSelectedWeekMonday] = useState(currentWeekMonday)

  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleRow | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<ScheduleRow | null>(null)
  const [formState, setFormState] = useState<SlotFormState>(emptyFormState)
  const [scopeChoiceOpen, setScopeChoiceOpen] = useState(false)
  const [editScope, setEditScope] = useState<"this" | "this_and_following" | "all" | null>(null)

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

  const activePeriodsQuery = useQuery({
    queryKey: ["schedule", "active-periods"],
    queryFn: fetchActiveSchedulePeriods,
    enabled: formOpen,
    staleTime: 60_000,
  })

  const data = scheduleQuery.data
  const canEditSchedule = hasPermission("schedule.edit")

  const blockedTeachers = useMemo(
    () =>
      new Set(
        (teachersQuery.data?.data ?? []).filter((t) => t.isBlocked).map((t) => t.id)
      ),
    [teachersQuery.data?.data]
  )

  const formPeriodOptions = useMemo<SchedulePeriodSummary[]>(() => {
    const map = new Map<string, SchedulePeriodSummary>()
    for (const p of activePeriodsQuery.data ?? []) {
      map.set(p.id, p)
    }
    if (data?.period && !map.has(data.period.id)) {
      map.set(data.period.id, {
        id: data.period.id,
        name: data.period.name,
        validFrom: data.period.validFrom,
        validTo: data.period.validTo,
        isActive: data.period.isActive,
      })
    }
    return [...map.values()].sort((a, b) =>
      a.validFrom < b.validFrom ? -1 : a.validFrom > b.validFrom ? 1 : 0
    )
  }, [activePeriodsQuery.data, data])

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

  // Vue liste : lignes + index d'affectation par plage horaire
  const { rows: listRows, assign: listAssign } = useMemo(
    () => buildListStructure(data?.catalog.timeSlots ?? [], filteredSchedules),
    [data?.catalog.timeSlots, filteredSchedules]
  )

  const setWeekFromIso = (weekIso: string) => {
    setSelectedWeekMonday(weekIso)
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
      // En édition, on ne change pas le type de récurrence (le backend conserve end_date)
      recurrence: null,
    })
    setFormOpen(true)
  }

  // Détermine si on demande à l'utilisateur la portée de la modification.
  // Un créneau one-shot (endDate non nul) n'a qu'une occurrence - édition directe avec scope='this'.
  const requestEditFor = (schedule: ScheduleRow) => {
    const isOneShot = schedule.endDate !== null
    if (isOneShot) {
      setEditScope("this")
      openEditModal(schedule)
      return
    }
    setSelectedSchedule(schedule)
    setDetailOpen(false)
    setScopeChoiceOpen(true)
  }

  const chooseScopeAndEdit = (scope: "this" | "this_and_following" | "all") => {
    if (!selectedSchedule) return
    setEditScope(scope)
    setScopeChoiceOpen(false)
    openEditModal(selectedSchedule)
  }

  const { isOnline } = useNetworkStatus()

  // Branche offline-only pour les MAJ : l'optimistic update reste géré par
  // upsertMutation.onMutate ci-dessous. On enregistre juste un processor qui
  // rejouera la requête à la reconnexion (registry global, voir
  // offline-processors.ts). Le create reste online-only : l'id serveur est
  // attribué à la création - on ne peut pas le rejouer en aveugle.
  const offlineUpdateMutation = useOfflineMutation<
    { id: string },
    ScheduleUpdateOfflinePayload
  >(
    ({ scheduleId, payload }) => updateScheduleSlot(scheduleId, payload),
    { queueKey: OFFLINE_QUEUE_KEYS.scheduleUpdate }
  )

  const offlineDeleteMutation = useOfflineMutation<
    void,
    ScheduleDeleteFromDateOfflinePayload
  >(
    ({ scheduleId, effectiveFrom, deleteScope }) =>
      deleteScheduleSlotFromDate(scheduleId, effectiveFrom, deleteScope),
    { queueKey: OFFLINE_QUEUE_KEYS.scheduleDeleteFromDate }
  )

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
        ? previous.schedules.map((s) => (s.id === values.id ? optimisticSchedule : s))
        : [optimisticSchedule, ...previous.schedules]
      queryClient.setQueryData<WeeklyScheduleData>(weeklyQueryKey, {
        ...previous,
        schedules: nextSchedules,
      })
      return { previous }
    },
    onError: (error, _v, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(weeklyQueryKey, ctx.previous)
      toast({
        variant: "destructive",
        title: "Action impossible",
        description: getScheduleConflictMessage(error),
      })
    },
    onSuccess: () => {
      toast({ title: editingSchedule ? "Créneau modifié" : "Créneau ajouté" })
      setFormOpen(false)
      setEditingSchedule(null)
      setEditScope(null)
    },
    onSettled: async () => { await queryClient.invalidateQueries({ queryKey: weeklyQueryKey }) },
  })

  const deleteMutation = useMutation({
    mutationFn: (values: { id: string; effectiveFrom: string; deleteScope?: "this" | "this_and_following" }) =>
      deleteScheduleSlotFromDate(values.id, values.effectiveFrom, values.deleteScope),
    onMutate: async (values) => {
      await queryClient.cancelQueries({ queryKey: weeklyQueryKey })
      const previous = queryClient.getQueryData<WeeklyScheduleData>(weeklyQueryKey)
      if (previous) {
        queryClient.setQueryData<WeeklyScheduleData>(weeklyQueryKey, {
          ...previous,
          // 'this' : on retire visuellement uniquement l'occurrence concernée pour
          // la semaine affichée. Le refetch en onSettled rétablit la vérité.
          // Autre cas : retrait complet du schedule.
          schedules: previous.schedules.filter((s) => s.id !== values.id),
        })
      }
      return { previous }
    },
    onError: (error, _id, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(weeklyQueryKey, ctx.previous)
      toast({
        variant: "destructive",
        title: "Suppression impossible",
        description: getScheduleConflictMessage(error),
      })
    },
    onSuccess: () => {
      toast({ title: "Créneau supprimé" })
      setDetailOpen(false)
      setSelectedSchedule(null)
    },
    onSettled: async () => { await queryClient.invalidateQueries({ queryKey: weeklyQueryKey }) },
  })

  const handleSubmit = async () => {
    if (!formState.schedulePeriodId) {
      toast({ variant: "destructive", title: "Aucune période", description: "Sélectionnez une période." })
      return
    }
    if (!editingSchedule && !formState.recurrence) {
      toast({
        variant: "destructive",
        title: "Type de créneau requis",
        description: "Indiquez s'il s'agit d'un créneau récurrent ou unique (rattrapage).",
      })
      return
    }
    if (formState.startTime >= formState.endTime) {
      toast({ variant: "destructive", title: "Horaire invalide", description: "La fin doit être après le début." })
      return
    }
    const payload = toPayload(formState)
    if (!payload.teacherId || !payload.classId || !payload.roomId || !payload.subject) {
      toast({ variant: "destructive", title: "Formulaire incomplet", description: "Renseignez tous les champs." })
      return
    }

    // Pour un créneau unique (rattrapage), on prend la date de l'occurrence dans la semaine sélectionnée.
    // Pour un récurrent, on conserve l'ancien comportement (propagation à partir de cette occurrence).
    const occurrenceDate = occurrenceDateFromWeek(selectedWeekMonday, payload.dayOfWeek)

    if (isPastScheduleSelection(selectedWeekMonday, payload.dayOfWeek, payload.startTime ?? "", new Date())) {
      toast({
        variant: "destructive",
        title: "Créneau passé",
        description: "Les créneaux peuvent être ajoutés uniquement sur des dates/heures futures.",
      })
      return
    }

    // Valider que la date d'occurrence est dans la fourchette de la période
    // sélectionnée — pour le one_shot ET le récurrent. Sans cette garde en mode
    // récurrent, on pouvait créer un cours sur une semaine hors période : il était
    // accepté mais n'apparaissait jamais dans la grille (cours "fantôme").
    {
      const period = formPeriodOptions.find((p) => p.id === payload.schedulePeriodId)
      if (period && (occurrenceDate < period.validFrom || occurrenceDate > period.validTo)) {
        toast({
          variant: "destructive",
          title: "Date hors période",
          description:
            formState.recurrence === "one_shot"
              ? `Le créneau de rattrapage doit tomber entre ${period.validFrom} et ${period.validTo}.`
              : `La semaine sélectionnée est hors de la période « ${period.name} » (${period.validFrom} → ${period.validTo}). Choisissez une semaine couverte par la période.`,
        })
        return
      }
    }

    payload.effectiveFrom = occurrenceDate

    // En édition, propager la portée choisie (ou défaut côté backend = this_and_following).
    if (editingSchedule && editScope) {
      payload.updateScope = editScope
    }

    // Offline + update : mise en queue. L'optimistic update de upsertMutation
    // n'est pas déclenché (on appelle offlineUpdateMutation), donc on applique
    // manuellement la même mise à jour locale avant de queue-er.
    if (!isOnline && editingSchedule?.id) {
      const previous = queryClient.getQueryData<WeeklyScheduleData>(weeklyQueryKey)
      if (previous) {
        const optimisticSchedule = createOptimisticSchedule(
          editingSchedule.id,
          payload,
          previous
        )
        if (optimisticSchedule) {
          queryClient.setQueryData<WeeklyScheduleData>(weeklyQueryKey, {
            ...previous,
            schedules: previous.schedules.map((s) =>
              s.id === editingSchedule.id ? optimisticSchedule : s
            ),
          })
        }
      }

      try {
        await offlineUpdateMutation.mutateAsync({
          scheduleId: editingSchedule.id,
          payload,
        })
      } catch (error) {
        if (error instanceof OfflineMutationQueuedError) {
          toast({
            title: "Modification en attente",
            description: "Le créneau sera mis à jour côté serveur dès le retour du réseau.",
          })
          setFormOpen(false)
          setEditingSchedule(null)
          setEditScope(null)
          return
        }
        // Hors offline, l'erreur est inattendue : ne devrait pas se produire
        // puisque useOfflineMutation rejette uniquement OfflineMutationQueuedError
        // en mode offline et délègue au mutationFn online sinon.
        throw error
      }
      return
    }

    await upsertMutation.mutateAsync({ id: editingSchedule?.id, payload })
  }

  // Wrapper offline-aware autour de deleteMutation. Le optimistic update
  // (suppression locale du créneau) est appliqué manuellement avant la mise
  // en queue puisque deleteMutation.onMutate n'est pas déclenché en offline.
  const runDelete = async (values: {
    id: string
    effectiveFrom: string
    deleteScope?: "this" | "this_and_following"
  }) => {
    if (!isOnline) {
      const previous = queryClient.getQueryData<WeeklyScheduleData>(weeklyQueryKey)
      if (previous) {
        queryClient.setQueryData<WeeklyScheduleData>(weeklyQueryKey, {
          ...previous,
          schedules: previous.schedules.filter((s) => s.id !== values.id),
        })
      }

      try {
        await offlineDeleteMutation.mutateAsync({
          scheduleId: values.id,
          effectiveFrom: values.effectiveFrom,
          deleteScope: values.deleteScope,
        })
      } catch (error) {
        if (error instanceof OfflineMutationQueuedError) {
          toast({
            title: "Suppression en attente",
            description: "Le créneau sera supprimé côté serveur dès le retour du réseau.",
          })
          setDetailOpen(false)
          setSelectedSchedule(null)
          return
        }
        throw error
      }
      return
    }

    await deleteMutation.mutateAsync(values)
  }

  if (!user) return <Navigate to="/" replace />

  const weekStartDate = fromISODate(selectedWeekMonday)
  const today = new Date()
  const mondayKey = toISODate(weekStartDate)
  const currentMondayKey = toISODate(getMonday(today))
  const todayDayValue = mondayKey === currentMondayKey ? isoDayOfWeek(today) : null

  return (
    <>
      <TourGuide
        steps={scheduleTourSteps}
        run={tour.run}
        stepIndex={tour.stepIndex}
        onStepChange={tour.setStepIndex}
        onFinish={tour.markDone}
      />
    <div className="space-y-6 px-4 md:px-1">
      <OfflineIndicator offlineCapable />
      <header className="space-y-4">
        <WeekCoverageAlert
          nextWeekHasCoverage={nextWeekCoverageQuery.data ?? true}
          onNavigateToSchedule={() => setWeekFromIso(nextWeekMonday)}
        />

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Emploi du temps</h1>
            <p className="text-sm text-muted-foreground">Vue hebdomadaire et gestion des créneaux de cours.</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-muted-foreground"
              onClick={() => tour.restart()}
              aria-label="Revoir le guide"
            >
              <InfoIcon className="mr-1.5 h-4 w-4" />
              Guide
            </Button>
            {canEditSchedule ? (
              <Button
                onClick={() => openCreateModal()}
                // Pas de période active sur la semaine affichée = impossible de
                // poser un créneau cohérent (il n'apparaîtrait pas). On bloque ici
                // comme le font déjà la vue liste et l'EmptyState mobile.
                disabled={!data || !data.period}
                title={data && !data.period ? "Aucune période active pour cette semaine" : undefined}
                className="w-full sm:w-auto"
                data-tour="schedule-add-btn"
              >
                <AddIcon className="mr-2 h-4 w-4" />Ajouter un créneau
              </Button>
            ) : (
              <Badge variant="outline">Lecture seule</Badge>
            )}
          </div>
        </div>

        {/* ── Barre de contrôles ─────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-2 shadow-sm" data-tour="schedule-periods">
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-10"
              onClick={() => setWeekFromIso(shiftWeekIso(selectedWeekMonday, -1))}
              aria-label="Semaine précédente"
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </Button>
            <p className="min-w-0 flex-1 text-sm font-medium sm:flex-none">{formatWeekRange(selectedWeekMonday)}</p>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-10"
              onClick={() => setWeekFromIso(shiftWeekIso(selectedWeekMonday, 1))}
              aria-label="Semaine suivante"
            >
              <ChevronRightIcon className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setWeekFromIso(currentWeekMonday)}
            >
              Aujourd&apos;hui
            </Button>
          </div>

          <div className="h-7 w-px bg-border" aria-hidden="true" />

          {/* Vue grille / liste */}
          <div className="flex items-center rounded-md border bg-muted/40 p-0.5">
            <Button
              type="button"
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="sm"
              className="min-h-9 gap-1.5 px-2.5 text-xs"
              onClick={() => setViewMode("grid")}
              aria-pressed={viewMode === "grid"}
            >
              <LayoutGridIcon className="h-3.5 w-3.5" />
              Grille
            </Button>
            <Button
              type="button"
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="sm"
              className="min-h-9 gap-1.5 px-2.5 text-xs"
              onClick={() => setViewMode("list")}
              aria-pressed={viewMode === "list"}
            >
              <ListIcon className="h-3.5 w-3.5" />
              Liste
            </Button>
          </div>

          {/* Séparateur visuel */}
          <div className="h-7 w-px bg-border" aria-hidden="true" />

          {/* Filtre professeur */}
          <Select value={teacherFilter} onValueChange={setTeacherFilter} disabled={!data}>
            <SelectTrigger className="min-h-10 w-auto min-w-[160px] text-xs">
              <SelectValue placeholder="Tous les professeurs" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les professeurs</SelectItem>
              {(data?.catalog.teachers ?? []).map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Filtre classe */}
          <Select value={classFilter} onValueChange={setClassFilter} disabled={!data}>
            <SelectTrigger className="min-h-10 w-auto min-w-[140px] text-xs">
              <SelectValue placeholder="Toutes les classes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les classes</SelectItem>
              {(data?.catalog.classes ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Badges de filtres actifs */}
          {teacherFilter !== "all" && (
            <Badge
              variant="secondary"
              className="cursor-pointer gap-1 text-xs"
              onClick={() => setTeacherFilter("all")}
            >
              {data?.catalog.teachers.find((t) => t.id === teacherFilter)?.name ?? "Prof"}
              <span aria-hidden="true" className="opacity-60">✕</span>
            </Badge>
          )}
          {classFilter !== "all" && (
            <Badge
              variant="secondary"
              className="cursor-pointer gap-1 text-xs"
              onClick={() => setClassFilter("all")}
            >
              {data?.catalog.classes.find((c) => c.id === classFilter)?.name ?? "Classe"}
              <span aria-hidden="true" className="opacity-60">✕</span>
            </Badge>
          )}
        </div>
      </header>

      {scheduleQuery.isLoading ? (
        <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground shadow-sm">
          Chargement de l'emploi du temps...
        </div>
      ) : null}
      {scheduleQuery.isError ? (
        <Alert variant="destructive">
          <AlertDescription>Impossible de charger l'emploi du temps. Vérifiez la connexion, puis réessayez.</AlertDescription>
        </Alert>
      ) : null}
      {!scheduleQuery.isLoading && data && !data.period && viewMode === "list" ? (
        <Alert>
          <AlertDescription>Aucune période active pour cette semaine. Changez de semaine ou configurez une période avant d'ajouter des créneaux.</AlertDescription>
        </Alert>
      ) : null}

      {!scheduleQuery.isLoading && data && viewMode === "grid" ? (
        <div data-tour="schedule-grid">
        <WeekGrid
          slots={filteredSchedules}
          weekStart={weekStartDate}
          hasPeriod={!!data.period}
          isLoading={scheduleQuery.isFetching}
          onSlotClick={(slot) => { setSelectedSchedule(slot); setDetailOpen(true) }}
          onSlotAdd={(day, hour) => { if (!canEditSchedule) return; openCreateModal({ dayOfWeek: day, hour }) }}
          onWeekChange={(next) => setWeekFromIso(toISODate(next))}
          onToday={() => setWeekFromIso(currentWeekMonday)}
          isBlockedTeacher={(id) => blockedTeachers.has(id)}
        />
        </div>
      ) : null}

      {!scheduleQuery.isLoading && data && viewMode === "list" ? (
        <>
          {/* Vue desktop */}
          <Card className="hidden md:block" data-tour="schedule-grid">
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
                <table className="min-w-full table-fixed border-collapse text-sm" >
                  <thead>
                    <tr className="bg-muted/40">
                      <th className="w-32 border p-2 text-left text-xs font-semibold text-muted-foreground">
                        Créneau
                      </th>
                      {DAYS.map((day) => (
                        <th
                          key={day.value}
                          className="w-[14.66%] border p-2 text-left text-xs font-semibold text-muted-foreground"
                        >
                          {day.label}
                          {todayDayValue === day.value ? (
                            <span className="ml-1 text-primary">• Aujourd&apos;hui</span>
                          ) : null}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {listRows.map((row) => (
                    <tr key={row.startTime} className="align-top transition-colors hover:bg-muted/20">
                        {/* Label de la ligne */}
                        <td className="border p-2 text-xs font-medium text-muted-foreground whitespace-nowrap">
                          {row.label}
                        </td>
                        {DAYS.map((day) => {
                          const cellItems =
                            listAssign.get(row.startTime)?.get(day.value) ?? []
                          return (
                            <td
                              key={`${day.value}-${row.startTime}`}
                              className="w-[14.66%] min-h-[80px] border p-1.5 align-top"
                            >
                              <div className="space-y-1">
                                {cellItems.map((item) => (
                                  <Button
                                    key={item.id}
                                    type="button"
                                    variant="ghost"
                                    onClick={() => { setSelectedSchedule(item); setDetailOpen(true) }}
                                    className="h-auto w-full justify-start whitespace-normal rounded-md border bg-muted/30 p-2 text-left text-xs break-words shadow-sm hover:bg-muted/60 hover:shadow-md"
                                  >
                                    <div className="flex w-full flex-col items-start">
                                      <p className="font-semibold leading-tight">{item.teacher.name}</p>
                                      <p className="text-muted-foreground">{item.class.name}</p>
                                      <p className="text-muted-foreground">{item.subject}</p>
                                      {item.timeSlot.startTime !== row.startTime && (
                                        <p className="mt-0.5 text-[10px] text-amber-600">
                                          {item.timeSlot.startTime} – {item.timeSlot.endTime}
                                        </p>
                                      )}
                                      {blockedTeachers.has(item.teacher.id) ? (
                                        <Badge variant="destructive" className="mt-1 text-[10px]">
                                          Prof bloqué
                                        </Badge>
                                      ) : null}
                                    </div>
                                  </Button>
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

          {/* Vue mobile */}
          <Card className="md:hidden">
            <CardHeader>
              <CardTitle>Créneaux par jour</CardTitle>
              <CardDescription>Sélectionnez un jour pour voir ses cours.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Tabs value={mobileDay} onValueChange={setMobileDay}>
                <TabsList className="grid w-full grid-cols-6">
                  {DAYS.map((day) => (
                    <TabsTrigger key={day.value} value={String(day.value)}>
                      {day.label}
                      {todayDayValue === day.value ? "*" : ""}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              <div className="space-y-2">
                {filteredSchedules
                  .filter((item) => String(item.dayOfWeek) === mobileDay)
                  .map((item) => (
                    <Button
                      key={item.id}
                      type="button"
                      variant="ghost"
                      onClick={() => { setSelectedSchedule(item); setDetailOpen(true) }}
                      className="h-auto w-full justify-start whitespace-normal rounded-lg border bg-muted/30 p-3 text-left shadow-sm hover:bg-muted/60 hover:shadow-md"
                    >
                      <div className="flex w-full flex-col items-start">
                        <p className="text-xs font-semibold">{item.timeSlot.label}</p>
                        <p className="text-sm font-medium">{item.subject}</p>
                        <p className="text-xs text-muted-foreground">{item.teacher.name} · {item.class.name}</p>
                        {blockedTeachers.has(item.teacher.id) ? (
                          <Badge variant="destructive" className="mt-1">Prof bloqué</Badge>
                        ) : null}
                      </div>
                    </Button>
                  ))}
                {filteredSchedules.filter((s) => String(s.dayOfWeek) === mobileDay).length === 0 ? (
                  <EmptyState
                    icon={ScheduleIcon}
                    title="Aucun cours ce jour"
                    message="Ce jour n'a pas encore de créneau dans la période sélectionnée."
                    action={canEditSchedule && data.period ? {
                      label: "Ajouter un créneau",
                      onClick: () => openCreateModal({ dayOfWeek: Number(mobileDay), hour: 8 }),
                      icon: AddIcon,
                    } : undefined}
                  />
                ) : null}
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}

      {/* ── Dialog détail ────────────────────────────────────────────────── */}
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
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="text-xs font-medium text-muted-foreground">Matière</p>
                <p className="mt-1 font-semibold">{selectedSchedule.subject}</p>
              </div>
              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="text-xs font-medium text-muted-foreground">Horaire</p>
                <p className="mt-1 font-semibold">{selectedSchedule.timeSlot.startTime} - {selectedSchedule.timeSlot.endTime}</p>
              </div>
              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="text-xs font-medium text-muted-foreground">Professeur</p>
                <p className="mt-1 font-semibold">{selectedSchedule.teacher.name}</p>
              </div>
              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="text-xs font-medium text-muted-foreground">Classe et salle</p>
                <p className="mt-1 font-semibold">{selectedSchedule.class.name} · {selectedSchedule.room.name}</p>
              </div>
            </div>
          ) : null}
          {canEditSchedule && selectedSchedule ? (
            <DialogFooter className="gap-2 sm:justify-between">
              <Button variant="destructive"
                onClick={() => setConfirmDeleteOpen(true)}
                disabled={
                  deleteMutation.isPending ||
                  isPastScheduleSelection(
                    selectedWeekMonday,
                    selectedSchedule.dayOfWeek,
                    selectedSchedule.timeSlot.startTime,
                    new Date()
                  )
                }>
                <DeleteIcon className="mr-2 h-4 w-4" />Supprimer
              </Button>
              {selectedSchedule.hasPastAttendance ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        disabled={isPastScheduleSelection(
                          selectedWeekMonday,
                          selectedSchedule.dayOfWeek,
                          selectedSchedule.timeSlot.startTime,
                          new Date()
                        )}
                        onClick={() => requestEditFor(selectedSchedule)}
                      >
                        <EditIcon className="mr-2 h-4 w-4" />Modifier
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Ce créneau a un historique. Vous pourrez choisir d'impacter uniquement cette occurrence ou les suivantes.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <Button
                  variant="outline"
                  disabled={isPastScheduleSelection(
                    selectedWeekMonday,
                    selectedSchedule.dayOfWeek,
                    selectedSchedule.timeSlot.startTime,
                    new Date()
                  )}
                  onClick={() => requestEditFor(selectedSchedule)}
                >
                  <EditIcon className="mr-2 h-4 w-4" />Modifier
                </Button>
              )}
            </DialogFooter>
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce créneau de {selectedSchedule?.subject ?? "cours"} ?</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedSchedule?.endDate !== null
                ? "Ce créneau de rattrapage sera supprimé définitivement."
                : selectedSchedule?.hasPastAttendance
                  ? `Choisissez la portée de la suppression. L'historique des ${selectedSchedule.pastAttendanceCount} cours déjà enseignés sera conservé.`
                  : "Choisissez la portée de la suppression."}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {selectedSchedule && selectedSchedule.endDate === null ? (
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                className="h-auto justify-start whitespace-normal py-3 text-left"
                disabled={deleteMutation.isPending}
                onClick={() => {
                  if (!selectedSchedule) return
                  if (isPastScheduleSelection(
                    selectedWeekMonday,
                    selectedSchedule.dayOfWeek,
                    selectedSchedule.timeSlot.startTime,
                    new Date()
                  )) {
                    toast({
                      variant: "destructive",
                      title: "Suppression impossible",
                      description: "Un créneau passé ne peut pas être supprimé.",
                    })
                    return
                  }
                  const effectiveFrom = occurrenceDateFromWeek(selectedWeekMonday, selectedSchedule.dayOfWeek)
                  void runDelete({
                    id: selectedSchedule.id,
                    effectiveFrom,
                    deleteScope: "this",
                  })
                  setConfirmDeleteOpen(false)
                }}
              >
                <div className="flex flex-col items-start gap-0.5">
                  <span className="text-sm font-medium">Cette occurrence uniquement</span>
                  <span className="text-xs text-muted-foreground">
                    Seule la séance de ce jour est retirée. Les semaines suivantes restent intactes.
                  </span>
                </div>
              </Button>
              <Button
                variant="outline"
                className="h-auto justify-start whitespace-normal py-3 text-left"
                disabled={deleteMutation.isPending}
                onClick={() => {
                  if (!selectedSchedule) return
                  if (isPastScheduleSelection(
                    selectedWeekMonday,
                    selectedSchedule.dayOfWeek,
                    selectedSchedule.timeSlot.startTime,
                    new Date()
                  )) {
                    toast({
                      variant: "destructive",
                      title: "Suppression impossible",
                      description: "Un créneau passé ne peut pas être supprimé.",
                    })
                    return
                  }
                  const effectiveFrom = occurrenceDateFromWeek(selectedWeekMonday, selectedSchedule.dayOfWeek)
                  void runDelete({
                    id: selectedSchedule.id,
                    effectiveFrom,
                    deleteScope: "this_and_following",
                  })
                  setConfirmDeleteOpen(false)
                }}
              >
                <div className="flex flex-col items-start gap-0.5">
                  <span className="text-sm font-medium">Cette occurrence et les suivantes</span>
                  <span className="text-xs text-muted-foreground">
                    Le créneau s'arrête à cette date. Aucune séance future ne sera plus planifiée.
                  </span>
                </div>
              </Button>
            </div>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Garder le créneau</AlertDialogCancel>
            {selectedSchedule && selectedSchedule.endDate !== null ? (
              <AlertDialogAction
                onClick={() => {
                  if (!selectedSchedule) return
                  if (isPastScheduleSelection(
                    selectedWeekMonday,
                    selectedSchedule.dayOfWeek,
                    selectedSchedule.timeSlot.startTime,
                    new Date()
                  )) {
                    toast({
                      variant: "destructive",
                      title: "Suppression impossible",
                      description: "Un créneau passé ne peut pas être supprimé.",
                    })
                    return
                  }
                  const effectiveFrom = occurrenceDateFromWeek(selectedWeekMonday, selectedSchedule.dayOfWeek)
                  void runDelete({ id: selectedSchedule.id, effectiveFrom })
                  setConfirmDeleteOpen(false)
                }}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? "Suppression..." : "Supprimer le créneau"}
              </AlertDialogAction>
            ) : null}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Dialog choix de portée d'édition ─────────────────────────────── */}
      <Dialog open={scopeChoiceOpen} onOpenChange={setScopeChoiceOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Modifier ce cours</DialogTitle>
            <DialogDescription>
              Choisissez la portée de la modification pour ce créneau récurrent.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              className="h-auto justify-start whitespace-normal py-3 text-left"
              onClick={() => chooseScopeAndEdit("this")}
            >
              <div className="flex flex-col items-start gap-0.5">
                <span className="text-sm font-medium">Cette occurrence uniquement</span>
                <span className="text-xs text-muted-foreground">
                  Seule la séance du jour choisi est modifiée. Les autres semaines restent intactes.
                </span>
              </div>
            </Button>
            <Button
              variant="outline"
              className="h-auto justify-start whitespace-normal py-3 text-left"
              onClick={() => chooseScopeAndEdit("this_and_following")}
            >
              <div className="flex flex-col items-start gap-0.5">
                <span className="text-sm font-medium">Cette occurrence et les suivantes</span>
                <span className="text-xs text-muted-foreground">
                  À partir de cette date, toutes les séances futures prennent les nouvelles valeurs.
                </span>
              </div>
            </Button>
            {selectedSchedule?.hasPastAttendance ? (
              <p className="rounded-md border border-dashed bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
                L'option « Toutes les occurrences » est verrouillée : ce cours a déjà été enseigné
                ({selectedSchedule.pastAttendanceCount} séance{selectedSchedule.pastAttendanceCount > 1 ? "s" : ""} passée{selectedSchedule.pastAttendanceCount > 1 ? "s" : ""}). L'historique doit être préservé.
              </p>
            ) : (
              <Button
                variant="outline"
                className="h-auto justify-start whitespace-normal py-3 text-left"
                onClick={() => chooseScopeAndEdit("all")}
              >
                <div className="flex flex-col items-start gap-0.5">
                  <span className="text-sm font-medium">Toutes les occurrences</span>
                  <span className="text-xs text-muted-foreground">
                    L'ensemble du créneau (passé compris) est mis à jour. Utiliser pour corriger une erreur.
                  </span>
                </div>
              </Button>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setScopeChoiceOpen(false)}>
              Annuler
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog formulaire ────────────────────────────────────────────── */}
      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open)
          if (!open) {
            setEditingSchedule(null)
            setEditScope(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{editingSchedule ? "Modifier un créneau" : "Ajouter un créneau"}</DialogTitle>
            <DialogDescription>Renseignez les informations nécessaires pour placer ce cours dans la semaine sélectionnée.</DialogDescription>
            {editingSchedule && editScope ? (
              <Badge variant="secondary" className="mt-2 w-fit">
                Portée :{" "}
                {editScope === "this"
                  ? "Cette occurrence uniquement"
                  : editScope === "this_and_following"
                    ? "Cette occurrence et les suivantes"
                    : "Toutes les occurrences"}
              </Badge>
            ) : null}
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Période</Label>
              <Select value={formState.schedulePeriodId}
                onValueChange={(v) => setFormState((p) => ({ ...p, schedulePeriodId: v }))}>
                <SelectTrigger><SelectValue placeholder="Choisir une période" /></SelectTrigger>
                <SelectContent>
                  {formPeriodOptions.length === 0 ? (
                    <SelectItem value="__none__" disabled>
                      {activePeriodsQuery.isLoading ? "Chargement..." : "Aucune période active"}
                    </SelectItem>
                  ) : (
                    formPeriodOptions.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        ({p.validFrom} → {p.validTo})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {!editingSchedule ? (
              <div className="space-y-1">
                <Label>Type de créneau</Label>
                <RadioGroup
                  value={formState.recurrence ?? ""}
                  onValueChange={(v) =>
                    setFormState((p) => ({ ...p, recurrence: v as "recurring" | "one_shot" }))
                  }
                  className="grid grid-cols-1 gap-2 sm:grid-cols-2"
                >
                  <label
                    htmlFor="recurrence-recurring"
                    className="flex cursor-pointer items-start gap-2 rounded-md border p-3 hover:bg-muted/40"
                  >
                    <RadioGroupItem value="recurring" id="recurrence-recurring" className="mt-0.5" />
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium leading-none">Récurrent</p>
                      <p className="text-xs text-muted-foreground">
                        Répété chaque semaine jusqu'à la fin de la période.
                      </p>
                    </div>
                  </label>
                  <label
                    htmlFor="recurrence-one-shot"
                    className="flex cursor-pointer items-start gap-2 rounded-md border p-3 hover:bg-muted/40"
                  >
                    <RadioGroupItem value="one_shot" id="recurrence-one-shot" className="mt-0.5" />
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium leading-none">Unique (rattrapage)</p>
                      <p className="text-xs text-muted-foreground">
                        Uniquement le jour choisi, sans répétition.
                      </p>
                    </div>
                  </label>
                </RadioGroup>
                {formState.recurrence === "one_shot" && formState.dayOfWeek ? (
                  <p className="text-[11px] text-muted-foreground">
                    Ce créneau apparaîtra uniquement le{" "}
                    {occurrenceDateFromWeek(selectedWeekMonday, Number(formState.dayOfWeek))}.
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="space-y-1">
              <Label>Professeur</Label>
              <Select value={formState.teacherId}
                onValueChange={(v) => setFormState((p) => ({ ...p, teacherId: v, subject: "" }))}>
                <SelectTrigger><SelectValue placeholder="Choisir un professeur" /></SelectTrigger>
                <SelectContent>
                  {(data?.catalog.teachers ?? []).map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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
                    Ce professeur n'a pas encore de matière configurée dans son profil.
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-1">
              <Label>Classe</Label>
              <Select value={formState.classId}
                onValueChange={(v) => setFormState((p) => ({ ...p, classId: v }))}>
                <SelectTrigger><SelectValue placeholder="Choisir une classe" /></SelectTrigger>
                <SelectContent>
                  {(data?.catalog.classes ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                {formState.recurrence === "one_shot" ? (
                  (() => {
                    // Cours unique : on choisit une DATE directement. On en déduit
                    // le jour de semaine et la semaine cible (la grille suit), au
                    // lieu de dépendre de la semaine déjà affichée.
                    const formPeriod = formPeriodOptions.find((p) => p.id === formState.schedulePeriodId)
                    const todayIso = toISODate(new Date())
                    const minDate = formPeriod
                      ? (formPeriod.validFrom > todayIso ? formPeriod.validFrom : todayIso)
                      : todayIso
                    const maxDate = formPeriod?.validTo
                    const currentDate = occurrenceDateFromWeek(selectedWeekMonday, Number(formState.dayOfWeek))
                    return (
                      <>
                        <Label htmlFor="one-shot-date">Date du cours</Label>
                        <Input
                          id="one-shot-date"
                          type="date"
                          value={currentDate}
                          min={minDate}
                          max={maxDate}
                          onChange={(event) => {
                            const picked = event.target.value
                            if (!picked) return
                            const { weekMonday, dayOfWeek } = weekMondayAndDayFromDate(picked)
                            // Le modèle ne couvre que lundi→samedi (pas de cours le dimanche).
                            if (dayOfWeek === 7) {
                              toast({
                                variant: "destructive",
                                title: "Jour non autorisé",
                                description: "Aucun cours ne peut être planifié un dimanche.",
                              })
                              return
                            }
                            setSelectedWeekMonday(weekMonday)
                            setFormState((p) => ({ ...p, dayOfWeek: String(dayOfWeek) }))
                          }}
                        />
                      </>
                    )
                  })()
                ) : (
                  <>
                    <Label>Jour</Label>
                    <Select value={formState.dayOfWeek}
                      onValueChange={(v) => setFormState((p) => ({ ...p, dayOfWeek: v }))}>
                      <SelectTrigger><SelectValue placeholder="Choisir un jour" /></SelectTrigger>
                      <SelectContent>
                        {DAYS.map((day) => (
                          <SelectItem key={day.value} value={String(day.value)}>{day.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </>
                )}
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

            <div className="space-y-1">
              <Label>Salle</Label>
              <Select value={formState.roomId}
                onValueChange={(v) => setFormState((p) => ({ ...p, roomId: v }))}>
                <SelectTrigger><SelectValue placeholder="Choisir une salle" /></SelectTrigger>
                <SelectContent>
                  {(data?.catalog.rooms ?? []).map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Annuler</Button>
            <Button onClick={() => void handleSubmit()}
              disabled={upsertMutation.isPending || !formState.schedulePeriodId}>
              {upsertMutation.isPending ? "Enregistrement..." : editingSchedule ? "Enregistrer les modifications" : "Ajouter le créneau"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </>
  )
}
