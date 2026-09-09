/**
 * /coach-home — the Campaign Coach attention layer.
 *
 * A new route rather than a change to Watcher. The brief says explicitly not
 * to redesign Watcher, and an additive page can be linked from it, ignored,
 * or removed without touching anything that already works.
 */

import CoachHome from '@/components/CoachHome';

export const dynamic = 'force-dynamic';

export default function Page() {
  return <CoachHome />;
}
