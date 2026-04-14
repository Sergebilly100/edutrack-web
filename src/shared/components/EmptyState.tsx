import type { LucideIcon } from "lucide-react"
import {
  AlertCircle,
  BookOpen,
  CheckCircle,
  GraduationCap,
  Users
} from "lucide-react"

import { Button } from "@/components/ui/button"

type EmptyStateAction = {
  label: string
  onClick: () => void
}

type EmptyStateProps = {
  icon?: LucideIcon
  title: string
  description: string
  action?: EmptyStateAction
}

export const emptyStateIcons = {
  noCourses: BookOpen,
  noTeachers: Users,
  noStudents: GraduationCap,
  allGood: CheckCircle,
  genericError: AlertCircle
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center gap-3">
      {Icon ? <Icon className="h-12 w-12 text-muted-foreground/40" /> : null}
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
      {action ? (
        <Button
          variant="outline"
          onClick={action.onClick}
          className="active:scale-95 transition-transform duration-100"
        >
          {action.label}
        </Button>
      ) : null}
    </div>
  )
}
