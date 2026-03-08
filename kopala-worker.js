/**
 * kopala-worker.js
 * Web Worker — runs bootstrap-static processing entirely off the main thread.
 * Receives raw FPL JSON, returns structured maps and sorted arrays.
 *
 * Message in:  { type: 'PROCESS_BOOTSTRAP', payload: bootstrapData }
 * Message out: { type: 'BOOTSTRAP_READY',   payload: { playerMap, teamMap, allElements, currentGW, gwAvg, gwHigh, totalPlayers } }
 * Message out: { type: 'ERROR',             payload: errorMessage }
 */

self.onmessage = function(e) {
  const { type, payload } = e.data;

  if (type === 'PROCESS_BOOTSTRAP') {
    try {
      const result = processBootstrap(payload);
      self.postMessage({ type: 'BOOTSTRAP_READY', payload: result });
    } catch (err) {
      self.postMessage({ type: 'ERROR', payload: err.message });
    }
  }
};

function processBootstrap(d) {
  /* ── team map ─────────────────────────────────────────────── */
  const teamMap = {};
  d.teams.forEach(t => {
    teamMap[t.id] = { code: t.code, name: t.name, short: t.short_name };
  });

  /* ── player map + element data ───────────────────────────── */
  const playerMap   = {};
  const elementData = {};
  const allElements = d.elements;

  allElements.forEach(p => {
    playerMap[p.id] = {
      name:            p.web_name,
      fullName:        `${p.first_name} ${p.second_name}`,
      teamCode:        teamMap[p.team]?.code  || 1,
      teamShort:       teamMap[p.team]?.short || '?',
      pos:             p.element_type,
      team:            p.team,
      ownership:       parseFloat(p.selected_by_percent) || 0,
      nowCost:         p.now_cost,
      costChangeEvent: p.cost_change_event    || 0,
      transfersIn:     p.transfers_in_event   || 0,
      transfersOut:    p.transfers_out_event  || 0,
    };
    elementData[p.id] = p;
  });

  /* ── pre-sort price risers / fallers (expensive, do once) ─── */
  const priceRisers  = allElements
    .filter(e => e.cost_change_event > 0)
    .sort((a, b) => b.cost_change_event - a.cost_change_event)
    .slice(0, 25)
    .map(e => e.id);

  const priceFallers = allElements
    .filter(e => e.cost_change_event < 0)
    .sort((a, b) => a.cost_change_event - b.cost_change_event)
    .slice(0, 25)
    .map(e => e.id);

  /* ── pre-compute template top30 ──────────────────────────── */
  const top30 = allElements
    .slice()
    .sort((a, b) => b.selected_by_percent - a.selected_by_percent)
    .slice(0, 30)
    .map(e => e.id);

  /* ── current gameweek ────────────────────────────────────── */
  const ev = d.events.find(e => e.is_current)
           || d.events.find(e => e.is_next)
           || d.events[0];

  return {
    playerMap,
    teamMap,
    elementData,
    allElements,
    priceRisers,
    priceFallers,
    top30,
    totalPlayers: d.total_players || 0,
    currentGW:   ev.id,
    gwAvg:       ev.average_entry_score || 0,
    gwHigh:      ev.highest_score       || 0,
  };
}
