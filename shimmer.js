/* SHIMMER.JS — IMPROVEMENTS */

/* ════════════════════════════════════════════════════════════════════ */
/* FIND THIS IN YOUR _injectStyles() FUNCTION */
/* ════════════════════════════════════════════════════════════════════ */

/* BEFORE: */
s.textContent = `
  @keyframes _kfl_sweep {
    0%   { background-position: -600px 0; }
    100% { background-position:  600px 0; }
  }
  .kskel {
    background: linear-gradient(
      90deg,
      var(--surface-2, rgba(255,255,255,0.04)) 25%,
      var(--surface-3, rgba(255,255,255,0.09)) 50%,
      var(--surface-2, rgba(255,255,255,0.04)) 75%
    );
    background-size: 1200px 100%;
    animation: _kfl_sweep 1.5s ease-in-out infinite;
    border-radius: 6px;
  }
  .kskel-card { ... }
  .kskel-row { ... }
  .kskel-match { ... }
`;


/* AFTER: ADD THIS AT THE END */
s.textContent = `
  @keyframes _kfl_sweep {
    0%   { background-position: -600px 0; }
    100% { background-position:  600px 0; }
  }
  .kskel {
    background: linear-gradient(
      90deg,
      var(--surface-2, rgba(255,255,255,0.04)) 25%,
      var(--surface-3, rgba(255,255,255,0.09)) 50%,
      var(--surface-2, rgba(255,255,255,0.04)) 75%
    );
    background-size: 1200px 100%;
    animation: _kfl_sweep 1.5s ease-in-out infinite;
    border-radius: 6px;
  }
  .kskel-card { ... }
  .kskel-row { ... }
  .kskel-match { ... }
  
  /* NEW: Constrain shimmer containers to safe content area */
  .kskel-container {
    position: relative;
    max-width: 700px;
    margin: 0 auto;
    overflow: hidden;
  }
`;


/* ════════════════════════════════════════════════════════════════════ */
/* WHAT TO ADD */
/* ════════════════════════════════════════════════════════════════════ */

/* Just add this CSS to the style injection:

      /* FIX: Constrain shimmer containers to content area */
      .kskel-container {
        position: relative;
        /* Ensure the container is within the page-content bounds */
        max-width: 700px;
        margin: 0 auto;
        /* Prevent shimmer from extending beyond safe area */
        overflow: hidden;
      }
*/


/* ════════════════════════════════════════════════════════════════════ */
/* OPTIONAL: UPDATE YOUR PAGE CODE */
/* ════════════════════════════════════════════════════════════════════ */

/* When calling shimmer functions, you can now optionally wrap 
   containers with the constraint class:

   BEFORE:
   const container = document.getElementById('leagues-list');
   window.KflShimmer.leagues(container);

   AFTER (optional):
   const container = document.getElementById('leagues-list');
   container.classList.add('kskel-container');
   window.KflShimmer.leagues(container);
*/


/* ════════════════════════════════════════════════════════════════════ */
/* WHY THESE CHANGES */
/* ════════════════════════════════════════════════════════════════════ */

.kskel-container {
  position: relative;
  /* 
     Establishes a new positioning context so child elements
     respect this boundary (defensive measure)
  */

  max-width: 700px;
  /* 
     Matches your .page-content max-width
     Prevents shimmer from ever exceeding content width
  */

  margin: 0 auto;
  /* 
     Centers the shimmer within viewport
     Maintains symmetrical layout
  */

  overflow: hidden;
  /* 
     If any content tries to escape, it gets clipped
     Ensures shimmer never bleeds into nav areas
  */
}


/* ════════════════════════════════════════════════════════════════════ */
/* BACKWARD COMPATIBLE */
/* ════════════════════════════════════════════════════════════════════ */

✓ Your existing shimmer functions work exactly as before
✓ Only adds optional constraint class
✓ No breaking changes
✓ No changes needed to existing page code
✓ The .kskel-container class is optional — shimmer works fine without it
✓ Safe to deploy immediately
