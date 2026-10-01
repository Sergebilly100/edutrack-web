import { useQuery } from "@tanstack/react-query"
import { useSearchParams } from "react-router-dom"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { fetchConductDecisionWorkspace } from "./academic.api"
import ConductPage from "./ConductPage"
import ConductDecisionWorkspace from "./ConductDecisionWorkspace"
import NotesPage from "./NotesPage"
import TeacherAveragesPage from "./TeacherAveragesPage"

type NotesTab = "evaluations" | "moyennes" | "conduite" | "decisions"

export default function TeacherNotesWorkspace() {
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedTab = searchParams.get("tab") as NotesTab | null
  const workspaceQuery = useQuery({
    queryKey: ["conduct", "decision-workspace"],
    queryFn: fetchConductDecisionWorkspace,
    enabled: true,
    retry: false,
  })
  const canDecide = (workspaceQuery.data?.decisionScopes.length ?? 0) > 0
  const tab: NotesTab = requestedTab === "moyennes" || requestedTab === "conduite"
    ? requestedTab
    : requestedTab === "decisions" && canDecide ? "decisions" : requestedTab === "decisions" ? "conduite" : "evaluations"

  return <div className="min-w-0 space-y-4">
    <Tabs value={tab} onValueChange={(value) => {
      setSearchParams((current) => {
        const next = new URLSearchParams(current)
        next.set("tab", value)
        return next
      })
    }}>
      <TabsList aria-label="Sections de Notes" className="grid h-auto w-full grid-cols-3 gap-1 p-1 data-[decisions=true]:grid-cols-4" data-decisions={canDecide}>
        <TabsTrigger value="evaluations" className="min-h-12 px-1 text-xs sm:text-sm">Évaluations</TabsTrigger>
        <TabsTrigger value="moyennes" className="min-h-12 px-1 text-xs sm:text-sm">Moyennes</TabsTrigger>
        <TabsTrigger value="conduite" className="min-h-12 px-1 text-xs sm:text-sm">Conduite</TabsTrigger>
        {canDecide ? <TabsTrigger value="decisions" className="min-h-12 px-1 text-xs sm:text-sm">Décisions</TabsTrigger> : null}
      </TabsList>
    </Tabs>
    {requestedTab === "decisions" && workspaceQuery.isError ? <Alert variant="destructive"><AlertDescription className="flex flex-wrap items-center justify-between gap-2"><span>Impossible de vérifier vos décisions de conduite. Vos avis restent accessibles.</span><Button type="button" variant="outline" className="min-h-12" onClick={() => void workspaceQuery.refetch()}>Réessayer</Button></AlertDescription></Alert> : null}
    {requestedTab === "decisions" && workspaceQuery.isLoading ? <p role="status">Vérification de vos décisions…</p> : null}
    {requestedTab === "decisions" && workspaceQuery.isSuccess && !canDecide ? <Alert><AlertDescription>Aucune décision autorisée pour ce compte. La saisie des avis reste accessible.</AlertDescription></Alert> : null}
    {tab === "evaluations" ? <NotesPage /> : null}
    {tab === "moyennes" ? <TeacherAveragesPage /> : null}
    {tab === "conduite" ? <ConductPage /> : null}
    {tab === "decisions" ? <ConductDecisionWorkspace /> : null}
  </div>
}
