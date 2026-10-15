export type TimedCourse = { start_at: string; end_at: string }

export type TeacherDayState<T extends TimedCourse> =
  | { kind: "current"; schedule: T }
  | { kind: "next"; schedule: T }
  | { kind: "finished"; count: number }
  | { kind: "free" }

export function getTeacherDayState<T extends TimedCourse>(schedules: T[], now: Date): TeacherDayState<T> {
  if (schedules.length === 0) return { kind: "free" }

  const current = schedules.find((schedule) =>
    now >= new Date(schedule.start_at) && now <= new Date(schedule.end_at)
  )
  if (current) return { kind: "current", schedule: current }

  const next = schedules
    .filter((schedule) => new Date(schedule.start_at) > now)
    .sort((left, right) => +new Date(left.start_at) - +new Date(right.start_at))[0]
  if (next) return { kind: "next", schedule: next }

  return { kind: "finished", count: schedules.length }
}
