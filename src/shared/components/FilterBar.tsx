import type { HTMLAttributes } from "react"
import { cn } from "@/lib/utils"

export function FilterBar({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3", className)} {...props} />
}
