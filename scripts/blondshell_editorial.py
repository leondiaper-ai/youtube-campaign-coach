"""Editorial pass for the Blondshell deck (18 Nov 2026).

Tightens the story to one line of argument:
  campaign landed complete -> no second chapter yet -> what her channel already
  proves works -> the moves -> the plan.
Every asset is tagged as on the channel, not on the channel, or proposed.
Uses only figures already present in the 17 Nov capture / 18 Nov signals file.
Long caveats live in Analysis; slides keep one evidence line each.
"""
import re,html

ON='<span class="st st-on">On the channel</span>'
GAP='<span class="st st-gap">Not on the channel</span>'
PROP='<span class="st st-prop">Proposed</span>'

def tag(kind,text=None):
 base={'on':('st-on','On the channel'),'gap':('st-gap','Not on the channel'),'prop':('st-prop','Proposed')}[kind]
 return f'<span class="st {base[0]}">{text or base[1]}</span>'

def edit(orig,by,make,head,fmt):
 E=lambda s:html.escape(str(s),quote=True)
 def note(kind,text):return f'<p class="source"><b>{kind}</b> · {text}</p>'
 def frame(id,title,meta,status,value=True):
  v=by[id];val=f'<b class="ed-value">{fmt(v["views"])}<small> lifetime views</small></b>' if value else ''
  short=0<v['durationSec']<=62;src=f'/blondshell/images/{id}.jpg'
  bg=f'<img class="ed-bg" src="{src}" alt="" aria-hidden="true">' if short else ''
  return f'<a class="ed-frame" href="https://www.youtube.com/watch?v={id}" target="_blank" rel="noopener"><span class="ed-img{" short" if short else ""}">{bg}<img class="ed-pic" src="{src}" width="480" height="360" alt="{E(title)}" loading="eager">{status}</span>{val}<span class="ed-title">{E(title)} ↗</span><span class="ed-meta">{E(meta)}</span></a>'
 def renote(id,kind,text):
  orig[id]=re.sub(r'<p class="source">.*?</p>',note(kind,text),orig[id],count=1,flags=re.S)
 def rehead(id,old,new):
  assert old in orig[id],(id,old);orig[id]=orig[id].replace(old,new)

 # 02 — the readout: conclusion first, three states, one move.
 assert by['ytdwKm-dJyg']['views']==138554 and by['7M9A_sVI4BI']['views']==97490
 orig['verdict']=make('verdict','The readout',head('The readout · day 53','Violins arrived complete.<br><span class="serif">The second chapter hasn’t started.</span>')+'''<div class="ed-readout mt"><article>'''+frame('7M9A_sVI4BI','Stone Fruit · music video','Album day · 53 days old',tag('on'))+'''<h3>What works</h3><p><b>11 / 11</b> songs live by release day. The two music videos hold <b>59.6%</b> of album-video viewing.</p></article><article>'''+frame('R_1iHTmZ90k','Two Fried · Short','4 Nov · one of 24 Shorts since release',tag('on','On the channel · Short'),False)+'''<h3>What needs fixing</h3><p><b>24</b> Shorts since release, <b>0</b> new full-song versions. And the album playlist plays a pitch copy of Stone Fruit.</p></article><article class="ed-move">'''+frame('h0bN0GGLJSQ','Stone Fruit on XMU','7 Nov · 27-second excerpt',tag('prop','Proposed · full take to clear'),False)+'''<h3>What to do first</h3><p>Fix the album playlists. Then one full <b>Stone Fruit</b> performance and <b>two Shorts a week</b> to 17 January.</p></article></div><div class="ed-key"><span>'''+ON+'''exists publicly</span><span>'''+GAP+'''not found on her channel</span><span>'''+PROP+'''needs approval or production</span></div>'''+note('API → INFERENCE','Lifetime counters at 17 Nov capture. The XMU full take, its rights and edit are unconfirmed.'))

 # Tighter headlines and one evidence line per slide.
 renote('channel','API + WATCHER','30-day window 19 Oct–17 Nov. Watcher history is short and repeats counters, so no growth rate is claimed.')
 renote('rollout','API','Window opens with the Heart Has To Work So Hard teaser, 14 May. Full-song gaps of 38, 54 and 38 days.')
 renote('release','API','11 songs checked against the official tracklist. Seven album-day audios: 27,128 lifetime views between them.')
 renote('leaders','API + WATCHER','Stone Fruit Watcher interval 92,168 → 97,384 (27 Oct–17 Nov). A limited interval; not proof of fastest momentum. Asset ages differ.')

 # 07 — the gap, with the excerpts marked as existing and the full take as missing.
 orig['followthrough']=make('followthrough','The missing second chapter',head('26 September → 17 November · 53 days after release','24 Shorts.<br><span class="serif">No new full-song version.</span>')+'''<div class="ed-gap mt"><div class="ed-gap-grid">'''+frame('6yIjIWBWln4','Sea Legs · Short','28 Sep · 61 sec',tag('on','Short'),False)+frame('R_1iHTmZ90k','Two Fried · Short','4 Nov · 21 sec',tag('on','Short'),False)+frame('0wGC3JLV92E','Heart Has To Work · Sirius XM','4 Nov · 47-sec excerpt',tag('on','Excerpt'),False)+frame('h0bN0GGLJSQ','Stone Fruit · XMU','7 Nov · 27-sec excerpt',tag('on','Excerpt'),False)+'''</div><div class="ed-gap-copy"><b class="ed-zero">0</b><p>full-song album versions uploaded since release day.</p><div class="ed-slot">'''+GAP+'''<h3>The full XMU performances.</h3><p>Two excerpts are already public. If cleared, a full take would be the album’s first second version.</p></div></div></div>'''+note('API','Exhausted public uploads list for this channel. Partner channels are not counted.'))

 # 08 — previous album: merged structure table + the late extensions.
 rows=re.search(r'<tbody>(.*?)</tbody>',orig['comparison'],re.S).group(1)
 keep=[r for r in re.findall(r'<tr>.*?</tr>',rows,re.S) if re.search(r'Channel uploads|Shorts¹|Full-length uploads|New full-song|covered by release',r)]
 assert len(keep)==5
 orig['last-album']=make('last-album','Last time, the second versions came late',head('If You Asked For A Picture (2025) vs Violins (2026) · matched D−130 → D+53','Same shape as 2025.<br><span class="serif">Last time, a four-month wait.</span>')+'''<div class="ed-previous mt"><div class="table-wrap compare"><table><thead><tr><th>Matched 184-day window</th><th>2025</th><th>2026</th></tr></thead><tbody>'''+''.join(keep)+'''</tbody></table></div><div class="ed-late"><span class="label">After the 2025 album · days after release</span><div class="ed-late-row">'''+frame('Gh79OdPxXqU','Toy · Vevo DSCVR','8 Sep 2025 · live',f'<span class="st st-day">+129 days</span>')+frame('v42NfgSoIuE','Arms feat. Gigi Perez','8 Oct 2025 · acoustic alternate',f'<span class="st st-day">+159 days</span>')+'''</div><p class="ed-late-more"><b>+196</b> Another Picture followed. Thumbtack live arrived with Toy.</p></div></div><p class="takeaway">The formats work for her. This time, bring the second version inside the album window.</p>'''+note('API','Both windows 184 days. 2025 full-length count includes the Diet Pepsi cover. Extensions sit outside the matched window; full reconstruction in Analysis.'))

 # 09 — Olympus: a named route, with the action in the headline.
 rehead('catalogue','Fans tell us<br><span class="serif">how they found Olympus.</span>','Invincible brought fans to Olympus.<br><span class="serif">Give them a way into Violins.</span>')
 renote('catalogue','API + COMMENT SAMPLE','100 relevance-ranked comments read 18 Nov: a selected sample, not 55% of viewers. Traffic attribution needs Studio.')

 # 10 — second versions: acoustic Arms + live Docket on one page.
 orig['versions']=make('versions','Second versions already work for her',head('Acoustic and live · on her channel','Fans asked for second versions.<br><span class="serif">When they came, fans noticed.</span>')+'''<div class="ed-versions mt"><article>'''+frame('v42NfgSoIuE','Arms feat. Gigi Perez','Acoustic alternate · 8 Oct 2025',tag('on'))+'''<blockquote>I begged for an acoustic version of Arms since the album dropped<cite>Sampled comment · 9 Oct 2025 · 12 likes</cite></blockquote></article><article>'''+frame('zzZiTQ20EFc','Docket feat. Bully · Saturn Sound','Full live performance · 26 Jun 2024',tag('on'))+'''<blockquote>If the two of you did an entire album together it would probably be incredible.<cite>Sampled comment · 279 likes</cite></blockquote></article><article class="ed-versions-gap"><span class="label">Violins today</span>'''+GAP+'''<h3>No live or stripped version of a Violins song.</h3><p>Every album song has its primary upload. None yet has a second version on her channel.</p></article></div>'''+note('API + COMMENT SAMPLE','Individual comments, not a demand census. Toy and Thumbtack also have full Vevo performances; a KEXP session sits on the partner channel.'))

 rehead('premieres','Before Salad,<br><span class="serif">the artist and producer showed up.</span>','Before Salad, she went live.<br><span class="serif">Bring her to the next Premiere.</span>')
 rehead('premieres','Bring a brief artist moment to a major video when she can participate. Keep it selective; a long conversation is a core-fan extra, not the reach benchmark.','Add a short artist moment to the next major video, when she can take part. A long conversation is a core-fan extra, not a reach play.')
 renote('premieres','API','Scheduled and actual starts confirm four music-video Premieres. Missing metadata on current videos is unknown, not proof they never premiered. No uplift claimed.')
 rehead('formats','Keep the personality.<br><span class="serif">Make the musical destination obvious.</span>','Keep the personality.<br><span class="serif">Point every song Short at a full song.</span>')
 renote('formats','API → INFERENCE','Examples differ in age and role; not a ranking. Short Related Video settings are not public. Shorts proxy: ≤62 sec.')

 # 13 — priorities with imagery and explicit states.
 def move(n,kind,title,img,imgtitle,imgmeta,status,body,have,need):
  return f'''<article class="ed-move-card"><span class="n">{n} / {kind}</span>{frame(img,imgtitle,imgmeta,status,False)}<h3>{title}</h3><p>{body}</p><dl><dt>{ON}</dt><dd>{have}</dd><dt>{PROP}</dt><dd>{need}</dd></dl></article>'''
 orig['priorities']=make('priorities','Three specific moves for Violins',head('What Partisan should prioritise','Back one song.<br><span class="serif">Give it another reason to watch.</span>')+'<div class="ed-moves mt">'+move('01','performance','Finish the XMU performance.','h0bN0GGLJSQ','Stone Fruit on XMU','27-sec excerpt',tag('on','Excerpt'),'Two XMU excerpts are public. If cleared, the full takes are the quickest route to a second version.','Stone Fruit and Heart Has To Work excerpts','Full take, cleared for her channel')+move('02','acoustic','One stripped Violins take.','v42NfgSoIuE','Arms feat. Gigi Perez','Acoustic precedent',tag('on','Precedent'),'Arms proves the format and the fan ask. Trial one song before promising a series.','Arms acoustic alternate + fan requests','One approved take or new filming')+move('03','lyric','A lyric route into the title track.','ytdwKm-dJyg','Violins · music video','No lyric version found',tag('gap','Lyric version · not found'),'Salad and What’s Fair show a lyric-video audience. Violins only has its music video.','Music video and lyric-video precedent','Lyric edit with approved text')+'</div>'+note('INFERENCE','Recommendations, not booked deliverables. Partner material needs licensing before any duplicate upload.'))

 renote('song-plan','API + WATCHER → INFERENCE','Stone Fruit is a focus candidate, not a verified fastest-growing song. No full XMU recording is assumed available.')
 renote('roadmap','INFERENCE','Proposed, not booked. 16 Shorts, one full-length upload and an optional second. 7–14 days is a planning test. No view forecast.')
 # status tags on the plan steps
 orig['song-plan']=orig['song-plan'].replace('<span class="plan-step">01 / already available</span>','<span class="plan-step">01 / already available</span>'+ON).replace('<span class="plan-step">02 / proposed full performance</span>','<span class="plan-step">02 / full performance</span>'+tag('prop','Proposed · clearance first')).replace('<span class="plan-step">03 / inside 7–14 days</span>','<span class="plan-step">03 / inside 7–14 days</span>'+PROP)
 assert orig['song-plan'].count('class="st ')==3
 orig['roadmap']=orig['roadmap'].replace('<em>Week commencing · illustrative slots</em>','<em>Week commencing · every slot is a proposal</em>')

 # Channel housekeeping, from the public channel walk on 18 Nov (channel-walk-2026-11-18.json).
 assert by['7M9A_sVI4BI']['views']==97490 and by['MbaRp6LqVsQ']['views']==40892
 shelves=[('00','Featured · Stone Fruit music video','keep',''),('01','Violins','fix','Pitch copy in the Stone Fruit slot. Not in album order.'),('02','If You Asked For A Picture + Another Picture','fix','Pitch copy in the Two Times slot.'),('03','Blondshell (S/T)','keep',''),('04','Shorts','keep',''),('05','Music videos · YouTube-generated','move','Opens on five official audios.'),('06','Releases','keep',''),('07','Posts','keep',''),('08','Collaborations','keep',''),('+','Live & sessions','add','Docket, Toy, Thumbtack, Diet Pepsi · and the XMU take.')]
 rows=''.join(f'<li class="sh sh-{k}"><b>{n}</b><span>{E(t)}{f"<i>{E(x)}</i>" if x else ""}</span><em>{k}</em></li>' for n,t,k,x in shelves)
 fixes=[('Swap the pitch copies for the real videos.','The Violins playlist plays an unlisted Stone Fruit marked “For pitching purposes” (220 views), not the official video (97.5k). The last album’s playlist does the same with Two Times (77 views vs 40.9k).'),
  ('Put Violins in album order.','YouTube’s own Violins release already has the tracklist order. The channel playlist doesn’t.'),
  ('Retire or refresh the old playlists.','“Official Videos” stops at Event of a Fire, April 2025. “Official Audio” stops at Diet Pepsi, June 2025, and mixes in videos.'),
  ('Give live a shelf.','Her performances are scattered. One Live &amp; sessions playlist on Home gives the XMU take somewhere to land.'),
  ('Name the song in song Shorts.','8 of 24 Shorts since release name a Violins song. One reads “Nee Age Trojan Horse”; two are titled “November 3, 2026”. Keep the personality, add the song.')]
 fx=''.join(f'<li><b>{i:02d}</b><div><h3>{a}</h3><p>{b}</p></div></li>' for i,(a,b) in enumerate(fixes,1))
 orig['fixes']=make('fixes','Fix the shop window first',head('Channel housekeeping · public channel walk, 18 November','Fix the shop window first.<br><span class="serif">The album playlist plays a pitch copy.</span>')+f'<div class="ed-fixes mt"><div class="ed-home"><span class="label">Her Home page, top to bottom</span><ol>{rows}</ol></div><ol class="ed-fixlist">{fx}</ol></div>'+note('OBSERVED','Signed-out walk of Home, Playlists and Live. Unlisted status read from public watch pages. Shorts Related Video and end screens are Studio-only, not assessed.'))
 old_prep='Label + management confirm the full XMU take, permissions and edit delivery.'
 assert old_prep in orig['roadmap'];orig['roadmap']=orig['roadmap'].replace(old_prep,'Swap the pitch copies in the album playlists. Label + management confirm the full XMU take, permissions and edit delivery.')

 # Next steps: first, next, then (mirrors the EBTG close).
 def step(when,dates,items):
  li=''.join(f'<li>{x}</li>' for x in items)
  return f'<article class="ed-step"><span class="ed-when">{when}</span><span class="ed-dates">{dates}</span><ul>{li}</ul></article>'
 orig['next-steps']=make('next-steps','Next steps',head('Next steps · every item is a proposal','Fix the shop window.<br><span class="serif">Then give Stone Fruit its second life.</span>')+'<div class="ed-steps mt">'+step('First','This week · 18–22 Nov',['Swap the pitch copies in both album playlists for the real videos.','Put the Violins playlist in album order.','Ask whether the full XMU takes are cleared for her channel.'])+step('Next','23 Nov → December',['Upload the full Stone Fruit performance, if cleared.','Two Shorts a week, each naming its song.','Build a Live &amp; sessions playlist and put it on Home.','Refresh or retire Official Videos and Official Audio.'])+step('Then','January',['Read the response at day 28 and choose the next song.','Pick its second version: a stripped take or a lyric video.','If a new video lands, premiere it with her in the room.'])+'</div><div class="ed-close"><span></span><a class="button" href="#analysis">Full evidence in Analysis →</a></div>')

 order=['intro','channel','verdict','rollout','release','leaders','catalogue','versions','premieres','followthrough','last-album','fixes','formats','priorities','song-plan','roadmap','next-steps']
 SEC={**{k:('works','What works') for k in ['rollout','release','leaders','catalogue','versions','premieres']},**{k:('fix','What needs fixing') for k in ['followthrough','last-album','fixes','formats']},**{k:('do','What to do') for k in ['priorities','song-plan','roadmap','next-steps']}}
 for k,(c,t) in SEC.items():
  orig[k]=orig[k].replace('<div class="inner">',f'<div class="inner"><span class="sec sec-{c}">{t}</span>',1)
  assert f'sec-{c}' in orig[k],k
 from blondshell_cinema import cinema
 cinema(orig,by,make,head,fmt,note,tag,E)
 return order


def walk_section(section,E):
 W=__import__('json').load(open(__import__('pathlib').Path(__file__).resolve().parent.parent/'public/blondshell/channel-walk-2026-11-18.json'))
 def a(id,t):return f'<a href="https://www.youtube.com/watch?v={id}" target="_blank" rel="noopener">{E(t)} ↗</a>'
 rows=[('Violins playlist','Stone Fruit slot is '+a('J8gf5qRYpbQ','an unlisted copy')+' (“For pitching purposes”, 220 views, 21 Sep). Order differs from the album and YouTube’s own release.','Replace with '+a('7M9A_sVI4BI','the official video')+'; match the tracklist.'),
  ('If You Asked For A Picture + Another Picture','Two Times slot is '+a('QCFzjXhVQJU','an unlisted copy')+' (“For pitching only”, 77 views).','Replace with '+a('MbaRp6LqVsQ','the lyric video')+'.'),
  ('Official Videos','11 items; newest is Event of a Fire (Apr 2025). No Violins-era video.','Refresh or remove from public view.'),
  ('Official Audio','11 items; newest is Diet Pepsi (Jun 2025). Includes lyric and music videos; no audio from the last two albums.','Refresh or remove from public view.'),
  ('Home · Music videos shelf','YouTube-generated. First six tiles are official audios.','Consider replacing with a curated video or Live &amp; sessions playlist.'),
  ('Home · live performances','No live shelf. Live tab holds one 2023 producer conversation.','Add a Live &amp; sessions playlist.'),
  ('Shorts since release (24)','8 titles name a Violins song; one misspelt (Nee Age Trojan Horse); two titled “November 3, 2026”; three spellings of Two Fried. 8 of 8 sampled have no description.','Song name in song Shorts. Related Video needs a Studio check.')]
 body='<div class="table-wrap"><table class="audit-table"><thead><tr><th>Where</th><th>What the public page shows</th><th>Fix</th></tr></thead><tbody>'+''.join(f'<tr><th scope="row">{x}</th><td>{y}</td><td>{z}</td></tr>' for x,y,z in rows)+'</tbody></table></div><p class="audit-note">'+E(W['method'])+' <a href="/blondshell/channel-walk-2026-11-18.json" target="_blank">Walk evidence ↗</a></p>'
 return section('channel-walk','Channel housekeeping · public walk, 18 Nov',body)
