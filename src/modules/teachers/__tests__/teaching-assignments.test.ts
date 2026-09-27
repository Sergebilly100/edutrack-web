import { describe, expect, it } from 'vitest';
import { groupTeachingAssignments, resolveAssignmentBlocks } from '../teaching-assignments';

const subjects = [{ id: 'm4', name: 'Mathématiques', levelId: '4' }, { id: 'm2', name: 'Mathématiques', levelId: '2' }, { id: 'c3', name: 'Chimie', levelId: '3' }];
const classes = [{ id: '4a', name: '4e A', level: { id: '4' } }, { id: '2c', name: '2nde C', level: { id: '2' } }, { id: '3b', name: '3e B', level: { id: '3' } }].map((item) => ({ ...item, isActive: true, schoolYear: { id: 'year' } }));
const blocks = [{ subjectName: 'Mathématiques', classIds: ['4a', '2c'] }, { subjectName: 'Chimie', classIds: ['3b'] }];

describe('assignment blocks', () => {
  it('expands explicit groups without cross combinations and restores those groups on edit', () => {
    const result = resolveAssignmentBlocks(blocks, subjects, classes, 'year');
    expect(result.errors).toEqual([]);
    expect(result.pairs).toEqual([{ subjectId: 'm4', classId: '4a' }, { subjectId: 'm2', classId: '2c' }, { subjectId: 'c3', classId: '3b' }]);
    expect(groupTeachingAssignments(result.pairs, subjects)).toEqual(blocks);
  });
  it('reports duplicate pairs across blocks before submission', () => {
    expect(resolveAssignmentBlocks([...blocks, { subjectName: 'Mathématiques', classIds: ['4a'] }], subjects, classes, 'year').errors[0].message).toContain('déjà sélectionnée');
  });
  it('requires the active year, existing classes and matching subject levels', () => {
    expect(resolveAssignmentBlocks(blocks, subjects, classes, undefined).errors).toHaveLength(3);
    expect(resolveAssignmentBlocks(blocks, subjects, classes, 'old-year').errors).toHaveLength(3);
    expect(resolveAssignmentBlocks([{ subjectName: 'Chimie', classIds: ['4a'] }], subjects, classes, 'year').errors).toHaveLength(1);
  });
});
