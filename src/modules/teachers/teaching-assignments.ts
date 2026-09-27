export type AssignmentBlock = { subjectName: string; classIds: string[] };
type Subject = { id: string; name: string; levelId: string };
type SchoolClass = { id: string; name: string; isActive: boolean; level: { id: string }; schoolYear: { id: string } };

export function groupTeachingAssignments(assignments: Array<{ subjectId: string; subjectName?: string; classId: string }>, subjects: Subject[] = []): AssignmentBlock[] {
  const groups = new Map<string, string[]>();
  for (const assignment of assignments) {
    const name = assignment.subjectName ?? subjects.find((subject) => subject.id === assignment.subjectId)?.name ?? assignment.subjectId;
    const classes = groups.get(name) ?? [];
    if (!classes.includes(assignment.classId)) classes.push(assignment.classId);
    groups.set(name, classes);
  }
  return [...groups].map(([subjectName, classIds]) => ({ subjectName, classIds }));
}

/** Expand each explicit block only, resolving the subject defined for each class's level. */
export function resolveAssignmentBlocks(blocks: AssignmentBlock[], subjects: Subject[], classes: SchoolClass[], activeYearId: string | undefined) {
  const pairs: Array<{ subjectId: string; classId: string }> = [];
  const errors: Array<{ blockIndex: number; message: string }> = [];
  const seen = new Set<string>();
  blocks.forEach((block, blockIndex) => {
    if (!block.subjectName || !block.classIds.length) {
      errors.push({ blockIndex, message: "Choisissez une matière et au moins une classe pour ce bloc" });
      return;
    }
    for (const classId of block.classIds) {
      const schoolClass = classes.find((item) => item.id === classId);
      if (!activeYearId || !schoolClass?.isActive || schoolClass.schoolYear.id !== activeYearId) {
        errors.push({ blockIndex, message: "Chaque classe doit appartenir à l’année active" });
        continue;
      }
      const matches = subjects.filter((subject) => subject.name === block.subjectName && subject.levelId === schoolClass.level.id);
      if (matches.length !== 1) {
        errors.push({ blockIndex, message: `La matière ${block.subjectName} doit être définie une seule fois pour le niveau de ${schoolClass.name}` });
        continue;
      }
      const key = `${matches[0].id}:${classId}`;
      if (seen.has(key)) errors.push({ blockIndex, message: `Association déjà sélectionnée : ${block.subjectName} → ${schoolClass.name}` });
      else { seen.add(key); pairs.push({ subjectId: matches[0].id, classId }); }
    }
  });
  return { pairs, errors };
}
