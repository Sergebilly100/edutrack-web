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
import { Link } from "react-router-dom";
import axios from "axios";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { PageLayout } from "@/shared/components/PageLayout";
import { QueryErrorState } from "@/shared/components/QueryErrorState";
import { usePermissions } from "@/shared/hooks/usePermissions";
import { formatFcfa } from "@/shared/utils/formatting";
import {
  createEnrollment,
  getStudentAcademicSummary,
  listEnrollments,
  listReEnrollmentCandidates,
  normalizeEnrollmentsListResponse,
  type Enrollment,
  type ReEnrollmentCandidate,
} from "./enrollments.api";
import { enrollmentStatusLabel } from "./enrollments.helpers";

const statusClassName: Record<Enrollment["status"], string> = {
  pending_cashier: "border-blue-200 bg-blue-50 text-blue-800",
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

function StudentAcademicSummaryDialog({
  studentId,
  open,
  onOpenChange,
}: {
  studentId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const summaryQuery = useQuery({
    queryKey: ["enrollments", "re-enrollment", "student-summary", studentId],
    queryFn: () => getStudentAcademicSummary(studentId!),
    enabled: open && Boolean(studentId),
  });
  const summary = summaryQuery.data;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Synthèse scolaire</DialogTitle>
          <DialogDescription>
            {summary
              ? `${summary.student.lastName} ${summary.student.firstName}${summary.student.matricule ? ` · ${summary.student.matricule}` : ""}`
              : "Chargement du cursus et de la situation financière."}
          </DialogDescription>
        </DialogHeader>
        {summaryQuery.isLoading ? (
          <div
            className="space-y-3"
            aria-label="Chargement de la synthèse scolaire"
          >
            <div className="h-10 animate-pulse rounded-lg bg-muted" />
            <div className="h-32 animate-pulse rounded-lg bg-muted" />
          </div>
        ) : null}
        {summaryQuery.isError ? (
          <QueryErrorState
            message="Impossible de charger la synthèse scolaire."
            onRetry={() => void summaryQuery.refetch()}
            isRetrying={summaryQuery.isFetching}
          />
        ) : null}
        {summary && !summaryQuery.isLoading && !summaryQuery.isError ? (
          summary.years.length === 0 ? (
            <EmptyState
              title="Aucune année scolaire trouvée"
              description="Le cursus de cet élève ne contient encore aucune année exploitable."
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table className="min-w-[42rem]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Année scolaire</TableHead>
                    <TableHead>Classe</TableHead>
                    <TableHead>Décision</TableHead>
                    <TableHead>Situation financière</TableHead>
                    <TableHead className="text-right">Reste à verser</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.years.map((year) => (
                    <TableRow key={year.schoolYearId}>
                      <TableCell className="font-medium">
                        {year.schoolYearLabel}
                      </TableCell>
                      <TableCell>{year.className}</TableCell>
                      <TableCell>{year.decision}</TableCell>
                      <TableCell>
                        {year.financialStatus === "settled" ? (
                          <Badge
                            variant="outline"
                            className="border-green-200 bg-green-50 text-green-700"
                          >
                            Soldé
                          </Badge>
                        ) : year.financialStatus === "remaining_due" ? (
                          <Badge
                            variant="outline"
                            className="border-amber-200 bg-amber-50 text-amber-700"
                          >
                            Reste à régler
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-muted-foreground"
                          >
                            Non configuré
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {year.remainingDue === null
                          ? "Non disponible"
                          : year.remainingDue > 0
                            ? formatFcfa(year.remainingDue)
                            : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export default function EnrollmentsPage() {
  const { hasPermission } = usePermissions();
  const canEditDraft =
    hasPermission("enrollments.edit") && hasPermission("students.edit");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [targetYearId, setTargetYearId] = useState("");
  const [page, setPage] = useState(1);
  const [dossierYearId, setDossierYearId] = useState("");
  const [dossierLevelId, setDossierLevelId] = useState("");
  const [dossierClassId, setDossierClassId] = useState("");
  const [candidatePage, setCandidatePage] = useState(1);
  const [candidateSearch, setCandidateSearch] = useState("");
  const [recentYearId, setRecentYearId] = useState("");
  const [recentLevelId, setRecentLevelId] = useState("");
  const [recentClassId, setRecentClassId] = useState("");
  const [classSelections, setClassSelections] = useState<
    Record<string, string>
  >({});
  const [summaryStudentId, setSummaryStudentId] = useState<string | null>(null);
  const enrollmentsQuery = useQuery({
    queryKey: [
      "enrollments",
      "list",
      "normalized-v2",
      page,
      dossierYearId,
      dossierLevelId,
      dossierClassId,
    ],
    queryFn: () =>
      listEnrollments({
        page,
        limit: 20,
        schoolYearId: dossierYearId || undefined,
        levelId: dossierLevelId || undefined,
        classId: dossierClassId || undefined,
      }),
    select: (data) => normalizeEnrollmentsListResponse(data, page, 20),
  });
  const yearsQuery = useQuery({
    queryKey: ["academic", "school-years", "re-enrollment"],
    queryFn: listSchoolYears,
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
    queryKey: ["academic", "classes", "re-enrollment", targetYearId],
    queryFn: () => listClasses(targetYearId),
    enabled: Boolean(targetYearId),
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
      targetYearId,
      recentYearId,
      recentLevelId,
      recentClassId,
      candidateSearch,
      candidatePage,
    ],
    queryFn: () =>
      listReEnrollmentCandidates({
        schoolYearId: targetYearId || undefined,
        sourceSchoolYearId: recentYearId || undefined,
        levelId: recentLevelId || undefined,
        classId: recentClassId || undefined,
        search: candidateSearch || undefined,
        page: candidatePage,
        limit: 20,
      }),
  });
  const candidates = candidatesQuery.data?.candidates ?? [];
  const activeYears = (yearsQuery.data ?? []).filter(
    (year) => year.status === "active",
  );
  const dossierFilterClasses = (dossierClassesQuery.data?.classes ?? []).filter(
    (item) => !dossierLevelId || item.level.id === dossierLevelId,
  );
  const recentFilterClasses = (recentClassesQuery.data?.classes ?? []).filter(
    (item) => !recentLevelId || item.level.id === recentLevelId,
  );
  const selectedYear =
    yearsQuery.data?.find((year) => year.id === targetYearId) ?? null;
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
        schoolYearId: targetYearId,
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
            : "Vérifiez la décision finale, l’année cible et la classe choisie.",
        variant: "destructive",
      }),
  });
  const enrollmentRows = Array.isArray(enrollmentsQuery.data?.enrollments)
    ? enrollmentsQuery.data.enrollments
    : [];
  const namedEnrollments = useMemo(
    () => enrollmentRows.map((enrollment) => ({ enrollment })),
    [enrollmentRows],
  );
  const resetCandidateView = (yearId: string) => {
    setTargetYearId(yearId);
    setCandidatePage(1);
    setClassSelections({});
  };
  const updateDossierYear = (yearId: string) => {
    setDossierYearId(yearId);
    setDossierClassId("");
    setPage(1);
  };
  const updateRecentYear = (yearId: string) => {
    setRecentYearId(yearId);
    setRecentClassId("");
    setCandidatePage(1);
  };
  return (
    <PageLayout
      title="Inscriptions"
      subtitle="Suivez les nouveaux dossiers, les réinscriptions et les passages en caisse."
      actions={
        hasPermission("enrollments.create") ? (
          <Button asChild>
            <Link to="/enrollments/new">
              <Plus className="mr-2 h-4 w-4" />
              Nouvelle inscription
            </Link>
          </Button>
        ) : undefined
      }
    >
      <Tabs defaultValue="dossiers" className="space-y-5">
        <TabsList className="grid h-auto w-full grid-cols-2 sm:w-[420px]">
          <TabsTrigger className="min-h-12" value="dossiers">
            Dossiers
          </TabsTrigger>
          <TabsTrigger className="min-h-12" value="re-enrollment">
            Réinscriptions
          </TabsTrigger>
        </TabsList>
        <TabsContent value="dossiers" className="space-y-4">
          <div className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2 lg:grid-cols-[repeat(3,minmax(0,1fr))_auto] lg:items-end">
            <div className="space-y-2">
              <Label htmlFor="dossier-year-filter">Année scolaire</Label>
              <Select value={dossierYearId} onValueChange={updateDossierYear}>
                <SelectTrigger id="dossier-year-filter" className="min-h-12">
                  <SelectValue placeholder="Toutes les années" />
                </SelectTrigger>
                <SelectContent>
                  {(yearsQuery.data ?? []).map((year) => (
                    <SelectItem key={year.id} value={year.id}>
                      {year.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dossier-level-filter">Niveau</Label>
              <Select
                value={dossierLevelId}
                onValueChange={(value) => {
                  setDossierLevelId(value);
                  setDossierClassId("");
                  setPage(1);
                }}
              >
                <SelectTrigger id="dossier-level-filter" className="min-h-12">
                  <SelectValue placeholder="Tous les niveaux" />
                </SelectTrigger>
                <SelectContent>
                  {(levelsQuery.data ?? []).map((level) => (
                    <SelectItem key={level.id} value={level.id}>
                      {level.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dossier-class-filter">Classe</Label>
              <Select
                value={dossierClassId}
                disabled={!dossierYearId}
                onValueChange={(value) => {
                  setDossierClassId(value);
                  setPage(1);
                }}
              >
                <SelectTrigger id="dossier-class-filter" className="min-h-12">
                  <SelectValue
                    placeholder={
                      dossierYearId
                        ? "Toutes les classes"
                        : "Choisir une année d’abord"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {dossierFilterClasses.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {dossierYearId || dossierLevelId || dossierClassId ? (
              <Button
                type="button"
                variant="outline"
                className="min-h-12"
                onClick={() => {
                  setDossierYearId("");
                  setDossierLevelId("");
                  setDossierClassId("");
                  setPage(1);
                }}
              >
                Réinitialiser
              </Button>
            ) : null}
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
              description="Créez une nouvelle inscription ou ouvrez l’onglet Réinscriptions."
              icon={FileCheck2}
            />
          ) : null}
          {namedEnrollments.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border bg-card">
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
                  {namedEnrollments.map(({ enrollment }) => (
                    <TableRow key={enrollment.id}>
                      <TableCell className="font-medium">
                        {enrollment.studentLastName}{" "}
                        {enrollment.studentFirstName}
                      </TableCell>
                      <TableCell>
                        <span className="block">{enrollment.className}</span>
                        <span className="text-xs text-muted-foreground">
                          {enrollment.schoolYearLabel}
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
                          {canEditDraft && enrollment.status !== "confirmed" ? (
                            <Button size="sm" variant="outline" asChild>
                              <Link to={`/enrollments/${enrollment.id}/edit`}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Modifier
                              </Link>
                            </Button>
                          ) : null}
                          <Button size="sm" variant="outline" asChild>
                            <Link
                              to={`/enrollments/students/${enrollment.studentId}/documents`}
                            >
                              Dossier
                            </Link>
                          </Button>
                          {hasPermission("enrollments.confirm_payment") &&
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
          <div className="rounded-lg border bg-card p-4">
            <div className="max-w-sm space-y-2">
              <Label htmlFor="re-enrollment-year">
                Nouvelle année scolaire
              </Label>
              <Select value={targetYearId} onValueChange={resetCandidateView}>
                <SelectTrigger id="re-enrollment-year" className="min-h-12">
                  <SelectValue
                    placeholder={
                      yearsQuery.isLoading
                        ? "Chargement…"
                        : "Choisir l’année cible"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {activeYears.map((year) => (
                    <SelectItem key={year.id} value={year.id}>
                      {year.label} · Active
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              La réinscription est autorisée uniquement après la clôture de
              l’année précédente et l’ouverture de la nouvelle année par le
              super-administrateur.
            </p>
          </div>
          <div className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2 lg:grid-cols-[repeat(3,minmax(0,1fr))_auto] lg:items-end">
            <div className="space-y-2">
              <Label htmlFor="recent-year-filter">Année scolaire récente</Label>
              <Select value={recentYearId} onValueChange={updateRecentYear}>
                <SelectTrigger id="recent-year-filter" className="min-h-12">
                  <SelectValue placeholder="Toutes les années récentes" />
                </SelectTrigger>
                <SelectContent>
                  {(yearsQuery.data ?? []).map((year) => (
                    <SelectItem key={year.id} value={year.id}>
                      {year.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="recent-level-filter">Niveau récent</Label>
              <Select
                value={recentLevelId}
                onValueChange={(value) => {
                  setRecentLevelId(value);
                  setRecentClassId("");
                  setCandidatePage(1);
                }}
              >
                <SelectTrigger id="recent-level-filter" className="min-h-12">
                  <SelectValue placeholder="Tous les niveaux" />
                </SelectTrigger>
                <SelectContent>
                  {(levelsQuery.data ?? []).map((level) => (
                    <SelectItem key={level.id} value={level.id}>
                      {level.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="recent-class-filter">Classe récente</Label>
              <Select
                value={recentClassId}
                disabled={!recentYearId}
                onValueChange={(value) => {
                  setRecentClassId(value);
                  setCandidatePage(1);
                }}
              >
                <SelectTrigger id="recent-class-filter" className="min-h-12">
                  <SelectValue
                    placeholder={
                      recentYearId
                        ? "Toutes les classes"
                        : "Choisir une année d’abord"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {recentFilterClasses.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {recentYearId || recentLevelId || recentClassId ? (
              <Button
                type="button"
                variant="outline"
                className="min-h-12"
                onClick={() => {
                  setRecentYearId("");
                  setRecentLevelId("");
                  setRecentClassId("");
                  setCandidatePage(1);
                }}
              >
                Réinitialiser
              </Button>
            ) : null}
          </div>
          {/* <div className="relative max-w-xl">
             <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Filtrer les élèves"
              className="min-h-12 pl-9"
              value={candidateSearch}
              onChange={(event) => {
                setCandidateSearch(event.target.value);
                setCandidatePage(1);
              }}
              placeholder="Filtrer par nom ou matricule"
            />
          </div> */}
          {candidatesQuery.isError ? (
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
          !targetYearId &&
          candidates.length === 0 ? (
            <EmptyState
              title="Aucun élève trouvé"
              description="Modifiez le filtre pour rechercher un autre élève."
            />
          ) : null}
          {!candidatesQuery.isLoading &&
          !candidatesQuery.isError &&
          targetYearId &&
          candidates.length === 0 ? (
            <EmptyState
              title="Aucun élève réinscriptible"
              description="La nouvelle année doit être active, l’année précédente clôturée et les décisions de fin d’année validées."
            />
          ) : null}
          {!targetYearId && candidates.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border bg-card">
              <Table className="min-w-[48rem]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Élève</TableHead>
                    <TableHead>Matricule</TableHead>
                    <TableHead>Classe récente</TableHead>
                    <TableHead>Année scolaire récente</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {candidates.map((candidate) => (
                    <TableRow key={candidate.studentId}>
                      <TableCell className="font-medium">
                        {candidate.studentLastName} {candidate.studentFirstName}
                      </TableCell>
                      <TableCell>{candidate.studentMatricule ?? "—"}</TableCell>
                      <TableCell>{candidate.currentClassName}</TableCell>
                      <TableCell>{candidate.currentSchoolYearLabel}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="min-h-10"
                          onClick={() =>
                            setSummaryStudentId(candidate.studentId)
                          }
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          Voir dossier
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}
          {targetYearId && selectedYear ? (
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
                        <p className="text-sm text-muted-foreground">
                          Année clôturée : {candidate.currentSchoolYearLabel} ·
                          Classe : {candidate.currentClassName}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="min-h-10"
                          onClick={() =>
                            setSummaryStudentId(candidate.studentId)
                          }
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          Voir dossier
                        </Button>
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
                        {candidate.nextLevelName ?? "non défini"}
                      </p>
                    ) : null}
                    {existing?.status === "blocked_unpaid" ? (
                      <Alert variant="destructive">
                        <AlertDescription>
                          La réinscription est bloquée par un impayé. L’élève
                          reste disponible dans la saisie rapide des
                          encaissements pour régulariser la situation.
                        </AlertDescription>
                      </Alert>
                    ) : null}
                    {!existing &&
                    candidate.finalDecision &&
                    candidate.finalDecision !== "expelled" ? (
                      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
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
                                  {item.name} · {item.studentCount} élèves
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
                          Réinscrire
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
        </TabsContent>
      </Tabs>
      <StudentAcademicSummaryDialog
        studentId={summaryStudentId}
        open={summaryStudentId !== null}
        onOpenChange={(open) => {
          if (!open) setSummaryStudentId(null);
        }}
      />
    </PageLayout>
  );
}
