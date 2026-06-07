import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

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

  return parsed.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
  })
}

export default function PresenceChart({ data }: PresenceChartProps) {
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Présence sur 7 jours</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune donnée disponible.</p>
        ) : (
          <div className="h-72 w-full min-h-[288px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                <YAxis
                  type="category"
                  dataKey="date"
                  tickFormatter={formatDate}
                  width={56}
                />
                <Tooltip
                  formatter={(value) => {
                    const numericValue =
                      typeof value === "number"
                        ? value
                        : Number(typeof value === "string" ? value : 0)
                    return [`${Math.round(numericValue)}%`, "Taux"]
                  }}
                  labelFormatter={(label) =>
                    typeof label === "string" ? formatDate(label) : String(label ?? "")
                  }
                />
                <Bar dataKey="attendanceRate" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
