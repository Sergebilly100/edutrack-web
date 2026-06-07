import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
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
  collected_fcfa?: number
}

type RevenueChartProps = {
  data: RevenuePoint[]
}

const formatFcfa = (v: number) => `${new Intl.NumberFormat("fr-FR").format(v)} FCFA`

const formatCompact = (v: number) => {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `${Math.round(v / 1_000)}K`
  return String(v)
}

const formatMonthShort = (v: string) => {
  const d = v.includes("-") ? new Date(`${v}-01T00:00:00Z`) : new Date(v)
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" })
}

function RevenueTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="rounded-md border border-border bg-background px-3 py-2 shadow-md space-y-1 text-sm">
      <p className="text-xs text-muted-foreground font-medium">{formatMonthShort(String(label))}</p>
      {payload.map((p) => (
        <p key={p.dataKey as string} style={{ color: p.color as string }}>
          {p.dataKey === "collected_fcfa" ? "Encaissé" : "MRR cible"} :{" "}
          <strong>{formatFcfa(Number(p.value ?? 0))}</strong>
        </p>
      ))}
    </div>
  )
}

export default function RevenueChart({ data }: RevenueChartProps) {
  const hasCollected = data.some((d) => (d.collected_fcfa ?? 0) > 0)

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">
          Encaissements réels vs MRR cible — 12 mois
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="fillMrr" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.08} />
                <stop offset="95%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.01} />
              </linearGradient>
              <linearGradient id="fillCollected" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.18} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
            <XAxis dataKey="month" tickFormatter={formatMonthShort} tickLine={false} axisLine={false} className="text-xs" />
            <YAxis tickFormatter={formatCompact} tickLine={false} axisLine={false} width={52} className="text-xs" />
            <Tooltip content={RevenueTooltip} />
            {hasCollected && <Legend formatter={(v) => v === "collected_fcfa" ? "Encaissé réel" : "MRR cible"} />}
            <Area
              type="monotone"
              dataKey="mrr_fcfa"
              name="mrr_fcfa"
              stroke="hsl(var(--muted-foreground))"
              strokeWidth={1.5}
              strokeDasharray="4 2"
              fill="url(#fillMrr)"
            />
            {hasCollected && (
              <Area
                type="monotone"
                dataKey="collected_fcfa"
                name="collected_fcfa"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#fillCollected)"
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
