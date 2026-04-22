import { useMemo } from "react"

import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

const PERMISSION_COLUMNS = [
  {
    key: "teachers",
    label: "Profs",
    permissions: ["teachers.view", "teachers.create", "teachers.edit", "teachers.block", "teachers.documents"],
  },
  {
    key: "students",
    label: "Élèves",
    permissions: ["students.view", "students.create", "students.edit", "students.documents"],
  },
  {
    key: "schedule",
    label: "EDT",
    permissions: ["schedule.view", "schedule.edit"],
  },
  {
    key: "attendance",
    label: "Présences",
    permissions: ["attendance.view", "attendance.mark_students"],
  },
  {
    key: "salary",
    label: "Salaires",
    permissions: ["salary.view", "salary.compute", "salary.mark_paid", "salary.export"],
  },
] as const

const PERMISSION_ROWS = [
  { key: "view", label: "Voir" },
  { key: "create", label: "Créer" },
  { key: "edit", label: "Modifier" },
  { key: "block", label: "Bloquer" },
  { key: "documents", label: "Documents" },
  { key: "mark_students", label: "Marquer les présences" },
  { key: "compute", label: "Calculer" },
  { key: "mark_paid", label: "Marquer payé" },
  { key: "export", label: "Exporter" },
] as const

type PermissionColumn = (typeof PERMISSION_COLUMNS)[number]

type RoleMatrixPosition = {
  permissions: string[]
}

type RoleMatrixProps = {
  position: RoleMatrixPosition
  onChange: (permissions: string[]) => void
  className?: string
}

const uniqueSorted = (permissions: string[]) => Array.from(new Set(permissions)).sort()

const resolvePermissionKey = (column: PermissionColumn, actionKey: (typeof PERMISSION_ROWS)[number]["key"]) => {
  const key = `${column.key}.${actionKey}`
  return (column.permissions as readonly string[]).includes(key) ? key : null
}

export default function RoleMatrix({ position, onChange, className }: RoleMatrixProps) {
  const permissionSet = useMemo(() => new Set(position.permissions), [position.permissions])

  const togglePermission = (permission: string, checked: boolean) => {
    const next = new Set(position.permissions)
    if (checked) {
      next.add(permission)
    } else {
      next.delete(permission)
    }

    onChange(uniqueSorted(Array.from(next)))
  }

  const toggleColumn = (column: PermissionColumn, checked: boolean) => {
    const next = new Set(position.permissions)

    for (const permission of column.permissions) {
      if (checked) {
        next.add(permission)
      } else {
        next.delete(permission)
      }
    }

    onChange(uniqueSorted(Array.from(next)))
  }

  return (
    <div className={cn("rounded-lg border border-border", className)}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[180px] text-sm">Action</TableHead>
            {PERMISSION_COLUMNS.map((column) => {
              const selected = column.permissions.reduce((count, permission) => {
                return count + (permissionSet.has(permission) ? 1 : 0)
              }, 0)
              const total = column.permissions.length
              const checkedState = selected === 0 ? false : selected === total ? true : "indeterminate"

              return (
                <TableHead key={column.key} className="min-w-[130px] text-center text-sm">
                  <div className="flex items-center justify-center gap-2">
                    <Checkbox
                      checked={checkedState}
                      onCheckedChange={(checked) => toggleColumn(column, checked === true)}
                      aria-label={`Tout sélectionner ${column.label}`}
                    />
                    <span>{column.label}</span>
                  </div>
                </TableHead>
              )
            })}
          </TableRow>
        </TableHeader>

        <TableBody>
          {PERMISSION_ROWS.map((row, index) => (
            <TableRow key={row.key} className={cn(index % 2 === 0 ? "bg-muted/20" : "bg-background", "hover:bg-muted/40")}>
              <TableCell className="font-medium text-sm">{row.label}</TableCell>
              {PERMISSION_COLUMNS.map((column) => {
                const permission = resolvePermissionKey(column, row.key)

                if (!permission) {
                  return (
                    <TableCell key={`${column.key}.${row.key}`} className="text-center text-muted-foreground">
                      -
                    </TableCell>
                  )
                }

                return (
                  <TableCell key={permission} className="text-center">
                    <Checkbox
                      checked={permissionSet.has(permission)}
                      onCheckedChange={(checked) => togglePermission(permission, checked === true)}
                      aria-label={`${column.label} ${row.label}`}
                    />
                  </TableCell>
                )
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
