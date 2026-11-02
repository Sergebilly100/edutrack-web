import { OnboardingReturn, useOnboardingContext } from "@/modules/onboarding/OnboardingReturn"
import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { ColumnDef } from "@tanstack/react-table"
import axios from "axios"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { createLevel, listLevels, updateLevel, type Level, type LevelPayload } from "@/modules/academic/academic.api"
import { AcademicNavigation } from "@/modules/academic/components/AcademicNavigation"
import { LevelDialog } from "@/modules/academic/components/AcademicDialogs"
import { DataTable, EmptyState, PageLayout, QueryErrorState } from "@/shared/components"
import { AddIcon, ClassIcon, EditIcon } from "@/shared/components/icons"
import { usePermissions } from "@/shared/hooks/usePermissions"

const LEVELS_KEY = ["academic", "levels"] as const
const apiErrorMessage = (error: unknown, fallback: string) =>
  axios.isAxiosError(error) && typeof error.response?.data?.error === "string" ? error.response.data.error : fallback

export default function LevelsPage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { hasPermission } = usePermissions()
  const onboardingContext = useOnboardingContext()
  const isOnboardingFocus = Boolean(onboardingContext.target)
  const canCreate = hasPermission("classes.create")
  const canEdit = hasPermission("classes.edit")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selected, setSelected] = useState<Level | null>(null)
  const query = useQuery({ queryKey: LEVELS_KEY, queryFn: listLevels })
  const mutation = useMutation({
    mutationFn: ({ level, payload }: { level: Level | null; payload: LevelPayload }) =>
      level ? updateLevel(level.id, payload) : createLevel(payload),
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: LEVELS_KEY }),
        queryClient.invalidateQueries({ queryKey: ["onboarding-status"] }),
      ])
      setDialogOpen(false)
      setSelected(null)
      toast({ title: variables.level ? "Niveau mis à jour" : "Niveau ajouté" })
    },
    onError: (error) => toast({ title: "Enregistrement impossible", description: apiErrorMessage(error, "Vérifiez le nom et l’ordre d’affichage."), variant: "destructive" }),
  })

  const openCreate = () => { setSelected(null); setDialogOpen(true) }
  const openEdit = (level: Level) => { setSelected(level); setDialogOpen(true) }
  const suggestedLevels = ["4ème", "3ème", "2nde", "1ère", "Terminale"].filter((name) =>
    !(query.data ?? []).some((level) => level.name.trim().toLocaleLowerCase("fr") === name.toLocaleLowerCase("fr")),
  )
  const addSuggestedLevel = (name: string) => {
    const nextOrder = Math.max(-1, ...(query.data ?? []).map((level) => level.orderIndex)) + 1
    mutation.mutate({ level: null, payload: { name, orderIndex: nextOrder, isExamClass: name === "Terminale" } })
  }
  const columns = useMemo<ColumnDef<Level>[]>(() => [
    { accessorKey: "name", header: "Niveau", cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
    { accessorKey: "orderIndex", header: "Ordre" },
    { id: "exam", header: "Type", cell: ({ row }) => row.original.isExamClass ? <Badge variant="outline">Classe d’examen</Badge> : <span className="text-sm text-muted-foreground">Classe standard</span> },
    { id: "actions", header: "Actions", cell: ({ row }) => canEdit ? <Button type="button" variant="ghost" size="sm" onClick={() => openEdit(row.original)}><EditIcon className="mr-2 h-4 w-4" />Modifier</Button> : null },
  ], [canEdit])

  return (
    <PageLayout title="Structure scolaire" subtitle="Organisez les niveaux dans leur ordre d’affichage." actions={canCreate ? <Button type="button" onClick={openCreate}><AddIcon className="mr-2 h-4 w-4" />Ajouter un niveau</Button> : undefined}>
      <AcademicNavigation />
      <OnboardingReturn />
      {isOnboardingFocus && canCreate ? (
        <section aria-label="Suggestions de niveaux" className="space-y-2 rounded-lg border bg-card p-4">
          <h2 className="text-sm font-semibold">Ajouter rapidement un niveau</h2>
          <div className="flex flex-wrap gap-2">
            {suggestedLevels.map((name) => (
              <Button key={name} type="button" variant="outline" disabled={mutation.isPending} onClick={() => addSuggestedLevel(name)}>
                + {name}
              </Button>
            ))}
            {suggestedLevels.length === 0 ? <p className="text-sm text-muted-foreground">Tous les niveaux proposés sont déjà présents.</p> : null}
          </div>
        </section>
      ) : null}
      {query.isError ? <QueryErrorState onRetry={() => void query.refetch()} isRetrying={query.isFetching} message="Impossible de charger les niveaux." /> : (
        <DataTable
          columns={columns}
          data={query.data ?? []}
          isLoading={query.isLoading}
          searchKey="name"
          searchPlaceholder="Rechercher un niveau…"
          emptyState={<EmptyState icon={ClassIcon} title="Aucun niveau" message="Ajoutez les niveaux avant de créer les classes." action={canCreate ? { label: "Ajouter un niveau", onClick: openCreate, icon: AddIcon } : undefined} />}
          mobileCard={(level) => <div className="space-y-3 rounded-lg border bg-card p-4"><div className="flex items-center justify-between gap-3"><div><p className="font-medium">{level.name}</p><p className="text-sm text-muted-foreground">Ordre {level.orderIndex}</p></div>{level.isExamClass ? <Badge variant="outline">Examen</Badge> : null}</div>{canEdit ? <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => openEdit(level)}><EditIcon className="mr-2 h-4 w-4" />Modifier</Button> : null}</div>}
        />
      )}
      <LevelDialog open={dialogOpen} isPending={mutation.isPending} level={selected} onOpenChange={setDialogOpen} onSubmit={(payload) => mutation.mutate({ level: selected, payload })} />
    </PageLayout>
  )
}
