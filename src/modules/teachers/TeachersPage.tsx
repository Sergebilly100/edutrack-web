import { useMemo, useState } from "react"
import type { ColumnDef, Column } from "@tanstack/react-table"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate, useSearchParams } from "react-router-dom"
import axios from "axios"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"
import { cn } from "@/lib/utils"
import TeacherAnalysisPanel from "@/modules/teachers/components/TeacherAnalysisPanel"
import TeacherForm from "@/modules/teachers/components/TeacherForm"
import {
  blockTeacher,
  createTeacher,
  exportTeacherHours,
  fetchTeacherAttendanceStats,
  getTeacherCompliance,
  getTeachers,
  sendCredentialsToTeachers,
  unblockTeacher,
  type DashboardTeacherComplianceItem,
  type TeacherListItem,
} from "@/modules/teachers/teachers.api"
import { getCurrentMonth } from "@/shared/utils/month"
import {
  AddIcon,
  AppIcon,
  BlockIcon,
  ChevronRightIcon,
  ExportIcon,
  InfoIcon,
  MoreIcon,
  TeachersIcon,
  UnblockIcon,
  ViewIcon,
} from "@/shared/components/icons"
import { ConfirmActionDialog, DataTable, EmptyState, OfflineGuard, PageLayout } from "@/shared/components"
import { TourGuide } from "@/shared/components/TourGuide"
import { usePermissions } from "@/shared/hooks/usePermissions"
import { usePdfExportJob } from "@/shared/hooks/usePdfExportJob"
import { useStudentLabels } from "@/shared/hooks/useStudentLabel"
import { useTourGuide } from "@/shared/hooks/useTourGuide"
import { isStaffRole, useAuthStore } from "@/shared/store/auth.store"
import { teachersTourSteps } from "@/shared/lib/tour-steps"

const THIRTY_DAYS_MS = 1000 * 60 * 60 * 24 * 30

const toISODate = (date: Date) => date.toISOString().slice(0, 10)

const getDefaultExportPeriod = () => {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return { dateFrom: toISODate(start), dateTo: toISODate(end) }
}

const getLast30DaysPeriod = () => {
  const end = new Date()
  const start = new Date(end.getTime() - THIRTY_DAYS_MS)
  return { dateFrom: toISODate(start), dateTo: toISODate(end) }
}

const getApiErrorMessage = (error: unknown, fallback: string) =>
  axios.isAxiosError(error) && typeof error.response?.data?.error === "string"
    ? error.response.data.error
    : fallback

type TeacherStatsMap = Record<
  string,
  { attendanceRate: number; hoursWorked: number; amountDue: number }
>

type TeacherTableRow = TeacherListItem & {
  name: string
  attendanceRate: number
}

type RankingTeacherRow = DashboardTeacherComplianceItem & {
  subjects: string[]
}

const initials = (value: string) =>
  value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk[0]?.toUpperCase() ?? "")
    .join("")

function SortableHeader<TData>({
  column,
  label,
}: {
  column: Column<TData, unknown>
  label: string
}) {
  return (
    <span
      className={cn(
        "text-sm font-medium",
        column.getIsSorted() ? "text-foreground" : "text-muted-foreground"
      )}
    >
      {label}
    </span>
  )
}

// teacherRowActions permet de gérer les actions spécifiques à chaque ligne du tableau (voir profil, bloquer/débloquer, exporter PDF) sans recréer les handlers à chaque rendu de ligne, 
// ce qui améliore les performances et évite les problèmes de focus dans le menu déroulant. Les handlers sont passés en props depuis la définition des colonnes, 
// garantissant ainsi une meilleure stabilité et réactivité de l'interface utilisateur.
function TeacherRowActions({
  teacher,
  onViewProfile,
  onToggleBlocked,
  onExportPdf,
  canToggleBlocked,
}: {
  teacher: TeacherTableRow
  onViewProfile: () => void
  onToggleBlocked: () => void
  onExportPdf: () => void
  canToggleBlocked: boolean
}) {
  return (
    <div onClick={(event) => event.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={(event) => event.stopPropagation()}
          >
            <MoreIcon className="h-4 w-4" />
            <span className="sr-only">Actions pour {teacher.name}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onSelect={onViewProfile}>
            <ViewIcon className="mr-2 h-4 w-4" />
            Voir le profil
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

// TeacherRankingPanel affiche le classement de conformité des professeurs pour un mois donné, avec la possibilité de filtrer par matière. 
// Il utilise les données de conformité et les informations des professeurs pour calculer les taux et afficher un classement clair et informatif, avec des indicateurs visuels 
// pour les différentes métriques de conformité.
function TeacherRankingPanel({
  teachers,
}: {
  teachers: TeacherListItem[]
}) {
  const studentLabels = useStudentLabels()
  const [month, setMonth] = useState(() => getCurrentMonth())
  const [subject, setSubject] = useState("all")
  // On récupère une liste plus large de professeurs pour avoir un pool complet pour les options de matière et éviter les problèmes de données manquantes dans le classement,
  const rankingTeachersQuery = useQuery({
    queryKey: ["teachers", "ranking", "subject-options"],
    queryFn: () => getTeachers({ page: 1, limit: 200 }),
    staleTime: 60_000,
  })
  // La requête de conformité est spécifique au mois et fournit les données nécessaires pour calculer les taux de conformité et afficher le classement. 
  // Elle est séparée de la requête des professeurs pour permettre une meilleure gestion du cache et éviter les problèmes de données manquantes.
  const complianceQuery = useQuery({
    queryKey: ["teachers", "ranking", month, subject],
    queryFn: () => getTeacherCompliance(month, subject === "all" ? undefined : subject),
    staleTime: 60_000,
    retry: false,
  })
  // On utilise les données de la requête de classement pour construire une map des professeurs par ID, ce qui permet d'enrichir les données de conformité avec 
  // les matières enseignées et d'autres informations nécessaires pour le classement, tout en évitant les problèmes de données manquantes ou de cache incohérent.
  const rankingTeachers = rankingTeachersQuery.data?.data ?? teachers
  const teachersById = useMemo(() => {
    return new Map(rankingTeachers.map((teacher) => [teacher.id, teacher]))
  }, [rankingTeachers])
  const subjectOptions = useMemo(() => {
    const values = new Set<string>()
    for (const teacher of rankingTeachers) { 
    // On parcourt tous les professeurs du classement (qui inclut potentiellement plus de professeurs que ceux affichés dans le classement actuel) pour extraire les matières enseignées, 
    // ce qui permet d'avoir une liste complète de matières pour les options de filtrage, même si certains professeurs du classement actuel n'ont pas de matière renseignée.
      for (const item of teacher.subjects) {
        const clean = item.trim()
        if (clean) values.add(clean)
      }
    }
    return Array.from(values).sort((a, b) => a.localeCompare(b, "fr"))
  }, [rankingTeachers])
  // On combine les données de conformité avec les informations des professeurs pour construire les lignes du classement, en appliquant les filtres de matière et en calculant les rangs.
  const rankedRows = useMemo<RankingTeacherRow[]>(() => {
    return (complianceQuery.data ?? [])
      .map((row) => ({
        ...row,
        subjects: teachersById.get(row.teacherId)?.subjects ?? [],
      }))
      .map((row, index) => ({ ...row, rank: index + 1 }))
  }, [complianceQuery.data, teachersById])

  // On calcule le meilleur taux et la moyenne à partir des lignes classées pour afficher les indicateurs globaux du classement, en gérant les cas où il n'y a pas de données.
  const topRate = rankedRows[0]?.complianceRate ?? 0

  // La moyenne est calculée en sommant les taux de conformité de tous les professeurs classés et en divisant par le nombre total de professeurs, ce qui donne une 
  // indication globale de la performance moyenne des professeurs par rapport aux critères de conformité pour le mois sélectionné.
  const averageRate =
    rankedRows.length === 0
      ? 0
      : rankedRows.reduce((sum, row) => sum + row.complianceRate, 0) / rankedRows.length 

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-4 bg-[var(--surface-chrome)] px-4 py-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-semibold">Classement de conformité</p>
            <p className="text-xs text-muted-foreground">
              {`Classement mensuel basé sur les taux de présence, salle correcte, pointage des ${studentLabels.pluralLower} et les scans de fin de cours.`}
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="ranking-month" className="text-[11px] uppercase text-muted-foreground">
                Mois
              </Label>
              <Input
                id="ranking-month"
                type="month"
                value={month}
                onChange={(event) => setMonth(event.target.value || getCurrentMonth())}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] uppercase text-muted-foreground">Matière</Label>
              <Select value={subject} onValueChange={setSubject}>
                <SelectTrigger>
                  <SelectValue placeholder="Matière" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les matières</SelectItem>
                  {subjectOptions.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <div className="grid gap-px bg-border sm:grid-cols-3">
          <div className="bg-background px-4 py-3">
            <p className="text-[11px] font-medium uppercase text-muted-foreground">Professeurs classés</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{rankedRows.length}</p>
          </div>
          <div className="bg-background px-4 py-3">
            <p className="text-[11px] font-medium uppercase text-muted-foreground">Meilleur taux</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{Math.round(topRate)}%</p>
          </div>
          <div className="bg-background px-4 py-3">
            <p className="text-[11px] font-medium uppercase text-muted-foreground">Moyenne</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{Math.round(averageRate)}%</p>
          </div>
        </div>
      </div>

      {complianceQuery.isError && complianceQuery.error ? (
        <Alert variant="destructive">
          <AlertDescription>
            {axios.isAxiosError(complianceQuery.error) && complianceQuery.error.response?.status === 404
              ? "Aucune donnée de classement disponible pour ce mois. Les professeurs doivent d'abord pointer pour apparaître ici."
              : "Impossible de charger le classement des professeurs. Vérifiez votre connexion."}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        {complianceQuery.isLoading ? ( 
          // Affiche des placeholders pendant le chargement du classement pour indiquer que les données sont en cours de récupération, ce qui améliore l'expérience utilisateur en évitant les écrans vides et en donnant un retour visuel sur l'état de chargement.
          Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-20 animate-pulse rounded-lg border bg-muted" />
          ))
        ) : rankedRows.length === 0 ? ( 
          // Affiche un état vide lorsque aucun classement n'est disponible pour les filtres sélectionnés
          <EmptyState
            icon={<AppIcon icon={TeachersIcon} size="md" className="text-muted-foreground" />}
            title="Aucun classement"
            message="Aucun scan de fin ne correspond aux filtres sélectionnés."
          />
        ) : (
          // Affiche les lignes du classement une fois les données chargées, en utilisant les données de conformité enrichies avec les informations des professeurs pour 
          // afficher les indicateurs et les matières enseignées, et en appliquant les styles et les indicateurs visuels pour chaque ligne du classement.
          rankedRows.map((teacher) => (
            <div
              key={teacher.teacherId}
              className="w-full rounded-lg border border-border bg-card p-4"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-muted text-sm font-semibold">
                    {teacher.rank}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{teacher.teacherName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {teacher.subjects.length > 0 ? teacher.subjects.join(", ") : "Matière non renseignée"}
                    </p>
                  </div>
                </div>
                <div className="min-w-0 md:w-80">
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      Taux de conformité
                    </span>
                    {/* // le taux de conformité est calculé à partir de plusieurs critères (présence, salle correcte, pointage des élèves, scans de fin) et représente la performance globale du professeur par rapport à ces critères.
                    // On affiche le taux de conformité arrondi à l'entier le plus proche, avec une mise en forme en pourcentage, pour donner une indication claire et rapide de la performance du professeur par rapport aux critères de conformité. */}
                    <span className="font-semibold">{Math.round(teacher.complianceRate)}%</span>
                  </div>
                  <Progress value={Math.max(0, Math.min(100, teacher.complianceRate))} />
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge title="Taux de présence: 20% du Total" variant="outline" className={teacher.attendanceRate > 80 ? "border-green-200 bg-green-50 text-green-700" : teacher.attendanceRate >= 50 ? "border-amber-200 bg-amber-50 text-amber-900" : "border-red-200 bg-red-50 text-red-700"}>
                  {/* // teacher.attendanceRate représente le taux de présence du professeur, calculé à partir des données de pointage et de présence, et est un indicateur clé de la régularité du professeur dans ses cours. */}
                  Présence {Math.round(teacher.attendanceRate)}%
                </Badge>
                <Badge title="Taux de scan de fin: 30% du Total" variant="outline" className={teacher.scanEndRate > 80 ? "border-green-200 bg-green-50 text-green-700" : teacher.scanEndRate >= 50 ? "border-amber-200 bg-amber-50 text-amber-900" : "border-red-200 bg-red-50 text-red-700"}>
                  Scan fin {Math.round(teacher.scanEndRate)}%
                </Badge>
                <Badge title="Taux de salle correcte: 25% du Total" variant="outline" className={teacher.roomCorrectRate > 80 ? "border-green-200 bg-green-50 text-green-700" : teacher.roomCorrectRate >= 50 ? "border-amber-200 bg-amber-50 text-amber-900" : "border-red-200 bg-red-50 text-red-700"}>
                  Salle correcte {Math.round(teacher.roomCorrectRate)}%
                </Badge>
                <Badge title={`Taux de pointage des ${studentLabels.pluralLower}: 25% du Total`} variant="outline" className={teacher.rollcallRate > 80 ? "border-green-200 bg-green-50 text-green-700" : teacher.rollcallRate >= 50 ? "border-amber-200 bg-amber-50 text-amber-900" : "border-red-200 bg-red-50 text-red-700"}>
                  Pointage {studentLabels.singularLower} {Math.round(teacher.rollcallRate)}%
                </Badge>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default function TeachersPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const user = useAuthStore((state) => state.user)
  const { hasPermission } = usePermissions()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const canToggleBlocked = hasPermission("teachers.block")
  const canCreateTeacher = hasPermission("teachers.create")
  const canViewTeacherAnalysis =
    hasPermission("teachers.attendance.view") || hasPermission("attendance.view")
  const canViewTeacherRanking =
    hasPermission("teachers.ranking.view") || hasPermission("attendance.view")
  const canResetTeacherPassword = hasPermission("teachers.password.reset")

  const [typeFilter, setTypeFilter] = useState<"all" | "vacataire" | "permanent">("all")
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all")
  const [subjectFilter, setSubjectFilter] = useState("")

  const [teacherForStatusChange, setTeacherForStatusChange] = useState<TeacherListItem | null>(null)
  const [blockReasonInput, setBlockReasonInput] = useState("")
  const [teacherForExport, setTeacherForExport] = useState<TeacherListItem | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [sendCredentialsConfirmOpen, setSendCredentialsConfirmOpen] = useState(false)
  const [exportPeriod, setExportPeriod] = useState(getDefaultExportPeriod)
  const rawTab = searchParams.get("tab")
  const activeTab =
    rawTab === "analyse" && canViewTeacherAnalysis
      ? rawTab
      : rawTab === "classement" && canViewTeacherRanking
        ? rawTab
        : "liste"
  const isExportPeriodValid =
    exportPeriod.dateFrom.length > 0 &&
    exportPeriod.dateTo.length > 0 &&
    exportPeriod.dateFrom <= exportPeriod.dateTo

  const last30Days = useMemo(() => getLast30DaysPeriod(), [])

  // La requête des professeurs est construite avec les filtres de type, statut et matière, ce qui permet d'affiner 
  // la liste des professeurs affichés dans le tableau en fonction des critères sélectionnés par l'utilisateur.
  const teachersQuery = useQuery({
    queryKey: ["teachers", typeFilter, statusFilter, subjectFilter],
    queryFn: () =>
      getTeachers({
        page: 1,
        limit: 100,
        type: typeFilter,
        is_active: statusFilter === "all" ? "all" : statusFilter === "active",
        subject: subjectFilter.trim() || undefined,
      }),
  })

  const teachers = teachersQuery.data?.data ?? []

  // On génère les options de matière à partir de tous les professeurs récupérés (et pas seulement ceux affichés) pour avoir 
  // une liste complète de matières, même si certains professeurs n'ont pas de matière renseignée ou si le classement actuel est filtré.
  const subjectOptions = useMemo(() => { 
    const set = new Set<string>()
    for (const teacher of teachers) {
      for (const subject of teacher.subjects) {
        const clean = subject.trim()
        if (clean.length > 0) set.add(clean)
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "fr"))
  }, [teachers])

  // On récupère les statistiques de présence pour tous les professeurs dans la période sélectionnée 
  // pour pouvoir afficher les taux de présence et autres indicateurs dans le tableau, en évitant les problèmes de données 
  // manquantes ou de cache incohérent qui pourraient survenir si on faisait une requête par professeur.
  const bulkStatsQuery = useQuery({
    queryKey: ["teacher-stats-bulk", last30Days.dateFrom, last30Days.dateTo],
    queryFn: () => fetchTeacherAttendanceStats({ from: last30Days.dateFrom, to: last30Days.dateTo }),
    staleTime: 1000 * 60 * 2,
  })

  // On construit une map des statistiques de présence par ID de professeur à partir des données de la requête en vrac, ce qui permet d'enrichir les données des 
  // professeurs dans le tableau avec les taux de présence et autres indicateurs, tout en gérant les cas où certaines données pourraient être manquantes (en utilisant des valeurs par défaut) et en évitant les problèmes de cache incohérent.
  const statsMap = useMemo<TeacherStatsMap>(() => { 
    const acc: TeacherStatsMap = {}
    for (const row of bulkStatsQuery.data ?? []) {
      acc[row.teacher_id] = {
        attendanceRate: row.attendance_rate ?? 0,
        hoursWorked: row.hours_done ?? 0,
        amountDue: 0,
      }
    }
    return acc
  }, [bulkStatsQuery.data])

  const sendCredentialsMutation = useMutation({
    mutationFn: () => sendCredentialsToTeachers(),
    onSuccess: async (data) => {
      setSendCredentialsConfirmOpen(false)
      await queryClient.invalidateQueries({ queryKey: ["teachers"] })
      const lines = [
        `${data.sentCount} email(s) envoyé(s).`,
        data.skippedNoEmailCount > 0 ? `${data.skippedNoEmailCount} prof(s) sans email ignoré(s).` : "",
        data.failedCount > 0 ? `${data.failedCount} échec(s) d'envoi.` : "",
      ].filter(Boolean)
      toast({
        title: "Envoi des identifiants",
        description: lines.join(" "),
        variant: data.failedCount > 0 ? "destructive" : "default",
      })
    },
    onError: () => {
      setSendCredentialsConfirmOpen(false)
      toast({
        title: "Erreur",
        description: "Impossible d'envoyer les identifiants.",
        variant: "destructive",
      })
    },
  })

  const createMutation = useMutation({
    mutationFn: createTeacher,
    onSuccess: async () => {
      setCreateOpen(false)
      await queryClient.invalidateQueries({ queryKey: ["teachers"] })
      toast({ title: "Professeur ajouté" })
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: getApiErrorMessage(error, "Impossible d'ajouter le professeur."),
        variant: "destructive",
      })
    },
  })

  const closeStatusDialog = () => {
    setTeacherForStatusChange(null)
    setBlockReasonInput("")
  }

  // Mutation de blocage - cible teachers.is_blocked via blockTeacher/unblockTeacher
  // toggleBlockMutation gère à la fois le blocage et le déblocage des professeurs en fonction de leur statut actuel, ce qui simplifie la logique de gestion du statut 
  // et évite la nécessité de créer deux mutations distinctes pour ces actions.
  const toggleBlockMutation = useMutation({
    mutationFn: ({ teacher, reason }: { teacher: TeacherListItem; reason: string }) =>
      teacher.isBlocked ? unblockTeacher(teacher.id) : blockTeacher(teacher.id, reason),
    onSuccess: async (_, variables) => {
      closeStatusDialog()
      await queryClient.invalidateQueries({ queryKey: ["teachers"] })
      toast({
        title: variables.teacher.isBlocked ? "Professeur débloqué" : "Professeur bloqué",
      })
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: getApiErrorMessage(error, "Impossible de modifier le statut."),
        variant: "destructive",
      })
    },
  })

  const hoursExport = usePdfExportJob({
    fallbackFileName: "bilan-heures.pdf",
    startedMessage: "Le bilan des heures (PDF) est en cours de génération.",
    successMessage: "Bilan des heures téléchargé",
    errorMessage: "Impossible d'exporter les heures du professeur.",
  })

  const tableData = useMemo<TeacherTableRow[]>(
    () =>
      teachers.map((teacher) => ({
        ...teacher,
        name: teacher.fullName,
        attendanceRate: statsMap[teacher.id]?.attendanceRate ?? 0,
      })),
    [statsMap, teachers]
  )

  const activeCount = useMemo(
    () => tableData.filter((teacher) => !teacher.isBlocked).length,
    [tableData]
  )
  const blockedCount = Math.max(tableData.length - activeCount, 0)
  const vacataireCount = tableData.filter((teacher) => teacher.type === "vacataire").length
  const permanentCount = tableData.filter((teacher) => teacher.type === "permanent").length
  const subjectsVisibleCount = subjectOptions.length

  const columns = useMemo<ColumnDef<TeacherTableRow>[]>(
    () => [
      {
        id: "name",
        accessorFn: (row) => row.name,
        header: ({ column }) => <SortableHeader column={column} label="Nom" />,
        cell: ({ row }) => (
          <div className="flex min-w-0 items-center gap-3">
            <Avatar className="h-8 w-8 flex-shrink-0">
              <AvatarFallback>{initials(row.original.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{row.original.name}</p>
              <p className="text-xs text-muted-foreground">@{row.original.username}</p>
              {row.original.matricule ? (
                <p className="truncate text-xs text-muted-foreground">Matricule : {row.original.matricule}</p>
              ) : null}
            </div>
          </div>
        ),
      },
      {
        accessorKey: "subjects",
        header: "Matières",
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {row.original.subjects.slice(0, 2).map((subject) => (
              <Badge key={subject} variant="secondary">
                {subject}
              </Badge>
            ))}
            {row.original.subjects.length > 2 ? (
              <Badge variant="outline">+{row.original.subjects.length - 2}</Badge>
            ) : null}
          </div>
        ),
        enableSorting: false,
      },
      {
        accessorKey: "type",
        header: "Type",
        cell: ({ row }) => (
          <Badge variant={row.original.type === "vacataire" ? "default" : "secondary"}>
            {row.original.type}
          </Badge>
        ),
      },
      {
        accessorKey: "isBlocked",
        header: "Statut",
        cell: ({ row }) => (
          <Badge variant={row.original.isBlocked ? "destructive" : "secondary"}>
            {row.original.isBlocked ? "Bloqué" : "Actif"}
          </Badge>
        ),
      },
      {
        id: "actions",
        cell: ({ row }) => (
          <TeacherRowActions
            teacher={row.original}
            onViewProfile={() => navigate(`/teachers/${row.original.id}`)}
            onToggleBlocked={() => {
              setTeacherForStatusChange(row.original)
              setBlockReasonInput("")
            }}
            onExportPdf={() => {
              setTeacherForExport(row.original)
              setExportPeriod(getDefaultExportPeriod())
            }}
            canToggleBlocked={canToggleBlocked}
          />
        ),
      },
    ],
    [canToggleBlocked, navigate]
  )

  const tour = useTourGuide("teachers", Boolean(user && (user.role === "director" || isStaffRole(user.role))))

  if (!user) return null

  if (user.role !== "director" && !isStaffRole(user.role)) {
    return (
      <div className="p-4 md:p-6">
        <Alert variant="destructive">
          <AlertDescription>
            Cette page est réservée à la direction et au staff.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <>
    <TourGuide
      steps={teachersTourSteps}
      run={tour.run}
      stepIndex={tour.stepIndex}
      onStepChange={tour.setStepIndex}
      onFinish={tour.markDone}
    />
    <PageLayout
      title={`Professeurs`}
      subtitle="Gestion des profs, blocage et export"
      actions={
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
          <div className="flex flex-wrap gap-2" data-tour="teachers-actions">
          {canResetTeacherPassword ? (
            <OfflineGuard>
              <Button
                type="button"
                variant="outline"
                disabled={sendCredentialsMutation.isPending}
                onClick={() => setSendCredentialsConfirmOpen(true)}
                title="Envoie un email avec un mot de passe temporaire aux profs qui n'ont jamais reçu leurs identifiants."
              >
                {sendCredentialsMutation.isPending ? "Envoi..." : "Envoyer les identifiants"}
              </Button>
            </OfflineGuard>
          ) : null}
          {canCreateTeacher ? (
            <OfflineGuard>
              <Button type="button" onClick={() => setCreateOpen(true)}>
                <AddIcon className="mr-2 h-4 w-4" />
                Ajouter un prof
              </Button>
            </OfflineGuard>
          ) : null}
          </div>
        </div>
      }
    >
      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          const next = new URLSearchParams(searchParams)
          next.set("tab", value)
          setSearchParams(next, { replace: true })
        }}
        className="space-y-4"
        data-tour="teachers-tabs"
      >
        <TabsList
          className={cn(
            "grid h-auto w-full rounded-xl border border-border bg-muted/50 p-1 sm:w-full",
            canViewTeacherAnalysis && canViewTeacherRanking
              ? "grid-cols-3 md:w-[620px]"
              : canViewTeacherAnalysis || canViewTeacherRanking
                ? "grid-cols-2 md:w-[420px]"
                : "grid-cols-1 md:w-[220px]"
          )}
        >
          <TabsTrigger value="liste" className="min-h-12 rounded-lg text-sm font-medium" data-tour="teachers-tab-liste">Liste</TabsTrigger>
          {canViewTeacherAnalysis ? (
            <TabsTrigger value="analyse" className="min-h-12 rounded-lg text-sm font-medium" data-tour="teachers-tab-analyse">Analyse présence</TabsTrigger>
          ) : null}
          {canViewTeacherRanking ? (
            <TabsTrigger value="classement" className="min-h-12 rounded-lg text-sm font-medium" data-tour="teachers-tab-classement">Classement</TabsTrigger>
          ) : null}
        </TabsList>

        <TabsContent value="liste" className="space-y-6">
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="flex flex-col gap-4 bg-[var(--surface-chrome)] px-4 py-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-semibold">Pilotage professeurs</p>
                <p className="text-xs text-muted-foreground">
                  Les statuts RH, les types de contrat et les matières visibles sont regroupés avant la table.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="rounded-md px-2.5 py-1">
                  {teachersQuery.isLoading ? "..." : `${activeCount} actifs`}
                </Badge>
                <Badge variant={blockedCount > 0 ? "destructive" : "secondary"} className="rounded-md px-2.5 py-1">
                  {teachersQuery.isLoading ? "..." : `${blockedCount} bloqués`}
                </Badge>
                <Badge variant="outline" className="rounded-md px-2.5 py-1">
                  {teachersQuery.isLoading ? "..." : `${subjectsVisibleCount} matières`}
                </Badge>
              </div>
            </div>
            <div className="grid gap-px bg-border sm:grid-cols-3">
              <div className="bg-background px-4 py-3">
                <p className="text-[11px] font-medium uppercase text-muted-foreground">Vacataires</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">{teachersQuery.isLoading ? "-" : vacataireCount}</p>
              </div>
              <div className="bg-background px-4 py-3">
                <p className="text-[11px] font-medium uppercase text-muted-foreground">Permanents</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">{teachersQuery.isLoading ? "-" : permanentCount}</p>
              </div>
              <div className="bg-background px-4 py-3">
                <p className="text-[11px] font-medium uppercase text-muted-foreground">Filtre actif</p>
                <p className="mt-1 truncate text-sm font-medium">
                  {typeFilter === "all" && statusFilter === "all" && !subjectFilter ? "Tous les professeurs" : "Vue affinée"}
                </p>
              </div>
            </div>
          </div>

          <div
            className="space-y-4 rounded-lg border border-border bg-card p-4 shadow-sm"
            data-testid="teachers-filters"
            data-tour="teachers-filters"
          >
            <div className="grid gap-3 md:grid-cols-3">
              <Select
                value={typeFilter}
                onValueChange={(value: "all" | "vacataire" | "permanent") => setTypeFilter(value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les types</SelectItem>
                  <SelectItem value="vacataire">Vacataires</SelectItem>
                  <SelectItem value="permanent">Permanents</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={statusFilter}
                onValueChange={(value: "all" | "active" | "inactive") => setStatusFilter(value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="active">Actifs</SelectItem>
                  <SelectItem value="inactive">Bloqués</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={subjectFilter || "all"}
                onValueChange={(value) => setSubjectFilter(value === "all" ? "" : value)}
              >
                <SelectTrigger data-testid="teachers-subject-filter-input">
                  <SelectValue placeholder="Filtrer par matière" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les matières</SelectItem>
                  {subjectOptions.map((subject) => (
                    <SelectItem key={subject} value={subject}>
                      {subject}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {teachersQuery.isError ? (
            <Alert variant="destructive">
              <AlertDescription>Impossible de charger la liste des professeurs.</AlertDescription>
            </Alert>
          ) : null}

          {!teachersQuery.isError ? (
            <div data-testid="teachers-list-table">
              <DataTable
                columns={columns}
                data={tableData}
                isLoading={teachersQuery.isLoading}
                searchKey="name"
                searchPlaceholder="Rechercher un professeur"
                pageSize={20}
                onRowClick={(teacher) => navigate(`/teachers/${teacher.id}`)}
                emptyState={
                  <EmptyState
                    icon={<AppIcon icon={TeachersIcon} size="md" className="text-muted-foreground" />}
                    title="Aucun professeur"
                    message="Ajoutez un professeur ou ajustez les filtres pour afficher des résultats."
                    action={canCreateTeacher ? { label: "Ajouter un professeur", onClick: () => setCreateOpen(true), icon: AddIcon } : undefined}
                  />
                }
                mobileCard={(teacher) => (
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-auto w-full justify-start gap-3 whitespace-normal rounded-xl border bg-card p-4 text-left shadow-sm hover:border-primary/30 hover:bg-card hover:shadow-md"
                    onClick={() => navigate(`/teachers/${teacher.id}`)}
                    data-testid="teacher-mobile-card"
                  >
                    <Avatar className="h-10 w-10 flex-shrink-0">
                      <AvatarFallback className="text-sm">{initials(teacher.name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{teacher.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {teacher.subjects.join(", ")}
                      </p>
                      {teacher.matricule ? (
                        <p className="truncate text-xs text-muted-foreground">Matricule : {teacher.matricule}</p>
                      ) : null}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge
                        variant={teacher.isBlocked ? "destructive" : "secondary"}
                        className="text-xs"
                      >
                        {teacher.isBlocked ? "Bloqué" : "Actif"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{teacher.attendanceRate}%</span>
                    </div>
                    <ChevronRightIcon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  </Button>
                )}
              />
            </div>
          ) : null}
        </TabsContent>

        {canViewTeacherAnalysis ? (
          <TabsContent value="analyse">
            <TeacherAnalysisPanel />
          </TabsContent>
        ) : null}

        {canViewTeacherRanking ? (
          <TabsContent value="classement">
            <TeacherRankingPanel teachers={teachers} />
          </TabsContent>
        ) : null}
      </Tabs>

      {/* ── Modal : créer un professeur ── */}
      {canCreateTeacher ? (
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ajouter un professeur</DialogTitle>
              <DialogDescription>
                Renseignez les informations du nouveau professeur.
              </DialogDescription>
            </DialogHeader>
            <TeacherForm
              isPending={createMutation.isPending}
              submitLabel="Créer le professeur"
              onSubmit={async (payload) => {
                await createMutation.mutateAsync(payload)
              }}
            />
          </DialogContent>
        </Dialog>
      ) : null}

      {/* ── Modal : bloquer / débloquer ── */}
      {canToggleBlocked ? (
        <Dialog
          open={Boolean(teacherForStatusChange)}
          onOpenChange={(open) => { if (!open) closeStatusDialog() }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {teacherForStatusChange?.isBlocked
                  ? "Débloquer le professeur"
                  : "Bloquer le professeur"}
              </DialogTitle>
              <DialogDescription>
                {teacherForStatusChange?.isBlocked
                  ? "Le professeur retrouvera l'accès à ses actions habituelles."
                  : "Saisissez le motif du blocage pour continuer."}
              </DialogDescription>
            </DialogHeader>

            {/* Motif uniquement pour le blocage */}
            {!teacherForStatusChange?.isBlocked ? (
              <div className="space-y-2">
                <Label htmlFor="teacher-block-reason">Raison du blocage</Label>
                <Input
                  id="teacher-block-reason"
                  value={blockReasonInput}
                  onChange={(event) => setBlockReasonInput(event.target.value)}
                  placeholder="Ex: Dossier RH incomplet"
                  data-testid="teachers-list-block-reason-input"
                />
              </div>
            ) : null}

            <DialogFooter>
              <Button variant="outline" onClick={closeStatusDialog}>
                Annuler
              </Button>
              <Button
                variant={teacherForStatusChange?.isBlocked ? "secondary" : "destructive"}
                disabled={
                  toggleBlockMutation.isPending ||
                  (!teacherForStatusChange?.isBlocked && blockReasonInput.trim().length === 0)
                }
                onClick={() => {
                  if (!teacherForStatusChange) return
                  void toggleBlockMutation.mutateAsync({
                    teacher: teacherForStatusChange,
                    reason: blockReasonInput.trim(),
                  })
                }}
              >
                {toggleBlockMutation.isPending
                  ? "Traitement..."
                  : teacherForStatusChange?.isBlocked
                    ? "Débloquer"
                    : "Bloquer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}

      {/* ── Modal : export heures ── */}
      <Dialog
        open={Boolean(teacherForExport)}
        onOpenChange={(open) => !open && setTeacherForExport(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Exporter PDF</DialogTitle>
            <DialogDescription>
              Sélectionnez la période d'export pour {teacherForExport?.fullName}.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="teacher-export-from">Date de début</Label>
              <Input
                id="teacher-export-from"
                type="date"
                value={exportPeriod.dateFrom}
                onChange={(event) =>
                  setExportPeriod((current) => ({ ...current, dateFrom: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="teacher-export-to">Date de fin</Label>
              <Input
                id="teacher-export-to"
                type="date"
                value={exportPeriod.dateTo}
                onChange={(event) =>
                  setExportPeriod((current) => ({ ...current, dateTo: event.target.value }))
                }
              />
            </div>
          </div>

          {!isExportPeriodValid ? (
            <Alert variant="destructive">
              <AlertDescription>La date de début doit être antérieure ou égale à la date de fin.</AlertDescription>
            </Alert>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setTeacherForExport(null)}>
              Annuler
            </Button>
            <Button
              disabled={hoursExport.isRunning || !isExportPeriodValid}
              onClick={() => {
                if (!teacherForExport) return
                const teacherId = teacherForExport.id
                setTeacherForExport(null)
                void hoursExport.launch(() =>
                  exportTeacherHours({
                    teacherId,
                    dateFrom: exportPeriod.dateFrom,
                    dateTo: exportPeriod.dateTo,
                  })
                )
              }}
            >
              {hoursExport.isRunning ? "Génération du PDF..." : "Exporter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {canResetTeacherPassword ? (
        <ConfirmActionDialog
          open={sendCredentialsConfirmOpen}
          onOpenChange={(open) => {
            if (!sendCredentialsMutation.isPending) setSendCredentialsConfirmOpen(open)
          }}
          title="Envoyer les identifiants aux professeurs"
          description="Cette action concerne tous les professeurs qui n'ont pas encore reçu leurs identifiants."
          consequences={[
            "Un nouveau mot de passe temporaire est généré pour chaque professeur ciblé.",
            "Un email leur est envoyé avec leurs identifiants.",
            "Les professeurs sans email renseigné sont ignorés (un récapitulatif est affiché après l'envoi).",
            "L'éventuel mot de passe précédent de ces comptes est invalidé.",
            "Le professeur devra changer son mot de passe à sa prochaine connexion.",
          ]}
          confirmLabel="Confirmer l'envoi"
          pendingLabel="Envoi..."
          isPending={sendCredentialsMutation.isPending}
          onConfirm={() => sendCredentialsMutation.mutate()}
        />
      ) : null}
    </PageLayout>
    </>
  )
}
