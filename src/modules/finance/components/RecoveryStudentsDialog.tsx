import { useEffect, useMemo, useState } from "react"
import { useInfiniteQuery } from "@tanstack/react-query"
import { ChevronRight, Search, Users } from "lucide-react"
import { Link } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { EmptyState } from "@/shared/components/EmptyState"
import { QueryErrorState } from "@/shared/components/QueryErrorState"
import type { StudentLabels } from "@/shared/hooks/useStudentLabel"
import { formatFcfa } from "@/shared/utils/formatting"
import { countedStudents, studentNoun, studentPlural } from "@/shared/utils/student-label"
import { fetchRecoveryStudents, type RecoveryClass, type RecoveryStudent } from "../finance.api"
import { FINANCE_PATHS } from "../finance.routes"
import { RateBar, ratePercent } from "./RateBar"
import { StatusPill } from "./StatusPill"

const PAGE_LIMIT = 100
const INITIAL_VISIBLE = 6

type StatusFilter = "all" | "late" | "up_to_date"

type Props = {
  open: boolean
  onClose: () => void
  schoolYearId: string
  levelId?: string
  schoolClass: RecoveryClass | null
  labels: StudentLabels
  /** Droit d'ouvrir le dossier financier d'un élève (payments.view). */
  canOpenStudent: boolean
  /** Élément (« Voir les élèves ») qui récupère le focus à la fermeture. */
  returnFocusRef?: { current: HTMLElement | null }
}

const initials = (name: string): string => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join("")
const normalize = (value: string): string => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
export const daysLateText = (days: number): string => `${days} jour${days > 1 ? "s" : ""} de retard`

function StudentRow({ student, href }: { student: RecoveryStudent; href: string | null }) {
  const pill = student.status === "late" ? <StatusPill tone="danger">En retard</StatusPill> : student.status === "up_to_date" ? <StatusPill tone="success">À jour</StatusPill> : <StatusPill tone="neutral">À calculer</StatusPill>
  const note = student.status === "late" && student.daysLate !== null ? daysLateText(student.daysLate) : student.remaining === 0 ? "Rien à payer" : null
  const content = <>
    <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground">{initials(student.name)}</span>
    <span className="min-w-0 flex-1"><span className="block truncate font-medium">{student.name}</span><span className="block truncate text-sm text-muted-foreground">{student.matricule ?? "Sans matricule"}</span></span>
    <span className="shrink-0">{pill}</span>
    <span className="w-36 shrink-0 text-right"><span className="block font-semibold tabular-nums">{formatFcfa(student.remaining)}</span>{note ? <span className={cn("block text-sm", student.status === "late" ? "text-red-700 dark:text-red-300" : "text-muted-foreground")}>{note}</span> : null}</span>
    {href ? <ChevronRight aria-hidden="true" className="h-5 w-5 shrink-0 text-muted-foreground" /> : <span className="w-5 shrink-0" />}
  </>
  const rowClass = "flex min-h-14 items-center gap-3 border-b px-1 py-3"
  return <li>{href ? <Link to={href} className={cn(rowClass, "rounded-md hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring")}>{content}</Link> : <div className={rowClass}>{content}</div>}</li>
}

export function RecoveryStudentsDialog({ open, onClose, schoolYearId, levelId, schoolClass, labels, canOpenStudent, returnFocusRef }: Props) {
  const classId = schoolClass?.classId ?? ""
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<StatusFilter>("all")
  const [showAll, setShowAll] = useState(false)

  useEffect(() => { setSearch(""); setFilter("all"); setShowAll(false) }, [classId, schoolYearId, open])

  const query = useInfiniteQuery({
    queryKey: ["finance", "recovery", "students", schoolYearId, classId, levelId ?? "", PAGE_LIMIT],
    queryFn: ({ pageParam }) => fetchRecoveryStudents(schoolYearId, classId, levelId, pageParam, PAGE_LIMIT),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.pagination.page < last.pagination.totalPages ? last.pagination.page + 1 : undefined),
    enabled: open && Boolean(schoolYearId && classId),
  })
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query
  useEffect(() => { if (hasNextPage && !isFetchingNextPage) void fetchNextPage() }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const students = useMemo(() => query.data?.pages.flatMap((page) => page.students) ?? [], [query.data])
  const counts = useMemo(() => ({ all: students.length, late: students.filter((item) => item.status === "late").length, upToDate: students.filter((item) => item.status === "up_to_date").length }), [students])
  const filtered = useMemo(() => {
    const term = normalize(search.trim())
    return students.filter((item) => (filter === "all" || item.status === filter) && (!term || normalize(item.name).includes(term) || normalize(item.matricule ?? "").includes(term)))
  }, [students, search, filter])
  const narrowed = Boolean(search.trim()) || filter !== "all"
  const visible = showAll || narrowed ? filtered : filtered.slice(0, INITIAL_VISIBLE)
  const hidden = filtered.length - visible.length
  const loading = query.isLoading || (query.isFetching && !query.data) || (Boolean(hasNextPage) && !query.isError)
  const pluralCap = studentPlural(labels, { capitalized: true })
  const hrefFor = (id: string) => canOpenStudent ? `${FINANCE_PATHS.historyDetail(id)}?schoolYearId=${encodeURIComponent(schoolYearId)}` : null
  const filters: Array<{ value: StatusFilter; label: string; count: number }> = [
    { value: "all", label: "Tous", count: counts.all }, { value: "late", label: "À suivre", count: counts.late }, { value: "up_to_date", label: "À jour", count: counts.upToDate },
  ]

  return <Dialog open={open} onOpenChange={(next) => { if (!next) onClose() }}>
    <DialogContent onCloseAutoFocus={(event) => { event.preventDefault(); returnFocusRef?.current?.focus() }} className="flex h-[100dvh] max-h-none w-full max-w-none flex-col gap-0 rounded-none p-0 sm:h-auto sm:max-h-[90vh] sm:max-w-3xl sm:rounded-lg">
      <DialogHeader className="border-b p-6 pr-12 text-left">
        <DialogTitle className="text-xl">{pluralCap} de {schoolClass?.className ?? "la classe"}</DialogTitle>
        <DialogDescription>{schoolClass ? `${countedStudents(labels, schoolClass.studentCount)} · ${schoolClass.studentsToFollow} à suivre` : ""}</DialogDescription>
      </DialogHeader>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-6">
        {schoolClass ? <div className="space-y-2">
          <div className="flex items-center justify-between text-sm"><span className="font-medium">Taux de recouvrement</span><span className="text-base font-semibold tabular-nums">{ratePercent(schoolClass.recoveryRate)} %</span></div>
          <RateBar rate={schoolClass.recoveryRate} label="Taux de recouvrement de la classe" className="[&>div]:h-2" />
          <p className="text-sm text-muted-foreground">{formatFcfa(schoolClass.paid)} encaissés sur {formatFcfa(schoolClass.expected)} attendus</p>
        </div> : null}
        <div className="relative"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label={`Rechercher un ${studentNoun(labels, 1)} ou un matricule`} placeholder={`Rechercher un ${studentNoun(labels, 1)} ou un matricule`} value={search} onChange={(event) => setSearch(event.target.value)} className="min-h-11 pl-9" /></div>
        <div role="group" aria-label="Filtrer par statut" className="flex flex-wrap gap-2">
          {filters.map((item) => <Button key={item.value} type="button" variant="outline" aria-pressed={filter === item.value} onClick={() => setFilter(item.value)} className={cn("min-h-10 rounded-full", filter === item.value && "border-primary bg-primary/10 text-primary")}>{item.label} · {item.count}</Button>)}
        </div>
        {loading ? <div aria-label={`Chargement des ${studentPlural(labels)}`} className="space-y-3">{Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-14 w-full" />)}</div> : null}
        {query.isError ? <QueryErrorState message={`Impossible de charger les ${studentPlural(labels)} de cette classe.`} onRetry={() => void query.refetch()} /> : null}
        {!loading && !query.isError && filtered.length === 0 ? <EmptyState icon={Users} title={`Aucun ${studentNoun(labels, 1)} dans cette sélection`} message="Modifiez la recherche ou le filtre." /> : null}
        {!loading && visible.length > 0 ? <ul aria-label={`Liste des ${studentPlural(labels)}`}>{visible.map((item) => <StudentRow key={item.studentId} student={item} href={hrefFor(item.studentId)} />)}</ul> : null}
        {!loading && hidden > 0 ? <Button type="button" variant="link" className="min-h-10 px-0" onClick={() => setShowAll(true)}>Afficher les {hidden} autres {studentNoun(labels, hidden)}</Button> : null}
      </div>
      <DialogFooter className="border-t p-4 sm:justify-end sm:space-x-0"><DialogClose asChild><Button type="button" variant="outline" className="min-h-11">Fermer</Button></DialogClose></DialogFooter>
    </DialogContent>
  </Dialog>
}
