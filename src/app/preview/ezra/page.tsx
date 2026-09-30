/* ═══════════════════════════════════════════════════════════════════════
   RETIRED — the prototype became the production page.

   This route held a hand-built preview of a redesigned artist page. That
   design now IS /watcher/[slug] for every artist, built from the shared
   components in components/artist/, so a second copy of it here would only
   drift out of date and start contradicting the real page.

   The route survives as a redirect because the URL was circulated while
   the design was being reviewed, and a dead link from that conversation is
   worse than one more file.
   ═══════════════════════════════════════════════════════════════════════ */

import { redirect } from 'next/navigation';

export default function EzraPreviewPage() {
  redirect('/watcher/ezra-collective');
}
