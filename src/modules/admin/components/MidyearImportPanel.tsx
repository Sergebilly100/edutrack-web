import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { FileSpreadsheet, Loader2, Upload } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/components/ui/use-toast"
import { apiClient } from "@/shared/api/client"

const IMPORT_ORDER = ["levels", "subjects", "rooms", "classes", "students", "payments"] as const
type ImportType = typeof IMPORT_ORDER[number]

const IMPORT_LABELS: Record<ImportType, string> = {
  levels: "1 · Niveaux",
  subjects: "2 · Matières (coef.)",
  rooms: "3 · Salles",
  classes: "4 · Classes (→ niveau)",
  students: "5 · Élèves + parents (matricule école)",
  payments: "6 · Situation financière de départ",
}

const DEPENDENCY_HINT: Record<ImportType, string> = {
  levels: "",
  subjects: "Nécessite les niveaux.",
  rooms: "",
  classes: "Nécessite les niveaux.",
  students: "Nécessite les classes.",
  payments: "Nécessite les élèves.",
}

export function MidyearImportPanel({ tenantId }: { tenantId: string }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [selectedType, setSelectedType] = useState<ImportType>("levels")
  const [file, setFile] = useState<File | null>(null)
  const [analysis, setAnalysis] = useState<{ headers: string[]; rowCount: number; missingTargets: string[] } | null>(null)
  const [result, setResult] = useState<{ createdCount: number; errors: Array<{ rowNumber: number; reason: string }> } | null>(null)

  const rulesQuery = useQuery({
    queryKey: ["admin", "midyear", tenantId],
    queryFn: () => Promise.resolve(null),
  })
  void rulesQuery
  void queryClient

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData()
      formData.append("file", file!)
      const response = await apiClient.post(
        `/admin/schools/${tenantId}/midyear-import/${selectedType}/analyze`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } },
      )
      return response.data as { headers: string[]; rowCount: number; missingTargets: string[] }
    },
    onSuccess: (data) => setAnalysis(data),
    onError: (error) =>
      toast({
        title: "Analyse impossible",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
        duration: 6000,
      }),
  })

  const confirmMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData()
      formData.append("file", file!)
      const response = await apiClient.post(
        `/admin/schools/${tenantId}/midyear-import/${selectedType}/confirm`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } },
      )
      return response.data as { createdCount: number; errors: Array<{ rowNumber: number; reason: string }> }
    },
    onSuccess: (data) => {
      setResult(data)
      toast({ title: `${data.createdCount} ligne(s) importée(s)`, duration: 3000 })
    },
    onError: (error) =>
      toast({
        title: "Import impossible",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
        duration: 6000,
      }),
  })

  return (
    <div className="space-y-6">
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            Import « prise en main » — ordre strict
          </CardTitle>
          <CardDescription>
            L&apos;école transmet ses fichiers existants ; le mapping des colonnes est configuré une
            fois puis mémorisé. Respectez l&apos;ordre de dépendance ci-dessous.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2">
            {IMPORT_ORDER.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => {
                  setSelectedType(type)
                  setAnalysis(null)
                  setResult(null)
                  setFile(null)
                }}
                aria-current={selectedType === type}
                className={`min-h-12 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                  selectedType === type ? "border-blue-700 bg-blue-50 text-blue-900" : "border-border hover:bg-accent/50"
                }`}
              >
                {IMPORT_LABELS[type]}
                {DEPENDENCY_HINT[type] ? (
                  <span className="block text-xs text-muted-foreground">{DEPENDENCY_HINT[type]}</span>
                ) : null}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            <Label htmlFor="midyear-file">Fichier Excel ({IMPORT_LABELS[selectedType]})</Label>
            <Input
              id="midyear-file"
              type="file"
              accept=".xlsx"
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null)
                setAnalysis(null)
                setResult(null)
              }}
            />
          </div>

          <Button
            type="button"
            disabled={!file || analyzeMutation.isPending}
            onClick={() => analyzeMutation.mutate()}
          >
            {analyzeMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Analyser les colonnes
          </Button>

          {analysis ? (
            <div className="space-y-3 rounded-lg border p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{analysis.rowCount} lignes</Badge>
                <Badge variant="outline">{analysis.headers.length} colonnes détectées</Badge>
              </div>
              <p className="text-xs text-muted-foreground">Colonnes : {analysis.headers.join(" · ")}</p>
              <Button
                type="button"
                size="sm"
                disabled={confirmMutation.isPending}
                onClick={() => confirmMutation.mutate()}
              >
                {confirmMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Confirmer l&apos;import définitif
              </Button>
            </div>
          ) : null}

          {result ? (
            <div className="space-y-2 rounded-lg border p-4">
              <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">
                {result.createdCount} créée(s)
              </Badge>
              {result.errors.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ligne</TableHead>
                      <TableHead>Raison</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.errors.slice(0, 20).map((error) => (
                      <TableRow key={`${error.rowNumber}-${error.reason}`}>
                        <TableCell>{error.rowNumber}</TableCell>
                        <TableCell>{error.reason}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
