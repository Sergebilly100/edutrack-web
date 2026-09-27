import { useEffect } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import axios from "axios"
import { ShieldCheck } from "lucide-react"
import { useForm, useWatch } from "react-hook-form"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/use-toast"
import RoleMatrix from "@/modules/settings/components/RoleMatrix"
import { createPosition, updatePosition } from "@/modules/settings/settings.api"
import { usePermissionCatalogue } from "@/modules/settings/permission-catalogue"

const positionSchema = z.object({
  name: z.string().trim().min(2, "Le nom du poste doit contenir au moins 2 caractères"),
  permissions: z.array(z.string()),
})

type PositionFormValues = z.infer<typeof positionSchema>

export type PositionPayload = {
  id: string
  name: string
  permissions: string[]
  assignmentsCount?: number
}

type PositionFormModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialPosition?: PositionPayload | null
}

export default function PositionFormModal({
  open,
  onOpenChange,
  initialPosition,
}: PositionFormModalProps) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const catalogueQuery = usePermissionCatalogue(open)
  const catalogueReady = catalogueQuery.isSuccess && catalogueQuery.data.permissions.length > 0

  const isEditMode = Boolean(initialPosition)

  const form = useForm<PositionFormValues>({
    resolver: zodResolver(positionSchema),
    defaultValues: {
      name: initialPosition?.name ?? "",
      permissions: initialPosition?.permissions ?? [],
    },
  })

  useEffect(() => {
    form.reset({
      name: initialPosition?.name ?? "",
      permissions: initialPosition?.permissions ?? [],
    })
  }, [form, initialPosition, open])

  const mutation = useMutation({
    mutationFn: async (values: PositionFormValues) => {
      if (isEditMode && initialPosition) {
        const original = new Set(initialPosition.permissions)
        const next = new Set(values.permissions)
        const permissionsChanged = original.size !== next.size || [...next].some((key) => !original.has(key))
        return updatePosition({
          id: initialPosition.id,
          name: values.name,
          ...(permissionsChanged ? { permissions: values.permissions } : {}),
        })
      }

      return createPosition({
        name: values.name,
        permissions: values.permissions,
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["settings", "school-config"] })
      await queryClient.invalidateQueries({ queryKey: ["settings", "positions"] })
      onOpenChange(false)
      toast({
        title: isEditMode ? "Poste mis à jour" : "Poste créé",
        duration: 3000,
      })
    },
    onError: (error) => {
      // Surface le message métier du backend (ex. exclusivité conduct.finalize).
      const detail =
        axios.isAxiosError(error)
          ? (error.response?.data as { error?: string } | undefined)?.error
          : undefined
      toast({
        title: "Erreur",
        description: detail ?? (error instanceof Error ? error.message : "Impossible d'enregistrer le poste."),
        variant: "destructive",
        duration: 6000,
      })
    },
  })

  const permissions = useWatch({
    control: form.control,
    name: "permissions",
    defaultValue: [],
  })

  const handleSubmit = (values: PositionFormValues) => {
    if (catalogueReady && !mutation.isPending) mutation.mutate(values)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-[95vw] max-w-2lg flex-col gap-0 p-0">
        <DialogHeader className="shrink-0 border-b px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <ShieldCheck className="h-4 w-4 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-base">
                {isEditMode ? "Modifier un poste" : "Nouveau poste"}
              </DialogTitle>
              <DialogDescription className="mt-0.5 text-xs">
                Définissez le poste et ses permissions opérationnelles.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex min-h-0 max-h-[78vh] flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto">
              <fieldset disabled={mutation.isPending} className="min-w-0 space-y-5 px-6 py-5">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <FormLabel>Nom du poste</FormLabel>
                        {permissions.length > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                            <ShieldCheck className="h-3 w-3" />
                            {permissions.length} permission{permissions.length !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                      <FormControl>
                        <Input
                          placeholder="Ex: Censeur, Surveillant général…"
                          className="max-w-sm"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
  
                <RoleMatrix
                  position={{ permissions }}
                  onChange={(permissions) => {
                    form.setValue("permissions", permissions, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }}
                />
              </fieldset>
            </div>

            <DialogFooter className="shrink-0 border-t bg-muted/30 px-6 py-4">
              <Button type="button" variant="outline" className="min-h-12" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={mutation.isPending || !catalogueReady} className="min-h-12 min-w-[120px]">
                {mutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                    Sauvegarde…
                  </span>
                ) : isEditMode ? (
                  "Mettre à jour"
                ) : (
                  "Créer le poste"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
