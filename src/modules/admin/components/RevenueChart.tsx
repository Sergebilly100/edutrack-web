import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export type RevenuePoint = {
  month: string
  mrr_fcfa: number
}

type RevenueChartProps = {
  data: RevenuePoint[]
}

const formatFcfa = (value: number) => `${new Intl.NumberFormat("fr-FR").format(value)} FCFA`

const formatCompactFcfa = (value: number) => {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`
  }

  if (value >= 1000) {
    return `${Math.round(value / 1000)}K`
  }

  return `${value}`
}

const formatMonthShort = (value: string) => {
  const parsed = value.includes("-") ? new Date(`${value}-01T00:00:00Z`) : new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return parsed.toLocaleDateString("fr-FR", { month: "short" })
}

function RevenueTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload || payload.length === 0) {
    return null
  }

  const point = payload[0]
  const numericValue = Number(point?.value)
  return (
    <div className="rounded-md border border-border bg-background px-3 py-2 shadow-md">
      <p className="text-xs text-muted-foreground">{formatMonthShort(String(label))}</p>
      <p className="text-sm font-medium">{formatFcfa(Number.isFinite(numericValue) ? numericValue : 0)}</p>
    </div>
  )
}

export default function RevenueChart({ data }: RevenueChartProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold">MRR sur 12 mois</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.15} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
            <XAxis
              dataKey="month"
              tickFormatter={formatMonthShort}
              tickLine={false}
              axisLine={false}
              className="text-xs"
            />
            <YAxis
              tickFormatter={formatCompactFcfa}
              tickLine={false}
              axisLine={false}
              width={48}
              className="text-xs"
            />
            <Tooltip content={RevenueTooltip} />
            <Area
              type="monotone"
              dataKey="mrr_fcfa"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              fill="url(#revenueFill)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
