import { useEffect, useState } from "react"
import { Navigate } from "react-router-dom"
import { useMutation, useQuery } from "@tanstack/react-query"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { clearAdminCache, getMaintenanceConfig, updateMaintenanceConfig } from "@/modules/admin/admin.api"
import { useAuthStore } from "@/shared/store/auth.store"

export default function AdminMaintenancePage() {
  const user = useAuthStore((state) => state.user)
  const { toast } = useToast()

  const maintenanceQuery = useQuery({ queryKey: ["admin", "maintenance"], queryFn: getMaintenanceConfig })
  const [maintenanceMode, setMaintenanceMode] = useState(false)
  const [maintenanceMessage, setMaintenanceMessage] = useState("Mise à jour en cours")

  useEffect(() => {
    if (!maintenanceQuery.data) return
    setMaintenanceMode(maintenanceQuery.data.maintenanceMode)
    setMaintenanceMessage(maintenanceQuery.data.maintenanceMessage)
  }, [maintenanceQuery.data])

  const saveMutation = useMutation({
    mutationFn: () => updateMaintenanceConfig({ maintenance_mode: maintenanceMode, maintenance_message: maintenanceMessage }),
    onSuccess: () => toast({ title: "Mode maintenance mis à jour" }),
    onError: () => toast({ title: "Erreur", description: "Impossible de mettre à jour la maintenance", variant: "destructive" }),
  })

  const clearCacheMutation = useMutation({
    mutationFn: clearAdminCache,
    onSuccess: () => toast({ title: "Cache vidé" }),
    onError: () => toast({ title: "Erreur", description: "Impossible de vider le cache", variant: "destructive" }),
  })

  if (!user) {
    return <Navigate to="/" replace />
  }

  if (user.role !== "super_admin") {
    return (
      <Alert variant="destructive">
        <AlertDescription>Cette page est réservée au super admin.</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6 px-4 py-6 md:px-6 md:py-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Maintenance</h1>
        <p className="text-sm text-muted-foreground">Gestion du mode maintenance et opérations système.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Mode maintenance</CardTitle>
          <CardDescription>Les routes API non admin retourneront 503 tant que ce mode est actif.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Button type="button" variant={maintenanceMode ? "default" : "outline"} onClick={() => setMaintenanceMode(true)}>
              Actif
            </Button>
            <Button type="button" variant={!maintenanceMode ? "default" : "outline"} onClick={() => setMaintenanceMode(false)}>
              Inactif
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="maintenance-message">Message maintenance</Label>
            <Input
              id="maintenance-message"
              value={maintenanceMessage}
              onChange={(event) => setMaintenanceMessage(event.target.value)}
              placeholder="Mise à jour en cours, retour prévu à 14h00"
            />
          </div>

          <Button type="button" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            Sauvegarder et appliquer
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cache</CardTitle>
          <CardDescription>Nettoyage des caches Redis/jobs non critiques.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" variant="outline" onClick={() => clearCacheMutation.mutate()} disabled={clearCacheMutation.isPending}>
            Vider le cache Redis
          </Button>
        </CardContent>
      </Card>

      {maintenanceQuery.isError ? (
        <Alert variant="destructive">
          <AlertDescription>Impossible de charger les paramètres maintenance.</AlertDescription>
        </Alert>
      ) : null}
    </div>
  )
}
