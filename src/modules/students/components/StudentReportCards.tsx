import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Download, FileText } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { EmptyState } from "@/shared/components/EmptyState"
import { QueryErrorState } from "@/shared/components/QueryErrorState"
import { usePdfExportJob } from "@/shared/hooks/usePdfExportJob"
import {
  getStudentReportCard,
  listStudentReportCards,
  requestStudentReportCardPdf,
} from "@/modules/students/students.api"

const averageLabel = (value: number) => new Intl.NumberFormat("fr-CI", { maximumFractionDigits: 2 }).format(value)

export function StudentReportCards({ studentId, schoolYearId }: { studentId: string; schoolYearId: string | null }) {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)
  const cardsQuery = useQuery({
    queryKey: ["students", studentId, "published-report-cards"],
    queryFn: () => listStudentReportCards(studentId),
    enabled: Boolean(studentId),
    staleTime: 0,
  })
  const detailQuery = useQuery({
    queryKey: ["students", studentId, "published-report-card", selectedCardId],
    queryFn: () => getStudentReportCard(studentId, selectedCardId!),
    enabled: Boolean(selectedCardId),
  })
  const { launch, isRunning } = usePdfExportJob({
    fallbackFileName: "bulletin.pdf",
    startedMessage: "Le bulletin est en cours de préparation.",
    successMessage: "Bulletin téléchargé",
    errorMessage: "Impossible de préparer le bulletin.",
  })
  const cards = (cardsQuery.data ?? []).filter((card) => !schoolYearId || card.schoolYearId === schoolYearId)
  const selectedCard = cards.find((card) => card.id === selectedCardId)

  if (cardsQuery.isLoading) return <Skeleton className="h-36 w-full" aria-label="Chargement des bulletins" />
  if (cardsQuery.isError) {
    return <QueryErrorState title="Bulletins indisponibles" message="Impossible de charger les bulletins publiés." onRetry={() => void cardsQuery.refetch()} />
  }
  if (cards.length === 0) {
    return <EmptyState icon={FileText} title="Aucun bulletin publié" description={schoolYearId ? "Aucun bulletin publié pour l’année scolaire sélectionnée." : "Aucun bulletin publié pour cet élève."} />
  }

  return (
    <>
      <div className="grid gap-3 lg:grid-cols-2">
        {cards.map((card) => <Card key={card.id}>
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">{card.periodLabel}</CardTitle>
              <Badge variant="outline">{card.schoolYearLabel}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{card.className}</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">Moyenne : <strong>{averageLabel(card.generalAverage)}/20</strong> · Rang : <strong>{card.rank}/{card.classHeadcount}</strong></p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" className="min-h-12" onClick={() => setSelectedCardId(card.id)}>
                <FileText className="mr-2 h-4 w-4" />Consulter
              </Button>
              <Button type="button" className="min-h-12" disabled={isRunning} onClick={() => void launch(() => requestStudentReportCardPdf(studentId, card.id))}>
                <Download className="mr-2 h-4 w-4" />Télécharger le PDF
              </Button>
            </div>
          </CardContent>
        </Card>)}
      </div>
      <Dialog open={Boolean(selectedCardId)} onOpenChange={(open) => { if (!open) setSelectedCardId(null) }}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Bulletin · {detailQuery.data?.periodLabel ?? "Chargement"}</DialogTitle>
            <DialogDescription>{selectedCard ? `${selectedCard.className} · ${selectedCard.schoolYearLabel}` : "Détail du bulletin publié"}</DialogDescription>
          </DialogHeader>
          {detailQuery.isLoading ? <Skeleton className="h-40 w-full" /> : null}
          {detailQuery.isError ? <QueryErrorState title="Bulletin indisponible" message="Impossible de lire ce bulletin." onRetry={() => void detailQuery.refetch()} /> : null}
          {detailQuery.data ? <div className="space-y-4">
            <p className="text-sm">Moyenne générale : <strong>{averageLabel(detailQuery.data.generalAverage)}/20</strong> · Rang : <strong>{detailQuery.data.rank}/{detailQuery.data.classHeadcount}</strong></p>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Matière</TableHead><TableHead>Moyenne</TableHead><TableHead>Coefficient</TableHead><TableHead>Rang</TableHead></TableRow></TableHeader>
                <TableBody>{detailQuery.data.lines.map((line) => <TableRow key={line.id}>
                  <TableCell>{line.lineType === "conduct" ? "Conduite" : line.subjectName ?? "Matière"}</TableCell>
                  <TableCell>{averageLabel(line.average)}/20</TableCell>
                  <TableCell>{line.coefficient}</TableCell>
                  <TableCell>{line.rank ?? "-"}</TableCell>
                </TableRow>)}</TableBody>
              </Table>
            </div>
          </div> : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
