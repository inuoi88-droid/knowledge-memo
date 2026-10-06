// 知識メモの Service Worker：毎日の学習通知を表示し、押されたら学習ページを開く

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()))

self.addEventListener('push', event => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }
  event.waitUntil(
    self.registration.showNotification(data.title || '知識メモ', {
      body: data.body || '今日の学習をはじめましょう',
      icon: '/pwa-icon?size=192',
      badge: '/pwa-icon?size=96',
      tag: 'daily-study',
      data: { url: data.url || '/dashboard/study' },
    }),
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = new URL((event.notification.data && event.notification.data.url) || '/dashboard/study', self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          return client.navigate(url).then(c => (c || client).focus())
        }
      }
      return self.clients.openWindow(url)
    }),
  )
})
