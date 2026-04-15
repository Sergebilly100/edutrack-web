import type { Table as TanStackTable } from "@tanstack/react-table"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ChevronLeftIcon, ChevronRightIcon } from "@/shared/components/icons"

interface DataTablePaginationProps<TData> {
  table: TanStackTable<TData>
  pageSize: number
}

export function DataTablePagination<TData>({ table, pageSize }: DataTablePaginationProps<TData>) {
  const total = table.getFilteredRowModel().rows.length

  if (total <= pageSize) {
    return null
  }

  const { pageIndex, pageSize: currentPageSize } = table.getState().pagination
  const start = total === 0 ? 0 : pageIndex * currentPageSize + 1
  const end = Math.min((pageIndex + 1) * currentPageSize, total)

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-muted-foreground">
        Affichant {start}–{end} sur {total} resultats
      </p>
      <div className="flex items-center gap-2">
        <Select
          value={String(currentPageSize)}
          onValueChange={(value) => table.setPageSize(Number(value))}
        >
          <SelectTrigger className="h-8 w-[130px]">
            <SelectValue placeholder="Lignes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="10">10 / page</SelectItem>
            <SelectItem value="20">20 / page</SelectItem>
            <SelectItem value="50">50 / page</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="sm"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
          aria-label="Page precedente"
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
          aria-label="Page suivante"
        >
          <ChevronRightIcon className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
