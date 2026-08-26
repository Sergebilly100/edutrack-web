import { useState } from "react"
import { useQuery } from "@tanstack/react-query"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { EmptyState } from "@/shared/components/EmptyState"
import { fetchClassCompletion, listClasses } from "./academic.api"

export default function CompletionTrackingPage() {
  const [classId, setClassId] = useState("")
  const [gradingPeriodId, setGradingPeriodId] = useState("")

  const classesQuery = useQuery({
    queryKey: ["academic", "classes-for-completion"],
    queryFn: () => listClasses(),
  })
  const periodsQuery = useQuery({
    queryKey: ["academic", "grading-periods"],
    queryFn: async () => {
      const { apiClient } = await import("@/shared/api/client")
      return apiClient
        .get<{ gradingPeriods: Array<{ id: string; label: string }> }>("/grading-periods")
        .then((r) => r.data.gradingPeriods)
    },
  })
  const completionQuery = useQuery({
    queryKey: ["class-completion", classId, gradingPeriodId],
    queryFn: () => fetchClassCompletion(classId, gradingPeriodId),
    enabled: Boolean(classId) && Boolean(gradingPeriodId),
  })

  return (
    <div className="space-y-6 px-4 py-6 md:px-6 md:py-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Suivi de complétude</h1>
        <p className="text-sm text-muted-foreground">
          Quelles matières bloquent encore la génération des bulletins, et chez quel professeur.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Classe</Label>
          <Select value={classId || "none"} onValueChange={(value) => setClassId(value === "none" ? "" : value)}>
            <SelectTrigger className="min-h-12"><SelectValue placeholder="Choisir une classe" /></SelectTrigger>
            <SelectContent>
              {(classesQuery.data?.classes ?? []).map((klass) => (
                <SelectItem key={klass.id} value={klass.id}>{klass.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Période</Label>
          <Select
            value={gradingPeriodId || "none"}
            onValueChange={(value) => setGradingPeriodId(value === "none" ? "" : value)}
          >
            <SelectTrigger className="min-h-12"><SelectValue placeholder="Choisir une période" /></SelectTrigger>
            <SelectContent>
              {(periodsQuery.data ?? []).map((period) => (
                <SelectItem key={period.id} value={period.id}>{period.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!classId || !gradingPeriodId ? (
        <EmptyState
          title="Choisissez une classe et une période"
          description="L'état de saisie par matière s'affichera ici."
        />
      ) : completionQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : (
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle>État de saisie par matière</CardTitle>
            <CardDescription>
              Une matière « en cours » retarde la génération et la publication du bulletin.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {(completionQuery.data?.subjects.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune matière paramétrée pour ce niveau.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Matière</TableHead>
                    <TableHead>Professeur</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(completionQuery.data?.subjects ?? []).map((subject) => (
                    <TableRow key={subject.subjectId}>
                      <TableCell className="font-medium">{subject.subjectName}</TableCell>
                      <TableCell>{subject.teacher?.name ?? <span className="text-muted-foreground">Non identifié</span>}</TableCell>
                      <TableCell>
                        {subject.status === "completed" ? (
                          <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">
                            Terminée
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
                            En cours
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
