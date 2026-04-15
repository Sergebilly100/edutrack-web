import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  AppIcon,
  ErrorIcon,
  PresentIcon,
  SearchIcon,
  StudentsIcon,
  SubjectIcon,
  TeachersIcon,
} from "@/shared/components/icons"

type EmptyStateAction = {
  label: string
  onClick: () => void
  icon?: React.ReactNode | React.ComponentType<{ className?: string }>
}

type EmptyStateProps = {
  icon?: React.ReactNode | React.ComponentType<{ className?: string }>
  title: string
  message?: string
  description?: string
  action?: EmptyStateAction
}

export const emptyStateIcons = {
  noCourses: SubjectIcon,
  noTeachers: TeachersIcon,
  noStudents: StudentsIcon,
  allGood: PresentIcon,
  genericError: ErrorIcon,
}

const renderIconNode = (
  icon?: React.ReactNode | React.ComponentType<{ className?: string }>,
  className = "h-5 w-5 text-muted-foreground"
) => {
  if (!icon) {
    return <AppIcon icon={SearchIcon} size="md" className={className} />
  }

  if (React.isValidElement(icon)) {
    return icon
  }

  if (typeof icon === "function") {
    const IconComponent = icon as React.ComponentType<{ className?: string }>
    return <IconComponent className={className} />
  }

  return <AppIcon icon={SearchIcon} size="md" className={className} />
}

export function EmptyState({ icon, title, message, description, action }: EmptyStateProps) {
  const contentMessage = message ?? description

  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        {renderIconNode(icon)}
      </div>
      <h3 className="text-sm font-medium">{title}</h3>
      {contentMessage ? <p className="max-w-xs text-sm text-muted-foreground">{contentMessage}</p> : null}
      {action ? (
        <Button variant="default" size="sm" onClick={action.onClick}>
          {action.icon ? <span className="mr-2 inline-flex items-center">{renderIconNode(action.icon, "h-4 w-4")}</span> : null}
          {action.label}
        </Button>
      ) : null}
    </div>
  )
}
