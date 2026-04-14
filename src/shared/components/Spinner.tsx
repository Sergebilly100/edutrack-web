import { cn } from "@/lib/utils"

type SpinnerSize = "sm" | "md" | "lg"

const spinnerSizes: Record<SpinnerSize, string> = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-8 w-8"
}

type SpinnerProps = {
  size?: SpinnerSize
  className?: string
}

export function Spinner({ size = "md", className }: SpinnerProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cn("animate-spin text-primary", spinnerSizes[size], className)}
      fill="none"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        className="opacity-25"
        stroke="currentColor"
        strokeWidth="3"
      />
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="42 84"
      />
    </svg>
  )
}
