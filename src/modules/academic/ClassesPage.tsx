import { useEffect, useMemo, useRef, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { ColumnDef } from "@tanstack/react-table"
import axios from "axios"

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
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ToastAction } from "@/components/ui/toast"
import { useToast } from "@/components/ui/use-toast"
import {
  archiveClass,
  createClass,
  listClasses,
  listLevels,
  listSchoolYears,
  updateClass,
  type ClassPayload,
  type SchoolClass,
} from "@/modules/academic/academic.api"
import { AcademicNavigation } from "@/modules/academic/components/AcademicNavigation"
import { ClassDialog } from "@/modules/academic/components/AcademicDialogs"
import { getAllTeachers } from "@/modules/teachers/teachers.api"
import { DataTable, EmptyState, PageLayout, QueryErrorState, Spinner } from "@/shared/components"
import { AddIcon, ClassIcon, DeleteIcon, EditIcon } from "@/shared/components/icons"
import { usePermissions } from "@/shared/hooks/usePermissions"
import { useAuthStore } from "@/shared/store/auth.store"
import { readEnrollmentClassDraft } from "@/shared/lib/enrollment-class-flow"

const SCHOOL_YEARS_KEY = ["academic", "school-years"] as const
const LEVELS_KEY = ["academic", "levels"] as const
const apiErrorMessage = (error: unknown, fallback: string) =>
  axios.isAxiosError(error) && typeof error.response?.data?.error === "string"
    ? error.response.data.error
    : error instanceof Error && error.message
      ? error.message
      : fallback

export default function ClassesPage() {
  const location = useLocation()
  return <ClassesContent key={location.key} />
}

function ClassesContent() {
  const location = useLocation()
  const navigate = useNavigate()
  const [enrollmentContext] = useState(() => readEnrollmentClassDraft(location.state)?.context)
  const contextOpened = useRef(false)
  const [createdClassId, setCreatedClassId] = useState<string>()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const user = useAuthStore((state) => state.user)
  const { hasPermission } = usePermissions()
  const isDirector = user?.role === "director"
  const canCreate = isDirector || hasPermission("classes.create")
  const canEdit = isDirector || hasPermission("classes.edit")
  const canArchive = isDirector || hasPermission("classes.delete")
  const canViewSchoolYears = isDirector || hasPermission("school_years.view")
  const [selectedSchoolYearId, setSelectedSchoolYearId] = useState(enrollmentContext?.schoolYearId ?? "")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedClass, setSelectedClass] = useState<SchoolClass | null>(null)
  const [classPendingArchive, setClassPendingArchive] = useState<SchoolClass | null>(null)

  const schoolYearsQuery = useQuery({
    queryKey: SCHOOL_YEARS_KEY,
    queryFn: listSchoolYears,
    enabled: canViewSchoolYears,
    refetchOnMount: enrollmentContext ? "always" : true,
  })
  const levelsQuery = useQuery({ queryKey: LEVELS_KEY, queryFn: listLevels, refetchOnMount: enrollmentContext ? "always" : true })
  const classesKey = ["academic", "classes", selectedSchoolYearId || "active"] as const
  const classesQuery = useQuery({
    queryKey: classesKey,
    queryFn: () => listClasses(selectedSchoolYearId || undefined, { requireServer: Boolean(enrollmentContext) }),
    refetchOnMount: enrollmentContext ? "always" : true,
  })
  const activeSchoolYear =
    classesQuery.data?.activeSchoolYear ??
    schoolYearsQuery.data?.find((year) => year.status === "active") ??
    null
  const activeSchoolYearId = activeSchoolYear?.id
  const contextInvalid = Boolean(enrollmentContext && (
    activeSchoolYearId !== enrollmentContext.schoolYearId
    || !levelsQuery.data?.some((level) => level.id === enrollmentContext.levelId)
  ))
  const contextLoading = classesQuery.isFetching || classesQuery.isPaused || levelsQuery.isFetching || levelsQuery.isPaused
    || (canViewSchoolYears && (schoolYearsQuery.isFetching || schoolYearsQuery.isPaused))
  const contextError = classesQuery.isError || levelsQuery.isError || (canViewSchoolYears && schoolYearsQuery.isError)
  const effectiveSchoolYearId =
    selectedSchoolYearId ||
    classesQuery.data?.schoolYear?.id ||
    activeSchoolYear?.id ||
    ""
  const teachersQuery = useQuery({
    queryKey: ["teachers", "academic", "homeroom-options"],
    queryFn: getAllTeachers,
    enabled: dialogOpen && (isDirector || hasPermission("teachers.view")),
    staleTime: 60_000,
  })

  useEffect(() => {
    if (!enrollmentContext || contextOpened.current || contextLoading || contextError || contextInvalid || !canCreate) return
    contextOpened.current = true
    setDialogOpen(true)
  }, [enrollmentContext, contextLoading, contextError, contextInvalid, canCreate])

  const saveMutation = useMutation({
    mutationFn: ({ schoolClass, payload }: { schoolClass: SchoolClass | null; payload: ClassPayload }) => {
      if (enrollmentContext && (contextInvalid || contextLoading || contextError || !readEnrollmentClassDraft(enrollmentContext))) {
        throw new Error("Le contexte a expiré ou l’année scolaire a changé. Revenez à l’inscription.")
      }
      return schoolClass ? updateClass(schoolClass.id, payload) : createClass({
        ...payload, ...(enrollmentContext ? { expectedSchoolYearId: enrollmentContext.schoolYearId } : {}),
      })
    },
    onSuccess: async (saved, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["academic", "classes"] })
      setSelectedSchoolYearId(saved.schoolYear.id)
      setDialogOpen(false)
      setSelectedClass(null)
      if (enrollmentContext && !variables.schoolClass) setCreatedClassId(saved.id)
      toast({ title: variables.schoolClass ? "Classe mise à jour" : "Classe ajoutée", duration: 3000 })
    },
    onError: (error, variables) => toast({
      title: "Enregistrement impossible", description: apiErrorMessage(error, "Vérifiez le nom, le niveau et le professeur principal."), variant: "destructive", duration: 6000,
      action: <ToastAction altText="Réessayer l’enregistrement de la classe" onClick={() => saveMutation.mutate(variables)}>Réessayer</ToastAction>,
    }),
  })
  const archiveMutation = useMutation({
    mutationFn: archiveClass,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["academic", "classes"] })
      setClassPendingArchive(null)
      toast({ title: "Classe archivée" })
    },
    onError: (error) => toast({ title: "Archivage impossible", description: apiErrorMessage(error, "La classe n’a pas pu être archivée."), variant: "destructive" }),
  })

  const openCreate = () => { if (enrollmentContext && (contextInvalid || contextLoading || contextError || createdClassId)) return; setSelectedClass(null); setDialogOpen(true) }
  const openEdit = (schoolClass: SchoolClass) => { setSelectedClass(schoolClass); setDialogOpen(true) }
  const isActiveClass = (schoolClass: SchoolClass) => schoolClass.schoolYear.id === activeSchoolYearId
  const columns = useMemo<ColumnDef<SchoolClass>[]>(() => [
    { accessorKey: "name", header: "Classe", cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
    { id: "level", header: "Niveau", cell: ({ row }) => row.original.level.name },
    { id: "teacher", header: "Professeur principal", cell: ({ row }) => row.original.homeroomTeacher?.name ?? <span className="text-muted-foreground">Non attribué</span> },
    { accessorKey: "studentCount", header: "Élèves confirmés" },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => row.original.schoolYear.id === activeSchoolYearId && (canEdit || canArchive) ? (
        <div className="flex flex-wrap gap-1">
          {canEdit ? <Button type="button" variant="ghost" size="sm" onClick={() => openEdit(row.original)}><EditIcon className="mr-2 h-4 w-4" />Modifier</Button> : null}
          {canArchive ? <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => setClassPendingArchive(row.original)}><DeleteIcon className="mr-2 h-4 w-4" />Archiver</Button> : null}
        </div>
      ) : <Badge variant="outline">Lecture seule</Badge>,
    },
  ], [activeSchoolYearId, canArchive, canEdit])

  const pageError = (canViewSchoolYears && schoolYearsQuery.isError) || levelsQuery.isError
  const selectedYear =
    schoolYearsQuery.data?.find((year) => year.id === effectiveSchoolYearId) ??
    classesQuery.data?.schoolYear ??
    null

  return (
    <PageLayout
      title="Structure scolaire"
      subtitle="Gérez les classes de chaque année et attribuez leur professeur principal."
      actions={canCreate && !createdClassId ? <Button type="button" className="min-h-12" onClick={openCreate} disabled={!activeSchoolYear || Boolean(enrollmentContext && (contextInvalid || contextLoading || contextError))}><AddIcon className="mr-2 h-4 w-4" />Ajouter une classe</Button> : undefined}
    >
      <AcademicNavigation />
      {enrollmentContext ? (
        <Alert>
          <AlertDescription className="space-y-3">
            <p>{createdClassId ? "Classe créée. Vous pouvez reprendre le dossier d’inscription." : contextLoading ? "Vérification de l’année et du niveau…" : contextInvalid ? "L’année active ou le niveau a changé. Revenez au dossier pour vérifier la sélection." : !canCreate ? "La création de classes doit être effectuée par le directeur ou un responsable autorisé." : "Créez la classe puis revenez au dossier. Votre brouillon est conservé temporairement."}</p>
            <Button type="button" variant="outline" className="min-h-12" disabled={saveMutation.isPending} onClick={() => navigate(enrollmentContext.returnTo, { state: { ...enrollmentContext, ...(createdClassId ? { createdClassId } : {}) } })}>Retour à l’inscription</Button>
          </AlertDescription>
        </Alert>
      ) : location.state ? <Alert><AlertDescription>Le contexte d’inscription n’est plus disponible. Rouvrez le dossier depuis les inscriptions.</AlertDescription></Alert> : null}
      <div className="flex flex-col gap-2 sm:max-w-sm">
        <Label htmlFor="school-year-filter">Année scolaire</Label>
        {canViewSchoolYears ? (
          <Select value={effectiveSchoolYearId} onValueChange={setSelectedSchoolYearId} disabled={schoolYearsQuery.isLoading || (schoolYearsQuery.data?.length ?? 0) === 0}>
            <SelectTrigger id="school-year-filter"><SelectValue placeholder="Sélectionner une année" /></SelectTrigger>
            <SelectContent>
              {(schoolYearsQuery.data ?? []).map((year) => <SelectItem key={year.id} value={year.id}>{year.label}{year.status === "active" ? " (active)" : ""}</SelectItem>)}
            </SelectContent>
          </Select>
        ) : (
          <div className="flex min-h-10 items-center rounded-md border bg-muted/30 px-3 text-sm" aria-live="polite">
            {classesQuery.isLoading ? "Chargement de l’année active…" : activeSchoolYear?.label ?? "Aucune année scolaire active"}
          </div>
        )}
        {selectedYear && selectedYear.status !== "active" ? <p className="text-xs text-muted-foreground">Les classes d’une année non active sont disponibles en lecture seule.</p> : null}
      </div>

      {pageError ? (
        <QueryErrorState onRetry={() => { if (canViewSchoolYears) void schoolYearsQuery.refetch(); void levelsQuery.refetch() }} isRetrying={schoolYearsQuery.isFetching || levelsQuery.isFetching} message="Impossible de charger les référentiels scolaires." />
      ) : classesQuery.isError ? (
        <QueryErrorState onRetry={() => void classesQuery.refetch()} isRetrying={classesQuery.isFetching} message="Impossible de charger les classes de cette année." />
      ) : (
        <DataTable
          columns={columns}
          data={classesQuery.data?.classes ?? []}
          isLoading={classesQuery.isLoading || levelsQuery.isLoading || (canViewSchoolYears && schoolYearsQuery.isLoading)}
          searchKey="name"
          searchPlaceholder="Rechercher une classe…"
          emptyState={<EmptyState icon={ClassIcon} title="Aucune classe" message={activeSchoolYear ? "Aucune classe n’est enregistrée pour cette année scolaire." : "Activez une année scolaire avant d’ajouter des classes."} action={canCreate && activeSchoolYear ? { label: "Ajouter une classe", onClick: openCreate, icon: AddIcon } : undefined} />}
          mobileCard={(schoolClass) => (
            <div className="space-y-3 rounded-lg border bg-card p-4">
              <div><p className="font-medium">{schoolClass.name}</p><p className="text-sm text-muted-foreground">{schoolClass.level.name} · {schoolClass.studentCount} {schoolClass.studentCount > 1 ? "élèves confirmés" : "élève confirmé"}</p></div>
              <p className="text-sm">Professeur principal : <span className="text-muted-foreground">{schoolClass.homeroomTeacher?.name ?? "Non attribué"}</span></p>
              {isActiveClass(schoolClass) && (canEdit || canArchive) ? <div className="grid grid-cols-2 gap-2">{canEdit ? <Button type="button" variant="outline" size="sm" onClick={() => openEdit(schoolClass)}><EditIcon className="mr-2 h-4 w-4" />Modifier</Button> : null}{canArchive ? <Button type="button" variant="outline" size="sm" className="text-destructive" onClick={() => setClassPendingArchive(schoolClass)}><DeleteIcon className="mr-2 h-4 w-4" />Archiver</Button> : null}</div> : <Badge variant="outline">Lecture seule</Badge>}
            </div>
          )}
        />
      )}

      <ClassDialog
        open={dialogOpen}
        isPending={saveMutation.isPending}
        canSubmit={!enrollmentContext || (!contextLoading && !contextError && !contextInvalid)}
        schoolClass={selectedClass}
        levels={levelsQuery.data ?? []}
        teachers={teachersQuery.data ?? []}
        teachersLoading={teachersQuery.isLoading}
        initialLevelId={enrollmentContext && !contextInvalid ? enrollmentContext.levelId : undefined}
        onOpenChange={setDialogOpen}
        onSubmit={(payload) => saveMutation.mutate({ schoolClass: selectedClass, payload })}
      />
      <AlertDialog open={Boolean(classPendingArchive)} onOpenChange={(open) => { if (!open) setClassPendingArchive(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archiver cette classe ?</AlertDialogTitle>
            <AlertDialogDescription>La classe {classPendingArchive?.name} ne sera plus proposée dans les listes actives. Cette action ne supprime pas son historique.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archiveMutation.isPending}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={archiveMutation.isPending}
              onClick={(event) => {
                event.preventDefault()
                if (classPendingArchive) archiveMutation.mutate(classPendingArchive.id)
              }}
            >
              {archiveMutation.isPending ? <Spinner size="sm" className="mr-2 text-current" /> : null}
              {archiveMutation.isPending ? "Archivage…" : "Archiver"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageLayout>
  )
}
