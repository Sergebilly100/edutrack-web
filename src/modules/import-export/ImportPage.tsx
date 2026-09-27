import { OnboardingReturn, useOnboardingContext } from "@/modules/onboarding/OnboardingReturn"
import { Link } from "react-router-dom"
import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { ChevronLeft, ChevronRight, Info } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { fetchImportContext, fetchImportHistory, type ImportType } from "@/modules/import-export/import-export.api"
import { EmptyState } from "@/shared/components/EmptyState"
import { Spinner } from "@/shared/components/Spinner"
import { QueryErrorState } from "@/shared/components/QueryErrorState"
import { OfflineIndicator } from "@/shared/components/OfflineIndicator"
import { ContextualHelp } from "@/shared/components/ContextualHelp"
import { useOfflineGuard } from "@/shared/hooks/useOfflineGuard"
import { CalendarClockIcon } from "@/shared/components/icons"
import { usePermissions } from "@/shared/hooks/usePermissions"
import { useStudentLabels, type StudentLabels } from "@/shared/hooks/useStudentLabel"
import { useAuthStore } from "@/shared/store/auth.store"
import { TourGuide } from "@/shared/components/TourGuide"
import { useTourGuide } from "@/shared/hooks/useTourGuide"
import { historicalStudentsImportTourSteps, importTourSteps } from "@/shared/lib/tour-steps"
import ImportWizard from "./ImportWizard"
import { HistoricalStudentsImport } from "./HistoricalStudentsImport"

const HISTORY_PAGE_SIZE = 10

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

const buildLabelByType = (labels: StudentLabels): Record<ImportType, string> => ({
  students: labels.plural,
  teachers: "Professeurs",
  schedule: "Emploi du temps",
})

// Build a list of the last 12 months as "YYYY-MM" for the month filter
const buildMonthOptions = (): Array<{ value: string; label: string }> => {
  const options: Array<{ value: string; label: string }> = []
  const now = new Date()
  for (let i = 0; i < 12; i++) {
    const d = new Date(Date.UTC(now.getFullYear(), now.getMonth() - i, 1))
    const value = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
    const label = d.toLocaleDateString("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" })
    options.push({ value, label })
  }
  return options
}

const MONTH_OPTIONS = buildMonthOptions()

export default function ImportPage() {
  const [searchParams] = useSearchParams()
  const onboardingContext = useOnboardingContext()
  const guidedReturn = onboardingContext.target
  const { hasPermission } = usePermissions()
  const studentLabels = useStudentLabels()
  const { isBlocked: isImportBlocked } = useOfflineGuard()
  const labelByType = buildLabelByType(studentLabels)
  const user = useAuthStore((state) => state.user)
  const isDirector = user?.role === "director"
  const tour = useTourGuide("import", true)
  const canImportStudents = isDirector || hasPermission("import.students")
  const canImportTeachers = isDirector || hasPermission("import.teachers")
  const canImportSchedule = isDirector || hasPermission("import.schedule")
  const accessQuery = useQuery({
    queryKey: ["import-context", user?.schemaName, user?.tenantId], queryFn: fetchImportContext,
    enabled: canImportStudents || canImportTeachers || canImportSchedule, staleTime: 0,
  })
  const initialProfileContext = Boolean(guidedReturn) && accessQuery.data?.canImportProfiles === true
  const isInitialTeacherImport = initialProfileContext && searchParams.get("type") !== "students"
  const allowedImportTypes = useMemo(() => ([
    initialProfileContext && searchParams.get("type") === "students" && canImportStudents ? "students" : null,
    initialProfileContext && searchParams.get("type") !== "students" && canImportTeachers ? "teachers" : null,
    !initialProfileContext && canImportSchedule ? "schedule" : null,
  ].filter((value): value is ImportType => value !== null)), [canImportStudents, canImportTeachers, canImportSchedule, initialProfileContext, searchParams])
  const canViewHistory = (canImportStudents || canImportTeachers || canImportSchedule) && accessQuery.isSuccess && !initialProfileContext && !onboardingContext.checking
  const requestedType = searchParams.get("type")
  const [activeImportType, setActiveImportType] = useState<ImportType>(
    requestedType === "teachers" || requestedType === "schedule" || requestedType === "students" ? requestedType : allowedImportTypes[0] ?? "students"
  )

  const selectedImportType = allowedImportTypes.includes(activeImportType) ? activeImportType : allowedImportTypes[0]
  const isHistoricalStudentsImport = initialProfileContext && selectedImportType === "students"
  const checkingAccess = accessQuery.isLoading || onboardingContext.checking

  // History filter state
  const [historyPage, setHistoryPage] = useState(1)
  const [historyMonth, setHistoryMonth] = useState<string | undefined>(undefined)
  const [historyType, setHistoryType] = useState<ImportType | undefined>(undefined)

  const historyQuery = useQuery({
    queryKey: ["import-history", user?.schemaName, user?.tenantId, { page: historyPage, month: historyMonth, type: historyType }],
    queryFn: () =>
      fetchImportHistory({
        limit: HISTORY_PAGE_SIZE,
        page: historyPage,
        month: historyMonth,
        type: historyType,
      }),
    enabled: canViewHistory,
  })

  useEffect(() => {
    if (!allowedImportTypes.length) return
    if (!allowedImportTypes.includes(activeImportType)) {
      setActiveImportType(allowedImportTypes[0])
    }
  }, [activeImportType, allowedImportTypes])
  useEffect(() => {
    if (requestedType === "teachers" || requestedType === "schedule" || requestedType === "students") {
      if (allowedImportTypes.includes(requestedType)) setActiveImportType(requestedType)
    }
  }, [allowedImportTypes, requestedType])

  // Reset to page 1 when filters change
  const handleMonthChange = (value: string) => {
    setHistoryMonth(value === "all" ? undefined : value)
    setHistoryPage(1)
  }

  const handleTypeChange = (value: string) => {
    setHistoryType(value === "all" ? undefined : (value as ImportType))
    setHistoryPage(1)
  }

  const historyResult = historyQuery.data
  const historyItems = historyResult?.items ?? []
  const totalPages = historyResult?.totalPages ?? 1
  const totalItems = historyResult?.total ?? 0

  return (
    <>
      <TourGuide
        steps={isHistoricalStudentsImport ? historicalStudentsImportTourSteps : importTourSteps}
        run={tour.run}
        stepIndex={tour.stepIndex}
        onStepChange={tour.setStepIndex}
        onFinish={tour.markDone}
      />
    <div className="space-y-6 px-4 md:px-1">
      <OfflineIndicator />
      <OnboardingReturn />
      <header className="space-y-1" data-tour="import-header">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Import de données</h1>
            <p className="text-sm text-muted-foreground">
              {isHistoricalStudentsImport
                ? "Profils élèves et contacts parents pour les réinscriptions."
                : isInitialTeacherImport
                ? "Importez les profils et contrats des professeurs. Les affectations viendront après les inscriptions."
                : "Importez l’emploi du temps et consultez les opérations déjà effectuées."}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-12 text-muted-foreground"
            onClick={() => tour.restart()}
            aria-label="Revoir le guide"
          >
            <Info className="mr-1.5 h-4 w-4" />
            Guide
          </Button>
        </div>
      </header>

      <div>
        {checkingAccess ? <div role="status" className="flex min-h-64 items-center justify-center gap-3 rounded-lg bg-muted text-sm text-muted-foreground"><Spinner size="sm" />Vérification du contexte d’import…</div>
          : accessQuery.isError || onboardingContext.error ? <QueryErrorState message="Impossible de vérifier le contexte d’import." onRetry={() => { void accessQuery.refetch(); void onboardingContext.retry() }} />
          : <>
        {!initialProfileContext ? <ContextualHelp title={accessQuery.data?.canImportProfiles ? "Imports de profils pendant l’initialisation" : "Imports de profils terminés"}>
          {accessQuery.data?.canImportProfiles && user?.tenantId ? <div className="space-y-3"><p>Les élèves et les professeurs peuvent être importés en plusieurs lots avant la finalisation de la configuration initiale.</p><Button asChild variant="outline" className="min-h-12"><Link to={`/onboarding?step=4&school=${encodeURIComponent(user.tenantId)}`}>Préparer les profils à l’étape 4</Link></Button></div> : <p>Les imports élèves et professeurs sont réservés à la configuration initiale. Ajoutez ensuite les élèves depuis les inscriptions et les professeurs depuis leur liste. Pour une reprise de données, contactez le super administrateur.</p>}
        </ContextualHelp> : null}
        {allowedImportTypes.length > 0 ? (
          isImportBlocked ? (
            <ContextualHelp title="Import indisponible hors ligne" tone="warning">
              L'import de fichiers nécessite une connexion réseau active. Reconnectez-vous puis recommencez.
            </ContextualHelp>
          ) : (
            isHistoricalStudentsImport ? <div className="space-y-4">
              <HistoricalStudentsImport key={`${user?.schemaName}:${user?.tenantId}`} />
            </div> : <ImportWizard
              selectedImportType={selectedImportType}
              onImportTypeChange={setActiveImportType}
              allowedImportTypes={allowedImportTypes}
            />
          )
        ) : (
          <ContextualHelp title="Import indisponible pour votre poste" tone="warning">
            Aucun import n’est disponible pour votre poste dans ce contexte.
          </ContextualHelp>
        )}
        </>}
      </div>

      {canViewHistory ? (
        <Card data-tour="import-history">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <CalendarClockIcon className="h-5 w-5" />
                  Historique des imports
                </CardTitle>
                <CardDescription className="mt-1">Opérations d’import confirmées.</CardDescription>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2">
                <Select value={historyMonth ?? "all"} onValueChange={handleMonthChange}>
                  <SelectTrigger className="min-h-12 w-[160px] text-xs">
                    <SelectValue placeholder="Tous les mois" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les mois</SelectItem>
                    {MONTH_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={historyType ?? "all"} onValueChange={handleTypeChange}>
                  <SelectTrigger className="min-h-12 w-[150px] text-xs">
                    <SelectValue placeholder="Tous les types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les types</SelectItem>
                    <SelectItem value="students">{studentLabels.plural}</SelectItem>
                    <SelectItem value="teachers">Professeurs</SelectItem>
                    <SelectItem value="schedule">Emploi du temps</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {historyQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Chargement de l’historique...</p>
            ) : null}

            {historyQuery.isError ? (
              <Alert variant="destructive">
                <AlertDescription>Impossible de charger l’historique des imports.</AlertDescription>
              </Alert>
            ) : null}

            {!historyQuery.isLoading && !historyQuery.isError && historyItems.length === 0 ? (
              <EmptyState title="Aucun import trouvé" description={historyMonth ?? historyType ? "Aucun import ne correspond aux filtres sélectionnés." : "Les imports validés apparaîtront ici."} />
            ) : null}

            {!historyQuery.isLoading && !historyQuery.isError && historyItems.length > 0 ? (
              <>
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Action par</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Importés</TableHead>
                        <TableHead className="text-right">Mis à jour</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {historyItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{formatDateTime(item.importedAt)}</TableCell>
                          <TableCell>
                            <p className="font-medium">{item.importedByName ?? "Utilisateur inconnu"}</p>
                            <p className="text-xs text-muted-foreground">{item.importedByRole ?? "Rôle non renseigné"}</p>
                          </TableCell>
                          <TableCell>
                            <p>{labelByType[item.type]}</p>
                            {item.schedulePeriod && (
                              <p className="text-xs text-muted-foreground">
                                (Période de validité  : {item.schedulePeriod})
                              </p>
                            )}
                            {item.historicalSchoolYearLabel ? <p className="text-xs text-muted-foreground">Historique {item.historicalSchoolYearLabel}</p> : null}
                          </TableCell>
                          <TableCell className="text-right">{item.importedCount}</TableCell>
                          <TableCell className="text-right">
                            {item.updatedCount > 0 ? (
                              <span className="text-green-600">{item.updatedCount}</span>
                            ) : (
                              <Badge variant="outline">Aucune</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
                  <span>
                    {totalItems} résultat{totalItems !== 1 ? "s" : ""}
                    {totalPages > 1 ? ` · page ${historyPage}/${totalPages}` : ""}
                  </span>
                  {totalPages > 1 ? (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-12 w-12"
                        disabled={historyPage <= 1 || historyQuery.isFetching}
                        onClick={() => setHistoryPage((p) => p - 1)}
                        aria-label="Page précédente"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-12 w-12"
                        disabled={historyPage >= totalPages || historyQuery.isFetching}
                        onClick={() => setHistoryPage((p) => p + 1)}
                        aria-label="Page suivante"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : null}
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
    </>
  )
}
