/**
 * firebase-messaging-sw.js — Kopala FPL
 * Firebase Cloud Messaging service worker.
 * Must be served from the ROOT of your site (same scope as sw.js).
 *
 * This file handles background push messages — when the app is closed.
 * When the app IS open, Firebase JS SDK handles it in the foreground.
 *
 * HOW TO GET YOUR CONFIG VALUES:
 *   Firebase Console → Project Settings → General → Your apps → Web app
 *   Copy the firebaseConfig object values below.
 */

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

/* ── PASTE YOUR FIREBASE CONFIG HERE ── */
firebase.initializeApp({
  apiKey:            'AIzaSyA0INOR1tann5VWA_XKuBKipfyu0WaWusY',
  authDomain:        'kopala-fpl.firebaseapp.com',
  projectId:         'kopala-fpl',
  storageBucket:     'kopala-fpl.firebasestorage.app',
  messagingSenderId: '781953678615',
  appId:             '1:781953678615:web:572717324c28c841adcb52',
});

const messaging = firebase.messaging();

/**
 * Background message handler.
 * Firebase shows the notification automatically using notification.title/body
 * from the FCM payload. This handler lets us customise it.
 */
messaging.onBackgroundMessage(function (payload) {
  console.log('[FCM-SW] Background message:', payload);

  const data    = payload.data || {};
  const notif   = payload.notification || {};
  const title   = notif.title || data.title || 'Kopala FPL';
  const body    = notif.body  || data.body  || '';
  const tag     = data.tag    || 'kfl-push';
  const group   = data.group  || null;
  const url     = data.url    || '/';

  const options = {
    body,
    icon:     '/android-chrome-192x192.png',
    badge:    '/android-chrome-96x96.png',
    tag,
    renotify: true,
    vibrate:  JSON.parse(data.vibrate || '[200,100,200]'),
    data:     { url, group },
    actions:  JSON.parse(data.actions || '[]'),
  };

  if (group) options.group = group;

  return self.registration.showNotification(title, options).then(async () => {
    /* Android group summary */
    if (!group) return;
    const existing = await self.registration.getNotifications({ tag: group + '-summary' });
    const count    = existing.length > 0
      ? parseInt(existing[0].data?.count || '1', 10) + 1 : 1;

    const summaryText = {
      'kfl-goals':    `${count} goal alert${count > 1 ? 's' : ''}`,
      'kfl-prices':   `${count} price change${count > 1 ? 's' : ''} in your squad`,
      'kfl-deadline': 'Deadline reminder',
    };

    return self.registration.showNotification(
      summaryText[group] || `${count} Kopala FPL notification${count > 1 ? 's' : ''}`,
      {
        body:     'Tap to open Kopala FPL',
        icon:     '/android-chrome-192x192.png',
        badge:    '/android-chrome-96x96.png',
        tag:      group + '-summary',
        group,
        silent:   true,
        renotify: false,
        data:     { url: '/', group, isSummary: true, count },
      }
    );
  });
});

/* Notification click — same logic as sw.js */
self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  const notifData = event.notification.data || {};
  const tag       = event.notification.tag  || '';
  const group     = notifData.group || null;
  const isSummary = notifData.isSummary || false;

  if (isSummary && group) {
    event.waitUntil(
      self.registration.getNotifications({ tag: group })
        .then(ns => ns.forEach(n => n.close()))
    );
  }

  let url = notifData.url;
  if (!url) {
    if (tag.startsWith('kfl-deadline') || group === 'kfl-deadline') url = '/transfers.html';
    else if (tag.startsWith('kfl-price')  || group === 'kfl-prices')  url = '/squad.html';
    else if (tag.startsWith('kfl-goal')   || group === 'kfl-goals')   url = '/games.html';
    else url = '/';
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        try {
          if (new URL(c.url).pathname === new URL(url, self.location.origin).pathname)
            return c.focus();
        } catch (_) {}
      }
      return clients.openWindow(url);
    })
  );
});
