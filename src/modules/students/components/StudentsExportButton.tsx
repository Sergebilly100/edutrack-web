import { exportStudentsExcel } from "@/modules/students/students.api"
import { ExportListDialog } from "@/shared/components/ExportListDialog"

type StudentsExportButtonProps = {
  noun: string
  levelFilter: string
  classFilter: string
  statusFilter: string
  searchTerm: string
}

/** Export Excel des élèves : « sélection filtrée » = filtres de la liste (niveau, classe, statut, recherche). */
export function StudentsExportButton({ noun, levelFilter, classFilter, statusFilter, searchTerm }: StudentsExportButtonProps) {
  const search = searchTerm.trim()
  return (
    <ExportListDialog
      noun={noun}
      filtersActive={levelFilter !== "all" || classFilter !== "all" || statusFilter !== "all" || search !== ""}
      yearHint="Les inscriptions de l’année choisie sont exportées. Le filtre de classe ne s’applique qu’à l’année active."
      onExport={({ schoolYearId, schoolYearLabel, filtered, isActiveYear }) => exportStudentsExcel({
        schoolYearId,
        schoolYearLabel,
        filters: filtered ? {
          classId: isActiveYear && classFilter !== "all" ? classFilter : undefined,
          levelId: levelFilter === "all" ? undefined : levelFilter,
          isActive: statusFilter === "all" ? undefined : statusFilter === "active",
          search: search || undefined,
        } : undefined,
      })}
    />
  )
}
