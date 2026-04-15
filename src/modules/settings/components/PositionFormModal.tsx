import { useEffect } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
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
import { apiClient } from "@/shared/api/client"

const positionSchema = z.object({
  name: z.string().trim().min(2, "Le nom du poste doit contenir au moins 2 caractères"),
  permissions: z.array(z.string()),
})

type PositionFormValues = z.infer<typeof positionSchema>

export type PositionPayload = {
  id: string
  name: string
  permissions: string[]
}

type PositionFormModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialPosition?: PositionPayload | null
}

const createPosition = (payload: PositionFormValues) =>
  apiClient.post("/permissions/positions", payload).then((response) => response.data)

const updatePosition = (payload: PositionPayload) =>
  apiClient.put("/permissions/positions", payload).then((response) => response.data)

export default function PositionFormModal({
  open,
  onOpenChange,
  initialPosition,
}: PositionFormModalProps) {
  const queryClient = useQueryClient()
  const { toast } = useToast()

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
        return updatePosition({
          id: initialPosition.id,
          name: values.name,
          permissions: values.permissions,
        })
      }

      return createPosition(values)
    },
    onSuccess: async () => {
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
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Modifier un poste" : "Nouveau poste"}</DialogTitle>
          <DialogDescription>
            Définissez le poste et ses permissions opérationnelles.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form className="space-y-4" onSubmit={form.handleSubmit(handleSubmit)}>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom du poste</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Censeur" {...field} />
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

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Sauvegarde..." : "Sauvegarder"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
