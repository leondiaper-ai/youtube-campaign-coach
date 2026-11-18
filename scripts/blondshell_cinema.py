"""Night-mode, image-led pass for the Blondshell deck (18 Nov 2026).

Full-bleed cover with a weekly cadence strip, a wall of her latest Shorts on the
channel slide, the readout as three tall photo panels, hi-res YouTube frames
everywhere (local thumbnails as fallback) and a dark Violins-at-night skin.
No new figures: everything is computed from the 17 Nov capture already loaded.
"""
import datetime as dt,re

def cinema(orig,by,make,head,fmt,note,tag,E):
 def d(v):return dt.date.fromisoformat(v['publishedAt'][:10])
 def src(id):
  v=by.get(id);sh=bool(v) and 0<v['durationSec']<=62
  return f'https://i.ytimg.com/vi/{id}/{"oar2" if sh else "maxresdefault"}.jpg'
 def img(id,alt,cls=''):
  fb=f'/blondshell/images/{id}.jpg'
  return f'<img class="{cls}" src="{src(id)}" onerror="this.onerror=null;this.src=\'https://i.ytimg.com/vi/{id}/hqdefault.jpg\'" alt="{E(alt)}" loading="eager">'

 # 1 · cover: full-bleed portrait + weekly cadence strip
 A,R,END=dt.date(2026,5,14),dt.date(2026,9,25),dt.date(2026,11,17)
 bins=[[0,0] for _ in range((END-A).days//7+1)]
 for v in by.values():
  if not v['durationSec']:continue
  x=d(v)
  if A<=x<=END:bins[(x-A).days//7][0 if v['durationSec']>62 else 1]+=1
 assert sum(a for a,b in bins)==11 and sum(b for a,b in bins)==99,bins
 mx=max(a+b for a,b in bins);rw=(R-A).days//7
 def cell(n,a,b):
  k='rel' if n==rw else 'full' if a else 'sh'
  wk=(A+dt.timedelta(days=7*n)).strftime('%-d %b')
  return f'<i class="{k}" style="height:{max(5,round(100*(a+b)/mx))}%" title="Week of {wk}: {a} full-song, {b} Shorts"></i>'
 cells=''.join(cell(n,a,b) for n,(a,b) in enumerate(bins))
 orig['intro']=('<section class="slide cover dark night-cover" id="intro" data-title="Violins · a channel and campaign review">'
  '<img class="cover-bg" src="/blondshell/images/portrait.jpg" alt="Blondshell portrait by Reese Layton" fetchpriority="high"><div class="cover-shade"></div>'
  '<div class="inner"><span class="mono">Virgin Music Group × Partisan Records · YouTube deep dive · 18 Nov 2026</span>'
  '<p class="cover-artist">blondshell</p><h1 class="cover-record">violins</h1>'
  '<p class="cover-line">The songs are there.<br><span>Give them a second life.</span></p>'
  f'<div class="cadence"><div class="cad-bars">{cells}</div><div class="cad-key"><span><i class="full"></i>full song</span><span><i class="rel"></i>album day</span><span><i class="sh"></i>Shorts only</span><span class="cad-range">every week · 14 May → 17 Nov 2026</span></div></div>'
  '</div><div class="folio"><span>Blondshell × YouTube · Partisan Records</span><span>01 / Violins · a channel and campaign review</span></div></section>')

 # 2 · channel: stats beside a wall of her latest uploads (all Shorts)
 recent=sorted([v for v in by.values() if v['durationSec'] and d(v)<=END],key=lambda v:v['publishedAt'],reverse=True)[:8]
 assert all(0<v['durationSec']<=62 for v in recent)
 wall=''.join(f'<a class="wall-tile" href="https://www.youtube.com/shorts/{v["id"]}" target="_blank" rel="noopener">{img(v["id"],v["title"])}<span>{d(v).strftime("%-d %b")}</span></a>' for v in recent)
 orig['channel']=make('channel','The channel today',head('Channel today · captured 17 November','Active in Shorts.<br><span class="serif">Quiet in full songs.</span>')
  +f'<div class="ch-grid mt"><div class="ch-stats"><div><b>14<small>/14</small></b><span>uploads in the last 30 days are Shorts</span></div><div><b>25 Sep</b><span>last full-song upload · album day</span></div><div class="ch-pair"><p><b>18.8k</b> subscribers</p><p><b>8.52m</b> channel views</p></div></div>'
  +f'<div class="ch-wall"><span class="mono">Her latest eight uploads · all Shorts</span><div class="wall">{wall}</div></div></div>'
  +note('API + WATCHER','30-day window 19 Oct–17 Nov. Watcher: 22 observations from 27 Oct; the channel counter repeats unchanged 9–17 Nov, so no growth rate is claimed.'))

 # 3 · the readout as three tall panels
 def panel(cls,id,alt,status,mono,big,unit,text):
  return (f'<a class="pnl {cls}" href="https://www.youtube.com/watch?v={id}" target="_blank" rel="noopener">{img(id,alt)}{status}'
   f'<div class="pnl-txt"><span class="mono">{mono}</span><b class="pnl-big">{big}</b><span class="pnl-unit">{unit}</span><p>{text}</p></div></a>')
 assert by['ytdwKm-dJyg']['views']+by['7M9A_sVI4BI']['views']==236044
 orig['verdict']=make('verdict','The readout',head('The readout · day 53','Violins arrived complete.<br><span class="serif">The second chapter hasn’t started.</span>')
  +'<div class="pnls mt">'
  +panel('pnl-works','7M9A_sVI4BI','Stone Fruit music video',tag('on'),'What works','11<small>/11</small>','songs live by release day','The two music videos hold <b>59.6%</b> of album-video viewing.')
  +panel('pnl-fix','R_1iHTmZ90k','Two Fried Short',tag('on','Short'),'What needs fixing','0','new full-song versions since release','<b>24</b> Shorts instead. And the album playlist plays a pitch copy of Stone Fruit.')
  +panel('pnl-do','h0bN0GGLJSQ','Stone Fruit on XMU',tag('prop','Proposed'),'What to do first','1','full Stone Fruit performance','Fix the album playlists first. Then two Shorts a week to 17 January.')
  +'</div>'+note('API → INFERENCE','Lifetime counters at 17 Nov capture. The XMU full take, its rights and edit are unconfirmed.'))

 # 4 · hi-res frames everywhere else (local thumbnail as fallback)
 def up(m):
  cls,id=m.group(1) or '',m.group(2)
  return f'<img {cls}src="{src(id)}" onerror="this.onerror=null;this.src=\'/blondshell/images/{id}.jpg\'"'
 for k in orig:
  if k in('intro','channel','verdict'):continue
  orig[k]=re.sub(r'<img (class="[^"]*" )?src="/blondshell/images/([\w-]{11})\.jpg"',up,orig[k])

 orig['rollout']=orig['rollout'].replace('Sand · Shorts &nbsp; Olive · full songs','Grey · Shorts &nbsp; Yellow · full songs').replace('sand Shorts, olive full-song uploads','grey Shorts, yellow full-song uploads')
 # 5 · night mode for all but the three data-dense slides
 for k in orig:
  if k in('intro','last-album','fixes','roadmap'):continue
  orig[k]=re.sub(r'<section class="slide\b','<section class="slide dark',orig[k],count=1)
