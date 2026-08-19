import { useEffect, useId, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Check, Search, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { listStudents, type StudentItem } from "@/modules/students/students.api"

type StudentSearchProps = {
  value: StudentItem | null
  onChange: (student: StudentItem | null) => void
  inputRef?: React.Ref<HTMLInputElement>
  disabled?: boolean
  placeholder?: string
  compact?: boolean
}

const studentLabel = (student: StudentItem): string =>
  `${student.lastName} ${student.firstName}${student.matricule ? ` · ${student.matricule}` : ""}`

export function StudentSearch({
  value,
  onChange,
  inputRef,
  disabled,
  placeholder = "Nom ou matricule",
  compact = false,
}: StudentSearchProps) {
  const listId = useId()
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState(value ? studentLabel(value) : "")
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const normalizedQuery = query.trim()
  const searchQuery = useQuery({
    queryKey: ["finance", "student-search", normalizedQuery],
    queryFn: () => listStudents({ search: normalizedQuery, limit: 8, isActive: true }),
    enabled: open && normalizedQuery.length >= 2 && !value,
    staleTime: 30_000,
  })
  const students = searchQuery.data?.data ?? []

  useEffect(() => {
    if (value) setQuery(studentLabel(value))
  }, [value])

  const choose = (student: StudentItem) => {
    onChange(student)
    setQuery(studentLabel(student))
    setOpen(false)
    setActiveIndex(0)
  }

  return (
    <div
      ref={wrapperRef}
      className="relative"
      onBlur={(event) => {
        if (!wrapperRef.current?.contains(event.relatedTarget as Node | null)) setOpen(false)
      }}
    >
      <Search className={cn("pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-muted-foreground", compact ? "h-3.5 w-3.5" : "h-4 w-4")} />
      <Input
        ref={inputRef}
        role="combobox"
        aria-label={placeholder}
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded={open}
        aria-activedescendant={open && students[activeIndex] ? `${listId}-${students[activeIndex].id}` : undefined}
        className={cn("pr-10", compact ? "h-10 pl-8 text-sm" : "min-h-12 pl-9")}
        value={query}
        disabled={disabled}
        placeholder={placeholder}
        onFocus={() => setOpen(!value && normalizedQuery.length >= 2)}
        onChange={(event) => {
          setQuery(event.target.value)
          if (value) onChange(null)
          setOpen(event.target.value.trim().length >= 2)
          setActiveIndex(0)
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" && students.length > 0) {
            event.preventDefault()
            setOpen(true)
            setActiveIndex((current) => Math.min(current + 1, students.length - 1))
          } else if (event.key === "ArrowUp" && students.length > 0) {
            event.preventDefault()
            setActiveIndex((current) => Math.max(current - 1, 0))
          } else if (event.key === "Enter" && open && students[activeIndex]) {
            event.preventDefault()
            choose(students[activeIndex])
          } else if (event.key === "Escape") {
            setOpen(false)
          }
        }}
      />
      {value ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn("absolute right-0 top-1/2 -translate-y-1/2", compact ? "h-10 w-10" : "h-12 w-12")}
          aria-label="Effacer l’élève sélectionné"
          onClick={() => {
            onChange(null)
            setQuery("")
          }}
        >
          <X className="h-4 w-4" />
        </Button>
      ) : null}
      {open ? (
        <div
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border bg-popover p-1 text-popover-foreground shadow-md"
        >
          {searchQuery.isFetching ? <p className="px-3 py-2 text-sm text-muted-foreground">Recherche…</p> : null}
          {!searchQuery.isFetching && normalizedQuery.length >= 2 && students.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">Aucun élève trouvé.</p>
          ) : null}
          {students.map((student, index) => (
            <button
              key={student.id}
              id={`${listId}-${student.id}`}
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              className={cn(
                "flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                index === activeIndex ? "bg-accent text-accent-foreground" : "hover:bg-accent/70",
              )}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => choose(student)}
            >
              <Check className={cn("h-4 w-4 shrink-0", index === activeIndex ? "opacity-100" : "opacity-0")} />
              <span className="min-w-0">
                <span className="block truncate font-medium">{student.lastName} {student.firstName}</span>
                <span className="block truncate text-xs text-muted-foreground">{student.className}{student.matricule ? ` · ${student.matricule}` : ""}</span>
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
