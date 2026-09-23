/* ═══════════════════════════════════════════════════════════════════
   THE ANALYSIS SHEET — behaviour
   Pairs with /shared/analysis-sheet.css. See that file for the markup.

   Bound on DOMContentLoaded as well as inline, because the first
   version of this was appended after its own <script> and shipped as
   a button that rendered perfectly and did nothing.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  function wire() {
    var btn = document.getElementById('an-open'),
        panel = document.getElementById('an-panel');
    if (!btn || !panel) return;

    function open() {
      panel.classList.add('open');
      document.body.classList.add('sheet-open');
      window.scrollTo(0, 0);
    }
    function shut() {
      panel.classList.remove('open');
      document.body.classList.remove('sheet-open');
      btn.focus();
    }

    btn.addEventListener('click', open);
    /* Every .an-back in the sheet closes it — there is one at the top
       and usually one at the foot, because a long document that can
       only be left from the top is a document you scroll twice. */
    panel.querySelectorAll('.an-back').forEach(function (b) {
      b.addEventListener('click', shut);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && panel.classList.contains('open')) shut();
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else { wire(); }
})();
