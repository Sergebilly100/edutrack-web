import axios from "axios"
import type { TeacherSchedule } from "@/modules/attendance/TeacherFlow"

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL, withCredentials: true })

export const fetchTeacherSchedule = () =>
  api.get<TeacherSchedule[] | { schedules?: TeacherSchedule[] }>("/schedule/teacher/me").then((r) => {
    const data = r.data
    return Array.isArray(data) ? data : (data.schedules ?? [])
  })
