import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { ColumnDef } from "@tanstack/react-table"
import axios from "axios"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import {
  listFilteredClassDecisions,
  previewBulkClassDecisions,
  validateBulkClassDecisions,
  validateClassDecision,
  type BulkClassDecisionsPayload,
  type BulkClassDecisionsPreview,
  type ClassDecision,
  type ClassDecisionValue,
  type LevelOption,
} from "@/modules/class-decisions/class-decisions.api"
import { DataTable, EmptyState, PageLayout, QueryErrorState, Spinner } from "@/shared/components"
import { StudentsIcon } from "@/shared/components/icons"
import { usePermissions } from "@/shared/hooks/usePermissions"

const DECISIONS_KEY = ["class-decisions", "list"] as const
const NONE_LEVEL = "none"
const ALL_FILTER = "all"
const decisionLabels: Record<ClassDecisionValue, string> = {
  promoted: "Admis(e)",
  repeat: "Redouble",
  expelled: "Exclu(e)",
}
const formatGeneralAverage = (average: number | null | undefined): string =>
  typeof average === "number" ? `${average.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}/20` : "Non calculée"

type Draft = { finalDecision: ClassDecisionValue | ""; nextLevelId: string | null }
type BulkRuleDraft = { finalDecision: ClassDecisionValue; nextLevelId: string | null }
type BulkDecisionDraft = { threshold: string; atOrAbove: BulkRuleDraft; below: BulkRuleDraft }

const defaultBulkDecisionDraft: BulkDecisionDraft = {
  threshold: "10",
  atOrAbove: { finalDecision: "promoted", nextLevelId: null },
  below: { finalDecision: "repeat", nextLevelId: null },
}

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

function BulkRuleControls({
  label,
  rule,
  levels,
  onChange,
}: {
  label: string
  rule: BulkRuleDraft
  levels: LevelOption[]
  onChange: (rule: BulkRuleDraft) => void
}) {
  const idPrefix = label.includes("inférieure") ? "below" : "at-or-above"
  const requiresNextLevel = rule.finalDecision !== "expelled"

  return (
    <div className="space-y-3 rounded-md border bg-muted/20 p-3">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor={`${idPrefix}-decision`}>Décision</label>
          <Select value={rule.finalDecision} onValueChange={(value: ClassDecisionValue) => onChange({
            finalDecision: value,
            nextLevelId: value === "expelled" ? null : rule.nextLevelId,
          })}>
            <SelectTrigger id={`${idPrefix}-decision`} className="min-h-12"><SelectValue aria-label={`Décision : ${label}`} /></SelectTrigger>
            <SelectContent>
              {Object.entries(decisionLabels).map(([value, decisionLabel]) => <SelectItem key={value} value={value}>{decisionLabel}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor={`${idPrefix}-next-level`}>Niveau de destination</label>
          <Select value={rule.nextLevelId ?? NONE_LEVEL} onValueChange={(value) => onChange({ ...rule, nextLevelId: value === NONE_LEVEL ? null : value })} disabled={!requiresNextLevel}>
            <SelectTrigger id={`${idPrefix}-next-level`} className="min-h-12"><SelectValue placeholder="Niveau de destination" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE_LEVEL}>Aucun niveau suivant</SelectItem>
              {levels.map((level) => <SelectItem key={level.id} value={level.id}>{level.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )
}

export default function ClassDecisionsPage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { hasPermission } = usePermissions()
  const canValidate = hasPermission("class_decisions.validate")
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [levelFilter, setLevelFilter] = useState(ALL_FILTER)
  const [classFilter, setClassFilter] = useState(ALL_FILTER)
  const [bulkDraft, setBulkDraft] = useState<BulkDecisionDraft>(defaultBulkDecisionDraft)
  const [bulkPreview, setBulkPreview] = useState<BulkClassDecisionsPreview | null>(null)
  const [isConfigDialogOpen, setConfigDialogOpen] = useState(false)
  const [isPreviewDialogOpen, setPreviewDialogOpen] = useState(false)
  const filters = { levelId: levelFilter === ALL_FILTER ? undefined : levelFilter, classId: classFilter === ALL_FILTER ? undefined : classFilter }
  const query = useQuery({ queryKey: [...DECISIONS_KEY, filters], queryFn: () => listFilteredClassDecisions(filters) })
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
  const bulkPayload = (): BulkClassDecisionsPayload => ({
    levelId: levelFilter === ALL_FILTER ? undefined : levelFilter,
    classId: classFilter === ALL_FILTER ? undefined : classFilter,
    threshold: Number(bulkDraft.threshold),
    atOrAbove: bulkDraft.atOrAbove,
    below: bulkDraft.below,
  })
  const isLevelSelected = levelFilter !== ALL_FILTER
  const isBulkConfigComplete = isLevelSelected
    && bulkDraft.threshold.trim() !== ""
    && Number.isFinite(Number(bulkDraft.threshold))
    && Number(bulkDraft.threshold) >= 0
    && Number(bulkDraft.threshold) <= 20
    && (bulkDraft.atOrAbove.finalDecision === "expelled" || bulkDraft.atOrAbove.nextLevelId !== null)
    && (bulkDraft.below.finalDecision === "expelled" || bulkDraft.below.nextLevelId !== null)
  const previewMutation = useMutation({
    mutationFn: () => previewBulkClassDecisions(bulkPayload()),
    onSuccess: (preview) => {
      setBulkPreview(preview)
      setConfigDialogOpen(false)
      setPreviewDialogOpen(true)
    },
    onError: (error) => toast({
      title: "Prévisualisation impossible",
      description: axios.isAxiosError(error) && typeof error.response?.data?.error === "string"
        ? error.response.data.error
        : "Vérifiez la configuration puis réessayez.",
      variant: "destructive",
      duration: 6000,
    }),
  })
  const bulkValidationMutation = useMutation({
    mutationFn: () => validateBulkClassDecisions(bulkPayload()),
    onSuccess: async (result) => {
      setBulkPreview(result)
      setPreviewDialogOpen(false)
      await queryClient.invalidateQueries({ queryKey: DECISIONS_KEY })
      toast({ title: `${result.eligibleCount} décision(s) de fin d’année validée(s)` })
    },
    onError: (error) => toast({
      title: "Validation groupée impossible",
      description: axios.isAxiosError(error) && typeof error.response?.data?.error === "string"
        ? error.response.data.error
        : "Réessayez après avoir vérifié les moyennes et la configuration.",
      variant: "destructive",
      duration: 6000,
    }),
  })

  const draftFor = (decision: ClassDecision): Draft => drafts[decision.studentId] ?? {
    finalDecision: decision.finalDecision ?? "",
    nextLevelId: decision.nextLevelId,
  }
  const classes = (query.data?.classes ?? []).filter((schoolClass) => levelFilter === ALL_FILTER || schoolClass.levelId === levelFilter)
  useEffect(() => {
    if (classFilter !== ALL_FILTER && !classes.some((schoolClass) => schoolClass.id === classFilter)) {
      setClassFilter(ALL_FILTER)
      setBulkPreview(null)
    }
  }, [classFilter, classes])
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
      accessorKey: "generalAverage",
      header: "Moyenne générale",
      cell: ({ row }) => row.original.generalAverage === null || row.original.generalAverage === undefined
        ? <span className="text-sm text-muted-foreground">Non calculée</span>
        : <span className="font-medium tabular-nums">{formatGeneralAverage(row.original.generalAverage)}</span>,
    },
    {
      id: "suggestion",
      header: "Suggestion",
      cell: ({ row }) => row.original.suggestedDecision
        ? <Badge variant="outline">{decisionLabels[row.original.suggestedDecision]}</Badge>
        : <span className="text-sm text-muted-foreground">Saisie manuelle</span>,
    },
    { id: "decision", header: "Décision finale", cell: ({ row }) => controls(row.original) },
  ]
  const previewColumns: ColumnDef<NonNullable<typeof bulkPreview>["items"][number]>[] = [
    {
      id: "student",
      accessorFn: (row) => `${row.studentLastName} ${row.studentFirstName}`,
      header: "Élève",
      cell: ({ row }) => <div><p className="font-medium">{row.original.studentLastName} {row.original.studentFirstName}</p><p className="text-xs text-muted-foreground">{row.original.className}</p></div>,
    },
    {
      accessorKey: "generalAverage",
      header: "Moyenne générale",
      cell: ({ row }) => <span className="font-medium tabular-nums">{formatGeneralAverage(row.original.generalAverage)}</span>,
    },
    {
      id: "proposedDecision",
      header: "Décision proposée",
      cell: ({ row }) => row.original.isEligible && row.original.proposedDecision ? (
        <div className="space-y-1"><Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">{decisionLabels[row.original.proposedDecision]}</Badge><p className="text-xs text-muted-foreground">{row.original.proposedNextLevelName ?? "Sans niveau suivant"}</p></div>
      ) : <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-200">Moyenne en attente</Badge>,
    },
  ]

  const updateScope = (nextLevelFilter: string, nextClassFilter: string) => {
    const scopeLevelId = nextClassFilter !== ALL_FILTER
      ? query.data?.classes.find((schoolClass) => schoolClass.id === nextClassFilter)?.levelId
      : nextLevelFilter === ALL_FILTER ? undefined : nextLevelFilter
    setLevelFilter(nextLevelFilter)
    setClassFilter(nextClassFilter)
    setBulkPreview(null)
    if (scopeLevelId) {
      setBulkDraft((current) => ({
        ...current,
        below: { ...current.below, nextLevelId: scopeLevelId },
      }))
    }
  }

  return (
    <PageLayout
      title="Fin d’année"
      subtitle={
        query.data
          ? `Validez les décisions des élèves pour ${query.data.schoolYear.label}.`
          : "Validez les décisions de passage, redoublement ou exclusion."
      }
    >
      {query.isError ? (
        <QueryErrorState
          onRetry={() => void query.refetch()}
          isRetrying={query.isFetching}
          message="Impossible de charger les décisions de fin d’année."
        />
      ) : (
        <div className="space-y-5">
          <div className="grid gap-4 rounded-lg border bg-muted/20 p-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label
                className="text-sm font-medium"
                htmlFor="class-decisions-level"
              >
                Niveau
              </label>
              <Select
                value={levelFilter}
                onValueChange={(value) => updateScope(value, ALL_FILTER)}
              >
                <SelectTrigger id="class-decisions-level" className="min-h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_FILTER}>Tous les niveaux</SelectItem>
                  {query.data?.levels.map((level) => (
                    <SelectItem key={level.id} value={level.id}>
                      {level.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label
                className="text-sm font-medium"
                htmlFor="class-decisions-class"
              >
                Classe
              </label>
              <Select
                value={classFilter}
                onValueChange={(value) => updateScope(levelFilter, value)}
              >
                <SelectTrigger id="class-decisions-class" className="min-h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_FILTER}>Toutes les classes</SelectItem>
                  {classes.map((schoolClass) => (
                    <SelectItem key={schoolClass.id} value={schoolClass.id}>
                      {schoolClass.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {canValidate ? (
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                className="min-h-12"
                onClick={() => setConfigDialogOpen(true)}
                disabled={!isLevelSelected}
              >
                Décision automatique
              </Button>
              {!isLevelSelected ? (
                <p className="text-sm text-muted-foreground">
                  Sélectionnez d’abord un niveau pour appliquer une règle
                  commune.
                </p>
              ) : null}
            </div>
          ) : null}
          <Dialog open={isConfigDialogOpen} onOpenChange={setConfigDialogOpen}>
            <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-3xl overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span>Configurer la décision automatique</span>
                  {levelFilter !== ALL_FILTER ? (
                    <Badge variant="secondary" className="font-normal">
                      {query.data?.levels.find((level) => level.id === levelFilter)?.name ?? "Niveau sélectionné"}
                    </Badge>
                  ) : null}
                </DialogTitle>
                <DialogDescription>
                  Les règles seront appliquées aux élèves du niveau sélectionné
                  {classFilter !== ALL_FILTER ? " et de la classe filtrée" : ""}
                  .
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-5">
                <div className="space-y-2">
                  <label
                    className="text-sm font-medium"
                    htmlFor="bulk-threshold"
                  >
                    Moyenne seuil d’admission (/20)
                  </label>
                  <Input
                    id="bulk-threshold"
                    type="number"
                    min="0"
                    max="20"
                    step="0.01"
                    inputMode="decimal"
                    value={bulkDraft.threshold}
                    onChange={(event) => {
                      setBulkDraft((current) => ({
                        ...current,
                        threshold: event.target.value,
                      }));
                      setBulkPreview(null);
                    }}
                    className="min-h-12"
                  />
                </div>

                <BulkRuleControls
                  label="Moyenne supérieure ou égale au seuil"
                  rule={bulkDraft.atOrAbove}
                  levels={query.data?.levels ?? []}
                  onChange={(rule) => {
                    setBulkDraft((current) => ({
                      ...current,
                      atOrAbove: rule,
                    }));
                    setBulkPreview(null);
                  }}
                />

                <BulkRuleControls
                  label="Moyenne inférieure au seuil"
                  rule={bulkDraft.below}
                  levels={query.data?.levels ?? []}
                  onChange={(rule) => {
                    setBulkDraft((current) => ({ ...current, below: rule }));
                    setBulkPreview(null);
                  }}
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-12"
                  onClick={() => setConfigDialogOpen(false)}
                >
                  Annuler
                </Button>
                <Button
                  type="button"
                  className="min-h-12"
                  onClick={() => previewMutation.mutate()}
                  disabled={previewMutation.isPending || !isBulkConfigComplete}
                >
                  {previewMutation.isPending ? (
                    <Spinner size="sm" className="mr-2" />
                  ) : null}
                  {previewMutation.isPending
                    ? "Prévisualisation…"
                    : "Voir la prévisualisation"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog
            open={isPreviewDialogOpen}
            onOpenChange={setPreviewDialogOpen}
          >
            <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-5xl overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Prévisualisation des décisions</DialogTitle>
                <DialogDescription>
                  Vérifiez chaque résultat avant la validation définitive.
                </DialogDescription>
              </DialogHeader>
              {bulkPreview ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className="bg-green-50 text-green-700 border-green-200"
                    >
                      {bulkPreview.eligibleCount} prêt(s) à valider
                    </Badge>
                    {bulkPreview.pendingCount > 0 ? (
                      <Badge
                        variant="outline"
                        className="bg-amber-50 text-amber-800 border-amber-200"
                      >
                        {bulkPreview.pendingCount} moyenne(s) en attente
                      </Badge>
                    ) : null}
                  </div>
                  <DataTable
                    columns={previewColumns}
                    data={bulkPreview.items}
                    searchKey="student"
                    searchPlaceholder="Rechercher dans la prévisualisation…"
                    emptyState={
                      <EmptyState
                        icon={StudentsIcon}
                        title="Aucun élève dans ce périmètre"
                        message="Modifiez le niveau ou la classe sélectionnée."
                      />
                    }
                    mobileCard={(item) => (
                      <div className="space-y-2 rounded-lg border bg-card p-4">
                        <p className="font-medium">
                          {item.studentLastName} {item.studentFirstName}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Moyenne : {formatGeneralAverage(item.generalAverage)}
                        </p>
                        <p className="text-sm">
                          {item.isEligible && item.proposedDecision
                            ? `${decisionLabels[item.proposedDecision]} · ${item.proposedNextLevelName ?? "Sans niveau suivant"}`
                            : "Moyenne générale en attente"}
                        </p>
                      </div>
                    )}
                  />
                  {!bulkPreview.canApply ? (
                    <p className="text-sm text-amber-800">
                      La validation reste bloquée tant que toutes les moyennes
                      générales du périmètre ne sont pas finalisées.
                    </p>
                  ) : null}
                </div>
              ) : null}
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-12"
                  onClick={() => {
                    setPreviewDialogOpen(false);
                    setConfigDialogOpen(true);
                  }}
                >
                  Modifier la configuration
                </Button>
                <Button
                  type="button"
                  className="min-h-12"
                  onClick={() => bulkValidationMutation.mutate()}
                  disabled={
                    bulkValidationMutation.isPending || !bulkPreview?.canApply
                  }
                >
                  {bulkValidationMutation.isPending ? (
                    <Spinner size="sm" className="mr-2" />
                  ) : null}
                  {bulkValidationMutation.isPending
                    ? "Validation finale…"
                    : "Valider définitivement"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <DataTable
            columns={columns}
            data={query.data?.decisions ?? []}
            isLoading={query.isLoading}
            searchKey="student"
            searchPlaceholder="Rechercher un élève…"
            emptyState={
              <EmptyState
                icon={StudentsIcon}
                title="Aucun élève à valider"
                message="Aucune inscription confirmée n’est rattachée aux classes de l’année en cours."
              />
            }
            mobileCard={(decision) => (
              <div className="space-y-4 rounded-lg border bg-card p-4">
                <div>
                  <p className="font-medium">
                    {decision.studentLastName} {decision.studentFirstName}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {decision.className}, {decision.currentLevelName}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Moyenne générale :{" "}
                    {formatGeneralAverage(decision.generalAverage)}
                  </p>
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
        </div>
      )}
    </PageLayout>
  );
}
