import * as React from "react"
import type { Table as TanStackTable } from "@tanstack/react-table"

import { Input } from "@/components/ui/input"
import { SearchIcon } from "@/shared/components/icons"

interface DataTableToolbarProps<TData> {
  table: TanStackTable<TData>
  searchKey?: string
  searchPlaceholder?: string
  actions?: React.ReactNode
}

export function DataTableToolbar<TData>({
  table,
  searchKey,
  searchPlaceholder,
  actions,
}: DataTableToolbarProps<TData>) {
  const searchValue = searchKey
    ? (table.getColumn(searchKey)?.getFilterValue() as string | undefined) ?? ""
    : ""

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      {searchKey ? (
        <div className="relative w-full sm:max-w-sm">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchValue}
            onChange={(event) => table.getColumn(searchKey)?.setFilterValue(event.target.value)}
            placeholder={searchPlaceholder || "Rechercher..."}
            className="pl-9"
          />
        </div>
      ) : null}
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}
