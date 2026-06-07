import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type AttendanceSummaryCardProps = {
  label: string
  value: number
  tone: "present" | "absent" | "unmarked"
}

const toneStyles: Record<AttendanceSummaryCardProps["tone"], string> = {
  present: "border-green-200 bg-green-50 text-green-700",
  absent: "border-red-200 bg-red-50 text-red-700",
  unmarked: "border-amber-200 bg-amber-50 text-amber-900",
}

export default function AttendanceSummaryCard({ label, value, tone }: AttendanceSummaryCardProps) {
  return (
    <Card className={cn("shadow-sm", toneStyles[tone])}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-4xl font-semibold leading-none">{value}</p>
      </CardContent>
    </Card>
  )
}
