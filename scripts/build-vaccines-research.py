"""Freeze the Vaccines review from the existing Watcher catalogue + history APIs.

Usage: python scripts/build-vaccines-research.py /tmp/vaccines-catalogue.json /tmp/vaccines-history.json
Descriptions are read for format checks but never republished (they contain lyrics).
"""
import json
import sys
from pathlib import Path
from statistics import median

root = Path(__file__).resolve().parents[1]
catalogue = json.loads(Path(sys.argv[1]).read_text())
history = json.loads(Path(sys.argv[2]).read_text())
assert catalogue['channel']['id'] == 'UCWLY9PpOMnI3Q66zwZdyzyA'
assert not catalogue['capped']
overrides = {
    'nIplJnJLre0': 'Music video',
    'KPCzMoANomA': 'Primary visualiser',
    'ncS6WWSWguI': 'Primary visualiser',
    'R4VTfu95HHc': 'Primary visualiser',
    'U-AgIXURXwI': 'Primary visualiser',
    '0tG2LZWE91E': 'Lyric visualiser',
    'G336e0fn_6s': 'Lyric visualiser',
    'aoQ0KVHNNgg': 'Lyric visualiser',
}
rows = [{k: v[k] for k in ['id', 'title', 'publishedAt', 'durationSec', 'views', 'likes', 'comments', 'actualStart', 'scheduledStart']} for v in catalogue['videos']]
for row in rows:
    if row['id'] in overrides:
        row['reviewedFormat'] = overrides[row['id']]
        row['classificationBasis'] = 'Title and first line of source description; reviewed 2026-11-09.'
window = [v for v in rows if '2023-09-20' <= v['publishedAt'][:10] <= '2024-04-12']
assets = [v for v in window if v['id'] in overrides]
clips = [v for v in window if 0 < v['durationSec'] <= 62]
pre = [v for v in window if v['publishedAt'][:10] <= '2024-01-12']
post = [v for v in window if v['publishedAt'][:10] > '2024-01-12']
debut_ids = ['uQKjI6395iU', 'dU9hrd35Dsg', '8VI3q4T-1Jc', '5tr5ptnUoDE', '0sOq6Rrre7c', '_PfE9iLBvkU']
assert len(assets) == 8 and len(clips) == 20 and len(window) == 28
groups = []
for name in ['Music video', 'Primary visualiser', 'Lyric visualiser']:
    group = [v for v in assets if v['reviewedFormat'] == name]
    groups.append({'name': name, 'count': len(group), 'views': sum(v['views'] for v in group), 'ids': [v['id'] for v in group]})
out = {
    'capturedAt': catalogue['fetchedAt'],
    'channel': catalogue['channel'],
    'source': '/api/full-catalogue?handle=%40thevaccinesuk&desc=full',
    'historySource': '/api/debug/snapshots?handle=%40thevaccinesuk',
    'releaseSource': 'https://shop.thevaccines.com/product/pick-up-full-of-pink-carnations',
    'releaseDate': '2024-01-12',
    'anniversary': {'debutReleaseMonth': '2011-03', 'anniversaryYear': 2026, 'years': 15, 'selectedDebutVideoIds': debut_ids, 'selectedDebutVideoViews': sum(v['views'] for v in rows if v['id'] in debut_ids), 'source': 'https://www.destroyalllines.com/tours/the-vaccines', 'note': 'Anniversary touring is already underway; the proposed warm-up continues the story. Selected lifetime video totals are not current demand or all album consumption.'},
    'cadence': {'throughAlbumDay': {'start': '2023-09-20', 'end': '2024-01-12', 'fullSongVideos': sum(v['id'] in overrides for v in pre), 'shortClips': sum(0 < v['durationSec'] <= 62 for v in pre)}, 'afterAlbumDay': {'start': '2024-01-13', 'end': '2024-04-12', 'weeks': 13, 'fullSongVideos': sum(v['id'] in overrides for v in post), 'shortClips': sum(0 < v['durationSec'] <= 62 for v in post)}, 'note': 'Retrieved public uploads, not a complete Topic/partner census. Proposed four full-video slots in six weeks are a future operating plan, not measured optimal cadence.'},
    'window': {'start': '2023-09-20', 'end': '2024-04-12', 'basis': 'Observed teaser through last retrieved 2024 clip; an analytical boundary, not an official campaign end.'},
    'coverage': {'retrieved': len(rows), 'playlistIds': catalogue['playlistIds'], 'capped': catalogue['capped'], 'visibleViews': sum(v['views'] for v in rows), 'note': 'Uploads playlist exhausted. OAC/linked uploads may exceed the channel publicVideoCount. Not a census of Topic, partner or fan channels.'},
    'campaign': {'assets': len(assets), 'views': sum(v['views'] for v in assets), 'formats': groups, 'clipCount': len(clips), 'clipViews': sum(v['views'] for v in clips), 'clipMedian': median(v['views'] for v in clips), 'lastLongform': '2024-01-12', 'representedTracks': 5, 'albumTracks': 10},
    'history': {'range': history['dateRange'], 'timeline': history['allViewsTimeline'], 'usableForPace': False, 'note': 'The same channel total repeats from 15 Oct to 8 Nov, followed by a refresh jump on 9 Nov. Do not interpret the displayed 910,965 delta as seven days of consumption or attribute it to an asset. No 2023–24 subscriber history is available.'},
    'limitations': ['Lifetime asset views as at capture, not views earned during the campaign.', 'No matched-age performance, paid/organic split, CTR, retention, unique viewers or asset-level subscriber attribution.', 'Short clips use the legacy duration proxy, not a verified Shorts-feed classification. 2024 and 2026 Shorts view definitions differ; do not compare raw counts across those periods.', 'No inference of platform eligibility, confirmed partner support, next-release date, production rights or clearance from public counts.'],
    'videos': rows,
}
dest = root / 'public/vaccines/research-2026-11-09.json'
dest.parent.mkdir(parents=True, exist_ok=True)
dest.write_text(json.dumps(out, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({k:v for k,v in out.items() if k not in ['videos','history']}, indent=2))
