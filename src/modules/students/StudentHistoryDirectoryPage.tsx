import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link, useLocation, useSearchParams } from "react-router-dom"
import { Search, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { EmptyState, PageLayout } from "@/shared/components"
import { QueryErrorState } from "@/shared/components/QueryErrorState"
import { useDebounce } from "@/shared/hooks/useDebounce"
import { listHistoryProfiles, listStudents } from "@/modules/students/students.api"
import { RecordsNavigation } from "@/modules/students/components/RecordsNavigation"

const pageSize = 20

export default function StudentHistoryDirectoryPage() {
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch] = useState(searchParams.get("search") ?? "")
  const [page, setPage] = useState(1)
  const scope = searchParams.get("scope") === "current" ? "current" : "all"
  const debouncedSearch = useDebounce(search.trim(), 200)
  const searchPending = search.trim() !== debouncedSearch
  const query = useQuery({
    queryKey: ["students", "records-directory", scope, debouncedSearch, page],
    queryFn: () => (scope === "current" ? listStudents : listHistoryProfiles)({
      page,
      limit: pageSize,
      search: debouncedSearch || undefined,
    }),
  })
  const returnTo = `${location.pathname}${location.search}`

  const setScope = (nextScope: "all" | "current") => {
    const next = new URLSearchParams(searchParams)
    if (nextScope === "all") next.delete("scope")
    else next.set("scope", nextScope)
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
    <PageLayout title="Inscriptions & dossiers" subtitle="Retrouvez un élève par nom ou matricule, même sans inscription active.">
      <div className="space-y-5">
        <RecordsNavigation />
        <section aria-label="Trouver un dossier élève" className="space-y-4 rounded-lg border bg-card p-4 sm:p-6">
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
          <div className="flex flex-wrap items-center gap-2" aria-label="Périmètre des dossiers">
            <Button type="button" variant={scope === "all" ? "secondary" : "outline"} className="min-h-12" aria-pressed={scope === "all"} onClick={() => setScope("all")}>Tous les dossiers</Button>
            <Button type="button" variant={scope === "current" ? "secondary" : "outline"} className="min-h-12" aria-pressed={scope === "current"} onClick={() => setScope("current")}>Inscrits cette année</Button>
          </div>
        </section>
        {query.isPending || searchPending ? <p className="text-sm text-muted-foreground" role="status">Recherche des dossiers…</p> : null}
        {!searchPending && query.isError ? <QueryErrorState title="Dossiers indisponibles" message="Impossible de charger les dossiers élèves." onRetry={() => void query.refetch()} /> : null}
        {!searchPending && query.isSuccess && query.data.data.length === 0 ? <EmptyState title="Aucun dossier trouvé" description={search ? "Vérifiez le nom ou le matricule, ou affichez tous les dossiers." : scope === "current" ? "Aucun élève confirmé cette année. Essayez Tous les dossiers." : "Aucun profil élève disponible."} /> : null}
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
                  {scope === "current" && student.className ? <Badge variant="secondary">{student.className}</Badge> : null}
                </div>
              </div>
              <Button variant="outline" className="min-h-12 w-full sm:w-auto" asChild><Link to={`/students/${student.id}/history?returnTo=${encodeURIComponent(returnTo)}`}>Ouvrir le dossier</Link></Button>
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
