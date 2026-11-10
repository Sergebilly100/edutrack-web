import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { HelpCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { EmptyState, PageLayout } from "@/shared/components"
import { AIDE_PAGES, matchesQuery, visibleAidePages } from "@/shared/aide/aide-registry"
import { useAideViewer } from "@/shared/aide/useAide"

export default function AideCenterPage() {
  const viewer = useAideViewer()
  const [query, setQuery] = useState("")

  const groups = useMemo(() => {
    const pages = visibleAidePages(viewer, AIDE_PAGES).filter((page) => matchesQuery(page, query))
    const byEspace = new Map<string, typeof pages>()
    for (const page of pages) byEspace.set(page.espace, [...(byEspace.get(page.espace) ?? []), page])
    return [...byEspace.entries()]
  }, [viewer, query])

  return (
    <PageLayout title="Aide" subtitle="Trouvez comment faire, page par page.">
      <div className="space-y-1.5">
        <Label htmlFor="aide-centre-recherche">Que voulez-vous faire ?</Label>
        <Input id="aide-centre-recherche" type="search" className="min-h-12 max-w-xl" placeholder="Ex. paiement, bulletin, emploi du temps" value={query} onChange={(event) => setQuery(event.target.value)} />
      </div>

      {groups.length === 0 ? (
        <EmptyState
          icon={HelpCircle}
          title="Aucune aide trouvée"
          description={query ? "Essayez un autre mot, par exemple « élève » ou « absence »." : "Aucune aide n'est disponible pour votre profil pour le moment."}
        />
      ) : (
        groups.map(([espace, pages]) => (
          <section key={espace} aria-label={espace} className="space-y-3">
            <h2 className="text-lg font-semibold">{espace}</h2>
            <ul className="grid gap-3 md:grid-cols-2">
              {pages.map((page) => (
                <li key={page.id} className="space-y-2 rounded-lg border border-border bg-card p-4">
                  <h3 className="font-medium">{page.titre}</h3>
                  <p className="text-sm text-muted-foreground">{page.resume}</p>
                  {page.chemins[0].includes(":") ? (
                    <p className="text-sm text-muted-foreground">
                      Cette page s'ouvre depuis une liste ou un dossier. Ouvrez-la, puis cliquez sur « Aide ».
                    </p>
                  ) : (
                    <Button asChild variant="outline" className="min-h-12">
                      <Link to={page.chemins[0]}>Ouvrir la page</Link>
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </PageLayout>
  )
}
