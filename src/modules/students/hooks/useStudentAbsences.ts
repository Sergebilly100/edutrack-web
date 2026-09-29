import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useSearchParams } from "react-router-dom"

import { listClasses, listLevels, listSubjects } from "@/modules/academic/academic.api"
import { fetchTeacherOptions } from "@/modules/teachers/teachers.api"
import {
  getStudentAbsenceStats,
  type StudentAbsenceStat,
  type StudentAbsenceStatsQuery,
} from "@/modules/students/students.api"
import { usePermissions } from "@/shared/hooks/usePermissions"

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
  level_id: string
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
    level_id: searchParams.get("level_id") || "all",
    subject: searchParams.get("subject") || "",
    sms_status: isSmsFilter(rawSms) ? rawSms : "all",
    min_absences: parseMinAbsences(searchParams.get("min_absences")),
  }
}

export const useStudentAbsences = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const { hasPermission } = usePermissions()
  const [formValues, setFormValues] = useState<StudentAbsenceFormValues>(() =>
    toFormFromSearch(searchParams)
  )

  const classesQuery = useQuery({
    queryKey: ["students", "absence", "classes"],
    queryFn: () => listClasses(),
  })
  const levelsQuery = useQuery({
    queryKey: ["students", "absence", "levels"],
    queryFn: listLevels,
  })

  const queryEnabled = searchParams.get("run") === "1"

  const teachersQuery = useQuery({
    queryKey: ["students", "absence", "teachers"],
    queryFn: fetchTeacherOptions,
    enabled: hasPermission("teachers.view"),
    staleTime: 1000 * 60 * 5,
  })
  const academicSubjectsQuery = useQuery({
    queryKey: ["students", "absence", "subjects", formValues.level_id],
    queryFn: () => listSubjects(formValues.level_id),
    enabled: formValues.level_id !== "all",
  })

  const subjectsOptions = useMemo(() => {
    if (formValues.level_id !== "all") {
      return Array.from(new Set((academicSubjectsQuery.data ?? []).map((subject) => subject.name)))
        .sort((a, b) => a.localeCompare(b, "fr"))
    }
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
  }, [academicSubjectsQuery.data, formValues.level_id, teachersQuery.data])

  const filters = useMemo<StudentAbsenceStatsQuery>(() => {
    const parsed = toFormFromSearch(searchParams)
    return {
      from: parsed.from,
      to: parsed.to,
      classId: parsed.class_id === "all" ? undefined : parsed.class_id,
      levelId: parsed.level_id === "all" ? undefined : parsed.level_id,
      subject: parsed.subject.trim() || undefined,
      smsStatus: parsed.sms_status === "all" ? undefined : parsed.sms_status,
      minAbsences: parsed.min_absences,
    }
  }, [searchParams])

  useEffect(() => {
    setFormValues(toFormFromSearch(searchParams))
  }, [searchParams])

  useEffect(() => {
    const classes = classesQuery.data?.classes
    if (!classes) return
    const selected = classes.find((item) => item.id === formValues.class_id)
    if (formValues.class_id !== "all" && formValues.level_id !== "all" && (!selected || selected.level.id !== formValues.level_id)) {
      setFormValues((current) => ({ ...current, class_id: "all" }))
    }
  }, [classesQuery.data, formValues.class_id, formValues.level_id])

  useEffect(() => {
    if (formValues.level_id === "all" || !academicSubjectsQuery.isSuccess || !formValues.subject) return
    if (!subjectsOptions.includes(formValues.subject)) {
      setFormValues((current) => ({ ...current, subject: "" }))
    }
  }, [academicSubjectsQuery.isSuccess, formValues.level_id, formValues.subject, subjectsOptions])

  useEffect(() => {
    const classes = classesQuery.data?.classes
    const classId = searchParams.get("class_id")
    const levelId = searchParams.get("level_id")
    if (!classes || !classId || !levelId) return
    const selected = classes.find((item) => item.id === classId)
    if (!selected || selected.level.id !== levelId) {
      const next = new URLSearchParams(searchParams)
      next.delete("class_id")
      setSearchParams(next, { replace: true })
    }
  }, [classesQuery.data, searchParams, setSearchParams])

  useEffect(() => {
    const levelId = searchParams.get("level_id")
    const subject = searchParams.get("subject")
    if (!levelId || !subject || !academicSubjectsQuery.isSuccess || formValues.level_id !== levelId) return
    if (!subjectsOptions.includes(subject)) {
      const next = new URLSearchParams(searchParams)
      next.delete("subject")
      setSearchParams(next, { replace: true })
    }
  }, [academicSubjectsQuery.isSuccess, formValues.level_id, searchParams, setSearchParams, subjectsOptions])

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

    if (formValues.level_id === "all") next.delete("level_id")
    else next.set("level_id", formValues.level_id)

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
    next.delete("level_id")
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
    levelsQuery,
    subjectsOptions,
    statsQuery,
    handleApply,
    handleReset,
  }
}
