import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useSearchParams } from "react-router-dom"

import { fetchWeeklySchedule } from "@/modules/schedule/schedule.api"
import { fetchTeacherOptions } from "@/modules/teachers/teachers.api"
import {
  getStudentAbsenceStats,
  type StudentAbsenceStat,
  type StudentAbsenceStatsQuery,
} from "@/modules/students/students.api"

const toISODate = (date: Date) => date.toISOString().slice(0, 10)

const getCurrentMonthRange = () => {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return { from: toISODate(start), to: toISODate(end) }
}

export type StudentAbsenceSmsFilter = "all" | "sent" | "not_sent" | "failed"

export type StudentAbsenceFormValues = {
  from: string
  to: string
  class_id: string
  subject: string
  sms_status: StudentAbsenceSmsFilter
  min_absences: number
}

const parseMinAbsences = (value: string | null): number => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1
  }
  return Math.trunc(parsed)
}

const isSmsFilter = (value: string): value is StudentAbsenceSmsFilter =>
  value === "all" || value === "sent" || value === "not_sent" || value === "failed"

const toFormFromSearch = (searchParams: URLSearchParams): StudentAbsenceFormValues => {
  const range = getCurrentMonthRange()
  const rawSms = searchParams.get("sms_status") || "all"

  return {
    from: searchParams.get("from") || range.from,
    to: searchParams.get("to") || range.to,
    class_id: searchParams.get("class_id") || "all",
    subject: searchParams.get("subject") || "",
    sms_status: isSmsFilter(rawSms) ? rawSms : "all",
    min_absences: parseMinAbsences(searchParams.get("min_absences")),
  }
}

export const useStudentAbsences = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const [formValues, setFormValues] = useState<StudentAbsenceFormValues>(() =>
    toFormFromSearch(searchParams)
  )

  const classesQuery = useQuery({
    queryKey: ["students", "absence", "classes"],
    queryFn: async () => {
      const schedule = await fetchWeeklySchedule()
      const unique = new Map<string, string>()
      for (const item of schedule.catalog.classes) {
        unique.set(item.id, item.name)
      }
      return Array.from(unique.entries()).map(([id, name]) => ({ id, name }))
    },
  })

  const queryEnabled = searchParams.get("run") === "1"

  const teachersQuery = useQuery({
    queryKey: ["students", "absence", "teachers"],
    queryFn: fetchTeacherOptions,
    staleTime: 1000 * 60 * 5,
  })

  const subjectsOptions = useMemo(() => {
    const set = new Set<string>()
    for (const teacher of teachersQuery.data ?? []) {
      for (const subject of teacher.subjects) {
        const clean = subject.trim()
        if (clean.length > 0) {
          set.add(clean)
        }
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "fr"))
  }, [teachersQuery.data])

  const filters = useMemo<StudentAbsenceStatsQuery>(() => {
    const parsed = toFormFromSearch(searchParams)
    return {
      from: parsed.from,
      to: parsed.to,
      classId: parsed.class_id === "all" ? undefined : parsed.class_id,
      subject: parsed.subject.trim() || undefined,
      smsStatus: parsed.sms_status === "all" ? undefined : parsed.sms_status,
      minAbsences: parsed.min_absences,
    }
  }, [searchParams])

  useEffect(() => {
    setFormValues(toFormFromSearch(searchParams))
  }, [searchParams])

  const statsQuery = useQuery<StudentAbsenceStat[]>({
    queryKey: ["students", "absence", "stats", filters],
    queryFn: () => getStudentAbsenceStats(filters),
    enabled: queryEnabled,
  })

  const handleApply = () => {
    const next = new URLSearchParams(searchParams)
    next.set("tab", "absences")
    next.set("run", "1")
    next.set("from", formValues.from)
    next.set("to", formValues.to)
    next.set("min_absences", String(Math.max(1, formValues.min_absences || 1)))

    if (formValues.class_id === "all") next.delete("class_id")
    else next.set("class_id", formValues.class_id)

    if (formValues.subject.trim().length === 0) next.delete("subject")
    else next.set("subject", formValues.subject.trim())

    if (formValues.sms_status === "all") next.delete("sms_status")
    else next.set("sms_status", formValues.sms_status)

    setSearchParams(next, { replace: true })
  }

  const handleReset = () => {
    const nextRange = getCurrentMonthRange()
    const next = new URLSearchParams(searchParams)
    next.set("tab", "absences")
    next.delete("run")
    next.set("from", nextRange.from)
    next.set("to", nextRange.to)
    next.set("min_absences", "1")
    next.delete("class_id")
    next.delete("subject")
    next.delete("sms_status")
    setSearchParams(next, { replace: true })
  }

  return {
    queryEnabled,
    formValues,
    setFormValues,
    filters,
    classesQuery,
    subjectsOptions,
    statsQuery,
    handleApply,
    handleReset,
  }
}
