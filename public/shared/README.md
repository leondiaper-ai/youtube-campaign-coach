# Shared deep-dive patterns

Campaign deep dives are self-contained static pages by design — one file
each, no build step, openable from anywhere. That is worth keeping. But a
few things are genuinely the same across all of them, and those live here
so there is one copy rather than ten.

## `analysis-sheet.css` + `analysis-sheet.js`

**The house pattern for the working behind a deep dive.**

Every deep dive is a dark, photographic deck, and every one has a body of
analysis behind it. That analysis kept ending up in one of two bad places:
at the foot of the scroll, where the deck then ends on apparatus instead
of on the recommendation; or nowhere, which makes the page
unfalsifiable.

The answer — first built for Amyl, standard from September 2026 — is a
**light document behind a fixed ANALYSIS control, top right.** The change
in ground is the point: you are not in the deck any more, you are in the
evidence.

### Wiring it up

```html
<link rel="stylesheet" href="/shared/analysis-sheet.css">

<!-- in the deck's :root, name the accent it should use -->
:root{ --an-accent: var(--gold); }
```

```html
<div class="deck"> … slides … </div>

<button class="an-btn" id="an-open">Analysis</button>

<div class="an-panel" id="an-panel" role="dialog" aria-modal="true"
     aria-label="Analysis appendix">
  <div class="an-in">
    <button class="an-back">← Back to the review</button>
    <h2>Analysis appendix</h2>
    <div class="an-sub">One line of provenance and date</div>

    <h3>Section heading</h3>
    <table>
      <tr><th>Measure</th><th>Value</th></tr>
      <tr class="lead"><td>The one that matters</td><td class="n up">18 / 20</td></tr>
    </table>
    <p>The sentence that reads the table.</p>

    <div class="an-note"><b>The objection to raise first.</b> …</div>

    <dl><dt>Method heading</dt><dd>…</dd></dl>
    <button class="an-back">← Back to the review</button>
  </div>
</div>

<script src="/shared/analysis-sheet.js"></script>
```

### The classes

| Class | Use |
|---|---|
| `td.n` | A figure. Display face, full weight, never wrapped. |
| `td.up` `td.dn` | Direction, where direction is the point. |
| `td.miss` | An absent asset — an em dash in the accent red. |
| `tr.lead` | The row the section exists for. |
| `.an-note` | A caveat, called out rather than buried. |
| `.an-fair` | The measures a cross-era comparison may rest on. |

### What belongs in a sheet

1. **Every figure the deck asserts**, as a row someone can disagree with.
2. **Sample sizes inside the table**, not in a footnote.
3. **The claim boundary in words.** What the page does *not* claim is
   usually the most useful paragraph in the document.
4. **The objection a reviewer would raise first — raised by us.**
5. **A pointer to the audit pack**, where the raw rows, the
   classification rule and the judgement calls live.

### What does *not* belong in a sheet

The full methodology. We tried it on Angus & Julia Stone and it read as
a wall — eight dense definitions about duration thresholds and window
boundaries, in the document people open to check a number. Sources and
the claim boundary in plain sentences; everything else goes in the
audit pack, which exists precisely so the sheet does not have to carry
it.

### Two things learned the hard way

- **The deck is hidden, not covered.** `body.sheet-open .deck{display:none}`.
  An overlay sitting on a 12,000px document scrolls to slide one when the
  reader tries to reach the top of the thing they asked for.
- **The behaviour binds on `DOMContentLoaded` as well as inline.** The
  first version of this was appended after its own `<script>` and shipped
  as a button that rendered perfectly and did nothing at all.

### Adopted by

- `/angusandjuliastone` — Karaoke Bar, September 2026 (reference implementation)
- `/amyl` — the original, still on its own inline copy

### Still to convert

`/ezra`, `/chvrches`, `/kol`, `/palaye`, `/idles`, `/ktrap`,
`/venusgrrrls`, `/antonyszmierek`, `/dblock`. Each has analysis in a
different shape — some in a trailing section, some in a sheet of their
own, some not at all — so they are converted one at a time rather than
by find-and-replace.
