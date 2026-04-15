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
  { key: "teachers", label: "Profs" },
  { key: "students", label: "Élèves" },
  { key: "schedule", label: "EDT" },
  { key: "attendance", label: "Présences" },
  { key: "salary", label: "Salaires" },
  { key: "settings", label: "Paramètres" },
] as const

const PERMISSION_ROWS = [
  { key: "view", label: "Voir" },
  { key: "create", label: "Créer" },
  { key: "update", label: "Modifier" },
  { key: "delete", label: "Supprimer" },
  { key: "export", label: "Exporter" },
] as const

type PermissionCategory = (typeof PERMISSION_COLUMNS)[number]["key"]
type PermissionAction = (typeof PERMISSION_ROWS)[number]["key"]

type RoleMatrixPosition = {
  permissions: string[]
}

type RoleMatrixProps = {
  position: RoleMatrixPosition
  onChange: (permissions: string[]) => void
  className?: string
}

const getPermissionKey = (category: PermissionCategory, action: PermissionAction) =>
  `${category}.${action}`

const uniqueSorted = (permissions: string[]) => Array.from(new Set(permissions)).sort()

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

  const toggleColumn = (category: PermissionCategory, checked: boolean) => {
    const next = new Set(position.permissions)

    for (const row of PERMISSION_ROWS) {
      const key = getPermissionKey(category, row.key)
      if (checked) {
        next.add(key)
      } else {
        next.delete(key)
      }
    }

    onChange(uniqueSorted(Array.from(next)))
  }

  return (
    <div className={cn("rounded-lg border border-border", className)}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[140px] text-sm">Action</TableHead>
            {PERMISSION_COLUMNS.map((column) => {
              const total = PERMISSION_ROWS.length
              const selected = PERMISSION_ROWS.reduce((count, row) => {
                const key = getPermissionKey(column.key, row.key)
                return count + (permissionSet.has(key) ? 1 : 0)
              }, 0)

              const checkedState = selected === 0 ? false : selected === total ? true : "indeterminate"

              return (
                <TableHead key={column.key} className="min-w-[120px] text-center text-sm">
                  <div className="flex items-center justify-center gap-2">
                    <Checkbox
                      checked={checkedState}
                      onCheckedChange={(checked) => toggleColumn(column.key, checked === true)}
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
                const permission = getPermissionKey(column.key, row.key)

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
