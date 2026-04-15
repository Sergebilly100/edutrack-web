import { useState } from "react"
import { useQuery } from "@tanstack/react-query"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { downloadTemplate, type ImportType } from "@/modules/import-export/import-export.api"
import { fetchImportHistory } from "@/modules/schedule/schedule.api"
import {
  CalendarClockIcon,
  ClassIcon,
  DownloadIcon,
  SpreadsheetIcon,
  TeacherIdentityIcon,
} from "@/shared/components/icons"
import ImportWizard from "./ImportWizard"

type TemplateItem = {
  type: ImportType
  label: string
  description: string
  icon: typeof ClassIcon
}

const TEMPLATE_ITEMS: TemplateItem[] = [
  {
    type: "students",
    label: "Modèle élèves",
    description: "Classes, identité et contacts parent",
    icon: ClassIcon
  },
  {
    type: "teachers",
    label: "Modèle professeurs",
    description: "Type, matières et taux horaire",
    icon: TeacherIdentityIcon
  },
  {
    type: "schedule",
    label: "Modèle emploi du temps",
    description: "Jour, créneau, professeur, classe, salle",
    icon: SpreadsheetIcon
  }
]

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  })

const labelByType: Record<ImportType, string> = {
  students: "Élèves",
  teachers: "Professeurs",
  schedule: "Emploi du temps"
}

export default function ImportPage() {
  const [downloadingType, setDownloadingType] = useState<ImportType | null>(null)
  const [templateError, setTemplateError] = useState<string | null>(null)

  const historyQuery = useQuery({
    queryKey: ["import-history", 20],
    queryFn: () => fetchImportHistory(20)
  })

  const handleDownload = async (type: ImportType) => {
    try {
      setTemplateError(null)
      setDownloadingType(type)
      await downloadTemplate(type)
    } catch {
      setTemplateError("Impossible de télécharger ce modèle pour le moment.")
    } finally {
      setDownloadingType(null)
    }
  }

  const history = historyQuery.data ?? []

  return (
    <div className="space-y-6 px-4 py-6 md:px-6 md:py-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Import de données</h1>
        <p className="text-sm text-muted-foreground">
          Utilisez les modèles Excel puis importez vos élèves, professeurs et emploi du temps.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Télécharger les modèles</CardTitle>
          <CardDescription>Commencez par un fichier conforme au format EduTrack.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {templateError ? (
            <Alert variant="destructive">
              <AlertDescription>{templateError}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-3 md:grid-cols-3">
            {TEMPLATE_ITEMS.map((item) => {
              const Icon = item.icon
              return (
                <Button
                  key={item.type}
                  variant="outline"
                  className="h-auto items-start justify-between gap-3 p-4 text-left"
                  onClick={() => void handleDownload(item.type)}
                  disabled={downloadingType !== null}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Icon className="h-4 w-4 text-primary" />
                      {item.label}
                    </div>
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  </div>
                  <span className="inline-flex items-center text-xs">
                    <DownloadIcon className="mr-1 h-3 w-3" />
                    {downloadingType === item.type ? "Chargement..." : "Télécharger"}
                  </span>
                </Button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <ImportWizard />

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
            <p className="text-sm text-muted-foreground">Aucun import disponible pour le moment.</p>
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
    </div>
  )
}
