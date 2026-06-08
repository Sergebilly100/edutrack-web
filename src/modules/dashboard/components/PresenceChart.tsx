import { useMemo } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { DashboardHistoryPoint } from "@/modules/dashboard/dashboard.api"

type PresenceChartProps = {
  data: DashboardHistoryPoint[]
}

const formatDate = (value: string) => {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }
  return parsed.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })
}

const formatDateLong = (value: string) => {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  })
}

const rateColor = (rate: number) => {
  if (rate >= 80) return "hsl(142, 71%, 45%)"
  if (rate >= 60) return "hsl(38, 92%, 50%)"
  return "hsl(0, 84%, 60%)"
}

type CustomTooltipProps = {
  active?: boolean
  payload?: Array<{ payload: DashboardHistoryPoint }>
  label?: string
}

function PresenceTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.[0]) return null
  const point = payload[0].payload
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2 shadow-lg text-xs space-y-1.5 min-w-[160px]">
      <p className="font-semibold text-foreground capitalize">{formatDateLong(point.date)}</p>
      <div className="flex items-center justify-between gap-4">
        <span className="text-green-700">Présents</span>
        <span className="font-semibold text-green-700">{point.presentCount}</span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-red-600">Absents</span>
        <span className="font-semibold text-red-600">{point.absentCount}</span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-muted-foreground">Total créneaux</span>
        <span className="font-semibold">{point.totalCount}</span>
      </div>
      <div className="border-t border-border pt-1 flex items-center justify-between gap-4">
        <span className="text-muted-foreground">Taux présence</span>
        <span className="font-bold" style={{ color: rateColor(point.attendanceRate) }}>
          {Math.round(point.attendanceRate)}%
        </span>
      </div>
    </div>
  )
}

export default function PresenceChart({ data }: PresenceChartProps) {
  const stats = useMemo(() => {
    if (data.length === 0) return null
    const totalDays = data.filter((d) => d.totalCount > 0).length
    const avgRate =
      totalDays > 0
        ? data.reduce((acc, d) => acc + d.attendanceRate, 0) / data.length
        : 0
    const bestDay = [...data].sort((a, b) => b.attendanceRate - a.attendanceRate)[0]
    const worstDay = [...data].filter((d) => d.totalCount > 0).sort((a, b) => a.attendanceRate - b.attendanceRate)[0]
    const totalAbsences = data.reduce((acc, d) => acc + d.absentCount, 0)
    return { avgRate, bestDay, worstDay, totalAbsences, totalDays }
  }, [data])

  return (
    <Card className="shadow-sm" data-tour="presence-chart">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-lg font-semibold">Évolution des présences — 7 jours</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Taux de présence quotidien des professeurs (cours pointés / cours planifiés)
            </p>
          </div>
          {stats ? (
            <div className="flex flex-wrap gap-2 sm:justify-end">
              <Badge
                variant="outline"
                className={
                  stats.avgRate >= 80
                    ? "border-green-200 bg-green-50 text-green-700"
                    : stats.avgRate >= 60
                      ? "border-amber-200 bg-amber-50 text-amber-800"
                      : "border-red-200 bg-red-50 text-red-700"
                }
              >
                Moy. {Math.round(stats.avgRate)}%
              </Badge>
              <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">
                {stats.totalAbsences} absence{stats.totalAbsences > 1 ? "s" : ""}
              </Badge>
              <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
                {stats.totalDays} jour{stats.totalDays > 1 ? "s" : ""} de cours
              </Badge>
            </div>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune donnée disponible pour les 7 derniers jours.</p>
        ) : (
          <>
            <div className="h-64 w-full min-h-[256px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} layout="vertical" margin={{ top: 4, right: 32, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    tickFormatter={(value) => `${value}%`}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis
                    type="category"
                    dataKey="date"
                    tickFormatter={formatDate}
                    width={48}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip content={<PresenceTooltip />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }} />
                  <Bar dataKey="attendanceRate" radius={[0, 6, 6, 0]} maxBarSize={28}>
                    {data.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={rateColor(entry.attendanceRate)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            {stats?.bestDay || stats?.worstDay ? (
              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 border-t border-border pt-4">
                {stats.bestDay && stats.bestDay.totalCount > 0 ? (
                  <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2">
                    <p className="text-[11px] font-medium uppercase text-green-700">Meilleure journée</p>
                    <p className="mt-0.5 text-sm font-semibold text-green-900">
                      {formatDateLong(stats.bestDay.date)}
                    </p>
                    <p className="text-xs text-green-700">
                      {Math.round(stats.bestDay.attendanceRate)}% • {stats.bestDay.presentCount}/{stats.bestDay.totalCount} présents
                    </p>
                  </div>
                ) : null}
                {stats.worstDay && stats.worstDay.totalCount > 0 ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                    <p className="text-[11px] font-medium uppercase text-red-700">Journée la plus faible</p>
                    <p className="mt-0.5 text-sm font-semibold text-red-900">
                      {formatDateLong(stats.worstDay.date)}
                    </p>
                    <p className="text-xs text-red-700">
                      {Math.round(stats.worstDay.attendanceRate)}% • {stats.worstDay.absentCount} absent{stats.worstDay.absentCount > 1 ? "s" : ""}
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-green-500" />
                ≥ 80% (bon)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-amber-500" />
                60–79% (attention)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-500" />
                &lt; 60% (critique)
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
