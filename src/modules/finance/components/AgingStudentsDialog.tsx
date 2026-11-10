import { formatPersonName } from "@/shared/utils/person-name"
import { useCallback, useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { ChevronDown, ChevronRight, Search, Users } from "lucide-react"
import { Link } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/shared/components/EmptyState"
import { QueryErrorState } from "@/shared/components/QueryErrorState"
import { useDebounce } from "@/shared/hooks/useDebounce"
import { formatFcfa } from "@/shared/utils/formatting"
import { fetchAgingStudents, type AgingStudent, type FinancialAgingBucket } from "../finance.api"
import { FINANCE_PATHS } from "../finance.routes"

const PAGE_LIMIT = 10

export const AGING_BUCKET_LABELS: Record<FinancialAgingBucket["bucket"], string> = {
  "0-30": "0–30 jours",
  "31-60": "31–60 jours",
  ">60": "Plus de 60 jours",
}

const formatDay = (value: string | null): string => value
  ? new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`))
  : "Aucun paiement"
const displayName = (student: AgingStudent): string => formatPersonName({ lastName: student.last_name, firstName: student.first_name })

type Props = {
  bucket: FinancialAgingBucket["bucket"] | null
  schoolYearId: string
  onClose: () => void
  /** Droit d'ouvrir le dossier financier d'un élève (payments.view). */
  canOpenStudent: boolean
}

/** Détail d'une tranche d'ancienneté : fenêtre centrée, chiffres identiques à ceux de la tranche sur le tableau de bord. */
export function AgingStudentsDialog({ bucket, schoolYearId, onClose, canOpenStudent }: Props) {
  const [search, setSearch] = useState("")
  const [classId, setClassId] = useState("all")
  const [page, setPage] = useState(1)
  const debouncedSearch = useDebounce(search.trim(), 300)
  useEffect(() => { setSearch(""); setClassId("all"); setPage(1) }, [bucket])
  useEffect(() => { setPage(1) }, [debouncedSearch, classId])

  // Indice de défilement : la liste scrolle dans la fenêtre, on signale clairement quand il reste des lignes plus bas.
  // L'élément est suivi en état (callback ref) : la fenêtre est montée dans un portail, la ref n'est pas prête au premier rendu.
  const [listElement, setListElement] = useState<HTMLDivElement | null>(null)
  const [hasMoreBelow, setHasMoreBelow] = useState(false)
  const refreshScrollHint = useCallback(() => {
    setHasMoreBelow(Boolean(listElement) && listElement!.scrollHeight - listElement!.scrollTop - listElement!.clientHeight > 8)
  }, [listElement])

  const query = useQuery({
    queryKey: ["finance", "aging", "students", schoolYearId, bucket, page, debouncedSearch, classId],
    queryFn: () => fetchAgingStudents({ schoolYearId, bucket: bucket!, page, limit: PAGE_LIMIT, search: debouncedSearch, classId: classId === "all" ? undefined : classId }),
    enabled: bucket !== null && Boolean(schoolYearId),
    placeholderData: (previous) => previous,
  })
  const data = query.data
  const students = data?.students ?? []
  const label = bucket ? AGING_BUCKET_LABELS[bucket] : ""
  useEffect(() => {
    // Nouvelle page, nouveau filtre ou nouvelles données : on repart du haut de la liste et on recalcule l'indice.
    listElement?.scrollTo?.({ top: 0 })
    refreshScrollHint()
  }, [page, debouncedSearch, classId, bucket, data, listElement, refreshScrollHint])
  useEffect(() => {
    if (!listElement || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(refreshScrollHint)
    observer.observe(listElement)
    return () => observer.disconnect()
  }, [listElement, refreshScrollHint])
  const hrefFor = (id: string) => canOpenStudent ? `${FINANCE_PATHS.historyDetail(id)}?schoolYearId=${encodeURIComponent(schoolYearId)}` : null

  return (
    <Dialog open={bucket !== null} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="flex max-h-[90vh] w-full flex-col gap-0 p-0 sm:max-w-3xl">
        <DialogHeader className="border-b p-6 pr-12 text-left">
          <DialogTitle className="text-xl">Impayés de {label}</DialogTitle>
          <DialogDescription>
            {data ? `${formatFcfa(Number(data.total_amount))} restant dû · ${data.student_count} élève${data.student_count === 1 ? "" : "s"}` : "Chargement de la tranche…"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 border-b px-6 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative w-full sm:max-w-[16rem]">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input aria-label="Rechercher un élève ou un matricule" placeholder="Élève ou matricule" value={search} onChange={(event) => setSearch(event.target.value)} className="min-h-11 pl-9" />
            </div>
            <div className="w-full sm:w-48">
              <Select value={classId} onValueChange={setClassId} disabled={(data?.classes.length ?? 0) === 0}>
                <SelectTrigger aria-label="Filtrer par classe" className="min-h-11"><SelectValue placeholder="Toutes les classes" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les classes</SelectItem>
                  {(data?.classes ?? []).map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {classId !== "all" || search ? (
              <Button type="button" variant="ghost" className="min-h-11" onClick={() => { setSearch(""); setClassId("all") }}>Réinitialiser</Button>
            ) : null}
          </div>
        </div>
        <div className="relative min-h-0 flex-1">
          <div
            ref={setListElement}
            onScroll={refreshScrollHint}
            tabIndex={0}
            aria-label={`Liste des élèves en retard (${label}), défilante`}
            className="max-h-[48vh] min-h-[12rem] overflow-y-scroll px-6 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          >
            {query.isLoading ? <div aria-label="Chargement des élèves" className="space-y-3">{Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-14 w-full" />)}</div> : null}
            {query.isError ? <QueryErrorState message="Impossible de charger les élèves de cette tranche." onRetry={() => void query.refetch()} /> : null}
            {!query.isLoading && !query.isError && students.length === 0 ? (
              <EmptyState icon={Users} title={debouncedSearch || classId !== "all" ? "Aucun élève trouvé" : "Aucun impayé dans cette tranche"} message={debouncedSearch || classId !== "all" ? "Essayez un autre nom ou matricule, ou changez de classe." : "Aucun élève n’a de solde échu sur cette période."} />
            ) : null}
            {students.length > 0 ? (
              <ul aria-label={`Élèves en retard : ${label}`}>
                {students.map((student) => {
                  const href = hrefFor(student.student_id)
                  const content = (
                    <>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{displayName(student)}</span>
                        <span className="block truncate text-sm text-muted-foreground">{student.class_name}{student.matricule ? ` · ${student.matricule}` : ""}</span>
                        <span className="block text-xs text-muted-foreground">Dernier paiement : {formatDay(student.last_payment_date)}</span>
                      </span>
                      <span className="w-36 shrink-0 text-right">
                        <span className="block font-semibold tabular-nums">{formatFcfa(Number(student.remaining_amount))}</span>
                        <span className="block text-sm text-red-700 dark:text-red-300">{student.days_late} jour{student.days_late > 1 ? "s" : ""} de retard</span>
                      </span>
                      {href ? <ChevronRight aria-hidden="true" className="h-5 w-5 shrink-0 text-muted-foreground" /> : <span className="w-5 shrink-0" />}
                    </>
                  )
                  const rowClass = "flex min-h-14 items-center gap-3 border-b px-1 py-3"
                  return (
                    <li key={student.student_id}>
                      {href
                        ? <Link to={href} className={`${rowClass} rounded-md hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}>{content}</Link>
                        : <div className={rowClass}>{content}</div>}
                    </li>
                  )
                })}
              </ul>
            ) : null}
            {/* Toujours monté : l'indice s'estompe et se replie en douceur au lieu de disparaître d'un coup (pas de `disabled` : une règle globale force opacity:1 sur les boutons désactivés). */}
            <button
              type="button"
              tabIndex={hasMoreBelow ? 0 : -1}
              aria-hidden={!hasMoreBelow}
              onClick={() => { if (hasMoreBelow) listElement?.scrollBy?.({ top: Math.round(listElement.clientHeight * 0.8), behavior: "smooth" }) }}
              className={`sticky bottom-0 flex m-auto px-4 items-center justify-center gap-2 overflow-hidden rounded-md border bg-background text-sm font-medium text-primary transition-all duration-300 ease-out hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none ${hasMoreBelow ? "mt-1 max-h-11 min-h-11 opacity-100" : "pointer-events-none mt-0 max-h-0 min-h-0 border-transparent opacity-0"}`}
            >
              <ChevronDown aria-hidden="true" className="h-4 w-4" />
              Faites défiler pour voir la suite
            </button>
          </div>
        </div>
          {data && data.pagination.total > 0 ? (
          <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 border-t px-6 py-3 text-sm">
            <p className="text-muted-foreground" aria-live="polite">
              {(data.pagination.page - 1) * data.pagination.limit + 1}–{Math.min(data.pagination.page * data.pagination.limit, data.pagination.total)} sur {data.pagination.total} élève{data.pagination.total === 1 ? "" : "s"}
            </p>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" className="min-h-11" disabled={data.pagination.page <= 1 || query.isFetching} onClick={() => setPage((current) => Math.max(1, current - 1))}>Précédent</Button>
              <span className="min-w-20 text-center tabular-nums">Page {data.pagination.page} / {data.pagination.totalPages}</span>
              <Button type="button" variant="outline" className="min-h-11" disabled={data.pagination.page >= data.pagination.totalPages || query.isFetching} onClick={() => setPage((current) => current + 1)}>Suivant</Button>
            </div>
          </nav>
          ) : null}

        <DialogFooter className="border-t p-4 sm:justify-end sm:space-x-0">
          <DialogClose asChild><Button type="button" variant="outline" className="min-h-11">Fermer</Button></DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
