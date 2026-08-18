import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { ColumnDef } from "@tanstack/react-table"
import axios from "axios"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import {
  createSchoolYear,
  listSchoolYears,
  updateSchoolYear,
  type SchoolYear,
  type SchoolYearPayload,
} from "@/modules/academic/academic.api"
import { AcademicNavigation } from "@/modules/academic/components/AcademicNavigation"
import { SchoolYearDialog } from "@/modules/academic/components/AcademicDialogs"
import { DataTable, EmptyState, PageLayout, QueryErrorState } from "@/shared/components"
import { AddIcon, CalendarIcon, EditIcon } from "@/shared/components/icons"
import { usePermissions } from "@/shared/hooks/usePermissions"

const SCHOOL_YEARS_KEY = ["academic", "school-years"] as const

const statusLabel = { draft: "Brouillon", active: "Active", closed: "Clôturée" } as const
const formatDate = (value: string) => new Intl.DateTimeFormat("fr-FR").format(new Date(`${value}T00:00:00`))
const apiErrorMessage = (error: unknown, fallback: string) =>
  axios.isAxiosError(error) && typeof error.response?.data?.error === "string"
    ? error.response.data.error
    : fallback

export default function SchoolYearsPage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { hasPermission } = usePermissions()
  const canCreate = hasPermission("school_years.create")
  const canEdit = hasPermission("school_years.edit")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selected, setSelected] = useState<SchoolYear | null>(null)

  const query = useQuery({ queryKey: SCHOOL_YEARS_KEY, queryFn: listSchoolYears })
  const mutation = useMutation({
    mutationFn: ({ schoolYear, payload }: { schoolYear: SchoolYear | null; payload: SchoolYearPayload }) =>
      schoolYear ? updateSchoolYear(schoolYear.id, payload) : createSchoolYear(payload),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["academic"] })
      setDialogOpen(false)
      setSelected(null)
      toast({ title: variables.schoolYear ? "Année scolaire mise à jour" : "Année scolaire ajoutée" })
    },
    onError: (error) => toast({
      title: "Enregistrement impossible",
      description: apiErrorMessage(error, "Vérifiez les dates, le libellé et le statut."),
      variant: "destructive",
    }),
  })

  const openCreate = () => {
    setSelected(null)
    setDialogOpen(true)
  }

  const columns = useMemo<ColumnDef<SchoolYear>[]>(() => [
    {
      accessorKey: "label",
      header: "Année scolaire",
      cell: ({ row }) => (
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{row.original.label}</span>
          {row.original.status === "active" ? <Badge className="bg-green-100 text-green-700">Année en cours</Badge> : null}
        </div>
      ),
    },
    { id: "dates", header: "Période", cell: ({ row }) => `${formatDate(row.original.startDate)} au ${formatDate(row.original.endDate)}` },
    {
      accessorKey: "status",
      header: "Statut",
      cell: ({ row }) => <Badge variant={row.original.status === "active" ? "default" : "outline"}>{statusLabel[row.original.status]}</Badge>,
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => canEdit ? (
        <Button type="button" variant="ghost" size="sm" onClick={() => { setSelected(row.original); setDialogOpen(true) }}>
          <EditIcon className="mr-2 h-4 w-4" />Modifier
        </Button>
      ) : null,
    },
  ], [canEdit])

  return (
    <PageLayout
      title="Structure scolaire"
      subtitle="Configurez les années scolaires utilisées par les classes et les emplois du temps."
      actions={canCreate ? <Button type="button" onClick={openCreate}><AddIcon className="mr-2 h-4 w-4" />Ajouter une année</Button> : undefined}
    >
      <AcademicNavigation />
      {query.isError ? (
        <QueryErrorState onRetry={() => void query.refetch()} isRetrying={query.isFetching} message="Impossible de charger les années scolaires." />
      ) : (
        <DataTable
          columns={columns}
          data={query.data ?? []}
          isLoading={query.isLoading}
          searchKey="label"
          searchPlaceholder="Rechercher une année…"
          emptyState={<EmptyState icon={CalendarIcon} title="Aucune année scolaire" message="Ajoutez une année scolaire pour pouvoir créer des classes." action={canCreate ? { label: "Ajouter une année", onClick: openCreate, icon: AddIcon } : undefined} />}
          mobileCard={(schoolYear) => (
            <div className="space-y-3 rounded-lg border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div><p className="font-medium">{schoolYear.label}</p><p className="text-sm text-muted-foreground">{formatDate(schoolYear.startDate)} au {formatDate(schoolYear.endDate)}</p></div>
                <Badge variant={schoolYear.status === "active" ? "default" : "outline"}>{statusLabel[schoolYear.status]}</Badge>
              </div>
              {canEdit ? <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => { setSelected(schoolYear); setDialogOpen(true) }}><EditIcon className="mr-2 h-4 w-4" />Modifier</Button> : null}
            </div>
          )}
        />
      )}
      <SchoolYearDialog
        open={dialogOpen}
        isPending={mutation.isPending}
        schoolYear={selected}
        onOpenChange={setDialogOpen}
        onSubmit={(payload) => mutation.mutate({ schoolYear: selected, payload })}
      />
    </PageLayout>
  )
}
