/**
 * push-price-cron.js — Netlify Scheduled Function (FCM version)
 * Runs daily at 07:00 UTC.
 *
 * netlify.toml:
 *   [functions."push-price-cron"]
 *   schedule = "0 7 * * *"
 */

const { getStore } = require('@netlify/blobs');
const { sendFCM }  = require('./_fcm-sender');

const PROXY = (process.env.SITE_URL || 'https://your-site.netlify.app') +
              '/.netlify/functions/fpl-proxy?endpoint=';

exports.handler = async function () {
  const store = getStore('push-subscriptions');

  let blobs;
  try { blobs = (await store.list()).blobs; }
  catch (err) { console.error('[price-cron]', err.message); return { statusCode: 500 }; }
  if (!blobs.length) return { statusCode: 200 };

  /* Bootstrap once for all users */
  let bootstrap;
  try { bootstrap = await fetch(PROXY + 'bootstrap-static/').then(r => r.json()); }
  catch (err) { console.error('[price-cron] bootstrap:', err.message); return { statusCode: 500 }; }

  const playerMap    = {};
  bootstrap.elements.forEach(p => { playerMap[p.id] = p; });
  const currentEvent = bootstrap.events.find(e => e.is_current);

  /* Global changes for users without teamId */
  const allRises = bootstrap.elements.filter(p => (p.cost_change_event || 0) > 0);
  const allFalls = bootstrap.elements.filter(p => (p.cost_change_event || 0) < 0);
  const hasGlobal = allRises.length > 0 || allFalls.length > 0;

  const genericTitle = hasGlobal ? '💰 FPL prices updated' : null;
  const genericBody  = hasGlobal
    ? [
        allRises.length ? `📈 ${allRises.length} player${allRises.length > 1 ? 's' : ''} rose` : '',
        allFalls.length ? `📉 ${allFalls.length} player${allFalls.length > 1 ? 's' : ''} fell` : '',
      ].filter(Boolean).join('  •  ') + '\nOpen Kopala FPL to see who'
    : null;

  let sent = 0, skipped = 0, expired = 0;

  await Promise.allSettled(blobs.map(async blob => {
    let record;
    try { record = await store.get(blob.key, { type: 'json' }); } catch (_) { return; }
    if (!record?.fcmToken) return;

    let title, body;

    if (record.teamId && currentEvent) {
      try {
        const data  = await fetch(PROXY + `entry/${record.teamId}/event/${currentEvent.id}/picks/`).then(r => r.json());
        const rises = [], falls = [];
        (data.picks || []).forEach(pick => {
          const p = playerMap[pick.element];
          if (!p) return;
          const c = p.cost_change_event || 0;
          if (c > 0) rises.push(`${p.web_name} +£${(c / 10).toFixed(1)}m`);
          if (c < 0) falls.push(`${p.web_name} £${(c / 10).toFixed(1)}m`);
        });

        if (!rises.length && !falls.length) { skipped++; return; }
        const total = rises.length + falls.length;
        title = `💰 ${total} price change${total > 1 ? 's' : ''} in your squad`;
        body  = [rises.length ? '📈 ' + rises.join(', ') : '', falls.length ? '📉 ' + falls.join(', ') : ''].filter(Boolean).join('\n');
      } catch (_) {
        if (!hasGlobal) { skipped++; return; }
        title = genericTitle; body = genericBody;
      }
    } else {
      if (!hasGlobal) { skipped++; return; }
      title = genericTitle; body = genericBody;
    }

    try {
      const result = await sendFCM(record.fcmToken, {
        title, body,
        tag:     'kfl-price',
        group:   'kfl-prices',
        url:     record.teamId ? '/squad.html' : '/',
        icon:    '/android-chrome-192x192.png',
        badge:   '/android-chrome-96x96.png',
        vibrate: [15, 40, 15],
        actions: [{ action: 'open', title: 'View' }, { action: 'dismiss', title: 'Dismiss' }],
      });
      if (result.expired) { await store.delete(blob.key); expired++; }
      else sent++;
    } catch (err) {
      console.warn('[price-cron] send failed:', err.message);
    }
  }));

  console.log(`[price-cron] sent:${sent} skipped:${skipped} expired:${expired}`);
  return { statusCode: 200 };
};
