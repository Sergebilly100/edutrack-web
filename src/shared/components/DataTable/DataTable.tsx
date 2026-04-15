import * as React from "react"
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
} from "@tanstack/react-table"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { EmptyState } from "@/shared/components/EmptyState"
import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
} from "@/shared/components/icons"

import { DataTablePagination } from "./DataTablePagination"
import { DataTableSkeleton } from "./DataTableSkeleton"
import { DataTableToolbar } from "./DataTableToolbar"

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  isLoading?: boolean
  searchKey?: string
  searchPlaceholder?: string
  emptyState?: React.ReactNode
  pageSize?: number
  onRowClick?: (row: TData) => void
  mobileCard?: (row: TData) => React.ReactNode
  toolbarActions?: React.ReactNode
}

export function DataTable<TData, TValue>({
  columns,
  data,
  isLoading,
  searchKey,
  searchPlaceholder,
  emptyState,
  pageSize = 20,
  onRowClick,
  mobileCard,
  toolbarActions,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])

  // eslint-disable-next-line react-hooks/incompatible-library -- useReactTable est la source d'etat officielle TanStack
  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize,
      },
    },
    state: {
      sorting,
      columnFilters,
    },
  })

  if (isLoading) {
    return <DataTableSkeleton columns={columns.length} />
  }

  const renderTable = (className?: string) => (
    <div className={cn("rounded-lg border border-border", className)}>
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const canSort = header.column.getCanSort()
                const sorted = header.column.getIsSorted()

                return (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : canSort ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-left text-sm"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {sorted === "asc" ? (
                          <ArrowUpIcon className="h-3.5 w-3.5" />
                        ) : sorted === "desc" ? (
                          <ArrowDownIcon className="h-3.5 w-3.5" />
                        ) : (
                          <ArrowUpDownIcon className="h-3.5 w-3.5" />
                        )}
                      </button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </TableHead>
                )
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                className={cn(
                  "transition-colors duration-100",
                  onRowClick ? "cursor-pointer hover:bg-muted/50" : undefined
                )}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-40 text-center">
                {emptyState ?? <EmptyState title="Aucun resultat" message="Affinez votre recherche pour continuer." />}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )

  return (
    <div className="space-y-4">
      {(searchKey || toolbarActions) ? (
        <DataTableToolbar
          table={table}
          searchKey={searchKey}
          searchPlaceholder={searchPlaceholder}
          actions={toolbarActions}
        />
      ) : null}

      {mobileCard ? (
        <>
          <ul className="space-y-3 md:hidden">
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <li key={row.id}>{mobileCard(row.original)}</li>
              ))
            ) : (
              <li>{emptyState ?? <EmptyState title="Aucun resultat" message="Affinez votre recherche pour continuer." />}</li>
            )}
          </ul>
          {renderTable("hidden md:block")}
        </>
      ) : (
        renderTable("overflow-x-auto")
      )}

      <DataTablePagination table={table} pageSize={pageSize} />
    </div>
  )
}
