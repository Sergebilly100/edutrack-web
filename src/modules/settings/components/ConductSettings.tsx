import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { EmptyState } from "@/shared/components/EmptyState"
import {
  createEducatorAssignment, deleteEducatorAssignment, fetchConductPolicy,
  fetchEducatorAssignments, fetchEligibleEducators, listClasses, listLevels,
  listSchoolYears, updateConductPolicy, type ConductPolicyMode,
} from "@/modules/academic/academic.api"

const modes: Array<{ value: ConductPolicyMode; label: string }> = [
  { value: "homeroom", label: "Professeur principal de chaque classe" },
  { value: "direction", label: "Direction de l’école" },
  { value: "delegated", label: "Éducateur délégué" },
]

function policyErrorMessage(error: unknown): string {
  const failure = error && typeof error === "object" ? error as {
    code?: string; status?: number; response?: { status?: number; data?: { code?: string } }
  } : null
  const code = failure?.code ?? failure?.response?.data?.code
  const status = failure?.status ?? failure?.response?.status
  if (code === "SCHOOL_YEAR_NOT_FOUND") return "Cette année scolaire est introuvable. Choisissez une autre année."
  if (status === 403) return "Vous n’avez pas le droit de consulter cette politique."
  if (code === "CONDUCT_MIGRATION_REQUIRED") return "La migration de conduite de cette école n’est pas appliquée. Contactez l’administrateur technique."
  return "La politique est indisponible. Vérifiez la connexion puis réessayez."
}

export function ConductSettings({ canEditPolicy, canManageAssignments }: { canEditPolicy: boolean; canManageAssignments: boolean }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [selectedYearId, setSelectedYearId] = useState("")
  const [mode, setMode] = useState<ConductPolicyMode | "">("")
  const [coefficient, setCoefficient] = useState("")
  const [targetType, setTargetType] = useState<"class" | "level">("class")
  const [targetId, setTargetId] = useState("")
  const [userId, setUserId] = useState("")
  const yearsQuery = useQuery({ queryKey: ["academic", "school-years"], queryFn: listSchoolYears })
  const schoolYearId = selectedYearId || yearsQuery.data?.find(year => year.status === "active")?.id || ""
  const policyQuery = useQuery({ queryKey: ["conduct", "policy", schoolYearId], queryFn: () => fetchConductPolicy(schoolYearId), enabled: Boolean(schoolYearId) })
  const assignmentsQuery = useQuery({ queryKey: ["conduct", "assignments"], queryFn: fetchEducatorAssignments, enabled: canManageAssignments })
  const educatorsQuery = useQuery({ queryKey: ["conduct", "eligible-educators"], queryFn: fetchEligibleEducators, enabled: canManageAssignments })
  const classesQuery = useQuery({ queryKey: ["academic", "classes", schoolYearId], queryFn: () => listClasses(schoolYearId), enabled: canManageAssignments && Boolean(schoolYearId) })
  const levelsQuery = useQuery({ queryKey: ["academic", "levels"], queryFn: listLevels, enabled: canManageAssignments })
  const chosenMode = mode || policyQuery.data?.mode || "homeroom"
  const chosenCoefficient = coefficient || String(policyQuery.data?.coefficient ?? 1)
  const numericCoefficient = Number(chosenCoefficient.replace(",", "."))
  const savePolicy = useMutation({
    mutationFn: () => updateConductPolicy(schoolYearId, { mode: chosenMode, coefficient: numericCoefficient }),
    onSuccess: async () => {
      setMode(""); setCoefficient("")
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["conduct", "policy"] }),
        queryClient.invalidateQueries({ queryKey: ["conduct", "decision-workspace"] }),
      ])
      toast({ title: "Politique de conduite enregistrée" })
    },
    onError: (error) => toast({ title: "Politique impossible à enregistrer", description: error instanceof Error ? error.message : undefined, variant: "destructive" }),
  })
  const addAssignment = useMutation({
    mutationFn: () => createEducatorAssignment({ user_id: userId, ...(targetType === "class" ? { class_id: targetId } : { level_id: targetId }) }),
    onSuccess: async () => {
      setTargetId(""); setUserId("")
      await queryClient.invalidateQueries({ queryKey: ["conduct", "assignments"] })
      await queryClient.invalidateQueries({ queryKey: ["conduct", "decision-workspace"] })
      toast({ title: "Affectation enregistrée" })
    },
    onError: (error) => toast({ title: "Affectation impossible", description: error instanceof Error ? error.message : undefined, variant: "destructive" }),
  })
  const removeAssignment = useMutation({
    mutationFn: deleteEducatorAssignment,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["conduct", "assignments"] })
      await queryClient.invalidateQueries({ queryKey: ["conduct", "decision-workspace"] })
      toast({ title: "Affectation supprimée" })
    },
    onError: (error) => toast({ title: "Suppression impossible", description: error instanceof Error ? error.message : undefined, variant: "destructive" }),
  })

  return <section className="space-y-5 rounded-lg border p-4" aria-label="Conduite">
    <div><h2 className="font-semibold">Décision de conduite</h2><p className="text-sm text-muted-foreground">Le responsable décide même si des avis enseignants manquent. Seule la note finale entre dans la moyenne.</p></div>
    {yearsQuery.isLoading ? <p role="status">Chargement des années scolaires…</p> : yearsQuery.isError ? <div role="alert" className="space-y-2"><p>Années scolaires indisponibles.</p><Button type="button" variant="outline" className="min-h-12" onClick={() => void yearsQuery.refetch()}>Réessayer</Button></div> : (yearsQuery.data?.length ?? 0) === 0 ? <EmptyState title="Aucune année scolaire" description="Créez une année scolaire avant de configurer la conduite." /> : <>
      <div className="max-w-sm space-y-2"><Label htmlFor="conduct-year">Année scolaire</Label><Select value={schoolYearId} onValueChange={value => { setSelectedYearId(value); setMode(""); setCoefficient("") }}><SelectTrigger id="conduct-year" className="min-h-12"><SelectValue /></SelectTrigger><SelectContent>{yearsQuery.data?.map(year => <SelectItem key={year.id} value={year.id}>{year.label}</SelectItem>)}</SelectContent></Select></div>
      {policyQuery.isLoading ? <p role="status">Chargement de la politique…</p> : policyQuery.isError ? <div role="alert" className="space-y-2"><p>{policyErrorMessage(policyQuery.error)}</p><Button type="button" variant="outline" className="min-h-12" onClick={() => void policyQuery.refetch()}>Réessayer</Button></div> : <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem_auto] sm:items-end">
        <div className="space-y-2"><Label htmlFor="conduct-mode">Responsable de la décision</Label><Select value={chosenMode} onValueChange={value => setMode(value as ConductPolicyMode)} disabled={!canEditPolicy}><SelectTrigger id="conduct-mode" className="min-h-12"><SelectValue /></SelectTrigger><SelectContent>{modes.map(item => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-2"><Label htmlFor="conduct-coefficient">Coefficient annuel</Label><Input id="conduct-coefficient" type="number" min="0.001" max="99999.999" step="0.001" className="min-h-12" value={chosenCoefficient} onChange={event => setCoefficient(event.target.value)} disabled={!canEditPolicy} /></div>
        {canEditPolicy ? <Button className="min-h-12" disabled={!Number.isFinite(numericCoefficient) || numericCoefficient <= 0 || numericCoefficient > 99999.999 || savePolicy.isPending} onClick={() => savePolicy.mutate()}>{savePolicy.isPending ? "Enregistrement…" : "Enregistrer"}</Button> : null}
      </div>}
      {chosenMode === "delegated" && canManageAssignments ? <div className="space-y-4 border-t pt-4">
        <div><h3 className="font-medium">Affectations des éducateurs</h3><p className="text-sm text-muted-foreground">Chaque éducateur doit détenir la permission conduct.finalize et être affecté à une classe ou à un niveau.</p></div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Select value={targetType} onValueChange={value => { setTargetType(value as "class" | "level"); setTargetId("") }}><SelectTrigger className="min-h-12" aria-label="Portée de l’affectation"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="class">Classe</SelectItem><SelectItem value="level">Niveau</SelectItem></SelectContent></Select>
          <Select value={targetId} onValueChange={setTargetId}><SelectTrigger className="min-h-12" aria-label="Classe ou niveau"><SelectValue placeholder="Choisir" /></SelectTrigger><SelectContent>{targetType === "class" ? classesQuery.data?.classes.map(item => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>) : levelsQuery.data?.map(item => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select>
          <Select value={userId} onValueChange={setUserId}><SelectTrigger className="min-h-12" aria-label="Éducateur"><SelectValue placeholder="Choisir l’éducateur" /></SelectTrigger><SelectContent>{educatorsQuery.data?.users.map(item => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select>
        </div>
        {(classesQuery.isError || levelsQuery.isError || educatorsQuery.isError || assignmentsQuery.isError) ? <p role="alert">Affectations indisponibles. Réessayez après vérification des droits.</p> : null}
        <Button className="min-h-12" disabled={!targetId || !userId || addAssignment.isPending} onClick={() => addAssignment.mutate()}>{addAssignment.isPending ? "Enregistrement…" : "Affecter"}</Button>
        {(assignmentsQuery.data?.assignments.length ?? 0) === 0 ? <EmptyState title="Aucune affectation" description="Choisissez une classe ou un niveau et un éducateur." /> : <ul className="divide-y rounded-lg border">{assignmentsQuery.data?.assignments.map(item => <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 p-3"><span className="text-sm">{item.userName} · {item.className ?? item.levelName}</span><Button variant="outline" className="min-h-12" disabled={removeAssignment.isPending} onClick={() => removeAssignment.mutate(item.id)}>Retirer</Button></li>)}</ul>}
      </div> : null}
    </>}
  </section>
}
