import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { ImportType } from "@/modules/import-export/import-export.api"
import { fetchImportHistory } from "@/modules/schedule/schedule.api"
import { OfflineIndicator } from "@/shared/components/OfflineIndicator"
import { ContextualHelp } from "@/shared/components/ContextualHelp"
import { CalendarClockIcon } from "@/shared/components/icons"
import { usePermissions } from "@/shared/hooks/usePermissions"
import { useAuthStore } from "@/shared/store/auth.store"
import ImportWizard from "./ImportWizard"

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

const labelByType: Record<ImportType, string> = {
  students: "Élèves",
  teachers: "Professeurs",
  schedule: "Emploi du temps",
}

export default function ImportPage() {
  const { hasPermission } = usePermissions()
  const user = useAuthStore((state) => state.user)
  const isDirector = user?.role === "director"
  const canImportStudents = isDirector || hasPermission("import.students")
  const canImportTeachers = isDirector || hasPermission("import.teachers")
  const canImportSchedule = isDirector || hasPermission("import.schedule")
  const allowedImportTypes = ([
    canImportStudents ? "students" : null,
    canImportTeachers ? "teachers" : null,
    canImportSchedule ? "schedule" : null,
  ].filter((value): value is ImportType => value !== null))
  const canViewHistory = canImportStudents
  const [activeImportType, setActiveImportType] = useState<ImportType>(allowedImportTypes[0] ?? "students")

  const historyQuery = useQuery({
    queryKey: ["import-history", 20],
    queryFn: () => fetchImportHistory(20),
    enabled: canViewHistory,
  })

  useEffect(() => {
    if (!allowedImportTypes.length) {
      return
    }

    if (!allowedImportTypes.includes(activeImportType)) {
      setActiveImportType(allowedImportTypes[0])
    }
  }, [activeImportType, allowedImportTypes])

  const history = historyQuery.data ?? []

  return (
    <div className="space-y-6 px-4 md:px-1">
      <OfflineIndicator />
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Import de données</h1>
        <p className="text-sm text-muted-foreground">
          Utilisez les modèles Excel puis importez vos élèves, professeurs et emploi du temps.
        </p>
      </header>

      {allowedImportTypes.length > 0 ? (
        <ImportWizard
          selectedImportType={activeImportType}
          onImportTypeChange={setActiveImportType}
          allowedImportTypes={allowedImportTypes}
        />
      ) : (
        <ContextualHelp title="Import indisponible pour votre poste" tone="warning">
          Aucun droit d&apos;import n&apos;est actif sur votre profil. Demandez au directeur d&apos;ajouter au moins un droit: élèves, professeurs ou emploi du temps.
        </ContextualHelp>
      )}

      {canViewHistory ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClockIcon className="h-5 w-5" />
              Historique des imports
            </CardTitle>
            <CardDescription>Dernières opérations d’import confirmées.</CardDescription>
          </CardHeader>
          <CardContent>
            {historyQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Chargement de l'historique...</p>
            ) : null}

            {historyQuery.isError ? (
              <Alert variant="destructive">
                <AlertDescription>Impossible de charger l'historique des imports.</AlertDescription>
              </Alert>
            ) : null}

            {!historyQuery.isLoading && !historyQuery.isError && history.length === 0 ? (
              <ContextualHelp title="Aucun import confirmé">
                Les imports validés apparaîtront ici avec la date, le type et les lignes traitées. Lancez d&apos;abord un import depuis le formulaire ci-dessus.
              </ContextualHelp>
            ) : null}

            {!historyQuery.isLoading && !historyQuery.isError && history.length > 0 ? (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Importés</TableHead>
                      <TableHead className="text-right">Mis à jour</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{formatDateTime(item.importedAt)}</TableCell>
                        <TableCell>{labelByType[item.type]}</TableCell>
                        <TableCell className="text-right">{item.importedCount}</TableCell>
                        <TableCell className="text-right">{item.updatedCount}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
