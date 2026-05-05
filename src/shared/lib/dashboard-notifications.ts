export const DASHBOARD_DISMISSED_NOTIFICATIONS_KEY = "edutrack:dashboard:dismissed-notifications"

export const clearDashboardDismissedNotifications = (): void => {
  if (typeof window === "undefined") {
    return
  }

  window.sessionStorage.removeItem(DASHBOARD_DISMISSED_NOTIFICATIONS_KEY)
}
