/**
 * kopala-worker.js  v3
 * ─────────────────────────────────────────────────────────────
 * Web Worker — all CPU-heavy work off the main thread.
 *
 * PROCESS_BOOTSTRAP returns a UNIFIED shape that satisfies
 * every page in Kopala FPL without adapters or shims:
 *
 *   Legacy fields  (index.html, leagues.html original shape)
 *     playerMap, teamMap, elementData,
 *     priceRisers, priceFallers, top30,
 *     totalPlayers, currentGW, gwAvg, gwHigh
 *
 *   New fields  (prices.html worker shape)
 *     TMAP, TCODES, teamList, allElements,
 *     gwNum, nextDeadline, nextGWName
 *
 * All fields present on every response — pages can use either set.
 *
 * OTHER MESSAGE TYPES (prices.html)
 *   CALC_PRICES   → PRICES_READY   { all, zones }
 *   SORT_FILTER   → SORTED         { pool }
 *   DIFF          → DIFF_READY     { changed }
 *
 * All messages support optional _id for request/response matching.
 */

const RISE_CUMUL = 220000, RISE_DAILY = 30000;
const FALL_CUMUL =  37000, FALL_DAILY =  5000;
const OWN_FLOOR  =    1.7;

/* ── Message router ──────────────────────────────────────── */
self.onmessage = function(e) {
  const { type, payload, _id } = e.data;
  try {
    let result, outType;
    switch (type) {
      case 'PROCESS_BOOTSTRAP':
        result  = processBootstrap(payload);
        outType = 'BOOTSTRAP_READY';
        break;
      case 'CALC_PRICES':
        result  = calcPrices(payload);
        outType = 'PRICES_READY';
        break;
      case 'SORT_FILTER':
        result  = sortFilter(payload);
        outType = 'SORTED';
        break;
      case 'DIFF':
        result  = diffPlayers(payload);
        outType = 'DIFF_READY';
        break;
      default:
        self.postMessage({ type: 'ERROR', payload: 'Unknown type: ' + type, _id });
        return;
    }
    const msg = { type: outType, payload: result };
    if (_id !== undefined) msg._id = _id;
    self.postMessage(msg);
  } catch (err) {
    self.postMessage({ type: 'ERROR', payload: err.message, _id });
  }
};

/* ── PROCESS_BOOTSTRAP ───────────────────────────────────── */
function processBootstrap(d) {
  /* Team maps */
  const teamMap  = {};   // legacy: { id: {code, name, short} }
  const TMAP     = {};   // new:    { id: short_name }
  const TCODES   = {};   // new:    { id: code }
  d.teams.forEach(t => {
    teamMap[t.id] = { code: t.code, name: t.name, short: t.short_name };
    TMAP[t.id]    = t.short_name;
    TCODES[t.id]  = t.code;
  });
  const teamList = d.teams.map(t => ({
    id: t.id, name: t.name, short: t.short_name, code: t.code,
  }));

  /* Player map + element data (legacy shape) */
  const playerMap   = {};
  const elementData = {};
  d.elements.forEach(p => {
    playerMap[p.id] = {
      name:            p.web_name,
      fullName:        `${p.first_name} ${p.second_name}`,
      teamCode:        teamMap[p.team]?.code  || 1,
      teamShort:       teamMap[p.team]?.short || '?',
      pos:             p.element_type,
      team:            p.team,
      ownership:       parseFloat(p.selected_by_percent) || 0,
      nowCost:         p.now_cost,
      costChangeEvent: p.cost_change_event   || 0,
      transfersIn:     p.transfers_in_event  || 0,
      transfersOut:    p.transfers_out_event || 0,
    };
    elementData[p.id] = p;
  });

  /* Price risers/fallers + top30 (legacy pre-sorts) */
  const priceRisers = d.elements
    .filter(e => e.cost_change_event > 0)
    .sort((a, b) => b.cost_change_event - a.cost_change_event)
    .slice(0, 25)
    .map(e => e.id);
  const priceFallers = d.elements
    .filter(e => e.cost_change_event < 0)
    .sort((a, b) => a.cost_change_event - b.cost_change_event)
    .slice(0, 25)
    .map(e => e.id);
  const top30 = d.elements
    .slice()
    .sort((a, b) => b.selected_by_percent - a.selected_by_percent)
    .slice(0, 30)
    .map(e => e.id);

  /* Current GW */
  const ev = d.events.find(e => e.is_current)
          || d.events.find(e => e.is_next)
          || d.events[0];

  /* Next deadline */
  const now  = Date.now();
  const next = d.events
    .filter(e => new Date(e.deadline_time).getTime() > now)
    .sort((a, b) => new Date(a.deadline_time) - new Date(b.deadline_time))[0];

  return {
    /* ── Legacy fields ── */
    playerMap,
    teamMap,
    elementData,
    allElements:  d.elements,
    priceRisers,
    priceFallers,
    top30,
    totalPlayers: d.total_players || 0,
    currentGW:    ev ? ev.id : 1,
    gwAvg:        ev ? ev.average_entry_score || 0 : 0,
    gwHigh:       ev ? ev.highest_score       || 0 : 0,
    /* ── New fields ── */
    TMAP,
    TCODES,
    teamList,
    gwNum:        ev ? ev.id : 1,
    maxGW:        d.events.length,
    nextDeadline: next ? new Date(next.deadline_time).getTime() : null,
    nextGWName:   next ? next.name : null,
  };
}

/* ── CALC_PRICES ─────────────────────────────────────────── */
function calcPrices({ elements, snapshots = {}, mySquad = [], TMAP = {}, gwStartMs, gwEndMs }) {
  const mySet   = new Set(mySquad);
  const gwStart = gwStartMs || getGWStart();
  const gwEnd   = gwEndMs   || getUpdateTarget();
  const all     = elements.map(p => calcPlayer(p, snapshots, mySet, TMAP, gwStart, gwEnd));

  const pending = all.filter(p => !p.moved && !p.belowFloor);
  const zones = {
    tn:      pending.filter(p => p.tonightEst >= 88).length,
    so:      pending.filter(p => p.tonightEst >= 60 && p.tonightEst < 88).length,
    wa:      pending.filter(p => p.cumulProg  >= 30 && p.tonightEst < 60).length,
    tnNames: pending.filter(p => p.tonightEst >= 88).slice(0,3).map(p => p.name),
    soNames: pending.filter(p => p.tonightEst >= 60 && p.tonightEst < 88).slice(0,3).map(p => p.name),
    waNames: pending.filter(p => p.cumulProg  >= 30 && p.tonightEst < 60).slice(0,3).map(p => p.name),
    risers:  all.filter(p => p.isRise  && !p.moved && p.tonightEst >= 40).length,
    fallers: all.filter(p => !p.isRise && !p.moved && p.tonightEst >= 40).length,
  };
  return { all, zones };
}

function getUpdateTarget() {
  const t = new Date(); t.setUTCHours(1, 30, 0, 0);
  if (Date.now() >= t.getTime()) t.setUTCDate(t.getUTCDate() + 1);
  return t.getTime();
}
function getGWStart() {
  const p = new Date(); p.setUTCHours(1, 30, 0, 0);
  if (Date.now() < p.getTime()) p.setUTCDate(p.getUTCDate() - 1);
  return p.getTime();
}

function calcPlayer(p, snapshots, mySet, TMAP, gwStart, gwEnd) {
  const own    = parseFloat(p.selected_by_percent) || 0;
  const net    = (p.transfers_in_event || 0) - (p.transfers_out_event || 0);
  const isRise = net >= 0;
  const belowFloor = own < OWN_FLOOR;
  const flagMult = isRise ? 1.0
    : p.status === 'a' ? 1.0 : p.status === 'd' ? 0.75
    : p.status === 'i' ? 0.55 : p.status === 's' ? 0.45 : 1.0;
  const cumulThresh = isRise ? RISE_CUMUL : FALL_CUMUL * flagMult;
  const dailyThresh = isRise ? RISE_DAILY : FALL_DAILY * flagMult;
  const absNet      = Math.abs(net);
  const cumulProg   = belowFloor ? 0 : Math.min(100, (absNet / cumulThresh) * 100);
  const now         = Date.now();
  const hElapsed    = Math.max(0.5, (now - gwStart) / 3.6e6);
  const hLeft       = Math.max(0, (gwEnd - now) / 3.6e6);
  const damp        = hElapsed / 24 < 0.3 ? 1.15 : hElapsed / 24 < 0.65 ? 1.0 : 0.7;
  const tonightEst  = belowFloor ? 0 : Math.min(100, cumulProg + (cumulProg / hElapsed) * damp * hLeft);

  const snap = snapshots[p.id] || null;
  let velCls = 'vn', velIcon = 'fa-minus';
  if (snap) {
    const rate = (cumulProg - snap.prog) / Math.max(0.1, (now - snap.ts) / 3.6e6);
    if      (rate >  3)   { velIcon = 'fa-angles-up';   velCls = 'vu'; }
    else if (rate >  0.8) { velIcon = 'fa-angle-up';    velCls = 'vu'; }
    else if (rate < -3)   { velIcon = 'fa-angles-down'; velCls = 'vd'; }
    else if (rate < -0.8) { velIcon = 'fa-angle-down';  velCls = 'vd'; }
  }

  const weakCond = Math.min(
    Math.min(100, (absNet / cumulThresh) * 100),
    Math.min(100, (absNet / dailyThresh) * 100)
  );
  let prob = 0;
  if (!belowFloor) {
    if      (weakCond < 40) prob = Math.round(weakCond * 0.45);
    else if (weakCond < 70) prob = Math.round(18 + (weakCond - 40) * 1.5);
    else if (weakCond < 88) prob = Math.round(63 + (weakCond - 70) * 1.8);
    else                    prob = Math.round(95 + (weakCond - 88) * 0.3);
    prob = Math.min(99, Math.max(0, prob));
  }

  const moved = p.cost_change_event !== 0;
  let pred = '—', predCls = 'p-none';
  if      (moved)              { pred = p.cost_change_event > 0 ? '+£0.1' : '−£0.1'; predCls = 'p-dn'; }
  else if (belowFloor)         { pred = '< FLOOR'; predCls = 'p-fl'; }
  else if (tonightEst >= 88)   { pred = 'TONIGHT'; predCls = 'p-tn'; }
  else if (tonightEst >= 60)   { pred = 'SOON';    predCls = 'p-so'; }
  else if (cumulProg  >= 30)   { pred = 'WATCH';   predCls = 'p-wa'; }

  const fmt = v => v >= 1000 ? (v / 1000).toFixed(1) + 'k' : String(v);
  return {
    id: p.id, name: p.web_name,
    teamId: p.team, teamCode: p.team_code,
    teamShort: TMAP[p.team] || '',
    pos: p.element_type,
    price: (p.now_cost / 10).toFixed(1),
    own, net, absNet,
    cumulProg:   parseFloat(cumulProg.toFixed(1)),
    tonightEst:  parseFloat(tonightEst.toFixed(1)),
    cumulMet: absNet >= cumulThresh, dailyMet: absNet >= dailyThresh,
    prob, pred, predCls, isRise, moved,
    actualChange: p.cost_change_event,
    netDisplay: `${isRise ? '+' : '−'}${fmt(absNet)}`,
    netCls:  isRise ? 'nr' : 'nf',
    pctCls:  moved ? 'cd' : isRise ? 'cr' : 'cf',
    velIcon, velCls, belowFloor,
    status: p.status,
    isMine: mySet.has(p.id),
  };
}

/* ── SORT_FILTER ─────────────────────────────────────────── */
function sortFilter({ players, view, pos, sort, search, teamId, minOwn, zone, watchlist }) {
  const wSet    = new Set(watchlist || []);
  const autoHide = !search && view !== 'w';

  let pool = players.filter(p => {
    if (view === 'r' && !p.isRise)                                          return false;
    if (view === 'f' &&  p.isRise)                                          return false;
    if (view === 'w' && !wSet.has(p.id))                                    return false;
    if (pos    && p.pos !== pos)                                             return false;
    if (search && !p.name.toLowerCase().includes(search))                   return false;
    if (teamId && teamId !== 'all' && String(p.teamId) !== teamId)          return false;
    if (autoHide && p.moved)                                                 return false;
    if (minOwn && p.own < minOwn)                                            return false;
    if (zone === 'tn' && (p.moved || p.tonightEst < 88))                    return false;
    if (zone === 'so' && (p.moved || p.tonightEst < 60 || p.tonightEst >= 88)) return false;
    if (zone === 'wa' && (p.moved || p.cumulProg  < 30 || p.tonightEst >= 60)) return false;
    return true;
  });

  const fns = {
    prog: (a, b) => b.cumulProg  - a.cumulProg,
    est:  (a, b) => b.tonightEst - a.tonightEst,
    net:  (a, b) => b.absNet     - a.absNet,
    own:  (a, b) => b.own        - a.own,
    name: (a, b) => a.name.localeCompare(b.name),
  };
  pool.sort(fns[sort] || fns.prog);
  return { pool };
}

/* ── DIFF ────────────────────────────────────────────────── */
function diffPlayers({ prev, next }) {
  const prevMap = {};
  prev.forEach(p => { prevMap[p.id] = p; });
  const changed = [];
  next.forEach(p => {
    const o = prevMap[p.id];
    if (!o ||
        o.cumulProg  !== p.cumulProg  ||
        o.tonightEst !== p.tonightEst ||
        o.prob       !== p.prob       ||
        o.pred       !== p.pred       ||
        o.netDisplay !== p.netDisplay ||
        o.velCls     !== p.velCls     ||
        o.moved      !== p.moved) {
      changed.push(p.id);
    }
  });
  return { changed };
}
