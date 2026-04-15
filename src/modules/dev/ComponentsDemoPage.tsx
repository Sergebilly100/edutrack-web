import { useEffect, useMemo, useRef, useState } from "react"
import { AlertCircle, CheckCircle2, Info, Users } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  DocumentList,
  DocumentUpload,
  EmptyState,
  OfflineIndicator,
  PageLayout,
  PresenceDonut,
  SalaryRow,
  Spinner,
  StatusBadge,
  TeacherProfileCard,
  WeekCoverageAlert,
  emptyStateIcons
} from "@/shared/components"
import type { SalaryRowPeriodSummary, SalaryRowTeacher } from "@/shared/components/SalaryRow"

const touchFeedbackClass = "active:scale-95 transition-transform duration-100"

type FetchScenario = "data" | "empty" | "error"

type PresenceRecord = {
  id: string
  teacher: string
  status: "present" | "absent" | "late"
  lateMinutes?: number
}

const mockRecords: PresenceRecord[] = [
  { id: "1", teacher: "M. Diallo", status: "present" },
  { id: "2", teacher: "Mme Konan", status: "late", lateMinutes: 12 },
  { id: "3", teacher: "M. Traoré", status: "absent" }
]

const salaryRows: Array<{ teacher: SalaryRowTeacher; periodSummary: SalaryRowPeriodSummary }> = [
  {
    teacher: { id: "t-1", name: "M. Diallo Ibrahim", type: "vacataire" },
    periodSummary: {
      hoursDone: 36,
      hoursPlanned: 38,
      amountFcfa: 180000,
      status: "pending",
      canMarkPaid: true,
    },
  },
  {
    teacher: { id: "t-2", name: "Mme Konan Awa", type: "permanent" },
    periodSummary: {
      hoursDone: 30,
      hoursPlanned: 40,
      amountFcfa: 150000,
      status: "paid",
      canMarkPaid: false,
    },
  },
  {
    teacher: { id: "t-3", name: "M. Traoré Koffi", type: "vacataire" },
    periodSummary: {
      hoursDone: 22,
      hoursPlanned: 36,
      amountFcfa: 110000,
      status: "disputed",
      canMarkPaid: false,
    },
  },
]

const demoTeacher = {
  id: "teacher-demo-1",
  name: "M. Coulibaly Yao",
  username: "coulibaly.yao",
  type: "vacataire" as const,
}

const demoBlockedTeacher = {
  id: "teacher-demo-2",
  name: "Mme Konan Aya",
  username: "konan.aya",
  type: "permanent" as const,
  blockReason: "Documents manquants pour le dossier RH.",
}

const FETCH_ERROR = new Error("Impossible de charger les professeurs")

function PatternFetchState() {
  const [scenario, setScenario] = useState<FetchScenario>("data")
  const [isLoading, setIsLoading] = useState(true)
  const timeoutRef = useRef<number | null>(null)

  const error = scenario === "error" ? FETCH_ERROR : null
  const data = scenario === "data" ? mockRecords : []

  const reload = () => {
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current)
    setIsLoading(true)
    timeoutRef.current = window.setTimeout(() => {
      setIsLoading(false)
      timeoutRef.current = null
    }, 1200)
  }

  useEffect(() => {
    timeoutRef.current = window.setTimeout(() => {
      setIsLoading(false)
      timeoutRef.current = null
    }, 1200)
    return () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current)
    }
  }, [])

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array(5)
          .fill(0)
          .map((_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-3">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className={touchFeedbackClass}
            onClick={reload}
          >
            Recharger
          </Button>
        </div>
      </div>
    )
  }

  if (!data.length) {
    return (
      <div className="space-y-3">
        <EmptyState
          icon={Users}
          title="Aucun professeur"
          description="Importez via Excel ou ajoutez manuellement."
          action={{ label: "Ajouter", onClick: () => undefined }}
        />
        <Button
          type="button"
          variant="outline"
          className={touchFeedbackClass}
          onClick={reload}
        >
          Recharger
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {data.map((row, index) => (
          // eslint-disable-next-line react/forbid-component-props -- animationDelay non supporté par les utilitaires Tailwind sans plugin arbitraire
          <div
            key={row.id}
            className="animate-in slide-in-from-bottom-2 duration-300 border rounded-md px-3 py-2 flex items-center justify-between"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <span className="text-sm">{row.teacher}</span>
            <StatusBadge status={row.status} lateMinutes={row.lateMinutes} />
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Select value={scenario} onValueChange={(value: FetchScenario) => setScenario(value)}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Scénario" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="data">Données</SelectItem>
            <SelectItem value="empty">Vide</SelectItem>
            <SelectItem value="error">Erreur</SelectItem>
          </SelectContent>
        </Select>
        <Button type="button" onClick={reload} className={touchFeedbackClass}>
          Simuler fetch
        </Button>
      </div>
    </div>
  )
}

function PatternMutation() {
  const [isPending, setIsPending] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const timeoutRef = useRef<number | null>(null)

  const handleSubmit = () => {
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current)
    setIsPending(true)
    setIsSuccess(false)

    timeoutRef.current = window.setTimeout(() => {
      setIsPending(false)
      setIsSuccess(true)
      timeoutRef.current = null
    }, 1200)
  }

  useEffect(
    () => () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current)
    },
    []
  )

  return (
    <div className="space-y-3">
      {isSuccess ? (
        <div className="flex items-center gap-2 text-green-600 animate-in fade-in duration-300">
          <CheckCircle2 className="h-5 w-5" />
          <span className="font-medium">Enregistré !</span>
        </div>
      ) : (
        <Button
          onClick={handleSubmit}
          disabled={isPending}
          className={cn("w-full", touchFeedbackClass)}
          size="lg"
        >
          {isPending ? (
            <>
              <Spinner size="sm" className="mr-2" />
              Enregistrement...
            </>
          ) : (
            "Je suis présent(e)"
          )}
        </Button>
      )}
      {isSuccess ? (
        <Button
          type="button"
          variant="outline"
          className={touchFeedbackClass}
          onClick={() => setIsSuccess(false)}
        >
          Rejouer
        </Button>
      ) : null}
    </div>
  )
}

function ColorTokenSwatch({
  label,
  value,
  textClass,
  bgClass,
  borderClass
}: {
  label: string
  value: string
  textClass?: string
  bgClass?: string
  borderClass?: string
}) {
  return (
    <div className={cn("rounded-md border p-3 space-y-1", bgClass, borderClass)}>
      <div className={cn("text-sm font-medium", textClass)}>{label}</div>
      <div className="text-xs text-muted-foreground">{value}</div>
    </div>
  )
}

export default function ComponentsDemoPage() {
  const [forcedNetwork, setForcedNetwork] = useState<"auto" | "offline" | "recovered">("offline")
  const [nextWeekHasCoverage, setNextWeekHasCoverage] = useState(false)
  const [demoEntityType, setDemoEntityType] = useState<"teacher" | "student">("teacher")
  const [demoEntityId, setDemoEntityId] = useState("teacher-demo-1")
  const [firstTeacherBlocked, setFirstTeacherBlocked] = useState(false)

  const shadcnVars = useMemo(
    () => [
      { label: "background", cssVar: "--background" },
      { label: "foreground", cssVar: "--foreground" },
      { label: "primary", cssVar: "--primary" },
      { label: "muted", cssVar: "--muted" },
      { label: "destructive", cssVar: "--destructive" }
    ],
    []
  )

  return (
    <PageLayout
      title="Components Demo"
      subtitle="Page temporaire /dev — à supprimer avant production"
      actions={
        <Button type="button" variant="outline" size="sm" className={touchFeedbackClass}>
          Action
        </Button>
      }
    >
      <Card>
        <CardHeader>
          <CardTitle>Composants shadcn installés</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button className={touchFeedbackClass}>Default</Button>
            <Button variant="secondary" className={touchFeedbackClass}>
              Secondary
            </Button>
            <Button variant="outline" className={touchFeedbackClass}>
              Outline
            </Button>
            <Button variant="ghost" className={touchFeedbackClass}>
              Ghost
            </Button>
            <Button variant="link" className={touchFeedbackClass}>
              Link
            </Button>
            <Button variant="destructive" className={touchFeedbackClass}>
              Destructive
            </Button>
            <Button size="sm" className={touchFeedbackClass}>
              Small
            </Button>
            <Button size="lg" className={touchFeedbackClass}>
              Large
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge>Badge</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="outline">Outline</Badge>
            <Badge variant="destructive">Destructive</Badge>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Card interne</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Exemple de contenu Card.</p>
            </CardContent>
          </Card>

          <div className="space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-full" />
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Information</AlertTitle>
            <AlertDescription>Exemple d’alerte standard.</AlertDescription>
          </Alert>

          <div className="flex flex-wrap gap-3">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" className={touchFeedbackClass}>
                  Ouvrir Dialog
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Dialogue de démo</DialogTitle>
                  <DialogDescription>
                    Ceci valide l’intégration du composant Dialog.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" className={touchFeedbackClass}>
                    Fermer
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Select defaultValue="option-1">
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Choisir" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="option-1">Option 1</SelectItem>
                <SelectItem value="option-2">Option 2</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Tabs defaultValue="one" className="w-full">
            <TabsList>
              <TabsTrigger value="one">Tab 1</TabsTrigger>
              <TabsTrigger value="two">Tab 2</TabsTrigger>
            </TabsList>
            <TabsContent value="one" className="text-sm text-muted-foreground">
              Contenu onglet 1
            </TabsContent>
            <TabsContent value="two" className="text-sm text-muted-foreground">
              Contenu onglet 2
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Composants custom</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <p className="text-sm font-medium">Spinner (sm / md / lg)</p>
            <div className="flex items-center gap-4">
              <Spinner size="sm" />
              <Spinner size="md" />
              <Spinner size="lg" />
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">OfflineIndicator (mode forcé)</p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={forcedNetwork === "offline" ? "default" : "outline"}
                className={touchFeedbackClass}
                onClick={() => setForcedNetwork("offline")}
              >
                Forcer offline
              </Button>
              <Button
                type="button"
                variant={forcedNetwork === "recovered" ? "default" : "outline"}
                className={touchFeedbackClass}
                onClick={() => setForcedNetwork("recovered")}
              >
                Forcer recovered
              </Button>
              <Button
                type="button"
                variant={forcedNetwork === "auto" ? "default" : "outline"}
                className={touchFeedbackClass}
                onClick={() => setForcedNetwork("auto")}
              >
                Auto
              </Button>
            </div>
            <OfflineIndicator forceState={forcedNetwork} />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">EmptyState (3 variantes)</p>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-md border">
                <EmptyState
                  icon={emptyStateIcons.noCourses}
                  title="Aucun cours"
                  description="Pas de cours planifié aujourd’hui."
                />
              </div>
              <div className="rounded-md border">
                <EmptyState
                  icon={emptyStateIcons.noTeachers}
                  title="Aucun professeur"
                  description="Importez via Excel ou ajoutez manuellement."
                  action={{ label: "Ajouter", onClick: () => undefined }}
                />
              </div>
              <div className="rounded-md border">
                <EmptyState
                  icon={emptyStateIcons.allGood}
                  title="Tout va bien"
                  description="Tous les enseignants sont présents."
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">StatusBadge</p>
            <div className="flex flex-wrap gap-2">
              <StatusBadge status="present" />
              <StatusBadge status="absent" />
              <StatusBadge status="late" lateMinutes={12} />
            </div>
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Le composant <code>PageLayout</code> est utilisé comme layout global de cette page.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Composants B2 - Widgets métriques</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <p className="text-sm font-medium">SalaryRow (pending / paid / disputed)</p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Professeur</TableHead>
                  <TableHead>Progression heures</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {salaryRows.map((row) => (
                  <SalaryRow
                    key={row.teacher.id}
                    teacher={row.teacher}
                    periodSummary={row.periodSummary}
                    onMarkPaid={() => undefined}
                    onExportPDF={() => undefined}
                  />
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">PresenceDonut (présences variées)</p>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border p-4 shadow-card">
                <p className="mb-3 text-xs text-muted-foreground">Semaine A</p>
                <PresenceDonut present={24} absent={3} late={2} size="sm" />
              </div>
              <div className="rounded-lg border p-4 shadow-card">
                <p className="mb-3 text-xs text-muted-foreground">Semaine B</p>
                <PresenceDonut present={16} absent={8} late={5} size="md" />
              </div>
              <div className="rounded-lg border p-4 shadow-card">
                <p className="mb-3 text-xs text-muted-foreground">Semaine C</p>
                <PresenceDonut present={0} absent={0} late={0} size="sm" />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">WeekCoverageAlert (visible / cachée)</p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={nextWeekHasCoverage ? "outline" : "default"}
                className={touchFeedbackClass}
                onClick={() => setNextWeekHasCoverage(false)}
              >
                Afficher alerte
              </Button>
              <Button
                type="button"
                variant={nextWeekHasCoverage ? "default" : "outline"}
                className={touchFeedbackClass}
                onClick={() => setNextWeekHasCoverage(true)}
              >
                Cacher alerte
              </Button>
            </div>
            <WeekCoverageAlert
              nextWeekHasCoverage={nextWeekHasCoverage}
              onNavigateToSchedule={() => undefined}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Composants B3 - Profil & Documents</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <p className="text-sm font-medium">TeacherProfileCard (actif / bloqué)</p>
            <div className="grid gap-4 lg:grid-cols-2">
              <TeacherProfileCard
                teacher={demoTeacher}
                monthStats={{
                  hours_done: 28,
                  hours_planned: 32,
                  attendance_rate: 88,
                  status: firstTeacherBlocked ? "blocked" : "active",
                }}
                onBlock={async () => {
                  setFirstTeacherBlocked(true)
                }}
                onUnblock={async () => {
                  setFirstTeacherBlocked(false)
                }}
                onViewDocuments={() => undefined}
              />

              <TeacherProfileCard
                teacher={demoBlockedTeacher}
                monthStats={{
                  hours_done: 31,
                  hours_planned: 32,
                  attendance_rate: 97,
                  status: "blocked",
                }}
                onBlock={async () => undefined}
                onUnblock={async () => undefined}
                onViewDocuments={() => undefined}
              />
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">DocumentUpload + DocumentList</p>
            <div className="grid gap-2 md:grid-cols-3">
              <Select value={demoEntityType} onValueChange={(value: "teacher" | "student") => setDemoEntityType(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Type d'entité" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="teacher">teacher</SelectItem>
                  <SelectItem value="student">student</SelectItem>
                </SelectContent>
              </Select>
              <Input
                value={demoEntityId}
                onChange={(event) => setDemoEntityId(event.target.value)}
                placeholder="ID entité"
              />
              <p className="text-xs text-muted-foreground md:self-center">
                Utiliser un ID valide du seed pour tester l'upload réel.
              </p>
            </div>

            <DocumentUpload
              entityType={demoEntityType}
              entityId={demoEntityId}
              onUploadSuccess={() => undefined}
            />

            <DocumentList entityType={demoEntityType} entityId={demoEntityId} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Patterns d’interaction obligatoires</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <p className="text-sm font-medium">Pattern 1 + 2: mutation loading puis succès</p>
            <PatternMutation />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Pattern 3 + 5: fetch state + apparition de liste</p>
            <PatternFetchState />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Pattern 4: feedback tactile</p>
            <div className="flex flex-wrap gap-2">
              <Button className={touchFeedbackClass}>Primary tactile</Button>
              <Button variant="outline" className={touchFeedbackClass}>
                Outline tactile
              </Button>
              <Button variant="secondary" className={touchFeedbackClass}>
                Secondary tactile
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Palette design system</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <ColorTokenSwatch
              label="present"
              value="text-green-700 / bg-green-100 / border-green-200"
              textClass="text-green-700"
              bgClass="bg-green-100"
              borderClass="border-green-200"
            />
            <ColorTokenSwatch
              label="absent"
              value="text-red-700 / bg-red-100 / border-red-200"
              textClass="text-red-700"
              bgClass="bg-red-100"
              borderClass="border-red-200"
            />
            <ColorTokenSwatch
              label="late"
              value="text-amber-700 / bg-amber-100 / border-amber-200"
              textClass="text-amber-700"
              bgClass="bg-amber-100"
              borderClass="border-amber-200"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shadcnVars.map((token) => (
              <div key={token.label} className="rounded-md border p-3 space-y-2 bg-background">
                <div className="text-sm font-medium">{token.label}</div>
                <div className="text-xs text-muted-foreground font-mono">{token.cssVar}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </PageLayout>
  )
}
