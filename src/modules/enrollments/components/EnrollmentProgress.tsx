import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

const STEPS = ["Élève et classe", "Documents"]

export function EnrollmentProgress({ currentStep }: { currentStep: number }) {
  return (
    <ol className="grid grid-cols-2 gap-3" aria-label="Progression de l’inscription">
      {STEPS.map((label, index) => {
        const step = index + 1
        const complete = step < currentStep
        const active = step === currentStep
        return (
          <li key={label} className="min-w-0">
            <div className={cn("mb-2 h-1 rounded-full bg-muted", step <= currentStep && "bg-primary")} />
            <div className="flex items-center gap-2">
              <span className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                active && "border-primary bg-primary text-primary-foreground",
                complete && "border-green-600 bg-green-50 text-green-700",
              )}>
                {complete ? <Check className="h-4 w-4" /> : step}
              </span>
              <span className={cn("truncate text-xs text-muted-foreground sm:text-sm", active && "font-medium text-foreground")}>{label}</span>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
