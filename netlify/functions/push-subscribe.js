/**
 * push-subscribe.js — Netlify Function (FCM version)
 * POST /.netlify/functions/push-subscribe
 *
 * Saves { fcmToken, teamId } to Netlify Blobs.
 * FCM token is used as the blob key — it's already unique per device.
 *
 * Body: {
 *   fcmToken: string,       // from Firebase getToken()
 *   teamId?: string,        // optional FPL entry ID
 *   action?: 'subscribe' | 'unsubscribe' | 'update-team'
 * }
 */

const { getStore } = require('@netlify/blobs');

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch (_) { return { statusCode: 400, body: 'Bad JSON' }; }

  const { fcmToken, teamId, action = 'subscribe' } = body;

  if (!fcmToken) return { statusCode: 400, body: 'Missing fcmToken' };

  const store = getStore('push-subscriptions');

  /* Use first 64 chars of token as key — tokens can be 150+ chars */
  const key = fcmToken.slice(0, 64);

  if (action === 'unsubscribe') {
    try {
      await store.delete(key);
      return { statusCode: 200, body: JSON.stringify({ ok: true, action: 'unsubscribed' }) };
    } catch (err) {
      return { statusCode: 500, body: err.message };
    }
  }

  /* Subscribe or update */
  try {
    let existing = null;
    try { existing = await store.get(key, { type: 'json' }); } catch (_) {}

    const record = {
      fcmToken,
      teamId:    teamId ? String(teamId) : (existing?.teamId || null),
      savedAt:   existing?.savedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await store.setJSON(key, record);

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, action: existing ? 'updated' : 'subscribed' }),
    };
  } catch (err) {
    console.error('[push-subscribe] error:', err.message);
    return { statusCode: 500, body: err.message };
  }
};
