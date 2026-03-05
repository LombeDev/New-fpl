/**
 * push-goal-cron.js — Netlify Scheduled Function (FCM version)
 * Runs every 2 minutes. Only does real work during live fixtures.
 *
 * netlify.toml:
 *   [functions."push-goal-cron"]
 *   schedule = "*/2 * * * *"
 */

const { getStore } = require('@netlify/blobs');
const { sendFCM }  = require('./_fcm-sender');

const PROXY = (process.env.SITE_URL || 'https://your-site.netlify.app') +
              '/.netlify/functions/fpl-proxy?endpoint=';

exports.handler = async function () {
  const subStore   = getStore('push-subscriptions');
  const scoreStore = getStore('goal-scores');

  /* Bootstrap + fixtures */
  let bootstrap, fixtures;
  try { bootstrap = await fetch(PROXY + 'bootstrap-static/').then(r => r.json()); }
  catch (err) { console.error('[goal-cron] bootstrap:', err.message); return { statusCode: 500 }; }

  const currentEvent = bootstrap.events.find(e => e.is_current);
  if (!currentEvent) return { statusCode: 200 };

  try { fixtures = await fetch(PROXY + 'fixtures/?event=' + currentEvent.id).then(r => r.json()); }
  catch (err) { console.error('[goal-cron] fixtures:', err.message); return { statusCode: 500 }; }

  const liveFixtures = fixtures.filter(f => f.started && !f.finished_provisional);
  if (!liveFixtures.length) return { statusCode: 200 };

  /* Detect new goals */
  let lastScores = {};
  try { lastScores = await scoreStore.get('current', { type: 'json' }) || {}; } catch (_) {}

  const newGoals = [];
  liveFixtures.forEach(fx => {
    const prev   = lastScores[fx.id] || { h: 0, a: 0 };
    const h = fx.team_h_score ?? 0, a = fx.team_a_score ?? 0;
    if (h > prev.h) newGoals.push({ teamId: fx.team_h, ownScore: h, oppScore: a, oppTeamId: fx.team_a });
    if (a > prev.a) newGoals.push({ teamId: fx.team_a, ownScore: a, oppScore: h, oppTeamId: fx.team_h });
    lastScores[fx.id] = { h, a };
  });

  try { await scoreStore.setJSON('current', lastScores); } catch (_) {}
  if (!newGoals.length) return { statusCode: 200 };

  /* Maps */
  const teamMap = {}, playerMap = {};
  bootstrap.teams.forEach(t => { teamMap[t.id] = t; });
  bootstrap.elements.forEach(p => { playerMap[p.id] = p; });

  /* Subscribers */
  let blobs = [];
  try { blobs = (await subStore.list()).blobs; } catch (_) { return { statusCode: 500 }; }
  if (!blobs.length) return { statusCode: 200 };

  let sent = 0;

  await Promise.allSettled(blobs.map(async blob => {
    let record;
    try { record = await subStore.get(blob.key, { type: 'json' }); } catch (_) { return; }
    if (!record?.fcmToken) return;

    /* Build squad map for personalised alerts */
    let mySquadByTeam = {};
    if (record.teamId) {
      try {
        const data = await fetch(PROXY + `entry/${record.teamId}/event/${currentEvent.id}/picks/`).then(r => r.json());
        (data.picks || []).slice(0, 11).forEach(pick => {
          const p = playerMap[pick.element];
          if (!p) return;
          if (!mySquadByTeam[p.team]) mySquadByTeam[p.team] = [];
          mySquadByTeam[p.team].push(p.web_name + (pick.is_captain ? ' ©' : ''));
        });
      } catch (_) {}
    }

    for (const goal of newGoals) {
      const scoringTeam = teamMap[goal.teamId];
      const oppTeam     = teamMap[goal.oppTeamId];
      const teamName    = scoringTeam?.short_name || '?';
      const oppName     = oppTeam?.short_name     || '?';
      const myPlayers   = mySquadByTeam[goal.teamId] || [];

      /* Skip if user has squad loaded but no player in this team */
      if (record.teamId && Object.keys(mySquadByTeam).length > 0 && !myPlayers.length) continue;

      const title = `⚽ GOAL! ${teamName} (${goal.ownScore})`;
      const body  = myPlayers.length
        ? `${teamName} ${goal.ownScore}–${goal.oppScore} ${oppName}\nYour players: ${myPlayers.join(', ')}`
        : `${teamName} ${goal.ownScore}–${goal.oppScore} ${oppName}`;

      try {
        const result = await sendFCM(record.fcmToken, {
          title, body,
          tag:     `kfl-goal-${goal.teamId}`,
          group:   'kfl-goals',
          url:     '/games.html',
          icon:    '/android-chrome-192x192.png',
          badge:   '/android-chrome-96x96.png',
          vibrate: [40, 60, 40, 60, 80],
          actions: [{ action: 'open', title: 'View match' }, { action: 'dismiss', title: 'Dismiss' }],
        });
        if (result.expired) { await subStore.delete(blob.key); return; }
        sent++;
      } catch (err) {
        console.warn('[goal-cron] send failed:', err.message);
      }
    }
  }));

  console.log(`[goal-cron] goals:${newGoals.length} sent:${sent}`);
  return { statusCode: 200 };
};
