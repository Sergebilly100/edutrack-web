import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
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
import { getSchoolSmsFeatureSettings } from "@/modules/settings/settings.api"
import { useStudentLabels, type StudentLabels } from "@/shared/hooks/useStudentLabel"

const buildBasePermissionColumns = (labels: StudentLabels) => [
  {
    key: "teachers",
    label: "Profs",
    permissions: [
      "teachers.view",
      "teachers.create",
      "teachers.edit",
      "teachers.block",
      "teachers.documents",
      "teachers.ranking.view",
      "teachers.attendance.view",
      "teachers.password.reset",
    ],
  },
  {
    key: "students",
    label: labels.plural,
    permissions: ["students.view", "students.create", "students.edit", "students.documents", "students.excuse"],
  },
  {
    key: "schedule",
    label: "EDT",
    permissions: ["schedule.view", "schedule.edit"],
  },
  {
    key: "salary",
    label: "Salaires",
    permissions: ["salary.view", "salary.compute", "salary.mark_paid", "salary.export"],
  },
  {
    key: "validations",
    label: "Validations horaires",
    permissions: ["validations.view", "validations.approve", "validations.reject"],
  },
  {
    key: "rooms",
    label: "Salles & QR",
    permissions: ["rooms.view", "rooms.create", "rooms.edit", "rooms.delete"],
  },
  {
    key: "import",
    label: "Import",
    permissions: ["import.students", "import.teachers", "import.schedule"],
  },
]

const buildBasePermissionRows = (labels: StudentLabels) => [
  { key: "view", label: "Voir" },
  { key: "create", label: "Créer" },
  { key: "edit", label: "Modifier" },
  { key: "delete", label: "Supprimer" },
  { key: "block", label: "Bloquer" },
  { key: "documents", label: "Documents" },
  { key: "ranking.view", label: "Voir classement" },
  { key: "attendance.view", label: "Analyse + absences" },
  { key: "password.reset", label: "Réinitialiser mdp" },
  { key: "excuse", label: "Excuser absence" },
  { key: "compute", label: "Calculer" },
  { key: "mark_paid", label: "Marquer payé" },
  { key: "export", label: "Exporter" },
  { key: "approve", label: "Valider une présence" },
  { key: "reject", label: "Refuser une présence" },
  { key: "students", label: `Importer ${labels.pluralLower}` },
  { key: "teachers", label: "Importer profs" },
  { key: "schedule", label: "Importer EDT" },
]

const SMS_PERMISSION_COLUMN = {
  key: "settings",
  label: "Paramètres",
  permissions: ["settings.sms_templates"],
} as const

const SMS_PERMISSION_ROW = { key: "sms_templates", label: "Template SMS école" } as const

const SUBSCRIPTIONS_PERMISSION_COLUMN = {
  key: "subscriptions",
  label: "Abonnements parents",
  permissions: [
    "subscriptions.view",
    "subscriptions.create",
    "subscriptions.renew",
    "subscriptions.cancel",
    "subscriptions.revenue",
  ],
} as const

const SUBSCRIPTIONS_PERMISSION_ROWS = [
  { key: "subscriptions_renew", label: "Renouveler un abonnement" },
  { key: "subscriptions_cancel", label: "Annuler un abonnement" },
  { key: "subscriptions_revenue", label: "Voir les revenus et commissions" },
] as const

type PermissionColumn = {
  key: string
  label: string
  permissions: readonly string[]
}
type PermissionRow = {
  key: string
  label: string
}

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
  validations: "validations.view",
  rooms: "rooms.view",
  schedule: "schedule.view",
}

const ACTION_KEYS_REQUIRING_VIEW = new Set([
  "create",
  "edit",
  "delete",
  "block",
  "documents",
  "ranking.view",
  "attendance.view",
  "password.reset",
  "excuse",
  "compute",
  "mark_paid",
  "export",
  "approve",
  "reject",
  "renew",
  "cancel",
  "revenue",
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

const isViewLocked = (
  permission: string,
  permissions: readonly string[]
): boolean => {
  const segments = splitPermission(permission)
  if (!segments || segments.action !== "view") {
    return false
  }

  return permissions.some((candidatePermission) => {
    const candidate = splitPermission(candidatePermission)
    if (!candidate) {
      return false
    }

    return (
      candidate.category === segments.category &&
      ACTION_KEYS_REQUIRING_VIEW.has(candidate.action)
    )
  })
}

const resolvePermissionKey = (
  column: PermissionColumn,
  actionKey: string
) => {
  if (actionKey.startsWith("subscriptions_")) {
    if (column.key !== "subscriptions") {
      return null
    }
    const subscriptionAction = actionKey.replace("subscriptions_", "")
    const key = `${column.key}.${subscriptionAction}`
    return (column.permissions as readonly string[]).includes(key) ? key : null
  }

  const key = `${column.key}.${actionKey}`
  return (column.permissions as readonly string[]).includes(key) ? key : null
}

export default function RoleMatrix({
  position,
  onChange,
  canManageSmsTemplates = false,
  className,
}: RoleMatrixProps) {
  const smsFeatureQuery = useQuery({
    queryKey: ["settings", "sms-feature", "role-matrix"],
    queryFn: getSchoolSmsFeatureSettings,
  })
  const isSubscriptionsCategoryEnabled = smsFeatureQuery.data?.monetize_parent_alerts === true
  const studentLabels = useStudentLabels()

  const permissionColumns = useMemo<PermissionColumn[]>(
    () => {
      const columns: PermissionColumn[] = [...buildBasePermissionColumns(studentLabels)]

      if (isSubscriptionsCategoryEnabled) {
        columns.push(SUBSCRIPTIONS_PERMISSION_COLUMN)
      }
      if (canManageSmsTemplates) {
        columns.push(SMS_PERMISSION_COLUMN)
      }

      return columns
    },
    [canManageSmsTemplates, isSubscriptionsCategoryEnabled, studentLabels]
  )
  const permissionRows = useMemo(
    () => {
      const rows: PermissionRow[] = [...buildBasePermissionRows(studentLabels)]

      if (isSubscriptionsCategoryEnabled) {
        rows.push(...SUBSCRIPTIONS_PERMISSION_ROWS)
      }
      if (canManageSmsTemplates) {
        rows.push(SMS_PERMISSION_ROW)
      }

      return rows
    },
    [canManageSmsTemplates, isSubscriptionsCategoryEnabled, studentLabels]
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
        const locked = isViewLocked(permission, position.permissions)
        if (locked) {
          return
        }
      }

      next.delete(permission)
    }

    onChange(uniqueSorted(Array.from(next)))
  }

  const toggleColumn = (column: PermissionColumn, checked: boolean) => {
    const next = new Set(position.permissions)

    if (checked) {
      for (const permission of column.permissions) {
        next.add(permission)
        const requiredView = resolveViewDependency(permission)
        if (requiredView) {
          next.add(requiredView)
        }
      }
    } else {
      // Calculer les permissions à retirer SAUF celles locked par des permissions hors colonne
      const columnPermSet = new Set<string>(column.permissions as readonly string[])
      const permissionsOutsideColumn = Array.from(next).filter(p => !columnPermSet.has(p))

      for (const permission of column.permissions) {
        const segments = splitPermission(permission)
        if (segments?.action === "view") {
          // Vérifier si une permission hors de cette colonne requiert ce .view
          const lockedByOutside = permissionsOutsideColumn.some(p => {
            const c = splitPermission(p)
            return c !== null && c.category === segments.category && ACTION_KEYS_REQUIRING_VIEW.has(c.action)
          })
          if (!lockedByOutside) {
            next.delete(permission)
          }
        } else {
          next.delete(permission)
        }
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
                  const isDisabled = isViewLocked(permission, position.permissions)

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
                            disabled={isDisabled}
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
