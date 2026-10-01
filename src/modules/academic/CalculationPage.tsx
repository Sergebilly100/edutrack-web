import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import {
  listStudents,
  type StudentItem,
} from "@/modules/students/students.api";
import { EmptyState } from "@/shared/components/EmptyState";
import {
  fetchEvaluationsScope,
  fetchTeacherAcademicContext,
  markSubjectCompleted,
  type EvaluationWithGrades,
} from "./academic.api";
import { OfflineIndicator } from "@/shared/components/OfflineIndicator";
import { InstallPwaCard } from "@/shared/pwa/InstallPwaCard"

const MAX_GRADE = 20;

const subjectAverage = (
  evaluations: EvaluationWithGrades[],
  studentId: string,
): number | null => {
  const values = evaluations
    .filter((evaluation) => evaluation.type === "scheduled")
    .flatMap((evaluation) => {
      const grade = evaluation.grades.find(
        (item) => item.studentId === studentId,
      );
      return grade
        ? [
            {
              value: (grade.score / grade.maxScore) * MAX_GRADE,
              coefficient: evaluation.coefficient,
            },
          ]
        : [];
    });
  if (values.length === 0) return null;
  const denominator = values.reduce(
    (total, value) => total + value.coefficient,
    0,
  );
  if (denominator <= 0) return null;
  const baseAverage =
    values.reduce(
      (total, value) => total + value.value * value.coefficient,
      0,
    ) / denominator;
  const adjustments = evaluations
    .filter((evaluation) => evaluation.type === "spontaneous")
    .reduce((total, evaluation) => {
      const grade = evaluation.grades.find(
        (item) => item.studentId === studentId,
      );
      return grade
        ? total +
            (evaluation.label.startsWith("Note spontanée -")
              ? -grade.score
              : grade.score)
        : total;
    }, 0);
  return Math.max(0, Math.min(MAX_GRADE, baseAverage + adjustments));
};

const formatAverage = (average: number | null) =>
  average === null ? "—" : average.toFixed(2).replace(".", ",");

export default function CalculationPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const classId = searchParams.get("classId") ?? "";
  const gradingPeriodId = searchParams.get("gradingPeriodId") ?? "";
  const subjectId = searchParams.get("subjectId") ?? "";
  const [currentStep, setCurrentStep] = useState<2 | 3>(2);
  const [detailsStudentId, setDetailsStudentId] = useState<string | null>(null);

  const contextQuery = useQuery({
    queryKey: ["academic", "teacher-context"],
    queryFn: fetchTeacherAcademicContext,
  });
  const scopeQuery = useQuery({
    queryKey: ["evaluations-scope", classId, gradingPeriodId],
    queryFn: () => fetchEvaluationsScope(classId, gradingPeriodId),
    enabled: Boolean(classId) && Boolean(gradingPeriodId),
  });
  const studentsQuery = useQuery({
    queryKey: ["students-list", classId],
    queryFn: () => listStudents({ classId, isActive: true, limit: 100 }),
    enabled: Boolean(classId),
  });
  const subject = scopeQuery.data?.subjects.find(
    (item) => item.id === subjectId,
  );
  const completion = scopeQuery.data?.completion.find(
    (item) => item.subjectId === subjectId,
  );
  const selectedClass = contextQuery.data?.classes.find(
    (item) => item.id === classId,
  );
  const period = contextQuery.data?.gradingPeriods.find(
    (item) => item.id === gradingPeriodId,
  );
  const evaluations = useMemo(
    () =>
      (scopeQuery.data?.evaluations ?? []).filter(
        (item) => item.subjectId === subjectId,
      ),
    [scopeQuery.data?.evaluations, subjectId],
  );
  const students = studentsQuery.data?.data ?? [];
  const scheduledEvaluations = evaluations.filter(
    (evaluation) => evaluation.type === "scheduled",
  );
  const isReadyForValidation =
    scheduledEvaluations.length > 0 &&
    scheduledEvaluations.every((evaluation) =>
      students.every((student) =>
        evaluation.grades.some((grade) => grade.studentId === student.id),
      ),
    );
  const detailsStudent =
    students.find((student) => student.id === detailsStudentId) ?? null;

  useEffect(() => {
    if (completion?.status === "completed") setCurrentStep(3);
  }, [completion?.status]);

  const validateMutation = useMutation({
    mutationFn: () =>
      markSubjectCompleted({
        classId,
        subjectId,
        gradingPeriodId,
        status: "completed",
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["evaluations-scope", classId, gradingPeriodId],
      });
      setCurrentStep(3);
      toast({ title: "Moyennes validées et transmises à l’administration" });
    },
    onError: (error) =>
      toast({
        title: "Validation impossible",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      }),
  });

  if (!classId || !gradingPeriodId || !subjectId)
    return (
      <EmptyState
        title="Calcul non défini"
        description="Revenez à Évaluations & notes puis choisissez une matière à calculer."
        action={{
          label: "Retour aux évaluations",
          onClick: () => navigate("/academic/notes"),
        }}
      />
    );
  if (scopeQuery.isLoading || studentsQuery.isLoading)
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Chargement du calcul…
      </p>
    );
  if (scopeQuery.isError || studentsQuery.isError || !subject || !completion)
    return (
      <EmptyState
        title="Calcul indisponible"
        description="Vérifiez la classe, la matière et la période choisies depuis Évaluations & notes."
        action={{
          label: "Retour aux évaluations",
          onClick: () => navigate("/academic/notes"),
        }}
      />
    );
  if (!completion.calculationStarted)
    return (
      <EmptyState
        title="Saisie encore ouverte"
        description="Calculez d’abord les moyennes de cette matière depuis Évaluations & notes."
        action={{
          label: "Retour aux évaluations",
          onClick: () =>
            navigate(
              `/academic/notes?classId=${encodeURIComponent(classId)}&gradingPeriodId=${encodeURIComponent(gradingPeriodId)}`,
            ),
        }}
      />
    );

  const editable =
    completion.status !== "completed" && period?.notesEntryOpen !== false && !period?.closedClassIds?.includes(classId);
  return (
    <>
      <OfflineIndicator />
      <InstallPwaCard
        audience="user"
        headline="Installez IvoirEdu pour pointer plus vite"
        className="!mb-4 !mt-0"
      />
      <div className="space-y-6 md:px-6 md:py-8">
        <header className="space-y-3">
          <Button variant="ghost" className="min-h-6 px-0 py-0" asChild>
            <Link
              to={`/academic/notes?classId=${encodeURIComponent(classId)}&gradingPeriodId=${encodeURIComponent(gradingPeriodId)}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour aux évaluations
            </Link>
          </Button>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Calcul des moyennes
              </h1>
              <div className="text-sm text-muted-foreground">
                {selectedClass?.name ?? "Classe"} · {subject.name} ·{" "}
                {period?.label ?? "Période"} &nbsp;
                <Badge variant={ completion.status === "completed" ? "outline" : "secondary" }>
                  {completion.status === "completed"
                    ? "Moyennes validées"
                    : "Calcul en cours"}
                </Badge>
              </div>
            </div>
            
          </div>
        </header>
        <ol className="grid grid-cols-3 gap-2 text-center text-xs" aria-label="Étapes de calcul" >
          <li className="rounded-lg border p-2 text-muted-foreground">
            1. Notes terminées
          </li>
          <li
            className={
              currentStep === 2
                ? "rounded-lg bg-primary p-2 font-medium text-primary-foreground"
                : "rounded-lg border p-2 text-muted-foreground"
            } >
            2. Notes par élève
          </li>
          <li
            className={
              currentStep === 3
                ? "rounded-lg bg-primary p-2 font-medium text-primary-foreground"
                : "rounded-lg border p-2 text-muted-foreground"
            }
          >
            3. Moyennes
          </li>
        </ol>
        {completion.status === "completed" || period?.notesEntryOpen === false ? (
          <Card className="shadow-sm !mt-3">
            <CardContent className="flex gap-3 p-4 text-xs">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
              {period?.notesEntryOpen === false
                ? "Cette période est consultable uniquement. Les données ne redeviennent jamais modifiables après la génération des bulletins."
                : "Cette matière est validée. Les moyennes et le détail des notes restent consultables."}
            </CardContent>
          </Card>
        ) : null}
        {currentStep === 2 ? (
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle>Notes de {subject.name}</CardTitle>
              <CardDescription>
                Le détail des évaluations et des notes est disponible pour chaque
                élève.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Élève</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="text-right">Détail</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell className="font-medium">
                        {student.firstName} {student.lastName}
                      </TableCell>
                      <TableCell>
                        {evaluationCount(evaluations, student.id)} note
                        {evaluationCount(evaluations, student.id) > 1 ? "s" : ""}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="outline"
                          className="min-h-6"
                          onClick={() => setDetailsStudentId(student.id)}
                          aria-label={`Consulter les notes de ${student.firstName} ${student.lastName}`}
                        >
                          <Eye className=" h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle>Moyennes de {subject.name}</CardTitle>
              <CardDescription>
                Consultez les résultats académiques de chaque élève.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Élève</TableHead>
                    <TableHead>Moyenne / 20</TableHead>
                    <TableHead className="text-right">Détail</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((student) => (
                    <TableRow key={student.id} >
                      <TableCell className="font-medium px-2 py-2" pNone="true">
                        {student.firstName} {student.lastName}
                      </TableCell>
                      <TableCell className="font-medium px-2 py-2" pNone="true">
                        {formatAverage(subjectAverage(evaluations, student.id))}
                      </TableCell>
                      <TableCell className="text-right px-2 py-2"  pNone="true">
                        <Button
                          type="button"
                          variant="outline"
                          className="min-h-6"
                          onClick={() => setDetailsStudentId(student.id)}
                          aria-label={`Consulter les notes de ${student.firstName} ${student.lastName}`}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
        {editable && currentStep === 2 ? (
          <div className="sticky bottom-0 space-y-2 border-t bg-background/95 py-3">
            <Button type="button" className="min-h-6 w-full" onClick={() => setCurrentStep(3)}>
              Voir les moyennes par élève
            </Button>
          </div>
        ) : null}
        {editable && currentStep === 3 ? (
          <div className="sticky bottom-0 space-y-2 border-t bg-background/95 py-3">
            <Button
              type="button"
              variant="outline"
              className="min-h-6 w-full"
              onClick={() => setCurrentStep(2)}
            >
              Revenir aux notes par élève
            </Button>
            <Button
              type="button"
              className="min-h-6 w-full"
              disabled={validateMutation.isPending || !isReadyForValidation}
              onClick={() => validateMutation.mutate()}
            >
              {validateMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Valider mes moyennes de {subject.name}
            </Button>
            {!isReadyForValidation ? (
              <p className="text-center text-xs text-muted-foreground">
                Ajoutez au moins une évaluation et terminez toutes les notes avant la validation.
              </p>
            ) : null}
            <p className="text-center text-xs text-muted-foreground">
              Après validation, les moyennes restent consultables mais ne sont
              plus modifiables.
            </p>
          </div>
        ) : null}
        <StudentNotesDialog
          student={detailsStudent}
          evaluations={evaluations}
          onOpenChange={(open) => !open && setDetailsStudentId(null)}
        />
      </div>
    </>
  );
}

function evaluationCount(
  evaluations: EvaluationWithGrades[],
  studentId: string,
) {
  return evaluations.filter(
    (evaluation) =>
      evaluation.type === "scheduled" &&
      evaluation.grades.some((grade) => grade.studentId === studentId),
  ).length;
}

function StudentNotesDialog({
  student,
  evaluations,
  onOpenChange,
}: {
  student: StudentItem | null;
  evaluations: EvaluationWithGrades[];
  onOpenChange: (open: boolean) => void;
}) {
  const scheduled = evaluations
    .filter((evaluation) => evaluation.type === "scheduled")
    .flatMap((evaluation) =>
      evaluation.grades
        .filter((grade) => grade.studentId === student?.id)
        .map((grade) => ({
          label: evaluation.label,
          coefficient: evaluation.coefficient,
          ...grade,
        })),
    );
  const spontaneous = evaluations
    .filter((evaluation) => evaluation.type === "spontaneous")
    .flatMap((evaluation) =>
      evaluation.grades
        .filter((grade) => grade.studentId === student?.id)
        .map((grade) => ({
          label: evaluation.label,
          ...grade,
          score: evaluation.label.startsWith("Note spontanée -")
            ? -grade.score
            : grade.score,
        })),
    );
  return (
    <Dialog open={Boolean(student)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-2xl overflow-y-auto rounded-lg p-0 sm:w-full gap-0">
        <DialogHeader className="border-b px-5 py-5 text-left sm:px-6">
          <DialogTitle>
            Notes de{" "}
            {student ? `${student.firstName} ${student.lastName}` : "l’élève"}
          </DialogTitle>
          <DialogDescription>
            Détail des évaluations retenues pour la moyenne.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-5 px-5 py-5 sm:grid-cols-2 sm:px-6">
          <NotesList
            title="Évaluations"
            items={scheduled}
            empty="Aucune note d’évaluation."
          />
          <NotesList
            title="Notes spontanées"
            items={spontaneous}
            empty="Aucune note spontanée."
            spontaneous
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NotesList({
  title,
  items,
  empty,
  spontaneous = false,
}: {
  title: string;
  items: Array<{
    label: string;
    score: number;
    maxScore: number;
    comment: string | null;
    coefficient?: number;
  }>;
  empty: string;
  spontaneous?: boolean;
}) {
  return (
    <div>
      <p className="mb-2 font-medium">{title}</p>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {items.map((item) => (
            <li key={`${item.label}-${item.score}-${item.comment ?? ""}`}>
              <span
                className={
                  spontaneous && item.score < 0
                    ? "font-medium text-red-700"
                    : "font-medium"
                }
              >
                {spontaneous && item.score > 0 ? "+" : ""}
                {item.score}
                {spontaneous ? " point(s)" : `/${item.maxScore}`}
              </span>
              <span className="text-muted-foreground">
                {" "}
                · {item.label}
                {item.coefficient ? ` · coef. ${item.coefficient}` : ""}
              </span>
              {item.comment ? (
                <span className="block text-muted-foreground">
                  Justificatif : {item.comment}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
