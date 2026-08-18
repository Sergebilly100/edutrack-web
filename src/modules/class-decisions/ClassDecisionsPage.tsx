import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { ColumnDef } from "@tanstack/react-table"
import axios from "axios"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import {
  listClassDecisions,
  validateClassDecision,
  type ClassDecision,
  type ClassDecisionValue,
  type LevelOption,
} from "@/modules/class-decisions/class-decisions.api"
import { DataTable, EmptyState, PageLayout, QueryErrorState, Spinner } from "@/shared/components"
import { StudentsIcon } from "@/shared/components/icons"
import { usePermissions } from "@/shared/hooks/usePermissions"

const DECISIONS_KEY = ["class-decisions", "list"] as const
const NONE_LEVEL = "none"
const decisionLabels: Record<ClassDecisionValue, string> = {
  promoted: "Admis(e)",
  repeat: "Redouble",
  expelled: "Exclu(e)",
}

type Draft = { finalDecision: ClassDecisionValue | ""; nextLevelId: string | null }

function DecisionControls({
  decision,
  levels,
  draft,
  canValidate,
  isPending,
  onChange,
  onSave,
}: {
  decision: ClassDecision
  levels: LevelOption[]
  draft: Draft
  canValidate: boolean
  isPending: boolean
  onChange: (draft: Draft) => void
  onSave: () => void
}) {
  if (!canValidate) {
    return decision.finalDecision ? (
      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
        {decisionLabels[decision.finalDecision]}
      </Badge>
    ) : <span className="text-sm text-muted-foreground">À valider</span>
  }

  return (
    <div className="grid gap-2 sm:grid-cols-[minmax(150px,1fr)_minmax(150px,1fr)_auto]">
      <Select value={draft.finalDecision} onValueChange={(value: ClassDecisionValue) => onChange({ ...draft, finalDecision: value })}>
        <SelectTrigger className="min-h-12"><SelectValue placeholder="Décision finale" /></SelectTrigger>
        <SelectContent>
          {Object.entries(decisionLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={draft.nextLevelId ?? NONE_LEVEL} onValueChange={(value) => onChange({ ...draft, nextLevelId: value === NONE_LEVEL ? null : value })}>
        <SelectTrigger className="min-h-12"><SelectValue placeholder="Niveau suivant" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE_LEVEL}>Aucun niveau suivant</SelectItem>
          {levels.map((level) => <SelectItem key={level.id} value={level.id}>{level.name}</SelectItem>)}
        </SelectContent>
      </Select>
      <Button type="button" className="min-h-12" disabled={!draft.finalDecision || isPending} onClick={onSave}>
        {isPending ? <Spinner size="sm" className="mr-2" /> : null}
        {isPending ? "Validation…" : decision.finalDecision ? "Mettre à jour" : "Valider"}
      </Button>
    </div>
  )
}

export default function ClassDecisionsPage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { hasPermission } = usePermissions()
  const canValidate = hasPermission("class_decisions.validate")
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const query = useQuery({ queryKey: DECISIONS_KEY, queryFn: listClassDecisions })
  const mutation = useMutation({
    mutationFn: ({ studentId, draft }: { studentId: string; draft: Draft }) => {
      if (!draft.finalDecision) throw new Error("Décision requise")
      return validateClassDecision(studentId, {
        finalDecision: draft.finalDecision,
        nextLevelId: draft.nextLevelId,
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: DECISIONS_KEY })
      toast({ title: "Décision de fin d’année validée" })
    },
    onError: (error) => toast({
      title: "Validation impossible",
      description: axios.isAxiosError(error) && typeof error.response?.data?.error === "string"
        ? error.response.data.error
        : "Réessayez après avoir vérifié la décision.",
      variant: "destructive",
    }),
  })

  const draftFor = (decision: ClassDecision): Draft => drafts[decision.studentId] ?? {
    finalDecision: decision.finalDecision ?? "",
    nextLevelId: decision.nextLevelId,
  }
  const controls = (decision: ClassDecision) => (
    <DecisionControls
      decision={decision}
      levels={query.data?.levels ?? []}
      draft={draftFor(decision)}
      canValidate={canValidate}
      isPending={mutation.isPending && mutation.variables?.studentId === decision.studentId}
      onChange={(draft) => setDrafts((current) => ({ ...current, [decision.studentId]: draft }))}
      onSave={() => mutation.mutate({ studentId: decision.studentId, draft: draftFor(decision) })}
    />
  )

  const columns: ColumnDef<ClassDecision>[] = [
    {
      id: "student",
      accessorFn: (row) => `${row.studentLastName} ${row.studentFirstName}`,
      header: "Élève",
      cell: ({ row }) => (
        <div><p className="font-medium">{row.original.studentLastName} {row.original.studentFirstName}</p><p className="text-xs text-muted-foreground">{row.original.studentMatricule ?? "Sans matricule"}</p></div>
      ),
    },
    { accessorKey: "className", header: "Classe" },
    {
      id: "suggestion",
      header: "Suggestion",
      cell: ({ row }) => row.original.suggestedDecision
        ? <Badge variant="outline">{decisionLabels[row.original.suggestedDecision]}</Badge>
        : <span className="text-sm text-muted-foreground">Saisie manuelle</span>,
    },
    { id: "decision", header: "Décision finale", cell: ({ row }) => controls(row.original) },
  ]

  return (
    <PageLayout
      title="Fin d’année"
      subtitle={query.data ? `Validez les décisions des élèves pour ${query.data.schoolYear.label}.` : "Validez les décisions de passage, redoublement ou exclusion."}
    >
      {query.isError ? (
        <QueryErrorState onRetry={() => void query.refetch()} isRetrying={query.isFetching} message="Impossible de charger les décisions de fin d’année." />
      ) : (
        <DataTable
          columns={columns}
          data={query.data?.decisions ?? []}
          isLoading={query.isLoading}
          searchKey="student"
          searchPlaceholder="Rechercher un élève…"
          emptyState={<EmptyState icon={StudentsIcon} title="Aucun élève à valider" message="Aucun élève actif n’est rattaché aux classes de l’année en cours." />}
          mobileCard={(decision) => (
            <div className="space-y-4 rounded-lg border bg-card p-4">
              <div>
                <p className="font-medium">{decision.studentLastName} {decision.studentFirstName}</p>
                <p className="text-sm text-muted-foreground">{decision.className}, {decision.currentLevelName}</p>
              </div>
              <p className="text-xs text-muted-foreground">
                {decision.suggestedDecision
                  ? `Suggestion : ${decisionLabels[decision.suggestedDecision]}`
                  : "Suggestion automatique indisponible, saisie manuelle requise."}
              </p>
              {controls(decision)}
            </div>
          )}
        />
      )}
    </PageLayout>
  )
}
