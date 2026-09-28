import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { ArrowRight, WalletCards } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { EmptyState } from "@/shared/components/EmptyState"
import { PageLayout } from "@/shared/components/PageLayout"
import { QueryErrorState } from "@/shared/components/QueryErrorState"
import { fetchRecoveryStudents, fetchRecoverySummary, fetchRecoveryYears, type RecoveryMetrics } from "./finance.api"

const money = (value: number) => `${new Intl.NumberFormat("fr-FR").format(Math.round(value))} FCFA`
const rate = (value: number) => `${Math.round(value * 100)} %`

function Metrics({ data }: { data: RecoveryMetrics }) {
  return <section aria-label="Indicateurs de recouvrement" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
    <Card className="rounded-lg bg-blue-500 text-white shadow-sm sm:col-span-2">
      <CardHeader className="pb-2 border-none"><CardTitle className="text-base font-medium text-blue-50">Taux de recouvrement</CardTitle></CardHeader>
      <CardContent><p className="text-3xl font-semibold tabular-nums">{rate(data.recoveryRate)}</p><p className="mt-2 text-sm text-blue-50">{money(data.paid)} encaissés sur {money(data.expected)} attendus à date</p></CardContent>
    </Card>
    <Card className="rounded-lg shadow-sm"><CardHeader className="pb-2 border-none"><CardTitle className="text-sm font-medium">Reste à collecter</CardTitle></CardHeader><CardContent><p className="text-2xl font-semibold tabular-nums">{money(data.remaining)}</p><p className="mt-2 text-sm text-muted-foreground">Après {money(data.waived)} tolérés</p></CardContent></Card>
    <Card className="rounded-lg shadow-sm"><CardHeader className="pb-2 border-none"><CardTitle className="text-sm font-medium">Élèves à suivre</CardTitle></CardHeader><CardContent><p className="text-2xl font-semibold tabular-nums">{data.studentsToFollow}</p><p className="mt-2 text-sm text-muted-foreground">Sur {data.studentCount} inscription{data.studentCount > 1 ? "s" : ""} confirmée{data.studentCount > 1 ? "s" : ""}</p></CardContent></Card>
  </section>
}

export default function RecoveryPage() {
  const years = useQuery({ queryKey: ["finance", "recovery", "years"], queryFn: fetchRecoveryYears })
  const [yearChoice, setYearChoice] = useState("")
  const [levelId, setLevelId] = useState("")
  const [classId, setClassId] = useState("")
  const [detailClassId, setDetailClassId] = useState("")
  const [page, setPage] = useState(1)
  const schoolYearId = yearChoice || years.data?.find((item) => item.status === "active")?.id || years.data?.[0]?.id || ""
  const base = useQuery({
    queryKey: ["finance", "recovery", schoolYearId, "", ""],
    queryFn: () => fetchRecoverySummary(schoolYearId), enabled: Boolean(schoolYearId),
  })
  const summary = useQuery({
    queryKey: ["finance", "recovery", schoolYearId, levelId, classId],
    queryFn: () => fetchRecoverySummary(schoolYearId, levelId || undefined, classId || undefined),
    enabled: Boolean(schoolYearId),
  })
  const students = useQuery({
    queryKey: ["finance", "recovery", "students", schoolYearId, detailClassId, page],
    queryFn: () => fetchRecoveryStudents(schoolYearId, detailClassId, levelId || undefined, page),
    enabled: Boolean(schoolYearId && detailClassId),
  })
  const allLevels = base.data?.levels ?? []
  const allClasses = (base.data?.classes ?? []).filter((item) => !levelId || item.levelId === levelId)
  const detailClass = base.data?.classes.find((item) => item.classId === detailClassId)

  if (years.isError) return <PageLayout title="Recouvrement détaillé"><QueryErrorState message="Impossible de charger les années scolaires." onRetry={() => void years.refetch()} /></PageLayout>

  return <PageLayout title="Recouvrement détaillé" subtitle="Montants calculés sur les inscriptions confirmées de l’année scolaire.">
    <section aria-label="Filtres de recouvrement" className="grid min-w-0 gap-3 sm:grid-cols-3 rounded-lg border bg-muted/20 p-4 ">
      <div className="min-w-0 space-y-1"><label className="text-sm font-medium" htmlFor="recovery-year">Année scolaire</label><Select value={schoolYearId} onValueChange={(value) => { setYearChoice(value); setLevelId(""); setClassId(""); setDetailClassId(""); setPage(1) }}><SelectTrigger id="recovery-year" className="min-h-12 w-full"><SelectValue placeholder="Choisir une année" /></SelectTrigger><SelectContent>{years.data?.map((item) => <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>)}</SelectContent></Select></div>
      <div className="min-w-0 space-y-1"><label className="text-sm font-medium" htmlFor="recovery-level">Niveau</label><Select value={levelId || "all"} onValueChange={(value) => { setLevelId(value === "all" ? "" : value); setClassId(""); setDetailClassId(""); setPage(1) }} disabled={!schoolYearId || base.isLoading}><SelectTrigger id="recovery-level" className="min-h-12 w-full"><SelectValue placeholder="Tous les niveaux" /></SelectTrigger><SelectContent><SelectItem value="all">Tous les niveaux</SelectItem>{allLevels.map((item) => <SelectItem key={item.levelId} value={item.levelId}>{item.levelName}</SelectItem>)}</SelectContent></Select></div>
      <div className="min-w-0 space-y-1"><label className="text-sm font-medium" htmlFor="recovery-class">Classe</label><Select value={classId || "all"} onValueChange={(value) => { setClassId(value === "all" ? "" : value); setDetailClassId(""); setPage(1) }} disabled={!levelId || base.isLoading}><SelectTrigger id="recovery-class" className="min-h-12 w-full"><SelectValue placeholder="Toutes les classes" /></SelectTrigger><SelectContent><SelectItem value="all">Toutes les classes</SelectItem>{allClasses.map((item) => <SelectItem key={item.classId} value={item.classId}>{item.className}</SelectItem>)}</SelectContent></Select></div>
    </section>

    {years.isLoading || summary.isLoading || base.isLoading ? <div aria-label="Chargement du recouvrement" className="space-y-4"><Skeleton className="h-40 w-full" /><Skeleton className="h-64 w-full" /></div> : null}
    {!years.isLoading && !schoolYearId ? <EmptyState icon={WalletCards} title="Aucune année scolaire" message="Créez une année scolaire pour consulter le recouvrement." /> : null}
    {summary.isError || base.isError ? <QueryErrorState message="Impossible de charger le recouvrement." onRetry={() => { void summary.refetch(); void base.refetch() }} /> : null}
    {summary.data && !summary.isLoading ? <>
      <Metrics data={summary.data.selection} />
      {summary.data.selection.studentCount === 0 ? <EmptyState icon={WalletCards} title="Aucune inscription confirmée" message="Aucun élève ne correspond aux filtres sélectionnés." /> : <>
        <section className="min-w-0 space-y-3"><h2 className="text-lg font-medium">Par niveau</h2><div className="max-w-full overflow-x-auto rounded-lg border"><Table className="min-w-[680px]"><TableHeader><TableRow><TableHead>Niveau</TableHead><TableHead>Effectif</TableHead><TableHead>Attendu</TableHead><TableHead>Encaissé</TableHead><TableHead>Toléré</TableHead><TableHead>Reste</TableHead><TableHead>Taux</TableHead><TableHead>À suivre</TableHead></TableRow></TableHeader><TableBody>{summary.data.levels.map((item) => <TableRow key={item.levelId}><TableCell className="font-medium">{item.levelName}</TableCell><TableCell>{item.studentCount}</TableCell><TableCell>{money(item.expected)}</TableCell><TableCell>{money(item.paid)}</TableCell><TableCell>{money(item.waived)}</TableCell><TableCell>{money(item.remaining)}</TableCell><TableCell>{rate(item.recoveryRate)}</TableCell><TableCell>{item.studentsToFollow}</TableCell></TableRow>)}</TableBody></Table></div></section>
        <section className="min-w-0 space-y-3 pt-5"><h2 className="text-lg font-medium">Par classe</h2><div className="max-w-full overflow-x-auto rounded-lg border"><Table className="min-w-[760px]"><TableHeader><TableRow><TableHead>Classe</TableHead><TableHead>Effectif</TableHead><TableHead>Attendu</TableHead><TableHead>Encaissé</TableHead><TableHead>Toléré</TableHead><TableHead>Reste</TableHead><TableHead>Taux</TableHead><TableHead>À suivre</TableHead><TableHead>Élèves</TableHead></TableRow></TableHeader><TableBody>{summary.data.classes.map((item) => <TableRow key={item.classId}><TableCell className="font-medium">{item.className}<span className="block text-xs text-muted-foreground">{item.levelName}</span></TableCell><TableCell>{item.studentCount}</TableCell><TableCell>{money(item.expected)}</TableCell><TableCell>{money(item.paid)}</TableCell><TableCell>{money(item.waived)}</TableCell><TableCell>{money(item.remaining)}</TableCell><TableCell>{rate(item.recoveryRate)}</TableCell><TableCell>{item.studentsToFollow}</TableCell><TableCell><Button variant="ghost" className="min-h-12" onClick={() => { setDetailClassId(item.classId); setPage(1) }} aria-label={`Voir les élèves de ${item.className}`}>Voir <ArrowRight className="ml-1 h-4 w-4" /></Button></TableCell></TableRow>)}</TableBody></Table></div></section>
      </>}
    </> : null}

    {detailClassId ? <section className="min-w-0 space-y-3" aria-label="Détail des élèves"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-xl font-medium">Élèves de {detailClass?.className ?? "la classe"}</h2><Button variant="outline" className="min-h-12" onClick={() => setDetailClassId("")}>Fermer le détail</Button></div>
      {students.isLoading ? <Skeleton aria-label="Chargement des élèves" className="h-56 w-full" /> : null}
      {students.isError ? <QueryErrorState message="Impossible de charger les élèves de cette classe." onRetry={() => void students.refetch()} /> : null}
      {students.data && students.data.students.length === 0 ? <EmptyState icon={WalletCards} title="Aucun élève confirmé" message="Cette classe ne contient aucun élève confirmé pour l’année." /> : null}
      {students.data && students.data.students.length > 0 ? <><div className="max-w-full overflow-x-auto rounded-lg border"><Table className="min-w-[790px]"><TableHeader><TableRow><TableHead>Élève</TableHead><TableHead>Matricule</TableHead><TableHead>Statut</TableHead><TableHead>Attendu</TableHead><TableHead>Encaissé</TableHead><TableHead>Toléré</TableHead><TableHead>Reste</TableHead><TableHead>Retard</TableHead></TableRow></TableHeader><TableBody>{students.data.students.map((item) => <TableRow key={item.studentId}><TableCell className="font-medium">{item.name}</TableCell><TableCell>{item.matricule ?? "—"}</TableCell><TableCell><Badge variant="outline" className={item.status === "late" ? "border-amber-200 bg-amber-50 text-amber-800" : ""}>{item.status === "late" ? "En retard" : item.status === "waived" ? "Toléré" : item.status === "up_to_date" ? "À jour" : "À calculer"}</Badge></TableCell><TableCell>{money(item.expected)}</TableCell><TableCell>{money(item.paid)}</TableCell><TableCell>{money(item.waived)}</TableCell><TableCell>{money(item.remaining)}</TableCell><TableCell>{item.daysLate === null ? "—" : `${item.daysLate} j`}</TableCell></TableRow>)}</TableBody></Table></div><div className="flex items-center justify-between gap-2"><p className="text-sm text-muted-foreground">Page {students.data.pagination.page} sur {students.data.pagination.totalPages}</p><div className="flex gap-2"><Button variant="outline" className="min-h-12" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Précédent</Button><Button variant="outline" className="min-h-12" disabled={page >= students.data.pagination.totalPages} onClick={() => setPage((value) => value + 1)}>Suivant</Button></div></div></> : null}
    </section> : null}
  </PageLayout>
}
