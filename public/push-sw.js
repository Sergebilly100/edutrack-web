// Handlers Web Push, chargés dans le Service Worker généré par Workbox via
// workbox.importScripts (vite.config). On garde ainsi tout le cache offline
// auto-généré et on n'ajoute QUE la couche push.

// Réception d'une notification push : affiche la notification système.
self.addEventListener("push", (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch (_e) {
    data = { title: "IvoirEdu", body: event.data ? event.data.text() : "" }
  }

  const title = data.title || "IvoirEdu"
  const options = {
    body: data.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: data.tag || undefined,
    data: { url: data.url || "/" },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

// Clic sur la notification : focus l'onglet existant ou ouvre l'app sur l'URL.
self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const targetUrl = (event.notification.data && event.notification.data.url) || "/"

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(targetUrl)
          return client.focus()
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl)
      }
      return undefined
    })
  )
})
