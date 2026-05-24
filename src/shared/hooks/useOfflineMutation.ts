import { useEffect } from "react"
import { useMutation, type UseMutationResult } from "@tanstack/react-query"
import axios from "axios"

import { useNetworkStatus } from "@/shared/hooks/useNetworkStatus"
import {
  registerOfflineProcessor,
  syncOfflineQueue,
  type OfflineQueueItem,
  useOfflineStore,
} from "@/shared/store/offline.store"

export class OfflineMutationQueuedError extends Error {
  constructor() {
    super("Mutation queued for offline sync")
    this.name = "OfflineMutationQueuedError"
  }
}

// Détecte les erreurs où la requête n'a JAMAIS atteint le serveur — donc
// safe à requeue. On exclut les vraies erreurs HTTP (4xx/5xx) où le serveur
// a répondu : requeue les rejouerait inutilement.
const isNetworkLevelError = (error: unknown): boolean => {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return true
  }
  if (axios.isAxiosError(error)) {
    // Pas de response → la requête n'est jamais arrivée (DNS, ECONNREFUSED, abort, timeout)
    if (!error.response) return true
    if (error.code === "ECONNABORTED" || error.code === "ERR_NETWORK") return true
  }
  // Fetch standard : TypeError thrown si network down ou request aborted
  if (error instanceof TypeError && /network|fetch|failed/i.test(error.message)) {
    return true
  }
  return false
}

type OfflineMutationOptions<TData, TVariables> = {
  queueKey: string
  optimisticUpdate?: (variables: TVariables) => void
  onSync?: (data: TData) => void
  maxRetries?: number
}

type OfflineMutationResult<TData, TVariables> = UseMutationResult<TData, Error, TVariables> & {
  syncNow: () => Promise<number>
}

const DEFAULT_MAX_RETRIES = 3

const buildQueueItemId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function useOfflineMutation<TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options: OfflineMutationOptions<TData, TVariables>
): OfflineMutationResult<TData, TVariables> {
  const { isOnline } = useNetworkStatus()
  const addToQueue = useOfflineStore((state) => state.addToQueue)

  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES

  useEffect(() => {
    return registerOfflineProcessor(options.queueKey, {
      mutationFn,
      onSync: options.onSync,
      maxRetries,
    })
  }, [maxRetries, mutationFn, options.onSync, options.queueKey])

  const mutation = useMutation<TData, Error, TVariables>({
    mutationFn,
  })

  const queueMutation = (variables: TVariables) => {
    options.optimisticUpdate?.(variables)

    const queueItem: OfflineQueueItem<TVariables> = {
      id: buildQueueItemId(),
      queueKey: options.queueKey,
      variables,
      timestamp: Date.now(),
    }

    addToQueue(queueItem)
  }

  // Deux cas de "queue" :
  //   1) navigator/onlineManager indique offline → queue avant d'appeler.
  //   2) on tente le call, il échoue avec une erreur **réseau** (pas un
  //      4xx/5xx applicatif) → fallback en queue pour ne pas perdre l'action.
  //      Sans (2), un check-in fait pendant un blip réseau (API down 5s,
  //      timeout, captive portal) était silencieusement perdu.
  const mutateAsync: UseMutationResult<TData, Error, TVariables>["mutateAsync"] = async (
    variables,
    _mutateOptions
  ) => {
    if (!isOnline) {
      queueMutation(variables)
      throw new OfflineMutationQueuedError()
    }

    try {
      return await mutation.mutateAsync(variables, _mutateOptions)
    } catch (error) {
      if (isNetworkLevelError(error)) {
        queueMutation(variables)
        throw new OfflineMutationQueuedError()
      }
      throw error
    }
  }

  const mutate: UseMutationResult<TData, Error, TVariables>["mutate"] = (
    variables,
    _mutateOptions
  ) => {
    if (!isOnline) {
      queueMutation(variables)
      return
    }

    mutation.mutate(variables, {
      ..._mutateOptions,
      onError: (...args) => {
        const [error, vars] = args
        if (isNetworkLevelError(error)) {
          queueMutation(vars)
        }
        ;(_mutateOptions?.onError as ((...a: typeof args) => void) | undefined)?.(...args)
      },
    })
  }

  return {
    ...mutation,
    mutate,
    mutateAsync,
    syncNow: syncOfflineQueue,
  }
}
