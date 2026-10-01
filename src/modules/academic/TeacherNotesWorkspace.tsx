import { useQuery } from "@tanstack/react-query"
import { useSearchParams } from "react-router-dom"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { fetchConductReviewWorkspace } from "./academic.api"
import ConductPage from "./ConductPage"
import ConductDecisionWorkspace from "./ConductDecisionWorkspace"
import NotesPage from "./NotesPage"
import TeacherAveragesPage from "./TeacherAveragesPage"

type NotesTab = "evaluations" | "moyennes" | "conduite" | "decisions"

export default function TeacherNotesWorkspace() {
  const [searchParams, setSearchParams] = useSearchParams()
  const workspaceQuery = useQuery({
    queryKey: ["conduct", "review-workspace"],
    queryFn: fetchConductReviewWorkspace,
  })
  const canDecide = (workspaceQuery.data?.decisionScopes.length ?? 0) > 0
  const requestedTab = searchParams.get("tab") as NotesTab | null
  const tab: NotesTab = requestedTab === "moyennes" || requestedTab === "conduite"
    ? requestedTab
    : requestedTab === "decisions" && canDecide ? "decisions" : "evaluations"

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
    {workspaceQuery.isError ? <Alert variant="destructive"><AlertDescription>Impossible de vérifier vos décisions de conduite pour le moment.</AlertDescription></Alert> : null}
    {tab === "evaluations" ? <NotesPage /> : null}
    {tab === "moyennes" ? <TeacherAveragesPage /> : null}
    {tab === "conduite" ? <ConductPage view="teacher" /> : null}
    {tab === "decisions" ? <ConductDecisionWorkspace /> : null}
  </div>
}
