import { useEffect } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
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
  canManageSmsTemplates?: boolean
}

const SMS_TEMPLATE_PERMISSION = "settings.sms_templates"
const ATTENDANCE_PERMISSIONS = new Set(["attendance.view", "attendance.mark_students"])

const sanitizePermissions = (permissions: string[], canManageSmsTemplates: boolean): string[] => {
  const withoutAttendance = permissions.filter((permission) => !ATTENDANCE_PERMISSIONS.has(permission))

  if (canManageSmsTemplates) {
    return withoutAttendance
  }

  return withoutAttendance.filter((permission) => permission !== SMS_TEMPLATE_PERMISSION)
}

export default function PositionFormModal({
  open,
  onOpenChange,
  initialPosition,
  canManageSmsTemplates = false,
}: PositionFormModalProps) {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const isEditMode = Boolean(initialPosition)

  const form = useForm<PositionFormValues>({
    resolver: zodResolver(positionSchema),
    defaultValues: {
      name: initialPosition?.name ?? "",
      permissions: sanitizePermissions(initialPosition?.permissions ?? [], canManageSmsTemplates),
    },
  })

  useEffect(() => {
    form.reset({
      name: initialPosition?.name ?? "",
      permissions: sanitizePermissions(initialPosition?.permissions ?? [], canManageSmsTemplates),
    })
  }, [canManageSmsTemplates, form, initialPosition, open])

  useEffect(() => {
    if (canManageSmsTemplates) {
      return
    }

    const currentPermissions = form.getValues("permissions")
    const nextPermissions = sanitizePermissions(currentPermissions, false)
    if (nextPermissions.length !== currentPermissions.length) {
      form.setValue("permissions", nextPermissions, {
        shouldDirty: true,
        shouldValidate: true,
      })
    }
  }, [canManageSmsTemplates, form])

  const mutation = useMutation({
    mutationFn: async (values: PositionFormValues) => {
      if (isEditMode && initialPosition) {
        return updatePosition({
          id: initialPosition.id,
          name: values.name,
          permissions: sanitizePermissions(values.permissions, canManageSmsTemplates),
        })
      }

      return createPosition({
        name: values.name,
        permissions: sanitizePermissions(values.permissions, canManageSmsTemplates),
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["settings", "school-config"] })
      await queryClient.invalidateQueries({ queryKey: ["settings", "positions"] })
      onOpenChange(false)
      toast({
        title: isEditMode ? "Poste mis à jour" : "Poste créé",
      })
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible d'enregistrer le poste.",
        variant: "destructive",
      })
    },
  })

  const permissions = useWatch({
    control: form.control,
    name: "permissions",
    defaultValue: [],
  })

  const handleSubmit = (values: PositionFormValues) => mutation.mutate(values)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-[95vw] max-w-5xl flex-col gap-0 p-0">
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
          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex max-h-[78vh] flex-col">
            <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
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
                canManageSmsTemplates={canManageSmsTemplates}
                onChange={(permissions) => {
                  form.setValue("permissions", permissions, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }}
              />
            </div>

            <DialogFooter className="shrink-0 border-t bg-muted/30 px-6 py-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={mutation.isPending} className="min-w-[120px]">
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
