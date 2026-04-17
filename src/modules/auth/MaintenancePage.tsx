import { useMemo } from "react"
import { useSearchParams } from "react-router-dom"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function MaintenancePage() {
  const [searchParams] = useSearchParams()
  const message = useMemo(() => searchParams.get("message") ?? "Mise à jour en cours", [searchParams])

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Maintenance en cours</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{message}</p>
        </CardContent>
      </Card>
    </div>
  )
}
