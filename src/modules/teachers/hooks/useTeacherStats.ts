import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useSearchParams } from "react-router-dom"

import { fetchWeeklySchedule } from "@/modules/schedule/schedule.api"
import {
  fetchClasses,
  fetchTeacherAttendanceStats,
  fetchTeacherOptions,
  type TeacherAttendanceStats,
} from "@/modules/teachers/teachers.api"

const THIRTY_DAYS_MS = 1000 * 60 * 60 * 24 * 30

const toISODate = (date: Date) => date.toISOString().slice(0, 10)

const getDefaultRange = () => {
  const to = new Date()
  const from = new Date(to.getTime() - THIRTY_DAYS_MS)
  return { from: toISODate(from), to: toISODate(to) }
}

const getCurrentMonthRange = () => {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return { from: toISODate(start), to: toISODate(end) }
}

export type TeacherStatsStatusFilter = "all" | "absent" | "room_mismatch" | "rollcall_missing" | "late"

export type TeacherStatsFormValues = {
  from: string
  to: string
  subject: string
  class_id: string
  teacher_id: string
  status_filter: TeacherStatsStatusFilter
}

type TeacherStatsApiFilters = {
  from: string
  to: string
  subject?: string
  class_id?: string
  teacher_id?: string
  status_filter?: "absent" | "room_mismatch" | "rollcall_missing" | "late"
}

const isStatusFilter = (value: string): value is TeacherStatsStatusFilter =>
  value === "all" ||
  value === "absent" ||
  value === "room_mismatch" ||
  value === "rollcall_missing" ||
  value === "late"

const toFormFromSearch = (searchParams: URLSearchParams): TeacherStatsFormValues => {
  const currentMonthRange = getCurrentMonthRange()
  const from = searchParams.get("from") || currentMonthRange.from
  const to = searchParams.get("to") || currentMonthRange.to
  const rawStatus = searchParams.get("status_filter") || "all"

  return {
    from,
    to,
    subject: searchParams.get("subject") || "all",
    class_id: searchParams.get("class_id") || "all",
    teacher_id: searchParams.get("teacher_id") || "all",
    status_filter: isStatusFilter(rawStatus) ? rawStatus : "all",
  }
}

export const useTeacherStats = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const [formValues, setFormValues] = useState<TeacherStatsFormValues>(() =>
    toFormFromSearch(searchParams)
  )
  const [lastAutofilledTeacherId, setLastAutofilledTeacherId] = useState<string | null>(null)

  const classesQuery = useQuery({
    queryKey: ["classes", "teacher-analysis"],
    queryFn: fetchClasses,
  })

  const teachersQuery = useQuery({
    queryKey: ["teachers", "analysis-filters"],
    queryFn: fetchTeacherOptions,
    staleTime: 1000 * 60 * 5,
  })
  const weeklyScheduleQuery = useQuery({
    queryKey: ["schedule", "weekly", "teacher-analysis"],
    queryFn: fetchWeeklySchedule,
    staleTime: 1000 * 60 * 5,
  })

  const selectedTeacher = useMemo(
    () =>
      (teachersQuery.data ?? []).find((teacher) => teacher.id === formValues.teacher_id) ?? null,
    [formValues.teacher_id, teachersQuery.data]
  )

  const teacherSubjectOptions = useMemo(() => {
    if (!selectedTeacher) return [] as string[]
    return selectedTeacher.subjects
      .map((subject) => subject.trim())
      .filter((subject) => subject.length > 0)
      .sort((a, b) => a.localeCompare(b, "fr"))
  }, [selectedTeacher])

  const teacherClassIds = useMemo(() => {
    if (!selectedTeacher) return new Set<string>()
    const ids = new Set<string>()
    for (const row of weeklyScheduleQuery.data?.schedules ?? []) {
      if (row.teacher.id === selectedTeacher.id) {
        ids.add(row.class.id)
      }
    }
    return ids
  }, [selectedTeacher, weeklyScheduleQuery.data?.schedules])

  const classOptions = useMemo(() => {
    const allClasses = classesQuery.data ?? []
    if (!selectedTeacher) return allClasses
    return allClasses.filter((item) => teacherClassIds.has(item.id))
  }, [classesQuery.data, selectedTeacher, teacherClassIds])

  const subjectsOptions = useMemo(() => {
    if (selectedTeacher) {
      return teacherSubjectOptions
    }
    const set = new Set<string>()
    for (const teacher of teachersQuery.data ?? []) {
      for (const subject of teacher.subjects) {
        const clean = subject.trim()
        if (clean.length > 0) set.add(clean)
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "fr"))
  }, [selectedTeacher, teacherSubjectOptions, teachersQuery.data])

  const queryEnabled = searchParams.get("run") === "1"

  const filters = useMemo<TeacherStatsApiFilters>(() => {
    const parsedForm = toFormFromSearch(searchParams)
    return {
      from: parsedForm.from,
      to: parsedForm.to,
      subject: parsedForm.subject === "all" ? undefined : parsedForm.subject,
      class_id: parsedForm.class_id === "all" ? undefined : parsedForm.class_id,
      teacher_id: parsedForm.teacher_id === "all" ? undefined : parsedForm.teacher_id,
      status_filter:
        parsedForm.status_filter === "all" ? undefined : parsedForm.status_filter,
    }
  }, [searchParams])

  useEffect(() => {
    setFormValues(toFormFromSearch(searchParams))
  }, [searchParams])

  useEffect(() => {
    if (!selectedTeacher) {
      setLastAutofilledTeacherId(null)
      return
    }
    const nextClassId = classOptions[0]?.id ?? "all"
    if (weeklyScheduleQuery.isLoading && nextClassId === "all") {
      return
    }
    if (lastAutofilledTeacherId === selectedTeacher.id) {
      return
    }

    setFormValues((current) => {
      const nextSubject = teacherSubjectOptions[0] ?? "all"
      return {
        ...current,
        subject: nextSubject,
        class_id: nextClassId,
      }
    })
    setLastAutofilledTeacherId(selectedTeacher.id)
  }, [
    classOptions,
    lastAutofilledTeacherId,
    selectedTeacher,
    teacherSubjectOptions,
    weeklyScheduleQuery.isLoading,
  ])

  const statsQuery = useQuery<TeacherAttendanceStats[]>({
    queryKey: ["teacher-stats", filters],
    queryFn: () => fetchTeacherAttendanceStats(filters),
    enabled: queryEnabled,
  })

  const handleApply = () => {
    const next = new URLSearchParams(searchParams)
    next.set("tab", "analyse")
    next.set("run", "1")
    next.set("from", formValues.from)
    next.set("to", formValues.to)

    if (formValues.subject === "all") next.delete("subject")
    else next.set("subject", formValues.subject)

    if (formValues.class_id === "all") next.delete("class_id")
    else next.set("class_id", formValues.class_id)

    if (formValues.teacher_id === "all") next.delete("teacher_id")
    else next.set("teacher_id", formValues.teacher_id)

    if (formValues.status_filter === "all") next.delete("status_filter")
    else next.set("status_filter", formValues.status_filter)

    setSearchParams(next, { replace: true })
  }

  const handleReset = () => {
    const nextRange = getCurrentMonthRange()
    const next = new URLSearchParams(searchParams)
    next.set("tab", "analyse")
    next.delete("run")
    next.set("from", nextRange.from)
    next.set("to", nextRange.to)
    next.delete("subject")
    next.delete("class_id")
    next.delete("teacher_id")
    next.delete("status_filter")
    setSearchParams(next, { replace: true })
  }

  return {
    queryEnabled,
    formValues,
    setFormValues,
    filters,
    classesQuery,
    classOptions,
    teachersQuery,
    subjectsOptions,
    statsQuery,
    handleApply,
    handleReset,
  }
}
