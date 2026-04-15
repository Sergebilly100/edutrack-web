import type { LucideIcon } from "lucide-react"

interface AppIconProps {
  icon: LucideIcon
  size?: "xs" | "sm" | "md" | "lg" | "xl"
  className?: string
  "aria-label"?: string
}

const SIZE_MAP = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
} as const

export function AppIcon({
  icon: Icon,
  size = "md",
  className,
  "aria-label": ariaLabel,
}: AppIconProps) {
  return (
    <Icon
      size={SIZE_MAP[size]}
      strokeWidth={1.75}
      className={className}
      aria-label={ariaLabel}
      aria-hidden={!ariaLabel}
    />
  )
}
