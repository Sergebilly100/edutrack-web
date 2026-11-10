import { useEffect, useRef, useState } from "react"
import { TourGuide } from "@/shared/components/TourGuide"
import { useTourGuide } from "@/shared/hooks/useTourGuide"
import { teacherNotesTourSteps } from "@/shared/lib/tour-steps"
import { AideButton } from "@/shared/aide/AideButton"
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
import { InstallPwaCard } from "@/shared/pwa/InstallPwaCard"
import { OfflineIndicator } from "@/shared/components/OfflineIndicator"

type NotesTab = "evaluations" | "moyennes" | "conduite" | "decisions"

export default function TeacherNotesWorkspace() {
  const tour = useTourGuide("teacher-notes", true)
  const [searchParams, setSearchParams] = useSearchParams()
  const evaluationsTabRef = useRef<HTMLButtonElement>(null)
  const [reviewNotice, setReviewNotice] = useState<"ended" | "unavailable" | null>(null)
  const hadOpenReview = useRef(false)
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
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    refetchInterval: 30_000,
    retry: false,
  })
  const conductPendingCount = (teacherActionsQuery.data?.teacherActions ?? [])
    .reduce((total, action) => total + action.pendingCount, 0)
  const openScopes = teacherActionsQuery.data?.teacherOpenScopes ?? []
  const reviewVerified = teacherActionsQuery.isSuccess && teacherActionsQuery.isFetchedAfterMount
  const canReview = reviewVerified && openScopes.length > 0
  const canDecide = workspaceQuery.isSuccess && getOpenConductScopes(workspaceQuery.data).length > 0
  useEffect(() => {
    if (requestedTab !== "decisions" || !workspaceQuery.isSuccess || !reviewVerified || canDecide) return
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      next.set("tab", canReview ? "conduite" : "evaluations")
      return next
    }, { replace: true })
  }, [requestedTab, workspaceQuery.isSuccess, reviewVerified, canDecide, canReview, setSearchParams])
  useEffect(() => {
    if (canReview) {
      hadOpenReview.current = true
      setReviewNotice(null)
    }
    if (requestedTab !== "conduite" || !reviewVerified || canReview) return
    setReviewNotice(hadOpenReview.current ? "ended" : "unavailable")
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      next.set("tab", "evaluations")
      next.delete("classId")
      next.delete("gradingPeriodId")
      return next
    }, { replace: true })
    evaluationsTabRef.current?.focus()
  }, [requestedTab, reviewVerified, canReview, setSearchParams])
  const tab: NotesTab = requestedTab === "moyennes" ? "moyennes"
    : requestedTab === "conduite" && canReview ? "conduite"
    : requestedTab === "decisions" && canDecide ? "decisions" : "evaluations"
  const verifyingReview = requestedTab === "conduite" && !reviewVerified

  return  <div className="min-w-0 space-y-4">
    <TourGuide steps={teacherNotesTourSteps} run={tour.run} stepIndex={tour.stepIndex} onStepChange={tour.setStepIndex} onFinish={tour.markDone} />
    <OfflineIndicator />
    <InstallPwaCard
      audience="user"
      headline="Installez IvoirEdu pour pointer plus vite"
      className="!mb-4 !mt-0"
    />
    <div className="flex items-center justify-between gap-3">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        Espace d’enseignement
      </p>
      <AideButton />
    </div>
    <Tabs value={tab} onValueChange={(value) => {
      setReviewNotice(null)
      setSearchParams((current) => {
        const next = new URLSearchParams(current)
        next.set("tab", value)
        return next
      })
    }}>
      <TabsList aria-label="Sections de Notes" data-tour="notes-tabs" className={`grid h-auto w-full gap-1 p-1 ${canReview && canDecide ? "grid-cols-2 sm:grid-cols-4" : canReview || canDecide ? "grid-cols-3" : "grid-cols-2"}`}>
        <TabsTrigger ref={evaluationsTabRef} value="evaluations" className="min-h-12 px-1 text-xs sm:text-sm">Évaluations</TabsTrigger>
        <TabsTrigger value="moyennes" className="min-h-12 px-1 text-xs sm:text-sm">Moyennes</TabsTrigger>
        {canReview ? <TabsTrigger value="conduite" className="min-h-12 gap-1 px-1 text-xs sm:text-sm">Conduite{conductPendingCount > 0 ? <Badge variant="warning" className="px-1.5 text-[10px]">{conductPendingCount}</Badge> : null}</TabsTrigger> : null}
        {canDecide ? <TabsTrigger value="decisions" className="min-h-12 px-1 text-xs sm:text-sm">Décisions</TabsTrigger> : null}
      </TabsList>
    </Tabs>
    {verifyingReview && !teacherActionsQuery.isError ? <p role="status">Vérification de la fenêtre de revue…</p> : null}
    {requestedTab === "conduite" && teacherActionsQuery.isError ? <Alert variant="destructive"><AlertDescription>Impossible de vérifier la fenêtre de revue. <Button type="button" variant="outline" className="min-h-12" onClick={() => void teacherActionsQuery.refetch()}>Réessayer</Button></AlertDescription></Alert> : null}
    {reviewNotice ? <p role="status" aria-live="polite" className="text-sm text-muted-foreground">{reviewNotice === "ended" ? "Fenêtre de revue terminée." : "Aucune fenêtre de revue de conduite ouverte pour vos classes."} Évaluations est maintenant sélectionné.</p> : null}
    {requestedTab === "decisions" && workspaceQuery.isError ? <Alert variant="destructive"><AlertDescription className="flex flex-wrap items-center justify-between gap-2"><span>Impossible de vérifier vos décisions de conduite. Vos avis restent accessibles.</span><Button type="button" variant="outline" className="min-h-12" onClick={() => void workspaceQuery.refetch()}>Réessayer</Button></AlertDescription></Alert> : null}
    {requestedTab === "decisions" && workspaceQuery.isLoading ? <p role="status">Vérification de vos décisions…</p> : null}
    {requestedTab === "decisions" && workspaceQuery.isSuccess && !canDecide ? <Alert><AlertDescription>Aucune décision autorisée pour ce compte. La saisie des avis reste accessible.</AlertDescription></Alert> : null}
    {tab === "evaluations" && !verifyingReview ? <NotesPage /> : null}
    {tab === "moyennes" ? <TeacherAveragesPage /> : null}
    {tab === "conduite" ? <ConductPage openScopes={openScopes} /> : null}
    {tab === "decisions" ? <ConductDecisionWorkspace /> : null}
  </div>
}
