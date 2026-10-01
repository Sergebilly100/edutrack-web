import { useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { useSearchParams } from "react-router-dom"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { fetchConductDecisionWorkspace, fetchConductTeacherActions } from "./academic.api"
import { getOpenConductScopes } from "./conduct-navigation"
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
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    refetchInterval: 30_000,
    retry: false,
  })
  const teacherActionsQuery = useQuery({
    queryKey: ["conduct", "teacher-actions"],
    queryFn: fetchConductTeacherActions,
  })
  const conductPendingCount = (teacherActionsQuery.data?.teacherActions ?? [])
    .reduce((total, action) => total + action.pendingCount, 0)
  const canDecide = workspaceQuery.isSuccess && getOpenConductScopes(workspaceQuery.data).length > 0
  useEffect(() => {
    if (requestedTab !== "decisions" || !workspaceQuery.isSuccess || canDecide) return
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      next.set("tab", "conduite")
      return next
    }, { replace: true })
  }, [requestedTab, workspaceQuery.isSuccess, canDecide, setSearchParams])
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
        <TabsTrigger value="conduite" className="min-h-12 gap-1 px-1 text-xs sm:text-sm">Conduite{conductPendingCount > 0 ? <Badge variant="secondary" className="px-1.5 text-[10px]">{conductPendingCount}</Badge> : null}</TabsTrigger>
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
