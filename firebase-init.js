/**
 * firebase-init.js — Kopala FPL
 * Initialises Firebase and gets an FCM token for this device.
 * Include on every page BEFORE kopala-notify.js.
 *
 * <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js"></script>
 * <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js"></script>
 * <script src="firebase-init.js"></script>
 * <script src="kopala-notify.js"></script>
 *
 * HOW TO GET THESE VALUES:
 *   Firebase Console → Project Settings → General → Your apps → Web app
 *
 * HOW TO GET YOUR VAPID KEY (FCM calls it "Web Push certificate"):
 *   Firebase Console → Project Settings → Cloud Messaging → Web Push certificates → Generate key pair
 */

(function () {
  'use strict';

  /* ── PASTE YOUR FIREBASE CONFIG HERE ── */
  const FIREBASE_CONFIG = {
    apiKey:            'AIzaSyA0INOR1tann5VWA_XKuBKipfyu0WaWusY',
    authDomain:        'kopala-fpl.firebaseapp.com',
    projectId:         'kopala-fpl',
    storageBucket:     'kopala-fpl.firebasestorage.app',
    messagingSenderId: '781953678615',
    appId:             '1:781953678615:web:572717324c28c841adcb52',
  };

  /* FCM Web Push certificate key pair (different from VAPID):
     Firebase Console → Project Settings → Cloud Messaging → Web Push certificates */
  const FCM_VAPID_KEY = '3SJ-FS0bMNyI7XgnEb2bhIsq2puo_zronKfLV_80OzU';

  /* ── Init ── */
  if (!window.firebase) {
    console.warn('[Firebase] SDK not loaded — include firebase-app + firebase-messaging scripts');
    return;
  }

  let app, messaging;
  try {
    app       = firebase.initializeApp(FIREBASE_CONFIG);
    messaging = firebase.messaging(app);
  } catch (err) {
    console.warn('[Firebase] Init error:', err.message);
    return;
  }

  /**
   * getFCMToken() → Promise<string|null>
   * Called by kopala-notify.js after permission is granted.
   */
  async function getFCMToken() {
    if (!('serviceWorker' in navigator)) return null;
    try {
      const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
      const token = await messaging.getToken({
        vapidKey:        FCM_VAPID_KEY,
        serviceWorkerRegistration: swReg,
      });
      return token || null;
    } catch (err) {
      console.warn('[Firebase] getToken error:', err.message);
      return null;
    }
  }

  /**
   * Handle foreground messages (app is open).
   * Firebase won't show a notification automatically when app is open
   * so we fire it manually through the SW.
   */
  messaging.onMessage(function (payload) {
    console.log('[Firebase] Foreground message:', payload);
    const data = payload.data || {};

    // Let kopala-notify handle it via a custom event
    window.dispatchEvent(new CustomEvent('kopala:fcm-message', { detail: payload }));
  });

  /* Expose globally for kopala-notify.js */
  window.KopalaFirebase = { getFCMToken, messaging };

})();
