import { useMemo } from "react"
import { ShieldCheck } from "lucide-react"

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

const BASE_PERMISSION_COLUMNS = [
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

const BASE_PERMISSION_ROWS = [
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

const SMS_PERMISSION_COLUMN = {
  key: "settings",
  label: "Paramètres",
  permissions: ["settings.sms_templates"],
} as const

const SMS_PERMISSION_ROW = { key: "sms_templates", label: "Template SMS école" } as const

type PermissionColumn = (typeof BASE_PERMISSION_COLUMNS)[number] | typeof SMS_PERMISSION_COLUMN

type RoleMatrixPosition = {
  permissions: string[]
}

type RoleMatrixProps = {
  position: RoleMatrixPosition
  onChange: (permissions: string[]) => void
  canManageSmsTemplates?: boolean
  className?: string
}

const uniqueSorted = (permissions: string[]) => Array.from(new Set(permissions)).sort()

const CATEGORY_VIEW_PERMISSION: Readonly<Record<string, string>> = {
  teachers: "teachers.view",
  students: "students.view",
  salary: "salary.view",
  rooms: "rooms.view",
  schedule: "schedule.view",
  attendance: "attendance.view",
}

const ACTION_KEYS_REQUIRING_VIEW = new Set([
  "create",
  "edit",
  "delete",
  "block",
  "compute",
  "mark_paid",
  "export",
])

const splitPermission = (permission: string): { category: string; action: string } | null => {
  const dotIndex = permission.indexOf(".")
  if (dotIndex <= 0 || dotIndex >= permission.length - 1) {
    return null
  }

  return {
    category: permission.slice(0, dotIndex),
    action: permission.slice(dotIndex + 1),
  }
}

const resolveViewDependency = (permission: string): string | null => {
  const segments = splitPermission(permission)
  if (!segments) {
    return null
  }

  if (!ACTION_KEYS_REQUIRING_VIEW.has(segments.action)) {
    return null
  }

  return CATEGORY_VIEW_PERMISSION[segments.category] ?? null
}

const resolvePermissionKey = (
  column: PermissionColumn,
  actionKey: string
) => {
  const key = `${column.key}.${actionKey}`
  return (column.permissions as readonly string[]).includes(key) ? key : null
}

export default function RoleMatrix({
  position,
  onChange,
  canManageSmsTemplates = false,
  className,
}: RoleMatrixProps) {
  const permissionColumns = useMemo(
    () =>
      canManageSmsTemplates
        ? [...BASE_PERMISSION_COLUMNS, SMS_PERMISSION_COLUMN]
        : BASE_PERMISSION_COLUMNS,
    [canManageSmsTemplates]
  )
  const permissionRows = useMemo(
    () => (canManageSmsTemplates ? [...BASE_PERMISSION_ROWS, SMS_PERMISSION_ROW] : BASE_PERMISSION_ROWS),
    [canManageSmsTemplates]
  )
  const permissionSet = useMemo(() => new Set(position.permissions), [position.permissions])

  const togglePermission = (permission: string, checked: boolean) => {
    const next = new Set(position.permissions)

    const segments = splitPermission(permission)
    const isViewPermission = segments?.action === "view"
    if (checked) {
      next.add(permission)

      const requiredView = resolveViewDependency(permission)
      if (requiredView) {
        next.add(requiredView)
      }
    } else {
      if (isViewPermission && segments) {
        const activeDependentActions = position.permissions.filter((candidatePermission) => {
          const candidate = splitPermission(candidatePermission)
          if (!candidate) {
            return false
          }

          return (
            candidate.category === segments.category &&
            ACTION_KEYS_REQUIRING_VIEW.has(candidate.action)
          )
        })

        if (activeDependentActions.length > 0) {
          const shouldClearCategory = window.confirm(
            "Cette permission \"Voir\" est requise par des actions actives. Voulez-vous décocher \"Voir\" et toutes les actions de cette catégorie ?"
          )

          if (!shouldClearCategory) {
            return
          }

          for (const dependentPermission of activeDependentActions) {
            next.delete(dependentPermission)
          }
        }
      }

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
    <div className={cn("overflow-hidden rounded-xl border border-border bg-card shadow-sm", className)}>
      <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Matrice de permissions</span>
        </div>
        <span className="text-xs text-muted-foreground">
          {position.permissions.length} permission{position.permissions.length !== 1 ? "s" : ""} activée
          {position.permissions.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-b bg-muted/20 hover:bg-muted/20">
              <TableHead className="w-[160px] py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Action
              </TableHead>
              {permissionColumns.map((column) => {
                const selected = column.permissions.reduce(
                  (count, permission) => count + (permissionSet.has(permission) ? 1 : 0),
                  0,
                )
                const total = column.permissions.length
                const checkedState = selected === 0 ? false : selected === total ? true : "indeterminate"
                const allChecked = selected === total

                return (
                  <TableHead key={column.key} className="py-3 text-center align-bottom">
                    <div className="flex flex-col items-center gap-1.5">
                      <div
                        className={cn(
                          "flex h-7 w-7 items-center justify-center rounded-md border transition-colors",
                          allChecked ? "border-blue-200 bg-blue-50" : "border-border bg-muted",
                        )}
                      >
                        <Checkbox
                          checked={checkedState}
                          onCheckedChange={(checked) => toggleColumn(column, checked === true)}
                          aria-label={`Tout sélectionner ${column.label}`}
                        />
                      </div>
                      <span className={cn("text-[11px] font-medium", allChecked ? "text-blue-700" : "text-muted-foreground")}>
                        {column.label}
                      </span>
                      <div className="h-0.5 w-10 overflow-hidden rounded-full bg-border">
                        <div
                          className="h-full rounded-full bg-blue-500 transition-all duration-300"
                          style={{ width: `${(selected / total) * 100}%` }}
                        />
                      </div>
                    </div>
                  </TableHead>
                )
              })}
            </TableRow>
          </TableHeader>

          <TableBody>
            {permissionRows.map((row, index) => (
              <TableRow
                key={row.key}
                className={cn(
                  "transition-colors",
                  index % 2 === 0 ? "bg-background" : "bg-muted/10",
                  "hover:bg-primary/5",
                )}
              >
                <TableCell className="py-2.5 pl-4">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {row.label}
                  </span>
                </TableCell>
                {permissionColumns.map((column) => {
                  const permission = resolvePermissionKey(column, row.key)

                  if (!permission) {
                    return (
                      <TableCell key={`${column.key}.${row.key}`} className="text-center">
                        <div className="flex justify-center">
                          <div className="h-1.5 w-1.5 rounded-full bg-border" />
                        </div>
                      </TableCell>
                    )
                  }

                  const isChecked = permissionSet.has(permission)

                  return (
                    <TableCell key={permission} className="text-center">
                      <div className="flex justify-center">
                        <div
                          className={cn(
                            "flex h-6 w-6 items-center justify-center rounded-md border transition-colors",
                            isChecked ? "border-blue-200 bg-blue-50" : "border-border hover:bg-muted",
                          )}
                        >
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={(checked) => togglePermission(permission, checked === true)}
                            aria-label={`${column.label} ${row.label}`}
                          />
                        </div>
                      </div>
                    </TableCell>
                  )
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
