import { useQuery } from "@tanstack/react-query"
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { getTenantStats } from "@/modules/admin/admin.api"

type TenantStatsModalProps = {
  tenantId: string | null
  tenantName: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function TenantStatsModal({
  tenantId,
  tenantName,
  open,
  onOpenChange,
}: TenantStatsModalProps) {
  const statsQuery = useQuery({
    queryKey: ["admin", "tenant-stats", tenantId],
    queryFn: () => getTenantStats(tenantId as string),
    enabled: open && Boolean(tenantId),
  })

  const data = statsQuery.data

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Stats tenant {tenantName ?? ""}</DialogTitle>
          <DialogDescription>DAU/WAU/MAU, SMS 30j, taux de pointage 30 jours.</DialogDescription>
        </DialogHeader>

        {statsQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Chargement des statistiques...</p>
        ) : null}

        {statsQuery.isError ? (
          <p className="text-sm text-destructive">Impossible de charger les statistiques.</p>
        ) : null}

        {data ? (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">DAU</p>
                <p className="text-xl font-semibold">{data.dau}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">WAU</p>
                <p className="text-xl font-semibold">{data.wau}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">MAU</p>
                <p className="text-xl font-semibold">{data.mau}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">SMS 30j</p>
                <p className="text-xl font-semibold">{data.smsSent30d}</p>
              </div>
            </div>

            <div className="rounded-lg border p-3">
              <p className="mb-2 text-sm font-medium">Taux pointage par jour</p>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.attendanceRateByDay}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} />
                    <Tooltip />
                    <Line type="monotone" dataKey="attendanceRate" stroke="#2563eb" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-lg border p-3">
              <p className="mb-2 text-sm font-medium">Top profs par absences (30j)</p>
              {data.topTeachersByAbsence.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune absence enregistrée.</p>
              ) : (
                <div className="space-y-2">
                  {data.topTeachersByAbsence.map((teacher) => (
                    <div key={teacher.teacherId} className="flex items-center justify-between text-sm">
                      <span>{teacher.teacherName}</span>
                      <span className="font-medium">{teacher.absenceCount}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

