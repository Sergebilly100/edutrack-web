import { useMemo, useState } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  FileCheck2,
  Loader2,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
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
import { getStudentById } from "@/modules/students/students.api";
import { useEndOfYearReviewStatus } from "@/modules/class-decisions/useEndOfYearReviewStatus";
import {
  createEnrollment,
  listEnrollments,
  listReEnrollmentCandidates,
  listRequiredDocumentTypes,
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
  decision_pending: "Décision en attente",
  ready: "Prêt à réinscrire",
  awaiting_cashier: "Dossier créé / en attente de caisse",
  awaiting_documents: "Dossier à compléter",
  blocked_unpaid: "Bloqué par impayé",
  re_enrolled: "Réinscrit",
  excluded: "Exclu",
  financial_unavailable: "Solde indisponible",
  all: "Tous les élèves",
} as const;
type CampaignStatus = keyof typeof campaignStatusLabels;
const campaignStatusClassName: Record<CampaignStatus, string> = {
  decision_pending: "border-amber-200 bg-amber-50 text-amber-800",
  ready: "border-blue-200 bg-blue-50 text-blue-700",
  awaiting_cashier: "border-blue-200 bg-blue-50 text-blue-700",
  awaiting_documents: "border-amber-200 bg-amber-50 text-amber-800",
  blocked_unpaid: "border-red-200 bg-red-50 text-red-800",
  re_enrolled: "border-green-200 bg-green-50 text-green-800",
  excluded: "border-slate-200 bg-slate-50 text-slate-700",
  financial_unavailable: "border-amber-200 bg-amber-50 text-amber-800",
  all: "border-border bg-background text-foreground",
};

function EnrollmentDocumentBadge({ enrollment }: { enrollment: Enrollment }) {
  const label =
    enrollment.documentStatus === "complete"
      ? "Complet"
      : enrollment.documentStatus === "incomplete"
        ? "Incomplet"
        : "";
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

type DossierSort = "student" | "class" | "status";
const studentName = (enrollment: Enrollment) => `${enrollment.studentLastName.toLocaleUpperCase("fr-FR")} ${enrollment.studentFirstName}`;
const studentInitials = (enrollment: Enrollment) => `${enrollment.studentLastName.charAt(0)}${enrollment.studentFirstName.charAt(0)}`.toLocaleUpperCase("fr-FR");
const enrollmentDateFormatter = new Intl.DateTimeFormat("fr-CI", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "Africa/Abidjan",
});

function EnrollmentDate({ value }: { value: string }) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? <span aria-label="Date d’inscription indisponible">—</span>
    : <time dateTime={value}>{enrollmentDateFormatter.format(date)}</time>;
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
  const [dossierSort, setDossierSort] = useState<DossierSort>("student");
  const [dossierSortDescending, setDossierSortDescending] = useState(false);
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
  const [campaignStatus, setCampaignStatus] = useState<CampaignStatus>("all");
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
  const reviewStatusQuery = useEndOfYearReviewStatus();
  const dossierYearId = dossierYearChoice === "all" ? "" : dossierYearChoice || activeYearId;
  const dossierYear = yearsQuery.data?.find((year) => year.id === dossierYearId);
  const viewingPastDossiers = selectedTab === "dossiers" && dossierYear?.status === "closed";
  const closedOriginYears = (yearsQuery.data ?? []).filter((year) => year.status === "closed" && (!selectedYear || year.endDate < selectedYear.startDate))
    .sort((left, right) => right.endDate.localeCompare(left.endDate));
  const originYears = [...closedOriginYears, ...(selectedYear ? [selectedYear] : [])];
  const recentYearId = originYears.some((year) => year.id === recentYearChoice)
    ? recentYearChoice : closedOriginYears[0]?.id || selectedYear?.id || "";
  const originYear = originYears.find((year) => year.id === recentYearId);
  const followingYear = (yearsQuery.data ?? []).filter((year) => originYear && year.startDate > originYear.endDate)
    .sort((left, right) => left.startDate.localeCompare(right.startDate) || Number(right.status === "active") - Number(left.status === "active"))[0];
  const targetYear = selectedYear && originYear?.status === "closed" && followingYear?.id === selectedYear.id ? selectedYear : null;
  const targetLabel = followingYear?.label ?? (originYear?.label.match(/^(\d{4})-(\d{4})$/)
    ? `${Number(originYear.label.slice(0, 4)) + 1}-${Number(originYear.label.slice(5)) + 1}`
    : "suivante");
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
  const dossierCountsQuery = useQuery({
    queryKey: ["enrollments", "year-counts", dossierYearId],
    queryFn: async () => {
      const [all, newRegistrations, reRegistrations] = await Promise.all([
        listEnrollments({ schoolYearId: dossierYearId || undefined, page: 1, limit: 1 }),
        listEnrollments({ schoolYearId: dossierYearId || undefined, type: "new_registration", page: 1, limit: 1 }),
        listEnrollments({ schoolYearId: dossierYearId || undefined, type: "re_registration", page: 1, limit: 1 }),
      ]);
      return { total: all.pagination.total, newRegistrations: newRegistrations.pagination.total, reRegistrations: reRegistrations.pagination.total };
    },
    enabled: yearsQuery.isSuccess,
  });
  const requiredDocumentsQuery = useQuery({
    queryKey: ["enrollments", "required-document-types"],
    queryFn: () => listRequiredDocumentTypes(),
  });
  const documentsConfigured = requiredDocumentsQuery.data?.some((document) => document.isActive) === true;
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
    queryKey: ["academic", "classes", "re-enrollment", targetYear?.id],
    queryFn: () => listClasses(targetYear!.id),
    enabled: Boolean(targetYear),
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
      followingYear?.id,
      campaignStatus,
      recentYearId,
      recentLevelId,
      recentClassId,
      candidateSearch,
      candidatePage,
    ],
    queryFn: () =>
      listReEnrollmentCandidates({
        schoolYearId: followingYear?.id,
        campaignStatus,
        sourceSchoolYearId: recentYearId || undefined,
        levelId: recentLevelId || undefined,
        classId: recentClassId || undefined,
        search: candidateSearch || undefined,
        page: candidatePage,
        limit: 20,
      }),
    enabled: selectedTab === "re-enrollment" && Boolean(recentYearId),
  });
  const candidates = candidatesQuery.data?.candidates ?? [];
  const campaignTargetLabel = candidatesQuery.data?.targetSchoolYear?.label ?? targetLabel;
  const campaignCounts = candidatesQuery.data?.counts;
  const expectedCount = campaignCounts ? campaignCounts.all - campaignCounts.excluded : 0;
  const campaignPercentage = expectedCount ? Math.round((campaignCounts?.reEnrolled ?? 0) / expectedCount * 100) : 0;
  const campaignCounters: Array<{ status: CampaignStatus; count: number }> = [
    { status: "all", count: campaignCounts?.all ?? 0 },
    { status: "decision_pending", count: campaignCounts?.decisionPending ?? 0 },
    { status: "ready", count: campaignCounts?.ready ?? 0 },
    { status: "awaiting_cashier", count: campaignCounts?.awaitingCashier ?? 0 },
    { status: "awaiting_documents", count: campaignCounts?.awaitingDocuments ?? 0 },
    { status: "blocked_unpaid", count: campaignCounts?.blockedUnpaid ?? 0 },
    { status: "re_enrolled", count: campaignCounts?.reEnrolled ?? 0 },
    { status: "excluded", count: campaignCounts?.excluded ?? 0 },
    { status: "financial_unavailable", count: campaignCounts?.financialUnavailable ?? 0 },
  ];
  const visibleCampaignCounters = campaignCounters.filter(({ status, count }) =>
    status === "all" || count > 0 || status === campaignStatus,
  );
  const otherCampaignCounters = campaignCounters.filter(({ status, count }) =>
    status !== "all" && count === 0 && status !== campaignStatus,
  );
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
  const matriculeQueries = useQueries({
    queries: enrollmentRows.map((enrollment) => ({
      queryKey: ["students", "enrollment-matricule", enrollment.studentId],
      queryFn: () => getStudentById(enrollment.studentId),
      enabled: selectedTab === "dossiers" && hasPermission("students.view"),
      staleTime: 5 * 60_000,
    })),
  });
  const matriculesByStudentId = new Map(enrollmentRows.map((enrollment, index) => [enrollment.studentId, matriculeQueries[index]?.data?.matricule]));
  const namedEnrollments = useMemo(
    () => enrollmentRows.map((enrollment) => {
      const yearStatus = yearsQuery.data?.find((year) => year.id === enrollment.schoolYearId)?.status;
      return { enrollment, isActiveYear: yearStatus === "active", yearStatus };
    }),
    [enrollmentRows, yearsQuery.data],
  );
  const sortedEnrollments = useMemo(() => [...namedEnrollments].sort((left, right) => {
    const a = left.enrollment;
    const b = right.enrollment;
    const value = dossierSort === "student"
      ? studentName(a).localeCompare(studentName(b), "fr")
      : dossierSort === "class"
        ? a.className.localeCompare(b.className, "fr")
        : enrollmentStatusLabel[a.status].localeCompare(enrollmentStatusLabel[b.status], "fr");
    return (dossierSortDescending ? -1 : 1) * (value || a.id.localeCompare(b.id));
  }), [namedEnrollments, dossierSort, dossierSortDescending]);
  const toggleDossierSort = (sort: DossierSort) => {
    setDossierSortDescending((current) => dossierSort === sort ? !current : false);
    setDossierSort(sort);
  };
  const dossierHref = (enrollment: Enrollment, isActiveYear: boolean) => {
    const returnTo = encodeURIComponent(`/enrollments${searchParams.toString() ? `?${searchParams.toString()}` : ""}`);
    if (isActiveYear) {
      return enrollment.status === "confirmed" && hasPermission("students.view")
        ? `/students/${enrollment.studentId}?returnTo=${returnTo}`
        : `/enrollments/students/${enrollment.studentId}/documents`;
    }
    return hasPermission("students.view")
      ? `/students/${enrollment.studentId}/history?year=${enrollment.schoolYearId}&returnTo=${returnTo}`
      : null;
  };
  const dossierActions = (enrollment: Enrollment, isActiveYear: boolean) => {
    const canEdit = isActiveYear && canEditDraft && enrollment.status !== "confirmed";
    const canPay = isActiveYear && hasPermission("enrollments.confirm_payment") && enrollment.status !== "confirmed" && enrollment.status !== "blocked_unpaid";
    const canViewHistory = hasPermission("students.view");
    return <DropdownMenu>
      <DropdownMenuTrigger asChild><Button variant="outline" size="icon" className="min-h-12 min-w-12" aria-label={`Actions pour ${studentName(enrollment)}`} onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}><MoreHorizontal className="h-5 w-5" /></Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
        {isActiveYear ? <DropdownMenuItem asChild><Link to={`/enrollments/students/${enrollment.studentId}/documents`}>Documents du dossier</Link></DropdownMenuItem> : null}
        {canEdit ? <DropdownMenuItem asChild><Link to={`/enrollments/${enrollment.id}/edit`}>Modifier</Link></DropdownMenuItem> : null}
        {canPay ? <DropdownMenuItem asChild><Link to={`/enrollments/${enrollment.id}/payment`}>Caisse</Link></DropdownMenuItem> : null}
        {canViewHistory ? <DropdownMenuItem asChild><Link to={`/students/${enrollment.studentId}/history?year=${enrollment.schoolYearId}`}>Historique scolaire</Link></DropdownMenuItem> : null}
        {!isActiveYear && !canViewHistory ? <DropdownMenuItem disabled>Aucune action disponible</DropdownMenuItem> : null}
      </DropdownMenuContent>
    </DropdownMenu>;
  };
  const updateDossierYear = (yearId: string) => {
    setDossierYearChoice(yearId || "all");
    setDossierLevelId("");
    setDossierClassId("");
    updateDossierSearch("");
    setPage(1);
  };
  const updateRecentYear = (yearId: string) => {
    setRecentYearChoice(yearId);
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
          {dossierCountsQuery.isLoading ? <div className="grid gap-3 sm:grid-cols-3" role="status" aria-label="Chargement de la synthèse">
            {[0, 1, 2].map((item) => <div key={item} className="h-24 animate-pulse rounded-lg bg-muted" />)}
          </div> : null}
          {dossierCountsQuery.isError ? <QueryErrorState message="Impossible de charger la synthèse des inscriptions." onRetry={() => void dossierCountsQuery.refetch()} isRetrying={dossierCountsQuery.isFetching} /> : null}
          {dossierCountsQuery.data ? <div className="grid gap-3 sm:grid-cols-3" aria-label="Synthèse des inscriptions">
            {[
              { label: "Total inscrits", count: dossierCountsQuery.data.total },
              { label: "Nouvelles inscriptions", count: dossierCountsQuery.data.newRegistrations },
              { label: "Réinscriptions", count: dossierCountsQuery.data.reRegistrations },
            ].map(({ label, count }) => <Card key={label} className="p-4">
              <p className="text-3xl font-semibold">{count}</p><p className="text-sm text-muted-foreground">{label}</p>
            </Card>)}
          </div> : null}
          {requiredDocumentsQuery.isError ? <QueryErrorState message="Impossible de vérifier la configuration des documents requis." onRetry={() => void requiredDocumentsQuery.refetch()} isRetrying={requiredDocumentsQuery.isFetching} /> : null}
          {requiredDocumentsQuery.isSuccess && !documentsConfigured ? <Alert className="border-amber-200 bg-amber-50 text-amber-800">
            <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
              <span>Les documents requis ne sont pas configurés.</span>
              <Button asChild variant="outline" className="min-h-12"><Link to="/settings?tab=scolarite">Configurer</Link></Button>
            </AlertDescription>
          </Alert> : null}
          <div className="space-y-4 rounded-lg border bg-card p-4">
            <AcademicContextFilters yearIdPrefix="dossier" years={yearsQuery.data ?? []} yearId={dossierYearId}
              activeYear={selectedYear ?? undefined} showPeriod={false} allowAllYears
              onYearChange={updateDossierYear} yearDisabled={yearsQuery.isLoading} />
            <FilterBar className="lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="enrollment-dossier-search">Élève, nom ou matricule</Label>
              <div className="relative">
                <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="enrollment-dossier-search" type="search" maxLength={100} className="min-h-12 pl-10" placeholder="Ex. Koné Aya ou MAT-42" value={dossierSearch} onChange={(event) => updateDossierSearch(event.target.value)} />
              </div>
            </div>
            <DependentSelect id="dossier-level-filter" label="Niveau" value={dossierLevelId}
              options={(levelsQuery.data ?? []).map((level) => ({ id: level.id, label: level.name }))}
              dependsOn={{ field: "year", value: dossierYearId }} allLabel="Tous les niveaux"
              onValueChange={(value) => { setDossierLevelId(value); setDossierClassId(""); updateDossierSearch(""); setPage(1) }} />
            <DependentSelect id="dossier-class-filter" label="Classe" value={dossierClassId}
              options={dossierFilterClasses.map((item) => ({ id: item.id, label: item.name }))}
              dependsOn={{ field: "year", value: dossierYearId }}
              allLabel="Toutes les classes" loading={dossierClassesQuery.isFetching}
              onValueChange={(value) => { setDossierClassId(value); updateDossierSearch(""); setPage(1) }} />
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
          {sortedEnrollments.length > 0 ? (
            <div className="space-y-3 md:hidden">
              {sortedEnrollments.map(({ enrollment, isActiveYear }) => {
                const href = dossierHref(enrollment, isActiveYear);
                return <article key={enrollment.id} role={href ? "link" : undefined} tabIndex={href ? 0 : undefined}
                  aria-label={href ? `Ouvrir le dossier de ${studentName(enrollment)}` : undefined}
                  onClick={() => { if (href) navigate(href) }}
                  onKeyDown={(event) => { if (href && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); navigate(href) } }}
                  className="space-y-3 rounded-lg border bg-card p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <div className="flex items-center gap-3">
                    <Avatar><AvatarFallback className="bg-blue-50 text-blue-700">{studentInitials(enrollment)}</AvatarFallback></Avatar>
                    <div className="min-w-0"><p className="font-medium">{studentName(enrollment)}</p>
                      {matriculesByStudentId.get(enrollment.studentId) !== undefined ? <p className="text-xs text-muted-foreground">{matriculesByStudentId.get(enrollment.studentId) ?? "Sans matricule"}</p> : null}
                      <p className="text-sm text-muted-foreground">{enrollment.className}{!dossierYearId ? ` · ${enrollment.schoolYearLabel}` : ""}</p>
                      <p className="text-xs text-muted-foreground">Inscrit le <EnrollmentDate value={enrollment.enrolledAt} /></p></div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{enrollment.type === "re_registration" ? "Réinscription" : "Nouvelle"}</Badge>
                    <Badge className={`border ${statusClassName[enrollment.status]}`}>{enrollmentStatusLabel[enrollment.status]}</Badge>
                    {documentsConfigured && enrollment.documentStatus !== "not_configured" ? <EnrollmentDocumentBadge enrollment={enrollment} /> : null}
                    <div className="ml-auto">{dossierActions(enrollment, isActiveYear)}</div>
                  </div>
                </article>;
              })}
            </div>
          ) : null}
          {sortedEnrollments.length > 0 ? (
            <div className="hidden overflow-x-auto rounded-lg border bg-card md:block">
              <Table className="min-w-[60rem]">
                <TableHeader><TableRow>
                  <TableHead aria-sort={dossierSort === "student" ? dossierSortDescending ? "descending" : "ascending" : "none"}>
                    <Button variant="ghost" onClick={() => toggleDossierSort("student")} className="min-h-12 px-0">Élève</Button>
                  </TableHead>
                  <TableHead aria-sort={dossierSort === "class" ? dossierSortDescending ? "descending" : "ascending" : "none"}>
                    <Button variant="ghost" onClick={() => toggleDossierSort("class")} className="min-h-12 px-0">Classe visée</Button>
                  </TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Date d’inscription</TableHead>
                  <TableHead aria-sort={dossierSort === "status" ? dossierSortDescending ? "descending" : "ascending" : "none"}>
                    <Button variant="ghost" onClick={() => toggleDossierSort("status")} className="min-h-12 px-0">Statut</Button>
                  </TableHead>
                  {documentsConfigured ? <TableHead>Dossier</TableHead> : null}
                  <TableHead><span className="sr-only">Actions</span></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {sortedEnrollments.map(({ enrollment, isActiveYear }) => {
                    const href = dossierHref(enrollment, isActiveYear);
                    return <TableRow key={enrollment.id} tabIndex={href ? 0 : undefined}
                      aria-label={href ? `Ouvrir le dossier de ${studentName(enrollment)}` : undefined}
                      onClick={() => { if (href) navigate(href) }}
                      onKeyDown={(event) => { if (href && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); navigate(href) } }}
                      className={href ? "cursor-pointer hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" : undefined}>
                      <TableCell><div className="flex items-center gap-3">
                        <Avatar><AvatarFallback className="bg-blue-50 text-blue-700">{studentInitials(enrollment)}</AvatarFallback></Avatar>
                        <div><span className="block font-medium">{studentName(enrollment)}</span>
                          {matriculesByStudentId.get(enrollment.studentId) !== undefined ? <span className="block text-xs text-muted-foreground">{matriculesByStudentId.get(enrollment.studentId) ?? "Sans matricule"}</span> : null}
                        </div>
                      </div></TableCell>
                      <TableCell><span className="block">{enrollment.className}</span>
                        {!dossierYearId ? <span className="text-xs text-muted-foreground">{enrollment.schoolYearLabel}</span> : null}
                      </TableCell>
                      <TableCell><Badge variant="outline">{enrollment.type === "re_registration" ? "Réinscription" : "Nouvelle"}</Badge></TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums"><EnrollmentDate value={enrollment.enrolledAt} /></TableCell>
                      <TableCell><Badge className={`border ${statusClassName[enrollment.status]}`}>{enrollmentStatusLabel[enrollment.status]}</Badge></TableCell>
                      {documentsConfigured ? <TableCell>{enrollment.documentStatus !== "not_configured" ? <EnrollmentDocumentBadge enrollment={enrollment} /> : null}</TableCell> : null}
                      <TableCell>{dossierActions(enrollment, isActiveYear)}</TableCell>
                    </TableRow>;
                  })}
                </TableBody>
              </Table>
            </div>
          ) : null}
          {enrollmentsQuery.data &&
          !enrollmentsQuery.isLoading && !enrollmentsQuery.isError ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                Page {enrollmentsQuery.data.pagination.page} sur{" "}
                {enrollmentsQuery.data.pagination.totalPages},{" "}
                {enrollmentsQuery.data.pagination.total} dossiers · tri sur la page affichée
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
          {yearsQuery.isSuccess && activeYears.length === 0 ? <Alert><AlertDescription>Aucune année scolaire active. La campagne s’ouvrira quand l’année suivante sera créée par IvoirEdu.</AlertDescription></Alert> : null}
          {yearsQuery.isSuccess && activeYears.length > 1 ? <Alert variant="destructive"><AlertDescription>Plusieurs années scolaires sont actives. Corrigez ce conflit avant de lancer la campagne.</AlertDescription></Alert> : null}
          {originYear ? <>
          <div className="space-y-4">
            <div className="space-y-4 rounded-lg border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold">Campagne de réinscription → année {campaignTargetLabel}</h2>
                  <p className="text-xs text-muted-foreground">Depuis l’année {originYear.label} · chiffres selon les filtres sélectionnés</p>
                </div>
                {campaignCounts ? <p className="text-sm font-semibold tabular-nums">{campaignCounts.reEnrolled} {campaignCounts.reEnrolled === 1 ? "réinscrit" : "réinscrits"} sur {expectedCount} {expectedCount === 1 ? "élève attendu" : "élèves attendus"}</p> : null}
              </div>
              {campaignCounts ? <Progress value={campaignPercentage} aria-valuenow={campaignPercentage}
                aria-label="Progression de la campagne de réinscription" /> : null}
              <div className="flex flex-wrap items-center gap-2 border-t pt-4" role="group" aria-label={`Filtrer les élèves de la campagne ${campaignTargetLabel} par état`}>
                {visibleCampaignCounters.map(({ status, count }) => (
                  <Button key={status} type="button" variant="outline" aria-pressed={campaignStatus === status}
                    className={`min-h-11 max-w-full whitespace-normal border text-left ${campaignStatusClassName[status]} ${campaignStatus === status ? "ring-2 ring-ring ring-offset-2" : ""}`}
                    onClick={() => { setCampaignStatus(status); setCandidatePage(1) }}>
                    {campaignStatusLabels[status]} : {candidatesQuery.isLoading ? "…" : count}
                  </Button>
                ))}
                {otherCampaignCounters.length > 0 ? <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button type="button" variant="outline" className="min-h-11 gap-2 text-muted-foreground">Autres statuts <ChevronDown className="h-4 w-4" /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {otherCampaignCounters.map(({ status, count }) => <DropdownMenuItem key={status}
                      onSelect={() => { setCampaignStatus(status); setCandidatePage(1) }}>
                      {campaignStatusLabels[status]} : {count}
                    </DropdownMenuItem>)}
                  </DropdownMenuContent>
                </DropdownMenu> : null}
              </div>
            </div>
            {!targetYear ? <Alert><AlertDescription>{candidatesQuery.data?.targetSchoolYear?.status === "closed"
              ? `L’année ${campaignTargetLabel} est clôturée. Cette campagne est consultable en lecture seule.`
              : `La campagne s’ouvrira quand l’année ${campaignTargetLabel} sera ${candidatesQuery.data?.targetSchoolYear?.status === "draft" ? "ouverte" : "créée et ouverte"} par IvoirEdu. Les candidats restent consultables en lecture seule.`}</AlertDescription></Alert> : null}
          </div>
          <div className="space-y-3 rounded-lg border bg-card p-4">
            <FilterBar className="lg:grid-cols-4">
            <AcademicContextFilters compact yearIdPrefix="re-enrollment" years={originYears} yearId={recentYearId}
              showPeriod={false} allowAllYears={false} yearLabel="Année d’origine"
              onYearChange={updateRecentYear} yearDisabled={yearsQuery.isLoading || !originYears.length} />
            <DependentSelect id="recent-level-filter" label="Niveau récent" value={recentLevelId}
              options={(levelsQuery.data ?? []).map((level) => ({ id: level.id, label: level.name }))}
              dependsOn={{ field: "year", value: recentYearId }} allLabel="Tous les niveaux"
              onValueChange={(value) => { setRecentLevelId(value); setRecentClassId(""); setCandidateSearch(""); setCandidatePage(1) }} />
            <DependentSelect id="recent-class-filter" label="Classe récente" value={recentClassId}
              options={recentFilterClasses.map((item) => ({ id: item.id, label: item.name }))}
              dependsOn={{ field: "year", value: recentYearId }}
              allLabel="Toutes les classes" loading={recentClassesQuery.isFetching && Boolean(recentYearId)}
              onValueChange={(value) => { setRecentClassId(value); setCandidateSearch(""); setCandidatePage(1) }} />
            <div className="space-y-2">
              <Label htmlFor="candidate-search">Élève, nom ou matricule</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="candidate-search" aria-label="Filtrer les élèves" className="min-h-12 pl-9" value={candidateSearch}
                  onChange={(event) => { setCandidateSearch(event.target.value); setCandidatePage(1) }} placeholder="Filtrer par nom ou matricule" />
              </div>
            </div>
            </FilterBar>
            <ResetFiltersButton active={Boolean(recentYearChoice || recentLevelId || recentClassId || candidateSearch || campaignStatus !== "all")}
              onReset={() => { setRecentYearChoice(""); setRecentLevelId(""); setRecentClassId(""); setCandidateSearch(""); setCampaignStatus("all"); setCandidatePage(1) }} />
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
            <div role="region" aria-label="Tableau des candidats à la réinscription" tabIndex={0}
              className="overflow-x-auto rounded-lg border bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Table className="min-w-[76rem]">
                <TableHeader><TableRow>
                  <TableHead>Élève</TableHead>
                  <TableHead>Classe d’origine</TableHead>
                  <TableHead>Décision de fin d’année</TableHead>
                  <TableHead>Classe d’accueil</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {candidates.map((candidate) => {
                    const existing = candidate.enrollment;
                    const eligibleClasses = (classesQuery.data?.classes ?? []).filter((item) => item.level.id === candidate.nextLevelId);
                    const canOpenDossier = hasPermission("students.view");
                    const dossierHref = `/students/${candidate.studentId}/history?year=${candidate.currentSchoolYearId}&returnTo=${encodeURIComponent("/enrollments?tab=re-enrollment")}`;
                    const name = `${candidate.studentLastName.toLocaleUpperCase("fr-FR")} ${candidate.studentFirstName}`;
                    const isCreating = reEnrollmentMutation.isPending && reEnrollmentMutation.variables?.studentId === candidate.studentId;
                    return <TableRow key={candidate.studentId} tabIndex={canOpenDossier ? 0 : undefined}
                      aria-label={canOpenDossier ? `Ouvrir le dossier de ${name}` : undefined}
                      onClick={() => { if (canOpenDossier) navigate(dossierHref) }}
                      onKeyDown={(event) => { if (canOpenDossier && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); navigate(dossierHref) } }}
                      className={canOpenDossier ? "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" : undefined}>
                      <TableCell><div className="flex items-center gap-3">
                        <Avatar><AvatarFallback className="bg-blue-50 text-blue-700">{`${candidate.studentLastName.charAt(0)}${candidate.studentFirstName.charAt(0)}`.toLocaleUpperCase("fr-FR")}</AvatarFallback></Avatar>
                        <div><span className="block font-medium">{name}</span>
                          <span className="block text-xs text-muted-foreground">{candidate.studentMatricule ?? "Sans matricule"}</span>
                        </div>
                      </div></TableCell>
                      <TableCell>{candidate.currentClassName}<span className="block text-xs text-muted-foreground">{candidate.currentSchoolYearLabel}</span></TableCell>
                      <TableCell>{candidate.finalDecision ? decisionLabel[candidate.finalDecision] : candidate.status === "re_enrolled"
                        ? <span className="text-muted-foreground" title="Aucune décision enregistrée pour l’année d’origine">Non renseignée</span>
                        : "Non validée"}</TableCell>
                      <TableCell onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
                        {existing ? existing.className : !candidate.finalDecision ? "À déterminer" : candidate.finalDecision === "expelled" ? "Sans classe d’accueil" : !targetYear || candidate.status !== "ready" ? <span>{candidate.nextLevelName ?? "Niveau à définir"}<span className="block text-xs text-muted-foreground">{candidate.status === "blocked_unpaid" ? "Classe à choisir après régularisation" : candidate.status === "financial_unavailable" ? "Classe à choisir après vérification du solde" : candidate.status === "decision_pending" ? "Classe à définir dans Fin d’année" : "Classe à choisir après ouverture"}</span></span> : <div className="min-w-44 space-y-1">
                          <Label className="sr-only" htmlFor={`target-class-${candidate.studentId}`}>Classe d’accueil de {name}</Label>
                          <Select value={classSelections[candidate.studentId] ?? ""}
                            onValueChange={(value) => setClassSelections((current) => ({ ...current, [candidate.studentId]: value }))}>
                            <SelectTrigger id={`target-class-${candidate.studentId}`} className="min-h-12">
                              <SelectValue placeholder={classesQuery.isLoading ? "Chargement…" : eligibleClasses.length ? "Choisir la classe" : "Aucune classe compatible"} />
                            </SelectTrigger>
                            <SelectContent>{eligibleClasses.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
                          </Select>
                          <span className="text-xs text-muted-foreground">{candidate.nextLevelName ?? "Niveau à définir"}</span>
                        </div>}
                      </TableCell>
                      <TableCell><Badge variant="outline" className={campaignStatusClassName[candidate.status]}>{campaignStatusLabels[candidate.status]}</Badge></TableCell>
                      <TableCell onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
                        {candidate.status === "ready" && targetYear ? <Button className="min-h-12"
                          disabled={!classSelections[candidate.studentId] || reEnrollmentMutation.isPending}
                          onClick={() => reEnrollmentMutation.mutate({ studentId: candidate.studentId, classId: classSelections[candidate.studentId]! })}>
                          {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                          {isCreating ? "Création…" : "Réinscrire"}
                        </Button> : <span className="text-sm text-muted-foreground">
                          {candidate.status === "decision_pending" ? <>{candidate.finalDecision
                            ? candidate.sourceSchoolYearStatus === "active" ? "La classe d’accueil doit être définie dans le menu Fin d’année." : "Classe d’accueil manquante pour cette décision ; contactez IvoirEdu."
                            : candidate.sourceSchoolYearStatus === "active" ? "La décision de fin d’année doit être validée dans le menu Fin d’année." : "Décision de fin d’année absente pour cette année clôturée ; contactez IvoirEdu."}{candidate.sourceSchoolYearStatus === "active" && reviewStatusQuery.data?.visible && hasPermission("class_decisions.view") ? <> <Link className="font-medium text-primary underline" to="/end-of-year">Ouvrir Fin d’année</Link></> : null}</>
                            : candidate.status === "ready" ? "La réinscription sera possible après l’ouverture de l’année suivante par IvoirEdu."
                            : candidate.status === "blocked_unpaid" ? "Impayé de l’année d’origine à régulariser à la caisse."
                            : candidate.status === "re_enrolled" ? "Réinscription confirmée."
                            : candidate.status === "awaiting_cashier" ? "Dossier créé, passage en caisse attendu."
                            : candidate.status === "awaiting_documents" ? "Dossier créé, pièces du dossier à compléter."
                            : candidate.status === "financial_unavailable" ? "Solde de l’année d’origine indisponible : vérifiez le plan de scolarité."
                            : "Élève exclu : réinscription impossible."}
                        </span>}
                      </TableCell>
                    </TableRow>;
                  })}
                </TableBody>
              </Table>
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
