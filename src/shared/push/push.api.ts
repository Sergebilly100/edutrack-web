import { apiClient } from "@/shared/api/client"

export type PushAudience = "user" | "parent"

const SUBSCRIBE_PATH: Record<PushAudience, string> = {
  user: "/push/subscribe",
  parent: "/parent/push/subscribe",
}

const UNSUBSCRIBE_PATH: Record<PushAudience, string> = {
  user: "/push/unsubscribe",
  parent: "/parent/push/unsubscribe",
}

export const sendPushSubscription = async (
  audience: PushAudience,
  subscription: PushSubscriptionJSON
): Promise<void> => {
  await apiClient.post(SUBSCRIBE_PATH[audience], {
    endpoint: subscription.endpoint,
    keys: subscription.keys,
  })
}

export const removePushSubscription = async (
  audience: PushAudience,
  endpoint: string
): Promise<void> => {
  await apiClient.post(UNSUBSCRIBE_PATH[audience], { endpoint })
}
