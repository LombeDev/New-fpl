/**
 * haptic.js — Kopala FPL
 * ─────────────────────────────────────────────────────────────
 * Vibration API wrapper with named patterns for every meaningful
 * interaction. Gracefully silent on unsupported devices.
 *
 * Usage:
 *   Haptic.tap()         — nav tap, button press
 *   Haptic.success()     — transfer confirmed, action done
 *   Haptic.warning()     — deadline < 1hr, injury alert
 *   Haptic.error()       — failed action
 *   Haptic.score()       — new points scored (live widget update)
 *   Haptic.expand()      — widget / card opens
 *   Haptic.dismiss()     — card / modal dismissed
 *
 * Auto-wires to:
 *   - .kfl-bottom-nav__item  (nav taps)
 *   - [data-haptic]          (any element with data-haptic="tap|success|...")
 */

(function () {
  'use strict';

  /* ── Check support ── */
  const supported = 'vibrate' in navigator;

  /* ── Patterns (ms on/off pairs) ── */
  const PATTERNS = {
    tap:      [8],               // single very short — nav, button
    success:  [10, 60, 20],      // double pulse — confirmed action
    warning:  [30, 80, 30],      // two medium — deadline warning
    error:    [50, 40, 50, 40, 50], // triple — failed action
    score:    [12, 50, 12],      // soft double — live score update
    expand:   [6],               // barely-there — open card
    dismiss:  [4],               // ghost — close/swipe away
  };

  /* ── Core fire ── */
  function fire(pattern) {
    if (!supported) return;
    try { navigator.vibrate(pattern); } catch (_) {}
  }

  /* ── Named API ── */
  const Haptic = {
    tap:     () => fire(PATTERNS.tap),
    success: () => fire(PATTERNS.success),
    warning: () => fire(PATTERNS.warning),
    error:   () => fire(PATTERNS.error),
    score:   () => fire(PATTERNS.score),
    expand:  () => fire(PATTERNS.expand),
    dismiss: () => fire(PATTERNS.dismiss),
    custom:  (pattern) => fire(pattern),
  };

  /* ── Auto-wire bottom nav ── */
  function wireNav() {
    document.querySelectorAll('.kfl-bottom-nav__item').forEach(el => {
      if (el.dataset.hapticWired) return;
      el.dataset.hapticWired = '1';
      el.addEventListener('touchstart', () => Haptic.tap(), { passive: true });
    });
  }

  /* ── Auto-wire [data-haptic] elements ── */
  function wireDataAttrs() {
    document.querySelectorAll('[data-haptic]').forEach(el => {
      if (el.dataset.hapticWired) return;
      el.dataset.hapticWired = '1';
      const type = el.dataset.haptic || 'tap';
      const fn = Haptic[type] || Haptic.tap;
      el.addEventListener('touchstart', fn, { passive: true });
    });
  }

  /* ── Observe DOM for late-rendered elements ── */
  const observer = new MutationObserver(() => {
    wireNav();
    wireDataAttrs();
  });

  function init() {
    wireNav();
    wireDataAttrs();
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* ── Expose globally ── */
  window.Haptic = Haptic;

})();
