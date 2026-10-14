import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Eye,
  FileCheck2,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import {
  listClasses,
  listLevels,
  listSchoolYears,
} from "@/modules/academic/academic.api";
import { EmptyState } from "@/shared/components/EmptyState";
import { AcademicContextFilters } from "@/shared/components/AcademicContextFilters";
import { DependentSelect } from "@/shared/components/DependentSelect";
import { FilterBar } from "@/shared/components/FilterBar";
import { ResetFiltersButton } from "@/shared/components/ResetFiltersButton";
import { PageLayout } from "@/shared/components/PageLayout";
import { QueryErrorState } from "@/shared/components/QueryErrorState";
import { usePermissions } from "@/shared/hooks/usePermissions";
import { useDebounce } from "@/shared/hooks/useDebounce";
import {
  createEnrollment,
  listEnrollments,
  listReEnrollmentCandidates,
  normalizeEnrollmentsListResponse,
  type Enrollment,
  type ReEnrollmentCandidate,
} from "./enrollments.api";
import { enrollmentStatusLabel } from "./enrollments.helpers";

const statusClassName: Record<Enrollment["status"], string> = {
  pending_cashier: "border-blue-200 bg-blue-50 text-blue-500",
  pending_dossier: "border-amber-200 bg-amber-50 text-amber-800",
  confirmed: "border-green-200 bg-green-50 text-green-800",
  blocked_unpaid: "border-red-200 bg-red-50 text-red-800",
};

const decisionLabel: Record<
  NonNullable<ReEnrollmentCandidate["finalDecision"]>,
  string
> = {
  promoted: "Admis(e)",
  repeat: "Redouble",
  expelled: "Exclu(e)",
};

const campaignStatusLabels = {
  to_process: "À traiter",
  awaiting_cashier: "Dossier créé / en attente de caisse",
  blocked_unpaid: "Bloqué par impayé",
  confirmed: "Confirmé",
  all: "Tous",
} as const;
type CampaignStatus = keyof typeof campaignStatusLabels;

function EnrollmentDocumentBadge({ enrollment }: { enrollment: Enrollment }) {
  const label =
    enrollment.documentStatus === "complete"
      ? "Dossier complet"
      : enrollment.documentStatus === "incomplete"
        ? `${enrollment.missingMandatoryDocumentCount} pièce${enrollment.missingMandatoryDocumentCount > 1 ? "s" : ""} manquante${enrollment.missingMandatoryDocumentCount > 1 ? "s" : ""}`
        : "Documents non configurés";
  const className =
    enrollment.documentStatus === "complete"
      ? "border-green-200 bg-green-50 text-green-700"
      : enrollment.documentStatus === "incomplete"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "text-muted-foreground";
  return (
    <Badge variant="outline" className={className}>
      {label}
    </Badge>
  );
}

export default function EnrollmentsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedTab = searchParams.get("tab") === "re-enrollment" ? "re-enrollment" : "dossiers";
  const { hasPermission } = usePermissions();
  const canEditDraft =
    hasPermission("enrollments.edit") && hasPermission("students.edit");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [dossierYearChoice, setDossierYearChoice] = useState("");
  const [dossierLevelId, setDossierLevelId] = useState("");
  const [dossierClassId, setDossierClassId] = useState("");
  const [dossierStatus, setDossierStatus] = useState<Enrollment["status"] | "all">("all");
  const dossierSearch = searchParams.get("search") ?? "";
  const debouncedDossierSearch = useDebounce(dossierSearch.trim(), 250);
  const updateDossierSearch = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value.trim()) next.set("search", value);
    else next.delete("search");
    setSearchParams(next, { replace: true });
    setPage(1);
  };
  const [candidatePage, setCandidatePage] = useState(1);
  const [campaignStatus, setCampaignStatus] = useState<CampaignStatus>("to_process");
  const [candidateSearch, setCandidateSearch] = useState("");
  const [recentYearChoice, setRecentYearChoice] = useState("");
  const [recentLevelId, setRecentLevelId] = useState("");
  const [recentClassId, setRecentClassId] = useState("");
  const [classSelections, setClassSelections] = useState<
    Record<string, string>
  >({});
  const yearsQuery = useQuery({
    queryKey: ["academic", "school-years", "re-enrollment"],
    queryFn: listSchoolYears,
  });
  const activeYears = (yearsQuery.data ?? []).filter((year) => year.status === "active");
  const activeYearId = activeYears.length === 1 ? activeYears[0].id : "";
  const selectedYear = activeYears.length === 1 ? activeYears[0] : null;
  const dossierYearId = dossierYearChoice === "all" ? "" : dossierYearChoice || activeYearId;
  const dossierYear = yearsQuery.data?.find((year) => year.id === dossierYearId);
  const viewingPastDossiers = selectedTab === "dossiers" && dossierYear?.status === "closed";
  const closedOriginYears = (yearsQuery.data ?? []).filter((year) => year.status === "closed" && selectedYear && year.endDate < selectedYear.startDate)
    .sort((left, right) => right.endDate.localeCompare(left.endDate));
  const recentYearId = recentYearChoice === "all" ? "" : closedOriginYears.some((year) => year.id === recentYearChoice)
    ? recentYearChoice : closedOriginYears[0]?.id || "";
  const enrollmentsQuery = useQuery({
    queryKey: [
      "enrollments",
      "list",
      "normalized-v2",
      page,
      dossierYearId,
      dossierLevelId,
      dossierClassId,
      dossierStatus,
      debouncedDossierSearch,
    ],
    queryFn: () =>
      listEnrollments({
        page,
        limit: 20,
        schoolYearId: dossierYearId || undefined,
        levelId: dossierLevelId || undefined,
        classId: dossierClassId || undefined,
        status: dossierStatus === "all" ? undefined : dossierStatus,
        ...(debouncedDossierSearch ? { search: debouncedDossierSearch } : {}),
      }),
    select: (data) => normalizeEnrollmentsListResponse(data, page, 20),
    enabled: yearsQuery.isSuccess,
  });
  const levelsQuery = useQuery({
    queryKey: ["academic", "levels", "enrollment-filters"],
    queryFn: listLevels,
  });
  const dossierClassesQuery = useQuery({
    queryKey: ["academic", "classes", "enrollment-filters", dossierYearId],
    queryFn: () => listClasses(dossierYearId),
    enabled: Boolean(dossierYearId),
  });
  const classesQuery = useQuery({
    queryKey: ["academic", "classes", "re-enrollment", activeYearId],
    queryFn: () => listClasses(activeYearId),
    enabled: Boolean(activeYearId),
  });
  const recentClassesQuery = useQuery({
    queryKey: ["academic", "classes", "re-enrollment-filters", recentYearId],
    queryFn: () => listClasses(recentYearId),
    enabled: Boolean(recentYearId),
  });
  const candidatesQuery = useQuery({
    queryKey: [
      "enrollments",
      "re-enrollment",
      "candidates",
      activeYearId,
      campaignStatus,
      recentYearId,
      recentLevelId,
      recentClassId,
      candidateSearch,
      candidatePage,
    ],
    queryFn: () =>
      listReEnrollmentCandidates({
        schoolYearId: activeYearId,
        campaignStatus,
        sourceSchoolYearId: recentYearId || undefined,
        levelId: recentLevelId || undefined,
        classId: recentClassId || undefined,
        search: candidateSearch || undefined,
        page: candidatePage,
        limit: 20,
      }),
    enabled: selectedTab === "re-enrollment" && Boolean(activeYearId),
  });
  const candidates = candidatesQuery.data?.candidates ?? [];
  const campaignCounts = candidatesQuery.data?.counts;
  const campaignCounters: Array<{ status: CampaignStatus; count: number }> = [
    { status: "to_process", count: campaignCounts?.toProcess ?? 0 },
    { status: "awaiting_cashier", count: campaignCounts?.awaitingCashier ?? 0 },
    { status: "blocked_unpaid", count: campaignCounts?.blockedUnpaid ?? 0 },
    { status: "confirmed", count: campaignCounts?.confirmed ?? 0 },
    { status: "all", count: campaignCounts?.all ?? 0 },
  ];
  const candidatesForbidden = axios.isAxiosError(candidatesQuery.error) && candidatesQuery.error.response?.status === 403;
  const dossierFilterClasses = (dossierClassesQuery.data?.classes ?? []).filter(
    (item) => !dossierLevelId || item.level.id === dossierLevelId,
  );
  const recentFilterClasses = (recentClassesQuery.data?.classes ?? []).filter(
    (item) => !recentLevelId || item.level.id === recentLevelId,
  );
  const reEnrollmentMutation = useMutation({
    mutationFn: ({
      studentId,
      classId,
    }: {
      studentId: string;
      classId: string;
    }) =>
      createEnrollment({
        studentId,
        classId,
        schoolYearId: activeYearId,
        type: "re_registration",
      }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["enrollments"] });
      toast({
        title:
          result.enrollment.status === "blocked_unpaid"
            ? "Réinscription bloquée"
            : "Réinscription créée",
        description:
          result.enrollment.status === "blocked_unpaid"
            ? "Le parent doit régulariser les impayés avant de poursuivre."
            : "Le dossier peut maintenant être transmis à la caisse.",
      });
    },
    onError: (error) =>
      toast({
        title: "Réinscription impossible",
        description:
          axios.isAxiosError(error) &&
          typeof error.response?.data?.error === "string"
            ? error.response.data.error
            : "Vérifiez la décision finale et la classe choisie, puis réessayez.",
        variant: "destructive",
      }),
  });
  const enrollmentRows = Array.isArray(enrollmentsQuery.data?.enrollments)
    ? enrollmentsQuery.data.enrollments
    : [];
  const namedEnrollments = useMemo(
    () => enrollmentRows.map((enrollment) => {
      const yearStatus = yearsQuery.data?.find((year) => year.id === enrollment.schoolYearId)?.status;
      return { enrollment, isActiveYear: yearStatus === "active", yearStatus };
    }),
    [enrollmentRows, yearsQuery.data],
  );
  const updateDossierYear = (yearId: string) => {
    setDossierYearChoice(yearId || "all");
    setDossierLevelId("");
    setDossierClassId("");
    updateDossierSearch("");
    setPage(1);
  };
  const updateRecentYear = (yearId: string) => {
    setRecentYearChoice(yearId || "all");
    setRecentLevelId("");
    setRecentClassId("");
    setCandidateSearch("");
    setCandidatePage(1);
  };
  if (!hasPermission("enrollments.view")) {
    return <PageLayout title="Inscriptions"><Alert variant="destructive"><AlertDescription>Vous n’avez pas accès aux inscriptions et aux candidats à la réinscription.</AlertDescription></Alert></PageLayout>;
  }
  return (
    <PageLayout
      title="Inscriptions"
      subtitle={selectedTab === "re-enrollment" ? "Suivez les élèves à traiter et ceux déjà réinscrits." : viewingPastDossiers ? `Dossiers ${dossierYear.label} · consultation seule.` : "Consultez les inscriptions de l’année sélectionnée."}
      actions={
        hasPermission("enrollments.create") && !viewingPastDossiers ? (
          <Button asChild>
            <Link to="/enrollments/new">
              <Plus className="mr-2 h-4 w-4" />
              Nouvelle inscription
            </Link>
          </Button>
        ) : undefined
      }
    >
      <Tabs value={selectedTab} onValueChange={(value) => {
        const next = new URLSearchParams(searchParams);
        if (value === "re-enrollment") next.set("tab", "re-enrollment");
        else next.delete("tab");
        setSearchParams(next, { replace: true });
      }} className="space-y-5">
        <TabsList className="grid h-auto w-full grid-cols-2 rounded-lg sm:w-[420px]">
          <TabsTrigger value="dossiers" className="min-h-12">Dossiers</TabsTrigger>
          <TabsTrigger value="re-enrollment" className="min-h-12">Réinscriptions</TabsTrigger>
        </TabsList>
        <TabsContent value="dossiers" className="space-y-4">
          <div className="space-y-4 rounded-lg border bg-card p-4">
            <AcademicContextFilters yearIdPrefix="dossier" years={yearsQuery.data ?? []} yearId={dossierYearId}
              activeYear={selectedYear ?? undefined} showPeriod={false} allowAllYears
              onYearChange={updateDossierYear} yearDisabled={yearsQuery.isLoading} />
            <FilterBar>
            <DependentSelect id="dossier-level-filter" label="Niveau" value={dossierLevelId}
              options={(levelsQuery.data ?? []).map((level) => ({ id: level.id, label: level.name }))}
              dependsOn={{ field: "year", value: dossierYearId }} allLabel="Tous les niveaux"
              onValueChange={(value) => { setDossierLevelId(value); setDossierClassId(""); updateDossierSearch(""); setPage(1) }} />
            <DependentSelect id="dossier-class-filter" label="Classe" value={dossierClassId}
              options={dossierFilterClasses.map((item) => ({ id: item.id, label: item.name }))}
              dependsOn={{ field: dossierYearId ? "level" : "year", value: dossierYearId && dossierLevelId ? dossierLevelId : "" }}
              allLabel="Toutes les classes" loading={dossierClassesQuery.isFetching && Boolean(dossierLevelId)}
              onValueChange={(value) => { setDossierClassId(value); updateDossierSearch(""); setPage(1) }} />
            <div className="space-y-2">
              <Label htmlFor="enrollment-dossier-search">Rechercher une inscription par nom ou matricule</Label>
              <div className="relative">
                <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="enrollment-dossier-search" type="search" maxLength={100} className="min-h-12 pl-10" placeholder="Ex. Koné Aya ou MAT-42" value={dossierSearch} onChange={(event) => updateDossierSearch(event.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dossier-status-filter">Statut</Label>
              <Select value={dossierStatus} onValueChange={(value) => { setDossierStatus(value as Enrollment["status"] | "all"); setPage(1) }}>
                <SelectTrigger id="dossier-status-filter" className="min-h-12"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  {Object.keys(statusClassName).map((status) => <SelectItem key={status} value={status}>{enrollmentStatusLabel[status as Enrollment["status"]]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            </FilterBar>
            <ResetFiltersButton active={Boolean(dossierYearChoice || dossierLevelId || dossierClassId || dossierStatus !== "all" || dossierSearch)}
              onReset={() => { setDossierYearChoice(""); setDossierLevelId(""); setDossierClassId(""); setDossierStatus("all"); updateDossierSearch(""); setPage(1) }} />
          </div>
          {enrollmentsQuery.isLoading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((item) => (
                <div
                  key={item}
                  className="h-24 animate-pulse rounded-lg bg-muted"
                />
              ))}
            </div>
          ) : null}
          {enrollmentsQuery.isError ? (
            <Alert variant="destructive">
              <AlertDescription>
                Impossible de charger les dossiers d’inscription.
              </AlertDescription>
            </Alert>
          ) : null}
          {!enrollmentsQuery.isLoading &&
          !enrollmentsQuery.isError &&
          namedEnrollments.length === 0 ? (
            <EmptyState
              title="Aucun dossier d’inscription"
              description={dossierSearch || dossierYearId || dossierLevelId || dossierClassId || dossierStatus !== "all" ? "Aucune inscription ne correspond à la recherche ou aux filtres. Essayez un autre nom, matricule ou statut." : "Créez une nouvelle inscription ou ouvrez Réinscriptions."}
              icon={FileCheck2}
            />
          ) : null}
          {namedEnrollments.length > 0 ? (
            <div className="space-y-3 md:hidden">
              {namedEnrollments.map(({ enrollment, isActiveYear, yearStatus }) => (
                <article key={enrollment.id} className="space-y-3 rounded-lg border bg-card p-4">
                  <div>
                    <p className="font-medium">{enrollment.studentLastName} {enrollment.studentFirstName}</p>
                    <p className="text-sm text-muted-foreground">{enrollment.schoolYearLabel} · {enrollment.className} · {enrollment.type === "re_registration" ? "Réinscription" : "Nouvelle inscription"}</p>
                    <p className="text-xs text-muted-foreground">{isActiveYear ? "Année active" : yearStatus === "closed" ? "Année clôturée · Consultation seule" : "Année non active · Consultation seule"}</p>
                  </div>
                  <Badge className={`w-fit border ${statusClassName[enrollment.status]}`}>{enrollmentStatusLabel[enrollment.status]}</Badge>
                  <div className="flex flex-wrap gap-2">
                    {hasPermission("students.view") ? (
                      <Button asChild variant="outline" className="min-h-12 flex-1">
                        <Link to={`/students/${enrollment.studentId}/history?year=${enrollment.schoolYearId}&returnTo=${encodeURIComponent(`/enrollments${searchParams.toString() ? `?${searchParams.toString()}` : ""}`)}`}>Voir le dossier</Link>
                      </Button>
                    ) : isActiveYear ? (
                      <Button asChild variant="outline" className="min-h-12 flex-1"><Link to={`/enrollments/students/${enrollment.studentId}/documents`}>Documents d’inscription</Link></Button>
                    ) : null}
                    {isActiveYear && canEditDraft && enrollment.status !== "confirmed" ? <Button asChild variant="outline" className="min-h-12"><Link to={`/enrollments/${enrollment.id}/edit`}>Modifier</Link></Button> : null}
                    {isActiveYear && hasPermission("enrollments.confirm_payment") && enrollment.status !== "confirmed" && enrollment.status !== "blocked_unpaid" ? <Button asChild className="min-h-12"><Link to={`/enrollments/${enrollment.id}/payment`}>Caisse</Link></Button> : null}
                  </div>
                </article>
              ))}
            </div>
          ) : null}
          {namedEnrollments.length > 0 ? (
            <div className="hidden overflow-x-auto rounded-lg border bg-card md:block">
              <Table className="min-w-[62rem]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Élève</TableHead>
                    <TableHead>Classe visée</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Dossier</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {namedEnrollments.map(({ enrollment, isActiveYear, yearStatus }) => (
                    <TableRow key={enrollment.id}>
                      <TableCell className="font-medium">
                        {enrollment.studentLastName}{" "}
                        {enrollment.studentFirstName}
                      </TableCell>
                      <TableCell>
                        <span className="block">{enrollment.className}</span>
                        <span className="text-xs text-muted-foreground">
                          {enrollment.schoolYearLabel} · {isActiveYear ? "Année active" : yearStatus === "closed" ? "Année clôturée · Consultation seule" : "Année non active · Consultation seule"}
                        </span>
                      </TableCell>
                      <TableCell>
                        {enrollment.type === "re_registration"
                          ? "Réinscription"
                          : "Nouvelle inscription"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={`w-fit border ${statusClassName[enrollment.status]}`}
                        >
                          {enrollmentStatusLabel[enrollment.status]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <EnrollmentDocumentBadge enrollment={enrollment} />
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          {isActiveYear && canEditDraft && enrollment.status !== "confirmed" ? (
                            <Button size="sm" variant="outline" asChild>
                              <Link to={`/enrollments/${enrollment.id}/edit`}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Modifier
                              </Link>
                            </Button>
                          ) : null}
                          {hasPermission("students.view") ? <Button size="sm" variant="outline" asChild>
                            <Link
                              to={`/students/${enrollment.studentId}/history?year=${enrollment.schoolYearId}&returnTo=${encodeURIComponent(`/enrollments${searchParams.toString() ? `?${searchParams.toString()}` : ""}`)}`}
                            >
                              Voir le dossier
                            </Link>
                          </Button> : isActiveYear ? <Button size="sm" variant="outline" asChild><Link to={`/enrollments/students/${enrollment.studentId}/documents`}>Documents d’inscription</Link></Button> : null}
                          {isActiveYear && hasPermission("enrollments.confirm_payment") &&
                          enrollment.status !== "confirmed" &&
                          enrollment.status !== "blocked_unpaid" ? (
                            <Button size="sm" asChild>
                              <Link
                                to={`/enrollments/${enrollment.id}/payment`}
                              >
                                Caisse
                                <ArrowRight className="ml-2 h-4 w-4" />
                              </Link>
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}
          {enrollmentsQuery.data &&
          enrollmentsQuery.data.pagination.totalPages > 1 ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                Page {enrollmentsQuery.data.pagination.page} sur{" "}
                {enrollmentsQuery.data.pagination.totalPages},{" "}
                {enrollmentsQuery.data.pagination.total} dossiers
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  disabled={page === 1 || enrollmentsQuery.isFetching}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  Précédent
                </Button>
                <Button
                  variant="outline"
                  disabled={
                    page >= enrollmentsQuery.data.pagination.totalPages ||
                    enrollmentsQuery.isFetching
                  }
                  onClick={() => setPage((current) => current + 1)}
                >
                  Suivant
                </Button>
              </div>
            </div>
          ) : null}
        </TabsContent>
        <TabsContent value="re-enrollment" className="space-y-5">
          {yearsQuery.isLoading ? <p role="status" className="text-sm text-muted-foreground">Chargement de la campagne…</p> : null}
          {yearsQuery.isError ? <QueryErrorState message="Impossible de charger les années scolaires." onRetry={() => void yearsQuery.refetch()} isRetrying={yearsQuery.isFetching} /> : null}
          {levelsQuery.isError ? <QueryErrorState message="Impossible de charger les niveaux scolaires." onRetry={() => void levelsQuery.refetch()} isRetrying={levelsQuery.isFetching} /> : null}
          {classesQuery.isError ? <QueryErrorState message="Impossible de charger les classes de l’année de campagne." onRetry={() => void classesQuery.refetch()} isRetrying={classesQuery.isFetching} /> : null}
          {recentClassesQuery.isError ? <QueryErrorState message="Impossible de charger les classes récentes." onRetry={() => void recentClassesQuery.refetch()} isRetrying={recentClassesQuery.isFetching} /> : null}
          {yearsQuery.isSuccess && activeYears.length === 0 ? (
            <EmptyState title="Aucune campagne active" description="La campagne débutera lorsqu’une nouvelle année scolaire sera ouverte. Les inscriptions des années clôturées restent consultables dans Inscriptions." />
          ) : null}
          {yearsQuery.isSuccess && activeYears.length > 1 ? <Alert variant="destructive"><AlertDescription>Plusieurs années scolaires sont actives. Corrigez ce conflit avant de lancer la campagne.</AlertDescription></Alert> : null}
          {selectedYear ? <>
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Campagne {selectedYear.label}</h2>
            <div className="flex flex-wrap gap-2" aria-label={`Compteurs de la campagne ${selectedYear.label}`}>
              {campaignCounters.map(({ status, count }) => (
                <Badge key={status} variant="outline">{campaignStatusLabels[status]} : {candidatesQuery.isLoading ? "…" : count}</Badge>
              ))}
            </div>
          </div>
          <div className="space-y-4 rounded-lg border bg-card p-4">
            <AcademicContextFilters yearIdPrefix="re-enrollment" years={closedOriginYears} yearId={recentYearId}
              activeYear={selectedYear ?? undefined} showPeriod={false} allowAllYears allYearsLabel="Toutes les années d’origine"
              yearLabel="Année d’origine clôturée" yearHint={recentYearChoice ? undefined : "Année clôturée la plus récente."}
              onYearChange={updateRecentYear} yearDisabled={yearsQuery.isLoading || !closedOriginYears.length} />
            <FilterBar>
            <DependentSelect id="recent-level-filter" label="Niveau récent" value={recentLevelId}
              options={(levelsQuery.data ?? []).map((level) => ({ id: level.id, label: level.name }))}
              dependsOn={{ field: "year", value: recentYearId }} allLabel="Tous les niveaux"
              onValueChange={(value) => { setRecentLevelId(value); setRecentClassId(""); setCandidateSearch(""); setCandidatePage(1) }} />
            <DependentSelect id="recent-class-filter" label="Classe récente" value={recentClassId}
              options={recentFilterClasses.map((item) => ({ id: item.id, label: item.name }))}
              dependsOn={{ field: recentYearId ? "level" : "year", value: recentYearId && recentLevelId ? recentLevelId : "" }}
              allLabel="Toutes les classes" loading={recentClassesQuery.isFetching && Boolean(recentLevelId)}
              onValueChange={(value) => { setRecentClassId(value); setCandidateSearch(""); setCandidatePage(1) }} />
            <div className="space-y-2">
              <Label htmlFor="candidate-search">Élève, nom ou matricule</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="candidate-search" aria-label="Filtrer les élèves" className="min-h-12 pl-9" value={candidateSearch}
                  onChange={(event) => { setCandidateSearch(event.target.value); setCandidatePage(1) }} placeholder="Filtrer par nom ou matricule" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="campaign-status-filter">État de la campagne</Label>
              <Select value={campaignStatus} onValueChange={(value) => { setCampaignStatus(value as CampaignStatus); setCandidatePage(1) }}>
                <SelectTrigger id="campaign-status-filter" className="min-h-12"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(campaignStatusLabels) as CampaignStatus[]).map((status) => <SelectItem key={status} value={status}>{campaignStatusLabels[status]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            </FilterBar>
            <ResetFiltersButton active={Boolean(recentYearChoice || recentLevelId || recentClassId || candidateSearch || campaignStatus !== "to_process")}
              onReset={() => { setRecentYearChoice(""); setRecentLevelId(""); setRecentClassId(""); setCandidateSearch(""); setCampaignStatus("to_process"); setCandidatePage(1) }} />
          </div>
          {candidatesForbidden ? <Alert variant="destructive"><AlertDescription>Vous n’avez pas accès aux candidats à la réinscription.</AlertDescription></Alert> : null}
          {candidatesQuery.isError && !candidatesForbidden ? (
            <QueryErrorState
              message="Impossible de charger les élèves."
              onRetry={() => void candidatesQuery.refetch()}
              isRetrying={candidatesQuery.isFetching}
            />
          ) : null}
          {candidatesQuery.isLoading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((item) => (
                <div
                  key={item}
                  className="h-24 animate-pulse rounded-lg bg-muted"
                />
              ))}
            </div>
          ) : null}
          {!candidatesQuery.isLoading &&
          !candidatesQuery.isError &&
          candidates.length === 0 ? (
            <EmptyState
              title="Aucun élève pour cet état"
              description="Modifiez l’état, la recherche ou les filtres. Les années clôturées sont consultables dans Dossiers."
            />
          ) : null}
          {candidates.length > 0 ? (
            <div className="divide-y rounded-lg border bg-card">
              {candidates.map((candidate) => {
                const eligibleClasses = (
                  classesQuery.data?.classes ?? []
                ).filter((item) => item.level.id === candidate.nextLevelId);
                const existing = candidate.enrollment;
                return (
                  <div key={candidate.studentId} className="space-y-4 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-medium">
                          {candidate.studentLastName}{" "}
                          {candidate.studentFirstName}
                        </p>
                        {candidate.studentMatricule ? <p className="text-sm text-muted-foreground">Matricule : {candidate.studentMatricule}</p> : null}
                        <p className="text-sm text-muted-foreground">
                          Année clôturée : {candidate.currentSchoolYearLabel} ·
                          Classe : {candidate.currentClassName}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {hasPermission("students.view") ? <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="min-h-10"
                          onClick={() =>
                            navigate(`/students/${candidate.studentId}/history?year=${candidate.currentSchoolYearId}&returnTo=${encodeURIComponent("/enrollments?tab=re-enrollment")}`)
                          }
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          Voir dossier
                        </Button> : null}
                        {existing ? (
                          <Badge
                            className={`w-fit border ${statusClassName[existing.status]}`}
                          >
                            {enrollmentStatusLabel[existing.status]}
                          </Badge>
                        ) : (
                          <Badge variant="outline">À traiter</Badge>
                        )}
                      </div>
                    </div>
                    {!candidate.finalDecision ? (
                      <Alert>
                        <AlertDescription>
                          La décision de fin d’année doit être validée avant la
                          réinscription.
                        </AlertDescription>
                      </Alert>
                    ) : null}
                    {candidate.finalDecision ? (
                      <p className="text-sm text-muted-foreground">
                        Décision : {decisionLabel[candidate.finalDecision]} ·
                        Niveau proposé :{" "}
                        {candidate.nextLevelName ?? "non défini"} · Classe cible : {existing?.className ?? "à choisir"}
                      </p>
                    ) : null}
                    {existing?.status === "blocked_unpaid" ? (
                      <Alert variant="destructive">
                        <AlertDescription>
                          La réinscription est bloquée par un impayé. La caisse
                          peut régulariser la dette si l’inscription de l’année
                          précédente est validée. Si l’élève n’apparaît pas
                          dans les encaissements, faites vérifier son dossier
                          antérieur par la direction.
                        </AlertDescription>
                      </Alert>
                    ) : null}
                    {!existing &&
                    candidate.finalDecision &&
                    candidate.finalDecision !== "expelled" ? (
                      <div className="grid gap-3 rounded-lg border bg-muted/40 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end" aria-label={`Réinscription de ${candidate.studentFirstName} ${candidate.studentLastName}`}>
                        <div className="space-y-2">
                          <Label>
                            Classe proposée pour {selectedYear.label}
                          </Label>
                          <Select
                            value={classSelections[candidate.studentId] ?? ""}
                            onValueChange={(value) =>
                              setClassSelections((current) => ({
                                ...current,
                                [candidate.studentId]: value,
                              }))
                            }
                          >
                            <SelectTrigger className="min-h-12">
                              <SelectValue
                                placeholder={
                                  classesQuery.isLoading
                                    ? "Chargement…"
                                    : eligibleClasses.length
                                      ? "Choisir la classe"
                                      : "Aucune classe compatible"
                                }
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {eligibleClasses.map((item) => (
                                <SelectItem key={item.id} value={item.id}>
                                  {item.name} · {item.studentCount} {item.studentCount === 1 ? "élève confirmé" : "élèves confirmés"}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Button
                          className="min-h-12"
                          disabled={
                            !classSelections[candidate.studentId] ||
                            reEnrollmentMutation.isPending
                          }
                          onClick={() =>
                            reEnrollmentMutation.mutate({
                              studentId: candidate.studentId,
                              classId: classSelections[candidate.studentId]!,
                            })
                          }
                        >
                          {reEnrollmentMutation.isPending &&
                          reEnrollmentMutation.variables?.studentId ===
                            candidate.studentId ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="mr-2 h-4 w-4" />
                          )}
                          Créer la réinscription
                        </Button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}
          {candidatesQuery.data &&
          candidatesQuery.data.pagination.totalPages > 1 ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                Page {candidatesQuery.data.pagination.page} sur{" "}
                {candidatesQuery.data.pagination.totalPages},{" "}
                {candidatesQuery.data.pagination.total} élèves
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  disabled={candidatePage === 1 || candidatesQuery.isFetching}
                  onClick={() =>
                    setCandidatePage((current) => Math.max(1, current - 1))
                  }
                >
                  Précédent
                </Button>
                <Button
                  variant="outline"
                  disabled={
                    candidatePage >=
                      candidatesQuery.data.pagination.totalPages ||
                    candidatesQuery.isFetching
                  }
                  onClick={() => setCandidatePage((current) => current + 1)}
                >
                  Suivant
                </Button>
              </div>
            </div>
          ) : null}
          </> : null}
        </TabsContent>
      </Tabs>
    </PageLayout>
  );
}
