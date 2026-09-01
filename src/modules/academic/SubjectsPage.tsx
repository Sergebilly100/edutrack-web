import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { ColumnDef } from "@tanstack/react-table"
import axios from "axios"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import {
  createSubject,
  createSubjectsBulk,
  listClasses,
  listLevels,
  listSubjects,
  updateSubject,
  type Subject,
  type SubjectPayload,
  type SubjectUpdatePayload,
} from "@/modules/academic/academic.api"
import { AcademicNavigation } from "@/modules/academic/components/AcademicNavigation"
import { SubjectBulkDialog, SubjectDialog } from "@/modules/academic/components/AcademicDialogs"
import { DataTable, EmptyState, PageLayout, QueryErrorState } from "@/shared/components"
import { AddIcon, ClassIcon, EditIcon } from "@/shared/components/icons"
import { usePermissions } from "@/shared/hooks/usePermissions"

const LEVELS_KEY = ["academic", "levels"] as const
const SUBJECTS_KEY = ["academic", "subjects"] as const

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
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null)
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
  const saveMutation = useMutation({
    mutationFn: ({ subject, payload }: {
      subject: Subject | null
      payload: SubjectPayload | SubjectUpdatePayload
    }) => subject
      ? updateSubject(subject.id, payload as SubjectUpdatePayload)
      : createSubject(payload as SubjectPayload),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: SUBJECTS_KEY })
      setDialogOpen(false)
      setSelectedSubject(null)
      toast({ title: variables.subject ? "Matière mise à jour" : "Matière ajoutée" })
    },
    onError: (error) => toast({
      title: "Enregistrement impossible",
      description: apiErrorMessage(error, "Vérifiez le niveau, le nom et le coefficient."),
      variant: "destructive",
    }),
  })

  const openCreate = () => {
    setBulkDialogOpen(true)
  }
  const openEdit = (subject: Subject) => {
    setSelectedSubject(subject)
    setDialogOpen(true)
  }
  const columns = useMemo<ColumnDef<Subject>[]>(() => [
    { accessorKey: "name", header: "Matière", cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
    { accessorKey: "levelName", header: "Niveau" },
    { accessorKey: "coefficient", header: "Coefficient", cell: ({ row }) => <Badge variant="outline">Coef. {row.original.coefficient}</Badge> },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => canEdit ? (
        <Button type="button" variant="ghost" size="sm" onClick={() => openEdit(row.original)}>
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
          data={subjectsQuery.data ?? []}
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
          mobileCard={(subject) => (
            <div className="space-y-3 rounded-lg border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{subject.name}</p>
                  <p className="text-sm text-muted-foreground">{subject.levelName}</p>
                </div>
                <Badge variant="outline">Coef. {subject.coefficient}</Badge>
              </div>
              {canEdit ? (
                <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => openEdit(subject)}>
                  <EditIcon className="mr-2 h-4 w-4" />Modifier
                </Button>
              ) : null}
            </div>
          )}
        />
      )}
      <SubjectDialog
        open={dialogOpen}
        isPending={saveMutation.isPending}
        subject={selectedSubject}
        levels={levelsQuery.data ?? []}
        onOpenChange={setDialogOpen}
        onSubmit={(payload) => saveMutation.mutate({ subject: selectedSubject, payload })}
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
