import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link, useLocation, useSearchParams } from "react-router-dom"
import { Search, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { EmptyState, PageLayout } from "@/shared/components"
import { QueryErrorState } from "@/shared/components/QueryErrorState"
import { useDebounce } from "@/shared/hooks/useDebounce"
import { listLevels, listSchoolYears } from "@/modules/academic/academic.api"
import { listHistoryProfiles, listStudents } from "@/modules/students/students.api"

const pageSize = 20

export default function StudentHistoryDirectoryPage() {
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch] = useState(searchParams.get("search") ?? "")
  const [page, setPage] = useState(1)
  const scope = searchParams.get("scope") === "current" ? "current" : "all"
  const schoolYearId = scope === "all" ? searchParams.get("year") ?? "" : ""
  const levelId = searchParams.get("level") ?? ""
  const debouncedSearch = useDebounce(search.trim(), 200)
  const searchPending = search.trim() !== debouncedSearch
  const yearsQuery = useQuery({ queryKey: ["academic", "school-years"], queryFn: listSchoolYears })
  const levelsQuery = useQuery({ queryKey: ["academic", "levels"], queryFn: listLevels })
  const query = useQuery({
    queryKey: ["students", "records-directory", scope, schoolYearId, levelId, debouncedSearch, page],
    queryFn: () => (scope === "current" ? listStudents : listHistoryProfiles)({
      page,
      limit: pageSize,
      search: debouncedSearch || undefined,
      schoolYearId: schoolYearId || undefined,
      levelId: levelId || undefined,
    }),
  })
  const returnTo = `${location.pathname}${location.search}`
  const detailHref = (studentId: string, matchedYearId?: string) => {
    const detailSearch = new URLSearchParams()
    const selectedYearId = schoolYearId || matchedYearId
    if (selectedYearId) detailSearch.set("year", selectedYearId)
    detailSearch.set("returnTo", returnTo)
    return `/students/${studentId}/history?${detailSearch.toString()}`
  }

  const setScope = (nextScope: "all" | "current") => {
    const next = new URLSearchParams(searchParams)
    if (nextScope === "all") next.delete("scope")
    else {
      next.set("scope", nextScope)
      next.delete("year")
    }
    setSearchParams(next, { replace: true })
    setPage(1)
  }

  const setFilter = (key: "year" | "level", value: string) => {
    const next = new URLSearchParams(searchParams)
    if (value === "all") next.delete(key)
    else next.set(key, value)
    setSearchParams(next, { replace: true })
    setPage(1)
  }

  const setSearchValue = (value: string) => {
    setSearch(value)
    setPage(1)
    const next = new URLSearchParams(searchParams)
    if (value.trim()) next.set("search", value)
    else next.delete("search")
    setSearchParams(next, { replace: true })
  }

  return (
    <PageLayout title="Tous les dossiers élèves" subtitle="Retrouvez un élève par nom ou matricule, même sans inscription active." actions={<Button asChild variant="outline" className="min-h-12"><Link to="/students">Retour aux élèves</Link></Button>}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2  h-auto w-full rounded-xl border border-border bg-muted/50 p-1" aria-label="Périmètre des dossiers">
          <Button type="button" variant={scope === "all" ? "outline" : "secondary"} className="min-h-12 rounded-lg text-sm font-medium" aria-pressed={scope === "all"} onClick={() => setScope("all")}>Tous les dossiers</Button>
          <Button type="button" variant={scope === "current" ? "outline" : "secondary"} className="min-h-12 rounded-lg text-sm font-medium" aria-pressed={scope === "current"} onClick={() => setScope("current")}>Inscrits cette année</Button>
        </div>
        <section aria-label="Trouver un dossier élève" className="space-y-4 rounded-lg border bg-card p-4 sm:p-4">
          <div className="grid gap-4 sm:grid-cols-3">
            {scope === "all" ? <div className="space-y-2">
              <Label htmlFor="records-year-filter">Année scolaire</Label>
              <Select value={schoolYearId || "all"} onValueChange={(value) => setFilter("year", value)}>
                <SelectTrigger id="records-year-filter" className="min-h-12"><SelectValue placeholder="Toutes les années" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les années</SelectItem>
                  {(yearsQuery.data ?? []).filter((year) => year.status !== "draft").map((year) => <SelectItem key={year.id} value={year.id}>{year.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div> : null}
            <div className="space-y-2">
              <Label htmlFor="records-level-filter">Niveau</Label>
              <Select value={levelId || "all"} onValueChange={(value) => setFilter("level", value)}>
                <SelectTrigger id="records-level-filter" className="min-h-12"><SelectValue placeholder="Tous les niveaux" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les niveaux</SelectItem>
                  {(levelsQuery.data ?? []).map((level) => <SelectItem key={level.id} value={level.id}>{level.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="records-student-search">Nom ou matricule</Label>
              <div className="relative max-w-2xl">
                <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="records-student-search"
                  type="search"
                  maxLength={100}
                  className="min-h-12 pl-10 pr-12"
                  value={search}
                  onChange={(event) => setSearchValue(event.target.value)}
                  placeholder="Ex. Koné Aya ou MAT-42"
                />
                {search ? <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 min-h-12 min-w-12" aria-label="Effacer la recherche" onClick={() => setSearchValue("")}><X className="h-4 w-4" /></Button> : null}
              </div>
            </div>
          </div>
          {yearsQuery.isError || levelsQuery.isError ? <QueryErrorState title="Filtres indisponibles" message="Impossible de charger les années scolaires ou les niveaux." onRetry={() => { void yearsQuery.refetch(); void levelsQuery.refetch() }} /> : null}
        </section>
        {query.isPending || searchPending ? <p className="text-sm text-muted-foreground" role="status">Recherche des dossiers…</p> : null}
        {!searchPending && query.isError ? <QueryErrorState title="Dossiers indisponibles" message="Impossible de charger les dossiers élèves." onRetry={() => void query.refetch()} /> : null}
        {!searchPending && query.isSuccess && query.data.data.length === 0 ? <EmptyState title="Aucun dossier trouvé" description={search || schoolYearId || levelId ? "Aucun élève ne correspond à la recherche et aux filtres sélectionnés." : scope === "current" ? "Aucun élève confirmé cette année. Essayez Tous les dossiers." : "Aucun profil élève disponible."} /> : null}
        {!searchPending && query.isSuccess && query.data.data.length > 0 ? <>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
            <p>{query.data.pagination.total} dossier{query.data.pagination.total > 1 ? "s" : ""} trouvé{query.data.pagination.total > 1 ? "s" : ""}</p>
            {scope === "current" ? <Button asChild variant="link" className="min-h-12 px-0"><Link to="/students">Voir les effectifs et absences</Link></Button> : null}
          </div>
          <div className="divide-y rounded-lg border bg-card">
            {query.data.data.map((student) => <div key={student.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0 space-y-1">
                <p className="font-medium">{student.lastName} {student.firstName}</p>
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <span>{student.matricule ? `Matricule : ${student.matricule}` : "Matricule non renseigné"}</span>
                  {student.schoolYearLabel ? <Badge variant="outline">{student.schoolYearLabel}</Badge> : null}
                  {(scope === "current" || schoolYearId || levelId) && student.className ? <Badge variant="secondary">{student.className}</Badge> : null}
                </div>
              </div>
              <Button variant="outline" className="min-h-10 w-full sm:w-auto" asChild><Link to={detailHref(student.id, student.schoolYearId)}>Ouvrir le dossier</Link></Button>
            </div>)}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <span>Page {query.data.pagination.page} sur {Math.max(1, query.data.pagination.totalPages)}</span>
            <div className="flex gap-2">
              <Button variant="outline" className="min-h-12" disabled={page === 1 || query.isFetching} onClick={() => setPage((value) => value - 1)}>Précédent</Button>
              <Button variant="outline" className="min-h-12" disabled={page >= query.data.pagination.totalPages || query.isFetching} onClick={() => setPage((value) => value + 1)}>Suivant</Button>
            </div>
          </div>
        </> : null}
      </div>
    </PageLayout>
  )
}
