import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"

import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

type AuthImageProps = {
  queryKey: readonly unknown[]
  fetchBlob: () => Promise<Blob>
  alt: string
  className?: string
}

/** Image servie par un flux authentifié : le Blob devient une URL locale, jamais une URL publique. */
export function AuthImage({ queryKey, fetchBlob, alt, className }: AuthImageProps) {
  const { data, isPending, isError } = useQuery({ queryKey, queryFn: fetchBlob, staleTime: Infinity })
  const [objectUrl, setObjectUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!data) return
    const url = URL.createObjectURL(data)
    setObjectUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [data])

  if (isPending) return <Skeleton className={cn("h-full w-full", className)} />
  if (isError || !objectUrl) {
    return <p className="p-2 text-xs text-muted-foreground">Aperçu indisponible</p>
  }
  return <img src={objectUrl} alt={alt} className={cn("h-full w-full object-contain", className)} />
}
