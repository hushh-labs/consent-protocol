/**
 * Firebase Cloud Messaging service worker
 * Handles background push and notification click → open consent pending tab
 */
self.addEventListener("push", function (event) {
  if (!event.data) return;
  try {
    const data = event.data.json();
    const title = data.notification?.title || data.title || "Consent request";
    const body = data.notification?.body || data.body || "You have a new consent request";
    const url = data.data?.url || data.url || "/consents?tab=pending";
    event.waitUntil(
      self.registration.showNotification(title, {
        body,
        data: { url },
        tag: "consent-request",
        requireInteraction: false,
      })
    );
  } catch (_) {
    event.waitUntil(
      self.registration.showNotification("Consent request", {
        body: "You have a new consent request",
        data: { url: "/consents?tab=pending" },
        tag: "consent-request",
      })
    );
  }
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  const url = event.notification.data?.url || "/consents?tab=pending";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});
