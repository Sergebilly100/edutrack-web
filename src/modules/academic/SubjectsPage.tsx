import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { ColumnDef } from "@tanstack/react-table"
import axios from "axios"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import {
  createSubjectsBulk,
  listClasses,
  listLevels,
  listSubjects,
  updateSubjectsBulk,
  type Subject,
} from "@/modules/academic/academic.api"
import { AcademicNavigation } from "@/modules/academic/components/AcademicNavigation"
import { SubjectBulkDialog, SubjectGroupDialog } from "@/modules/academic/components/AcademicDialogs"
import { DataTable, EmptyState, PageLayout, QueryErrorState } from "@/shared/components"
import { AddIcon, ClassIcon, EditIcon } from "@/shared/components/icons"
import { usePermissions } from "@/shared/hooks/usePermissions"

const LEVELS_KEY = ["academic", "levels"] as const
const SUBJECTS_KEY = ["academic", "subjects"] as const

type SubjectGroup = {
  key: string
  name: string
  subjects: Subject[]
}

const apiErrorMessage = (error: unknown, fallback: string) =>
  axios.isAxiosError(error) && typeof error.response?.data?.error === "string"
    ? error.response.data.error
    : error instanceof Error && error.message
      ? error.message
      : fallback

export default function SubjectsPage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { hasPermission } = usePermissions()
  const canEdit = hasPermission("classes.edit")
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState<SubjectGroup | null>(null)
  const levelsQuery = useQuery({ queryKey: LEVELS_KEY, queryFn: listLevels })
  const subjectsQuery = useQuery({ queryKey: SUBJECTS_KEY, queryFn: () => listSubjects() })
  const classesQuery = useQuery({ queryKey: ["academic", "classes-for-subjects"], queryFn: () => listClasses() })
  const bulkSaveMutation = useMutation({
    mutationFn: createSubjectsBulk,
    onSuccess: async (subjects) => {
      await queryClient.invalidateQueries({ queryKey: SUBJECTS_KEY })
      setBulkDialogOpen(false)
      toast({ title: `${subjects.length} matière${subjects.length > 1 ? "s" : ""} ajoutée${subjects.length > 1 ? "s" : ""}` })
    },
    onError: (error) => toast({
      title: "Enregistrement impossible",
      description: apiErrorMessage(error, "Vérifiez les niveaux et les coefficients."),
      variant: "destructive",
    }),
  })
  const groupSaveMutation = useMutation({
    mutationFn: updateSubjectsBulk,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: SUBJECTS_KEY })
      setDialogOpen(false)
      setSelectedGroup(null)
      toast({ title: "Matière mise à jour" })
    },
    onError: (error) => toast({
      title: "Enregistrement impossible",
      description: apiErrorMessage(error, "Vérifiez le nom et les coefficients."),
      variant: "destructive",
    }),
  })

  const openCreate = () => {
    setBulkDialogOpen(true)
  }
  const openEdit = (group: SubjectGroup) => {
    setSelectedGroup(group)
    setDialogOpen(true)
  }
  const subjectGroups = useMemo<SubjectGroup[]>(() => {
    const grouped = new Map<string, SubjectGroup>()
    for (const subject of subjectsQuery.data ?? []) {
      const key = subject.name.trim().toLocaleLowerCase("fr")
      const group = grouped.get(key)
      if (group) group.subjects.push(subject)
      else grouped.set(key, { key, name: subject.name, subjects: [subject] })
    }
    return [...grouped.values()].sort((left, right) => left.name.localeCompare(right.name, "fr"))
  }, [subjectsQuery.data])
  const columns = useMemo<ColumnDef<SubjectGroup>[]>(() => [
    { accessorKey: "name", header: "Matière", cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
    {
      id: "assignments",
      header: "Niveaux et coefficients",
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-2">
          {row.original.subjects.map((subject) => (
            <Badge key={subject.id} variant="outline" className="font-normal">
              {subject.levelName} <span className="ml-1 text-muted-foreground">Coef. {subject.coefficient}</span>
            </Badge>
          ))}
        </div>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => canEdit ? (
        <Button type="button" variant="ghost" size="sm" className="min-h-12" onClick={() => openEdit(row.original)}>
          <EditIcon className="mr-2 h-4 w-4" />Modifier
        </Button>
      ) : null,
    },
  ], [canEdit])

  const pageError = levelsQuery.isError || subjectsQuery.isError
  const classesByLevel = useMemo(() => {
    const counts = new Map<string, number>()
    for (const schoolClass of classesQuery.data?.classes ?? []) {
      counts.set(schoolClass.level.id, (counts.get(schoolClass.level.id) ?? 0) + 1)
    }
    return counts
  }, [classesQuery.data?.classes])

  return (
    <PageLayout
      title="Structure scolaire"
      subtitle="Gérez les matières enseignées et leur coefficient par niveau."
      actions={canEdit ? (
        <Button type="button" onClick={openCreate} disabled={(levelsQuery.data?.length ?? 0) === 0}>
          <AddIcon className="mr-2 h-4 w-4" />Ajouter une matière
        </Button>
      ) : undefined}
    >
      <AcademicNavigation />
      {pageError ? (
        <QueryErrorState
          onRetry={() => { void levelsQuery.refetch(); void subjectsQuery.refetch() }}
          isRetrying={levelsQuery.isFetching || subjectsQuery.isFetching}
          message="Impossible de charger les matières et les niveaux."
        />
      ) : (
        <DataTable
          columns={columns}
          data={subjectGroups}
          isLoading={levelsQuery.isLoading || subjectsQuery.isLoading}
          searchKey="name"
          searchPlaceholder="Rechercher une matière…"
          emptyState={(
            <EmptyState
              icon={ClassIcon}
              title="Aucune matière"
              message={(levelsQuery.data?.length ?? 0) === 0
                ? "Ajoutez d’abord un niveau avant de créer des matières."
                : "Ajoutez les matières enseignées pour chaque niveau."}
              action={canEdit && (levelsQuery.data?.length ?? 0) > 0
                ? { label: "Ajouter une matière", onClick: openCreate, icon: AddIcon }
                : undefined}
            />
          )}
          mobileCard={(group) => (
            <div className="space-y-3 rounded-lg border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{group.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {group.subjects.length} niveau{group.subjects.length > 1 ? "x" : ""} configuré{group.subjects.length > 1 ? "s" : ""}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {group.subjects.map((subject) => (
                  <Badge key={subject.id} variant="outline" className="font-normal">
                    {subject.levelName} <span className="ml-1 text-muted-foreground">Coef. {subject.coefficient}</span>
                  </Badge>
                ))}
              </div>
              {canEdit ? (
                <Button type="button" variant="outline" size="sm" className="min-h-12 w-full" onClick={() => openEdit(group)}>
                  <EditIcon className="mr-2 h-4 w-4" />Modifier
                </Button>
              ) : null}
            </div>
          )}
        />
      )}
      <SubjectGroupDialog
        open={dialogOpen}
        isPending={groupSaveMutation.isPending}
        subjects={selectedGroup?.subjects ?? []}
        levels={levelsQuery.data ?? []}
        onOpenChange={setDialogOpen}
        onSubmit={(payload) => groupSaveMutation.mutate(payload)}
      />
      <SubjectBulkDialog
        open={bulkDialogOpen}
        isPending={bulkSaveMutation.isPending}
        levels={levelsQuery.data ?? []}
        classesByLevel={classesByLevel}
        onOpenChange={setBulkDialogOpen}
        onSubmit={(payload) => bulkSaveMutation.mutate(payload)}
      />
    </PageLayout>
  )
}
