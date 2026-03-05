/**
 * _fcm-sender.js — internal utility
 * Sends FCM notifications via the HTTP v1 API.
 * No npm packages needed — pure Node built-ins.
 *
 * HOW TO GET YOUR SERVICE ACCOUNT JSON:
 *   Firebase Console → Project Settings → Service accounts → Generate new private key
 *   Download the JSON and paste the relevant fields into your Netlify env vars:
 *
 *   FCM_PROJECT_ID      = your-project-id
 *   FCM_CLIENT_EMAIL    = firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
 *   FCM_PRIVATE_KEY     = -----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n
 *   (paste the full private_key value from the JSON, newlines as \n)
 */

const crypto  = require('crypto');
const https   = require('https');

const PROJECT_ID    = process.env.FCM_PROJECT_ID;
const CLIENT_EMAIL  = process.env.FCM_CLIENT_EMAIL;
const PRIVATE_KEY   = (process.env.FCM_PRIVATE_KEY || '').replace(/\\n/g, '\n');

/* ── Google OAuth2 access token via service account JWT ── */
let _tokenCache = null; // { token, expiresAt }

function b64uEncode(str) {
  return Buffer.from(str).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function getAccessToken() {
  /* Return cached token if still valid (with 60s buffer) */
  if (_tokenCache && Date.now() < _tokenCache.expiresAt - 60000) {
    return _tokenCache.token;
  }

  const now    = Math.floor(Date.now() / 1000);
  const header  = b64uEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = b64uEncode(JSON.stringify({
    iss:   CLIENT_EMAIL,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud:   'https://oauth2.googleapis.com/token',
    iat:   now,
    exp:   now + 3600,
  }));

  const signingInput = `${header}.${payload}`;
  const privateKey   = crypto.createPrivateKey(PRIVATE_KEY);
  const signature    = b64uEncode(
    crypto.sign('SHA256', Buffer.from(signingInput), privateKey)
  );

  const jwt = `${signingInput}.${signature}`;

  /* Exchange JWT for access token */
  const tokenData = await new Promise((resolve, reject) => {
    const body = Buffer.from(
      `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`
    );
    const req = https.request('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': body.length },
    }, res => {
      let raw = '';
      res.on('data', d => { raw += d; });
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); }
        catch (_) { reject(new Error('Token parse failed')); }
      });
    });
    req.on('error', reject);
    req.end(body);
  });

  if (!tokenData.access_token) throw new Error('No access_token in response');

  _tokenCache = {
    token:     tokenData.access_token,
    expiresAt: Date.now() + (tokenData.expires_in || 3600) * 1000,
  };

  return _tokenCache.token;
}

/**
 * sendFCM(fcmToken, payload)
 *
 * payload: {
 *   title, body,           — notification text
 *   tag, group, url,       — Kopala routing
 *   vibrate, icon, badge,  — display options
 *   actions,               — action buttons
 * }
 *
 * Returns { ok: true } or throws.
 * Returns { ok: false, expired: true } if token is invalid/unregistered.
 */
async function sendFCM(fcmToken, payload) {
  if (!PROJECT_ID || !CLIENT_EMAIL || !PRIVATE_KEY) {
    throw new Error('FCM env vars not configured (FCM_PROJECT_ID, FCM_CLIENT_EMAIL, FCM_PRIVATE_KEY)');
  }

  const accessToken = await getAccessToken();

  /* FCM HTTP v1 message format */
  const message = {
    message: {
      token: fcmToken,
      /* notification block = what Android shows in the tray */
      notification: {
        title: payload.title || 'Kopala FPL',
        body:  payload.body  || '',
      },
      /* data block = passed to SW onBackgroundMessage as payload.data */
      data: {
        tag:     payload.tag     || 'kfl-push',
        group:   payload.group   || '',
        url:     payload.url     || '/',
        vibrate: JSON.stringify(payload.vibrate || [200, 100, 200]),
        actions: JSON.stringify(payload.actions || []),
        icon:    payload.icon    || '/android-chrome-192x192.png',
        badge:   payload.badge   || '/android-chrome-96x96.png',
      },
      /* Android-specific config */
      android: {
        priority: 'high',
        notification: {
          icon:              'ic_stat_kopala',   // small monochrome icon in res/drawable
          color:             '#00e868',           // Kopala green
          channel_id:        payload.group || 'kfl-general',
          notification_count: 1,
          tag:               payload.tag || 'kfl-push',
        },
      },
      /* Web push config (Chrome on desktop/Android) */
      webpush: {
        notification: {
          icon:      payload.icon  || '/android-chrome-192x192.png',
          badge:     payload.badge || '/android-chrome-96x96.png',
          tag:       payload.tag   || 'kfl-push',
          renotify:  true,
          vibrate:   payload.vibrate || [200, 100, 200],
          actions:   payload.actions || [],
        },
        fcm_options: {
          link: payload.url || '/',
        },
      },
    },
  };

  const body = Buffer.from(JSON.stringify(message));
  const url  = `https://fcm.googleapis.com/v1/projects/${PROJECT_ID}/messages:send`;

  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type':   'application/json',
        'Authorization':  `Bearer ${accessToken}`,
        'Content-Length': body.length,
      },
    }, res => {
      let raw = '';
      res.on('data', d => { raw += d; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve({ ok: true });
        } else if (res.statusCode === 404 || res.statusCode === 410) {
          /* Token no longer valid — unregistered device */
          resolve({ ok: false, expired: true, status: res.statusCode });
        } else {
          console.warn('[FCM] Send failed:', res.statusCode, raw.slice(0, 200));
          reject(new Error(`FCM HTTP ${res.statusCode}`));
        }
      });
    });
    req.on('error', reject);
    req.end(body);
  });
}

module.exports = { sendFCM };
