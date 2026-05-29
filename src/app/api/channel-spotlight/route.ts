/**
 * /api/channel-spotlight — Weekly Channel Spotlight data
 *
 * Identifies the top 2–5 best-performing Virgin-managed channels
 * using composite scoring (channel grade + growth + multiformat +
 * cadence + conversion). Returns enriched data with recent videos,
 * coach plan pipeline, and auto-generated narrative.
 *
 * Used by the Channel Spotlight page (/weekly-pulse/channel-spotlight).
 */

import { NextResponse } from 'next/server';
import {
  ARTISTS, mergeArtistLists, deriveFromLive,
  classifyArtist, isVirginOwned,
  type ChannelState, type RecentUpload,
} from '@/lib/artists';
import { listCustomArtists } from '@/lib/artistStore';
import { readAllLiveSnaps, readSyncMeta } from '@/lib/kvCache';
import { readHistory } from '@/lib/snapshots';
import { normalizeChannelData, rawDelta, computeWoW } from '@/lib/youtube/normalizeChannelData';
import { computeMultiformat } from '@/lib/contentStructure';
import { listPlans, loadPlan, type SavedPlan } from '@/lib/planStore';
import type { ParsedEvent } from '@/lib/planEngine';
import { calculateChannelScore, computeBenchmarkPool, type ChannelScoreInput } from '@/lib/channelScore';
import { classifyUploadFormat } from '@/lib/coach/matchEngine';

export const revalidate = 600;

export async function GET() {
  try {
    const custom = await listCustomArtists();
    const allArtists = mergeArtistLists(ARTISTS, custom);
    const syncMeta = await readSyncMeta();

    // Batch-read all cached snaps
    const handles = allArtists
      .map((a) => a.channelHandle)
      .filter(Boolean) as string[];
    const snapMap = await readAllLiveSnaps(handles);

    // Build row data for all artists (same as growth page)
    const rows = await Promise.all(
      allArtists.map(async (a) => {
        const snap = a.channelHandle ? (snapMap.get(a.channelHandle) ?? null) : null;
        const history = snap?.channelId && !snap.error ? await readHistory(snap.channelId) : [];
        const nc = normalizeChannelData(snap, history);
        const subs7Val = rawDelta(nc.subs7d);
        const views7Val = rawDelta(nc.views7d);
        const { deltaOver: deltaOverFn } = await import('@/lib/snapshots');
        const subs14Raw = deltaOverFn(history, 14, 'subs');
        const views14Raw = deltaOverFn(history, 14, 'views');
        const subsWoWResult = computeWoW(nc.subs7d, subs14Raw);
        const viewsWoWResult = computeWoW(nc.views7d, views14Raw);
        const derived = snap ? deriveFromLive(snap, { subs7Delta: subs7Val, views7Delta: views7Val }) : null;
        const status: ChannelState = derived?.status ?? 'COLD';
        const classification = classifyArtist(status, nc.cadence.uploads30d);

        return {
          slug: a.slug,
          name: a.name,
          isVirgin: isVirginOwned(a),
          subs: nc.subs,
          subs7Delta: subs7Val,
          views7Delta: views7Val,
          subsWoW: subsWoWResult?.value ?? null,
          viewsWoW: viewsWoWResult?.value ?? null,
          uploads30d: nc.cadence.uploads30d,
          shorts30d: nc.cadence.shorts30d,
          status,
          classification,
          totalViews: nc.views,
          movementConfidence: nc.movementConfidence,
          multiformat: snap?.recentUploads ? computeMultiformat(snap.recentUploads) : undefined,
        };
      })
    );

    // ── Score & rank managed channels ────────────────────────────────────
    const managed = allArtists.filter((a) => isVirginOwned(a));
    const managedRows = rows.filter((r) => r.isVirgin);
    if (managedRows.length === 0) {
      return NextResponse.json({ channels: [], weekRange: '', generatedAt: new Date().toISOString() });
    }

    const inputs: ChannelScoreInput[] = managedRows.map((r) => ({
      views7Delta: r.views7Delta,
      subs7Delta: r.subs7Delta,
      uploads30d: r.uploads30d,
      shorts30d: r.shorts30d,
      lastUploadAt: null,
      subs: r.subs,
      totalViews: r.totalViews ?? null,
      prevViews7Delta: null,
      movementConfidence: r.movementConfidence,
    }));
    const pool = computeBenchmarkPool(inputs);
    const scored = managedRows.map((r, i) => ({
      row: r,
      score: calculateChannelScore(inputs[i], pool),
    }));

    // ── Minimum thresholds ─────────────────────────────────────────
    // Channels must have real scale + genuine activity to qualify.
    // The spotlight should show channels that are performing at
    // meaningful scale — not micro channels where small gains
    // look disproportionate.
    const MIN_SUBS = 1000;
    const MIN_VIEWS_7D = 5000;
    const MIN_UPLOADS_30D = 3;

    const qualified = scored.filter(({ row }) => {
      if ((row.subs ?? 0) < MIN_SUBS) return false;
      if ((row.views7Delta ?? 0) < MIN_VIEWS_7D) return false;
      if (row.uploads30d < MIN_UPLOADS_30D) return false;
      if (row.status === 'COLD') return false;
      return true;
    });

    // ── Composite spotlight score ────────────────────────────────
    // Focuses on the four pillars that make a channel genuinely
    // "spotlight-worthy": cadence, format diversity, scale, and conversion.
    //
    // Views scale matters here — this is a performance report, so
    // a channel doing 229K views/week IS performing better than
    // one doing 2.8K views/week, all else equal.
    const withComposite = qualified.map(({ row, score }) => {
      let composite = 0;

      // ── 1. Cadence (max 20) ─────────────────────────────────
      if (row.uploads30d >= 10) composite += 20;
      else if (row.uploads30d >= 6) composite += 14;
      else if (row.uploads30d >= 3) composite += 8;

      // ── 2. Multi-format strategy (max 25) ───────────────────
      if (row.multiformat?.score === 'Strong') composite += 25;
      else if (row.multiformat?.score === 'Good') composite += 18;
      else if (row.multiformat?.score === 'Partial') composite += 8;

      // ── 3. Views scale (max 30) ─────────────────────────────
      // Performance report — real reach matters
      const v7 = row.views7Delta ?? 0;
      if (v7 >= 200000) composite += 30;
      else if (v7 >= 100000) composite += 25;
      else if (v7 >= 50000) composite += 20;
      else if (v7 >= 20000) composite += 14;
      else if (v7 >= 10000) composite += 8;
      else if (v7 >= 5000) composite += 4;

      // ── 4. Subscriber conversion (max 15) ───────────────────
      const s7 = row.subs7Delta ?? 0;
      if (s7 >= 500) composite += 15;
      else if (s7 >= 100) composite += 12;
      else if (s7 > 0) composite += 8;

      // ── Bonuses ─────────────────────────────────────────────
      // Growing classification — channel health system agrees
      if (row.classification === 'GROWING') composite += 10;
      // High channel score grade (execution quality)
      if (score.grade === 'A') composite += 8;
      else if (score.grade === 'B') composite += 4;

      // ── Mild penalties ──────────────────────────────────────
      // Stale data — mild penalty, don't crush active channels
      if (row.movementConfidence === 'stale') composite -= 5;

      return { row, score, composite };
    });

    // Take top 5, but only if they clear the bar (composite >= 40).
    // Better to show 2 genuinely strong channels than 5 padded with weak ones.
    const top = withComposite
      .filter((c) => c.composite >= 40)
      .sort((a, b) => b.composite - a.composite)
      .slice(0, 5);

    // ── Load coach plans ─────────────────────────────────────────────────
    const planIndex = await listPlans();
    const norm = (s: string) => s.replace(/-/g, '');
    const coachPlans = new Map<string, SavedPlan>();
    for (const entry of planIndex) {
      const planNorm = norm(entry.slug);
      for (const { row } of top) {
        const artistNorm = norm(row.slug);
        if (planNorm.startsWith(artistNorm) || artistNorm.startsWith(planNorm)) {
          if (!coachPlans.has(row.slug)) {
            const plan = await loadPlan(entry.slug);
            if (plan) coachPlans.set(row.slug, plan);
          }
        }
      }
    }

    const cleanTitle = (t: string) =>
      t.replace(/^[,\s]*\d{4}\s*[–—-]\s*/, '').replace(/^[,\s]+/, '').trim();

    const eventPriority = (kind: string, title: string): number => {
      const t = title.toLowerCase();
      if (kind === 'albumRelease' || kind === 'albumAnnounce') return 100;
      if (kind === 'singleRelease') return 100;
      if (kind === 'documentaryRelease') return 100;
      if (/\bofficial\s*(music\s*)?video\b/.test(t)) return 100;
      if (/\blongform\b/.test(t)) return 100;
      if (kind === 'documentaryTease') return 80;
      if (/\btrailer\b/.test(t)) return 80;
      if (/\b(bts|behind\s*the\s*scenes)\b/.test(t)) return 80;
      if (/\bvisuali[sz]er\b/.test(t)) return 80;
      if (/\blyric\s*video\b/.test(t)) return 80;
      if (/\b(live\s*session|acoustic|performance\s*video)\b/.test(t)) return 80;
      if (/\bpremiere\b/.test(t)) return 80;
      if (kind === 'collab') return 60;
      if (kind === 'snippet') return 60;
      if (/\b(community|shorts|fan\s*content|reaction)\b/.test(t)) return 60;
      if (kind === 'festival' || kind === 'tourDate' || kind === 'liveShow' || kind === 'tourAnnounce') return 30;
      if (kind === 'promoTrip' || kind === 'podcast') return 30;
      if (/\b(radio|press|interview)\b/.test(t)) return 30;
      return 60;
    };

    // ── Enrich each top channel ──────────────────────────────────────────
    const now = Date.now();
    const channels = top.map(({ row, score, composite }) => {
      const artist = managed.find((a) => a.slug === row.slug);
      const snap = artist?.channelHandle ? (snapMap.get(artist.channelHandle) ?? null) : null;
      const longform30d = row.uploads30d - row.shorts30d;

      // Recent videos — latest content, mixing longform + Shorts
      // Sorted by publish date (newest first), then curated to show
      // the most recent longform AND most recent Shorts — not just
      // whatever has the highest all-time velocity.
      const recentVideos: any[] = [];
      if (snap?.recentUploads) {
        const cutoff = 30 * 86400000;
        const eligible: any[] = [];
        for (const u of snap.recentUploads) {
          const ageMs = now - new Date(u.publishedAt).getTime();
          if (ageMs > cutoff || ageMs < 0) continue;
          const daysAgo = Math.max(1, Math.floor(ageMs / 86400000));
          const velocity = Math.round(u.viewCount / daysAgo);
          const isShort = u.durationSec <= 62;
          let format = 'Upload';
          try { format = classifyUploadFormat(u); } catch { /* fallback */ }
          eligible.push({
            id: u.id, title: u.title, views: u.viewCount, velocity, daysAgo,
            format: typeof format === 'string' ? format : 'Upload', isShort,
            thumbnail: `https://i.ytimg.com/vi/${u.id}/mqdefault.jpg`,
            publishedAt: u.publishedAt,
          });
        }

        // Sort by publish date (newest first)
        eligible.sort((a: any, b: any) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

        // Pick latest longform (up to 3) and latest Shorts (up to 3),
        // then interleave — newest content first, mixed formats
        const longform = eligible.filter((v: any) => !v.isShort);
        const shorts = eligible.filter((v: any) => v.isShort);
        const picked = new Set<string>();

        // Take up to 3 latest longform
        for (const v of longform.slice(0, 3)) {
          recentVideos.push(v);
          picked.add(v.id);
        }
        // Take up to 2 latest Shorts (3 if no longform)
        const shortsSlots = longform.length === 0 ? 5 : Math.min(5 - recentVideos.length, 3);
        for (const v of shorts.slice(0, shortsSlots)) {
          if (!picked.has(v.id)) {
            recentVideos.push(v);
            picked.add(v.id);
          }
        }

        // Re-sort final list by publish date (newest first)
        recentVideos.sort((a: any, b: any) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
        recentVideos.splice(5);
      }

      // Coach plan moments
      const coachPlan = coachPlans.get(row.slug);
      let currentMoment: string | null = null;
      let nextMoment: string | null = null;
      let upcomingMoment: string | null = null;
      if (coachPlan?.plan?.events) {
        const enriched = coachPlan.plan.events.map((e: ParsedEvent) => {
          const d = new Date(e.dateISO + 'T00:00:00');
          const diff = Math.round((d.getTime() - now) / 86400000);
          const title = cleanTitle(e.title);
          return { ...e, title, diff, priority: eventPriority(e.kind, title) };
        });
        const upcoming = enriched
          .filter((e) => e.diff >= -7 && e.priority >= 60) // YouTube content moments only
          .sort((a, b) => b.priority - a.priority || a.diff - b.diff);

        const fmtEvtDate = (iso: string) =>
          new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

        if (upcoming.length > 0) currentMoment = `${upcoming[0].title} — ${fmtEvtDate(upcoming[0].dateISO)}`;
        if (upcoming.length > 1) nextMoment = `${upcoming[1].title} — ${fmtEvtDate(upcoming[1].dateISO)}`;
        if (upcoming.length > 2) upcomingMoment = `${upcoming[2].title} — ${fmtEvtDate(upcoming[2].dateISO)}`;
      }

      const subsPer1kViews =
        row.views7Delta != null && row.views7Delta > 0 && row.subs7Delta != null
          ? (row.subs7Delta / row.views7Delta) * 1000
          : null;

      // Ecosystem signal — stricter: Full Ecosystem requires Strong multiformat
      // (anchor content + Shorts + supporting formats), not just Shorts + longform
      let ecosystemSignal = 'Getting Started';
      if (row.multiformat?.score === 'Strong') {
        ecosystemSignal = 'Full Ecosystem'; // Anchor + Shorts + 2+ supporting formats
      } else if (row.multiformat?.score === 'Good') {
        ecosystemSignal = 'Multi-Format Active'; // Anchor + Shorts + 1 supporting
      } else if (row.multiformat?.score === 'Partial') {
        ecosystemSignal = row.shorts30d > 0 ? 'Shorts Momentum' : 'Building';
      } else if (row.uploads30d >= 2) {
        ecosystemSignal = 'Building';
      }

      // Auto-generate "what's working" notes
      const whatsWorking: string[] = [];
      if (row.classification === 'GROWING') {
        whatsWorking.push('Channel classified as GROWING — positive momentum across cadence and conversion.');
      }
      if (ecosystemSignal === 'Full Ecosystem') {
        whatsWorking.push(`Multi-format strategy active: ${row.shorts30d} Shorts + ${longform30d} longform in 30 days. Shorts driving discovery, longform building depth.`);
      } else if (row.shorts30d > 0 && longform30d > 0) {
        whatsWorking.push(`Multi-format mix: ${row.shorts30d} Shorts + ${longform30d} longform in 30 days.`);
      }
      if (subsPer1kViews != null && subsPer1kViews >= 3) {
        whatsWorking.push(`Strong conversion at ${subsPer1kViews.toFixed(1)} subs per 1K views — audience is subscribing.`);
      }
      if (recentVideos.length > 0 && recentVideos[0].velocity >= 3000) {
        const topV = recentVideos[0];
        whatsWorking.push(`Top content: "${topV.title}" averaging ${Math.round(topV.velocity).toLocaleString()} views/day.`);
      }
      if (recentVideos.length >= 2) {
        const hasOfficial = recentVideos.some((v: any) =>
          /official|music video/i.test(v.format) || /official/i.test(v.title)
        );
        const hasSupport = recentVideos.some((v: any) =>
          v.isShort || /live|session|bts|behind/i.test(v.format) || /visuali|lyric/i.test(v.format)
        );
        if (hasOfficial && hasSupport) {
          whatsWorking.push('Follow-through content active — official video supported by additional uploads keeping recommendations alive.');
        }
      }
      if (row.uploads30d >= 8) {
        whatsWorking.push(`Strong upload cadence of ${row.uploads30d} uploads in 30 days — well above roster average.`);
      }

      const statusLabel = row.classification === 'GROWING' ? 'GROWING' : row.status;
      let headline = `${statusLabel} status with ${ecosystemSignal.toLowerCase()} signal. `;
      if (row.uploads30d >= 8 && (row.subs7Delta ?? 0) > 0) {
        headline += 'Strong execution across cadence, format diversity, and audience conversion.';
      } else if (row.uploads30d >= 4 && ecosystemSignal === 'Full Ecosystem') {
        headline += 'Multi-format content strategy building sustainable momentum.';
      } else if ((row.subs7Delta ?? 0) > 0) {
        headline += 'Converting viewers into subscribers — positive trajectory.';
      } else {
        headline += 'Active channel with room to accelerate cadence and conversion.';
      }

      // Content format tags — which YouTube formats are active (last 90d)
      const contentFormats: string[] = [];
      const mf = row.multiformat;
      if (mf) {
        if (mf.hasOfficialVideo) contentFormats.push('Official Video');
        if (mf.hasLyricVideo) contentFormats.push('Lyric Video');
        if (mf.hasVisualizer) contentFormats.push('Visualiser');
        if (mf.hasBTS) contentFormats.push('BTS');
        if (mf.hasLiveSession) contentFormats.push('Live Session');
        if (mf.hasShorts) contentFormats.push('Shorts');
      }
      // Also check recent videos for formats not caught by multiformat detection
      for (const v of recentVideos) {
        const fmt = (v as any).format as string;
        if (/collab/i.test(fmt) && !contentFormats.includes('Collab')) contentFormats.push('Collab');
        if (/premiere/i.test(fmt) && !contentFormats.includes('Premiere')) contentFormats.push('Premiere');
        if (/trailer/i.test(fmt) && !contentFormats.includes('Trailer')) contentFormats.push('Trailer');
      }

      // Hero image: top video thumbnail, fallback to channel avatar
      const heroImage = recentVideos.length > 0
        ? `https://i.ytimg.com/vi/${recentVideos[0].id}/hqdefault.jpg`
        : snap?.thumbnail ?? null;

      return {
        slug: row.slug, name: row.name, subs: row.subs,
        subs7d: row.subs7Delta, views7d: row.views7Delta,
        viewsWoW: row.viewsWoW, subsPer1kViews,
        uploads30d: row.uploads30d, shorts30d: row.shorts30d, longform30d,
        status: row.status, classification: row.classification,
        multiformatScore: row.multiformat?.score ?? null,
        ecosystemSignal, headline, whatsWorking, recentVideos,
        hasCoachPlan: !!coachPlan,
        currentMoment, nextMoment, upcomingMoment,
        grade: score.grade, scoreLabel: score.label,
        spotlightScore: composite,
        thumbnail: snap?.thumbnail ?? null,
        channelHandle: artist?.channelHandle ?? null,
        heroImage,
        contentFormats,
      };
    });

    // Week range
    const d = new Date();
    const dayOfWeek = d.getDay();
    const mon = new Date(d); mon.setDate(d.getDate() - ((dayOfWeek + 6) % 7));
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    const fmt = (dt: Date) => dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    const weekRange = `${fmt(mon)} – ${fmt(sun)} ${sun.getFullYear()}`;

    return NextResponse.json({
      channels,
      weekRange,
      generatedAt: new Date().toISOString(),
      totalManaged: managedRows.length,
      syncMeta: syncMeta ? {
        lastSyncAt: syncMeta.lastSyncAt,
        artistsSuccess: syncMeta.artistsSuccess,
        artistsTotal: syncMeta.artistsTotal,
      } : null,
    });
  } catch (err) {
    console.error('[channel-spotlight] Error:', err);
    return NextResponse.json({ error: 'Failed to compute spotlight' }, { status: 500 });
  }
}
