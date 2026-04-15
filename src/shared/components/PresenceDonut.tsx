import { Cell, Pie, PieChart, Tooltip } from "recharts"

type PresenceDonutProps = {
  present: number
  absent: number
  late: number
  size?: "sm" | "md"
}

const CHART_COLORS = {
  present: "#16a34a",
  absent: "#dc2626",
  late: "#d97706",
}

const CHART_CONFIG: Record<NonNullable<keyof typeof CHART_COLORS>, string> = {
  present: "Présents",
  absent: "Absents",
  late: "Retards",
}

const sizeMap: Record<NonNullable<PresenceDonutProps["size"]>, { chart: number; inner: number; outer: number }> = {
  sm: { chart: 160, inner: 48, outer: 68 },
  md: { chart: 208, inner: 62, outer: 84 },
}

export function PresenceDonut({ present, absent, late, size = "md" }: PresenceDonutProps) {
  const config = sizeMap[size]
  const total = Math.max(0, present) + Math.max(0, absent) + Math.max(0, late)
  const presenceRate = total > 0 ? Math.round((Math.max(0, present) / total) * 100) : 0

  const data = [
    { key: "present", name: CHART_CONFIG.present, value: Math.max(0, present), color: CHART_COLORS.present },
    { key: "absent", name: CHART_CONFIG.absent, value: Math.max(0, absent), color: CHART_COLORS.absent },
    { key: "late", name: CHART_CONFIG.late, value: Math.max(0, late), color: CHART_COLORS.late },
  ].filter((item) => item.value > 0)

  return (
    <div className="relative inline-flex items-center justify-center">
      <PieChart width={config.chart} height={config.chart}>
        <Pie
          data={data.length > 0 ? data : [{ key: "empty", name: "Aucune donnée", value: 1, color: "#cbd5e1" }]}
          dataKey="value"
          nameKey="name"
          innerRadius={config.inner}
          outerRadius={config.outer}
          strokeWidth={2}
          stroke="hsl(var(--background))"
          paddingAngle={2}
        >
          {(data.length > 0 ? data : [{ key: "empty", name: "Aucune donnée", value: 1, color: "#cbd5e1" }]).map(
            (entry) => (
              <Cell key={entry.key} fill={entry.color} />
            )
          )}
        </Pie>
        <Tooltip
          formatter={(value) => [`${value ?? 0}`, "Nombre"]}
          contentStyle={{ borderRadius: 8, borderColor: "hsl(var(--border))" }}
        />
      </PieChart>

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-semibold tabular-nums">{presenceRate}%</span>
        <span className="text-xs text-muted-foreground">Présence</span>
      </div>
    </div>
  )
}
