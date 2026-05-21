import { useEffect } from "react"
import { useMutation, type UseMutationResult } from "@tanstack/react-query"

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

  // When offline, mutateAsync rejects with OfflineMutationQueuedError so callers
  // can distinguish "queued for later" from a real network/server error.
  // Callers that don't care about the result can use mutate() instead.
  const mutateAsync: UseMutationResult<TData, Error, TVariables>["mutateAsync"] = async (
    variables,
    _mutateOptions
  ) => {
    if (!isOnline) {
      queueMutation(variables)
      throw new OfflineMutationQueuedError()
    }

    return mutation.mutateAsync(variables, _mutateOptions)
  }

  const mutate: UseMutationResult<TData, Error, TVariables>["mutate"] = (
    variables,
    _mutateOptions
  ) => {
    if (!isOnline) {
      queueMutation(variables)
      return
    }

    mutation.mutate(variables, _mutateOptions)
  }

  return {
    ...mutation,
    mutate,
    mutateAsync,
    syncNow: syncOfflineQueue,
  }
}
