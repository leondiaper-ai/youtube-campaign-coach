"""Nickelback × YouTube — Everything Under The Sun, post-album deep dive.

Generates public/nickelback/index.html from public/nickelback/research-2026-11-20.json.
Same deck framework and night-mode treatment as the Man/Woman/Chainsaw deck
(deck.css + deck.js + nb.css skin), with a Kings of Leon-style post-album plan.
Run: python scripts/build-nickelback.py
"""
import json,html,datetime as dt,pathlib

ROOT=pathlib.Path(__file__).resolve().parent.parent
OUT=ROOT/'public/nickelback'
D=json.load(open(OUT/'research-2026-11-20.json'))
CHECK=json.load(open(OUT/'channel-check-2026-11-23.json'))
E=lambda s:html.escape(str(s),quote=True)
V=[dict(zip(['id','date','dur','fmt','views','likes','comments','title'],r)) for r in D['campaign']]
by={v['id']:v for v in V}
day=lambda s:dt.date.fromisoformat(s)
START,END,ALBUM=day('2026-07-14'),day('2026-11-20'),day('2026-10-30')
def k(n):
 if n>=1_000_000:return f'{n/1e6:.1f}M'
 if n>=1000:return f'{n/1000:.0f}k' if n>=100000 else f'{n/1000:.1f}k'
 return f'{n:,}'
WV=D['watcherVideo']

# ── checks ─────────────────────────────────────────────────────────
L=[v for v in V if v['fmt']=='L'];S=[v for v in V if v['fmt']=='S']
assert (len(V),len(L),len(S))==(80,25,55)
camp_total=sum(v['views'] for v in V)
weeks=((END-START).days+1)/7;spw=len(S)/weeks
W=D['watcherChannel'];g30=W['latest'][1]-W['d30'][1];g7=W['latest'][1]-W['d7'][1];g90=W['latest'][1]-W['d90'][1]
older_min=round(100*(g30-camp_total)/g30)
assert (g30,g7,older_min)==(56795615,17028481,63)
mm=by['5l5OKWE3rbA']
lyr=[('X4NJO6mkeuA','If I Don’t Go','d7'),('M58G75GoOpI','I Already Know','d7'),('C8_F0AtqDNE','Bottled Dreams','d7'),('Ab4SSLrLt-Y','Lift Somebody Up','d7'),('wpa65K2rTe4','Technicolor Steamboat','d7'),('_CAz7Cckq24','Last Night Was Fun','d3')]
pre=(day(W['preSingle'][0])-day(W['first'][0])).days;pace_pre=(W['preSingle'][1]-W['first'][1])/pre
post=(day(W['latest'][0])-day(W['albumEve'][0])).days;pace_post=(W['latest'][1]-W['albumEve'][1])/post
calc={'campaignUploads':len(V),'campaignLongForm':len(L),'campaignShorts':len(S),'shortsPerWeek':round(spw,1),'campaignLifetimeViews':camp_total,
 'channelGain7':g7,'channelGain30':g30,'channelGain90':g90,'olderShareMinimum':older_min,'paceBeforeSingle':round(pace_pre),'paceSinceAlbum':round(pace_post)}
json.dump(calc,open(OUT/'calculations-2026-11-20.json','w'),indent=1)

MAXRES={'54Ug6Rexk2Q','73PieWbMHQg','2R8XAvv7TLM','MfoaCwlz0pk'}
# ── helpers ─────────────────────────────────────────────────────────
def src(id):
 v=by.get(id);sh=v and v['fmt']=='S'
 if not v and id not in MAXRES:return f'https://i.ytimg.com/vi/{id}/hqdefault.jpg'
 return f'https://i.ytimg.com/vi/{id}/{"oar2" if sh else "maxresdefault"}.jpg'
def img(id,alt='',cls=''):
 return f'<img class="{cls}" src="{src(id)}" onerror="this.onerror=null;this.src=\'https://i.ytimg.com/vi/{id}/hqdefault.jpg\'" alt="{E(alt)}" loading="eager">'
def yt(id):return f'https://www.youtube.com/watch?v={id}'
def head(kicker,h,sec=None):
 tag=f'<span class="sec sec-{sec[0]}">{sec[1]}</span>' if sec else ''
 return f'{tag}<span class="label">{kicker}</span><h2>{h}</h2>'
slides=[]
def slide(id,title,body,cls='dark'):
 slides.append(f'<section class="slide {cls}" id="{id}" data-title="{E(title)}"><div class="inner">{body}</div><div class="folio"><span>Nickelback × YouTube</span><span>{len(slides)+1:02d} / {E(title)}</span></div></section>')
WORK=('works','What is working');FIX=('fix','What to change');DO=('do','What to do')

RG=D['rolloutChannelViews'];SG=D['subscriberGrowth']
assert RG['gain']==RG['snapshots'][1]['views']-RG['snapshots'][0]['views']==216354691
assert SG['rolloutGain']==70000
rollout_headlines=f'''<div class="cover-results"><span class="cover-period">Across the rollout · 14 Jul–20 Nov 2026</span><div class="cover-result-grid"><div><b>+{RG['gain']/1e6:.1f}M</b><span>channel views</span><small>4.398B → 4.615B total views</small></div><div><b>+{SG['rolloutGain']/1000:.0f}k</b><span>subscribers · approximately</span><small>4.09M → 4.16M</small></div></div><p>Whole-channel growth, including the back catalogue.</p></div>'''

# 01 · cover ─────────────────────────────────────────────────────────
nb=(END-START).days//7+1;bins=[[0,0] for _ in range(nb)]
for v in V:bins[(day(v['date'])-START).days//7][0 if v['fmt']=='L' else 1]+=1
mx=max(a+b for a,b in bins);aw=(ALBUM-START).days//7
cells=''.join(f'<i class="{"rel" if n==aw else "full" if a else "sh"}" style="height:{max(6,round(100*(a+b)/mx))}%" title="Week of {(START+dt.timedelta(days=7*n)).strftime("%-d %b")}: {a} long-form, {b} Shorts"></i>' for n,(a,b) in enumerate(bins))
slides.append(f'''<section class="slide cover dark night-cover" id="intro" data-title="Everything Under The Sun · post-album"><img class="cover-bg" src="https://i.ytimg.com/vi/qki8O42Ct1w/maxresdefault.jpg" alt="Nickelback performing in the Rattle The Cage video" fetchpriority="high"><div class="cover-shade"></div><div class="inner"><span class="mono">YouTube deep dive · Everything Under The Sun · after the album · 20 Nov 2026</span><h1 class="cover-record">nickelback</h1><p class="cover-line">The album is out. The hit is climbing.<br><span>What keeps it going?</span></p>{rollout_headlines}<div class="cadence"><div class="cad-bars">{cells}</div><div class="cad-key"><span><i class="full"></i>long-form</span><span><i class="rel"></i>album week</span><span><i class="sh"></i>Shorts only</span><span class="cad-range">every week · 14 Jul → 20 Nov 2026</span></div></div></div><div class="folio"><span>Nickelback × YouTube</span><span>01 / Everything Under The Sun · post-album</span></div></section>''')

# 02 · the plan and what went live ─────────────────────────────────
def pos(d):return round(100*(day(d)-START).days/(END-START).days,2)
plan=[('2026-07-14','Rattle The Cage + album announced'),('2026-08-21','Leave Me Behind'),('2026-09-25','Make Me Love You'),('2026-10-30','Album + If I Don’t Go')]
actual=[('qki8O42Ct1w','Rattle The Cage video',None),('Kco5B5M-uu0','Leave Me Behind visualiser',None),('c6woWwSkm-k','Leave Me Behind video',None),('5l5OKWE3rbA','Make Me Love You video',None),('X4NJO6mkeuA','Album · If I Don’t Go lyric',None),('M58G75GoOpI','5 lyric videos · 4–17 Nov','2026-11-04')]
pl=''.join(f'<span class="tl-plan{" alt" if n%2 else ""}" style="left:{pos(d)}%"><i></i><em>{E(t)}</em><small>{day(d).strftime("%-d %b")}</small></span>' for n,(d,t) in enumerate(plan))
ac=''.join(f'<a class="tl-up{" lo" if n%2 else ""}" style="left:{pos(dd or by[i]["date"])}%" href="{yt(i)}" target="_blank" rel="noopener">{img(i,t)}<em>{E(t)}</em><small>{day(dd or by[i]["date"]).strftime("%-d %b")}</small></a>' for n,(i,t,dd) in enumerate(actual))
ticks=''.join(f'<i style="left:{pos(v["date"])}%"></i>' for v in S)
months=''.join(f'<span style="left:{pos(f"2026-{m:02d}-01")}%">{dt.date(2026,m,1).strftime("%b")}</span>' for m in range(8,12))
slide('delivered','The plan and what went live',head('Closing the loop · the album plan against the uploads','The album had a plan.<br><span class="serif">Here’s what went live.</span>')+f'''
<p class="why mt">The album rollout set out three singles from July, leading into the album on 30 October. Here’s what went live.</p>
<div class="tl mt"><div class="tl-row tl-row-plan"><span class="tl-lab">The plan</span>{pl}</div><div class="tl-axis">{months}</div><div class="tl-row tl-row-up"><span class="tl-lab">What went up</span>{ac}</div><div class="tl-shorts"><span class="tl-lab">Shorts · {len(S)}</span>{ticks}</div></div>
<div class="dl3 mt"><div><span class="st st-on">Delivered</span><p>Each of the three rollout singles got a video, visualiser and BTS film. Album day added eight audio uploads and the focus-track lyric video. {len(S)} Shorts, about {spw:.0f} a week.</p></div><div><span class="st st-diff">Delivered differently</span><p>Leave Me Behind’s video came 24 days after the song. If I Don’t Go got a lyric video. Bones For The Crows already had a visualiser and lyric video before July.</p></div><div><span class="st st-gap">After the album</span><p>Five more lyric videos followed on 4–17 Nov; Simple Song followed on 20 Nov. No new-song live or acoustic upload was found in the 23 Nov check.</p></div></div>''')

# 03 · last album vs this one ─────────────────────────────────────
C=D['compare'];td=C['thoseDays'];nl=C['nextLongFormAfterGetRollin']
compare_note='2022: first single (7 Sep) to album + 21 days. 2026: album announcement (14 Jul) to album + 21 days. Earlier Bones For The Crows uploads sit outside the 2026 window. Structure is compared across these windows; lifetime view callouts describe accumulated scale, not like-for-like performance.'
crow=''.join(f'<tr><td>{a}</td><td>{b}</td><td>{c}</td></tr>' for a,b,c in C['rows'])
slide('compare','Last album vs this one',head('Get Rollin’ vs Everything Under The Sun · rollout → album + 3 weeks','More around the rollout singles.<br><span class="serif">And the album didn’t go quiet.</span>',WORK)+f'''
<div class="cmp mt"><div class="table-wrap cmp-t"><table><thead><tr><th></th><th>Get Rollin’ · 2022</th><th>Everything Under The Sun · 2026</th></tr></thead><tbody>{crow}</tbody></table></div>
<div class="cmp-hi"><div class="cmp-big"><b>0 → 5</b><span>long-form uploads in the three weeks after the album. Last time the next one came {nl[2]} days later.</span></div>
<a class="cmp-tile" href="{yt('5l5OKWE3rbA')}" target="_blank" rel="noopener">{img('5l5OKWE3rbA','Make Me Love You')}<div><b>{k(mm['views'])}</b><span>Make Me Love You, in eight weeks. Those Days, the last album’s second single, has {k(td[2])} after four years.</span></div></a></div></div>''')

# 04 · what is working ──────────────────────────────────────────────
def panel(cls,id,alt,status,mono,big,unit,text,action):
 return f'<a class="pnl {cls}" href="{yt(id)}" target="_blank" rel="noopener">{img(id,alt)}{status}<div class="pnl-txt"><span class="mono">{mono}</span><b class="pnl-big">{big}</b><span class="pnl-unit">{unit}</span><p>{text}</p><p class="pnl-act">→ {action}</p></div></a>'
iidg=by['X4NJO6mkeuA'];sh=by['jC7jXZ3iA4k'];rc=by['qki8O42Ct1w']
slide('working','What is working',head('Views at 20 Nov · growth over the last 7 and 30 days','A ballad broke through.<br><span class="serif">And the classics are still busy.</span>',WORK)+'<div class="pnls three mt">'
 +panel('p1','5l5OKWE3rbA','Make Me Love You video','<span class="st st-on">Official video · 24 Sep</span>','The hit',k(mm['views']),f'views · {k(WV["5l5OKWE3rbA"]["d7"])} in its first week',f'Still adding {k(WV["5l5OKWE3rbA"]["g7"])} a week, eight weeks in.','Give it a second version.')
 +panel('p2','qki8O42Ct1w','Rattle The Cage video','<span class="st st-on">Official video · 14 Jul</span>','The rock single',k(rc['views']),'views · the album-announcement single','The heavier lead single landed too.','Keep both sides of the band in the plan.')
 +panel('p3','X4NJO6mkeuA','If I Don’t Go lyric video','<span class="st st-on">Lyric video · 30 Oct</span>','The album focus track',k(iidg['views']),'total views at 20 Nov','Approx. 369k paid views reported by Paid Media; reporting dates not confirmed.','Explore a music video for the focus track.')
 +'</div><div class="elsewhere"><span class="mono">The catalogue · lifetime</span>'+''.join(f'<a href="{yt(i)}" target="_blank" rel="noopener"><b>{k(n)}</b> {E(t)}</a>' for i,d,n,t in D['catalogueTop'][:4])+f'<a href="{yt(D["bestOf"][0])}" target="_blank" rel="noopener"><b>{k(D["bestOf"][3])}</b> The Best of Nickelback (Jun 2026)</a><span class="el-note">The channel gained {g30/1e6:.1f}M views in 30 days. Even counting every view the new uploads have ever had, at least {older_min}% came from older videos.</span></div>')

# 04b · what fans are saying ─────────────────────────────────────
SN=D['sentiment']
cards=''.join(f'<a class="fan" href="{yt(t["video"])}" target="_blank" rel="noopener"><span class="mono">{t["label"]}</span><b>{t["count"]}<small>/{t["of"]}</small></b><span class="fan-n">comments {t["note"]}</span><blockquote>“{E(t["quote"])}”<cite>{t["likes"]:,} likes</cite></blockquote></a>' for t in SN['themes'])
ex=''.join(f'<a class="fx2" href="{yt(i)}" target="_blank" rel="noopener">{img(i,n)}<div><span class="mono">{E(n)}</span><p>“{E(q)}” <small>{l:,} likes</small></p><small>{E(note)}</small></div></a>' for i,n,note,q,l in SN['extra'])
slide('fans','What fans are saying',head('800 top comments across 8 new-album videos · read 20 Nov','“They’re back.”<br><span class="serif">And fans are emotional about it.</span>',WORK)+f'<div class="fans mt">{cards}</div><div class="fx2s mt">{ex}</div>')

# 05 · what's landing, by format ─────────────────────────────────────
import statistics as _st
def _lr(ids):return _st.median(by[i]['likes']/by[i]['views']*100 for i in ids)
shorts=[r[0] for r in D['campaign'] if r[3]=='S'];lf_ids=[r[0] for r in D['campaign'] if r[3]=='L']
shr=_lr(shorts);lfr=_lr(lf_ids)
fm=[('Music videos','3','5l5OKWE3rbA','Make Me Love You',k(WV['5l5OKWE3rbA']['d7']),'in its first week','Music videos hold the campaign’s largest viewing totals.'),
 ('Behind the scenes','3','eSeczB9ZnzA','Leave Me Behind BTS',k(WV['eSeczB9ZnzA']['d7']),'in its first week','The biggest BTS film followed its video by 4 days. A useful timing test for the next shoot.'),
 ('Lyric videos','6','X4NJO6mkeuA','If I Don’t Go',k(iidg['views']),'total views at 20 Nov','Approx. 369k paid views reported by Paid Media. Paid support matters when comparing songs.'),
 ('Shorts',str(len(shorts)),'jC7jXZ3iA4k','A lyric line from Make Me Love You',k(by['jC7jXZ3iA4k']['views']),'views so far',f'Median like rate: about {shr:.0f} per 100 views, versus {lfr:.1f} for long-form. Lyric-line clips are worth developing.')]
cards=''.join(f'<a class="fmt" href="{yt(i)}" target="_blank" rel="noopener"><div class="fmt-img">{img(i,ex)}</div><div class="fmt-t"><span class="mono">{n} · {c} so far</span><b>{v}</b><span class="fmt-u">{u} · {E(ex)}</span><p>{t}</p></div></a>' for n,c,i,ex,v,u,t in fm)
slide('formats','What’s landing',head('Every campaign upload by format · views at 20 Nov','What fans are reacting to.<br><span class="serif">Videos reach. BTS and Shorts connect.</span>',WORK)+f'''
<div class="fmts mt">{cards}</div>
<p class="so mt"><b>Idea to develop:</b> a music video and BTS film for the album focus track, If I Don’t Go, with Shorts cut from both. Confirm the creative and budget with the team.</p>''')

# 07 · the opportunity, after the campaign evidence ─────────────────────────────────────────────
slide('opportunity','The opportunity',head('The opportunity','Make Me Love You became the hit.<br><span class="serif">Now the album needs its next chapter.</span>')+f'''
<div class="op-stats mt"><div><b>{k(mm['views'])}</b><span>views on the Make Me Love You video · +{k(WV['5l5OKWE3rbA']['g30'])} in the last 30 days</span></div><div><b>{g30/1e6:.1f}M</b><span>channel views in the last 30 days · at least {older_min}% from older videos</span></div><div class="op-small"><b>369k</b><span>approx. paid views reported for If I Don’t Go · interpret its total alongside paid support</span></div></div>
<div class="op-grid mt"><a class="op-photo" href="{yt('5l5OKWE3rbA')}" target="_blank" rel="noopener">{img('5l5OKWE3rbA','Make Me Love You video')}<span class="st st-on">Official video · 24 Sep</span><b>Make Me Love You</b></a>
<ol class="op-list"><li><b>01</b><div><h3>Connect the hits to the new album.</h3><p>Most viewing is on older uploads. Programme the new songs alongside How You Remind Me and Photograph.</p></div></li><li><b>02</b><div><h3>Give selected songs a new format.</h3><p>Choose songs using the campaign priorities and repeated audience response. Test a music video, an acoustic take or live performance for the priorities.</p></div></li><li><b>03</b><div><h3>Give the hit a second version.</h3><p>Make Me Love You added over 250k views in the latest measured week. An acoustic take is an idea to develop for January.</p></div></li></ol></div>''')

# 06 · which songs lead ─────────────────────────────────────────────
songs=[('If I Don’t Go','X4NJO6mkeuA',['X4NJO6mkeuA','dJcskN9tRWQ'],'Music video idea','Late Jan','The album focus track; 369k paid views reported for its lyric video. Explore a video with the team.'),
 ('I Already Know','M58G75GoOpI',['M58G75GoOpI','tPIfFakY8O0'],'Live or acoustic idea','Feb / tour','The strongest measured week; check rehearsal or tour capture.'),
 ('Lift Somebody Up','Ab4SSLrLt-Y',['Ab4SSLrLt-Y','rSeGbbhUzHU'],'Shorts','Ongoing','Its lyric video is still climbing fast.'),
 ('Technicolor Steamboat','oMpMkM-NEJc',['oMpMkM-NEJc','wpa65K2rTe4'],'Station + Shorts','Ongoing','The older audio upload holds most of the song’s views.'),
 ('Chasin Famous','fut4QlGfYk4',['fut4QlGfYk4'],'Lyric video idea','December','The leading audio-only album track in the snapshot.')]
rows=[]
for n,thumb,ids,role,when,why in songs:
 life=sum(by[i]['views'] for i in ids);g=sum(WV.get(i,{}).get('g7',0) for i in ids);rows.append((n,thumb,life,g,role,when,why))
mxs=max(r[2] for r in rows)
li=''.join(f'<li class="{"top" if i<2 else ""}"><b class="rk">{i+1}</b><a class="sg-img" href="{yt(t)}" target="_blank" rel="noopener">{img(t,n)}</a><div class="sg-n"><h3>{n}</h3><small>+{g:,} in the last 7 days</small></div><div class="sg-bar"><span style="width:{max(2,round(100*life/mxs))}%"></span><b>{k(life)}</b></div><div class="sg-role"><span class="role role-{"on" if i<2 else "opt"}">{when}</span><span class="role-t">{role}</span><p>{why}</p></div></li>' for i,(n,t,life,g,role,when,why) in enumerate(rows))
slide('songs','Which album songs lead next',head('Selected album tracks · views at 20 Nov · proposed next formats','A video for If I Don’t Go.<br><span class="serif">A live take for I Already Know.</span>',DO)+f'<p class="why mt">Ideas to develop with the team. If I Don’t Go is the album focus track; Paid Media reports approx. 369k paid views on its lyric video. I Already Know leads the measured week in public totals. Timing depends on footage, budget and band availability.</p><div class="sg-head"><span></span><span></span><span class="mono">Song</span><span class="mono">Views across its uploads</span><span class="mono">Proposed next step</span></div><ol class="sglist mt">{li}</ol>')

# 07 · station: catalogue ↔ album ───────────────────────────────────
seq=[('1cQh1ccqu8M','How You Remind Me','cat'),('5l5OKWE3rbA','Make Me Love You','new'),('BB0DU4DoPP4','Photograph','cat'),('X4NJO6mkeuA','If I Don’t Go','new'),('GP7zpdwo3Xo','Far Away','cat'),('qki8O42Ct1w','Rattle The Cage','new'),('_JQiEs32SqQ','Savin’ Me','cat'),('M58G75GoOpI','I Already Know','new')]
st=''.join(f'<a class="stn stn-{c}" href="{yt(i)}" target="_blank" rel="noopener">{img(i,t)}<span class="stn-tag">{"Catalogue" if c=="cat" else "New album"}</span><b>{E(t)}</b></a>' for i,t,c in seq)
slide('station','A Nickelback YouTube Station',head('Idea · a Nickelback YouTube Station','Turn catalogue viewing<br><span class="serif">into album viewing.</span>',DO)+f'''
<p class="why mt"><b>The idea:</b> an always-on mix of the band’s videos, programmed like a radio station. Familiar hits introduce the new album. Confirm availability and playback with YouTube.</p>
<div class="stn-row mt">{st}</div>
<div class="stn-steps"><span><b>01</b> Fans tune in for the hits</span><span class="ar">→</span><span><b>02</b> The new songs play next to them</span><span class="ar">→</span><span><b>03</b> The album stays in the mix</span><span class="st st-diff">Proposed · confirm with YouTube</span></div>
<div class="hw mt"><div><span class="mono">Why</span><p>Older uploads dominate channel viewing. How You Remind Me alone has {k(D['catalogueTop'][0][2])} lifetime views.</p></div><div><span class="mono">The mix</span><p>Alternate familiar hits with selected album songs, including the rollout singles.</p></div><div><span class="mono">Keep it fresh</span><p>Add new formats if made: a Chasin Famous lyric video, an acoustic take, a new music video.</p></div><div><span class="mono">Tour mode</span><p>Into February, mix in Red Rocks and Live From Nashville; add new live footage if captured and cleared.</p></div></div>''')

# 08 · an illustrative calendar, with time to prepare each moment ─────
def period(when,title,fmt,support,anchor=3,optional=False,tour=False):
 bars=[]
 for i in range(12):
  kind=('optional' if optional else 'anchor') if i==anchor else ('short' if i in (0,2,4,5,7,9,10,11) else 'quiet')
  label={'anchor':'Proposed long-form moment','optional':'Optional long-form moment','short':'Illustrative supporting Short','quiet':'Space between uploads'}[kind]
  bars.append(f'<i class="cal-bar cal-{kind}" aria-label="{label}"></i>')
 milestone='<span class="cal-tour">Tour starts · 5 Feb</span>' if tour else ''
 return f'<article class="cal-period"><div class="cal-date">{when}</div><div class="cal-rhythm">{"".join(bars)}</div><h3>{title}</h3><span class="cal-format">{fmt}</span><p>{support}</p>{milestone}</article>'
calendar=(period('1–15 Dec','Chasin Famous','Lyric video · proposed','Lyric-line clips; keep Simple Song in the mix.')
 +period('16–31 Dec','Holiday listening','Full-album video · optional','If assets are ready; catalogue-to-album Shorts.',optional=True)
 +period('1–15 Jan','Make Me Love You','Acoustic take · proposed','A new version of the hit, with performance clips.',anchor=8)
 +period('16–31 Jan','If I Don’t Go','Music video · proposed','Tease the film; cut Shorts from the video.',anchor=8)
 +period('1–14 Feb','If I Don’t Go','Behind the scenes · proposed','Follow the video within 7–14 days if ready.',anchor=3,tour=True)
 +period('15–28 Feb','I Already Know','Live or acoustic · proposed','Use rehearsals or tour capture if cleared.',anchor=3))
slide('rollout','Post-album timeline',head('Illustrative programming · December → February','Keep the album moving.<br><span class="serif">Into January and the tour.</span>',DO)+f'''
<p class="why mt">Space the new formats across the months ahead. Use December to agree the ideas, find footage and arrange production.</p>
<div class="cal-scroll mt" role="region" aria-label="December to February campaign timeline" tabindex="0"><div class="cal-board">
<div class="cal-top"><span>Proposed release windows</span><div class="cal-key"><span><i class="anchor"></i>Long-form idea</span><span><i class="short"></i>Supporting Shorts</span><span><i class="optional"></i>Optional</span></div></div>
<div class="cal-months"><b>December <small>2026</small></b><b>January <small>2027</small></b><b>February <small>2027</small></b></div>
<div class="cal-prep"><div><b>Prepare</b> Footage, budget, session dates + video shoot</div><div><b>Produce</b> Record, edit + capture BTS alongside the video</div><div><b>Tour</b> Rehearsals, live capture + cleared performances</div></div>
<div class="cal-periods">{calendar}</div>
<div class="cal-station"><b>YouTube Station · proposed always-on</b><span class="cal-station-line" aria-hidden="true"></span><span>Catalogue ↔ new album</span></div>
</div></div>
<div class="ess-opt"><span><b>Weekly rhythm</b> · aim for 3–5 purposeful Shorts from available footage.</span><span><b>Follow-through</b> · a second format within 7–14 days where assets allow.</span></div>
<p class="fine-print">Suggested windows; bars show an illustrative rhythm. Release timing depends on footage, budget, band availability and approval. Confirm Station availability with YouTube.</p>''')

# 09 · next steps, following the illustrative timeline ────────────────
slide('run','Next steps',head('After the album · three practical next steps','What to focus on<br><span class="serif">next.</span>',DO)+'''
<div class="next-actions mt">
<article><span class="next-num">01</span><h3>Start with a YouTube Station.</h3><p>Explore a mix of catalogue hits and new album songs with YouTube; confirm availability and programming. Alongside it, feature Make Me Love You and put the album playlist in track order.</p></article>
<article><span class="next-num">02</span><h3>Prepare Chasin Famous.</h3><p><strong>The leading audio-only album track in the 20 Nov snapshot: 95k views, with no lyric video yet.</strong></p><p>Check the artwork and lyric assets for a December lyric video, then agree the edit and release window. Cut lyric-line Shorts to support it.</p></article>
<article><span class="next-num">03</span><h3>Review the response.</h3><p>Check back in mid-January. Compare videos and Shorts with the same formats at the same age, then choose the next song to support.</p></article>
</div>''')

# ── analysis ───────────────────────────────────────────────────────
def table(h,rows):return '<div class="table-wrap"><table class="audit-table"><thead><tr>'+''.join(f'<th>{x}</th>' for x in h)+'</tr></thead><tbody>'+''.join('<tr>'+''.join(f'<td>{c}</td>' for c in r)+'</tr>' for r in rows)+'</tbody></table></div>'
def sec(id,t,b):return f'<section class="audit-section" id="{id}"><h3>{t}</h3>{b}</section>'
paid_note='<p>Paid context · Paid Media reports approx. 369k paid views for the If I Don’t Go lyric video (received 24 Nov). Reporting dates were not supplied; the figure is separate from the 20 Nov snapshot and cannot establish an organic remainder or first-week split.</p>'
inv=table(['Published','Video','Format','Views','Likes','Comments'],[[v['date'],f'<a href="{yt(v["id"])}" target="_blank" rel="noopener">{E(v["title"])}</a>','Short' if v['fmt']=='S' else 'Long-form',f'{v["views"]:,}',f'{v["likes"]:,}',f'{v["comments"]:,}'] for v in sorted(V,key=lambda v:v['date'],reverse=True)])
inv+=paid_note
pvd=table(['Plan moment','What went up (public)','Read'],[
 ['14 Jul · Rattle The Cage + announce','Music video and visualiser 14 Jul; BTS 14 Aug; 10 Shorts to mid-August','Delivered.'],
 ['21 Aug · Leave Me Behind','Visualiser 21 Aug; music video 14 Sep; BTS 18 Sep','Delivered; video 24 days after the song.'],
 ['25 Sep · Make Me Love You','Music video and visualiser 24 Sep; BTS 23 Oct; 7 Shorts','Delivered a day early. No lyric or live/acoustic version.'],
 ['30 Oct · Album + If I Don’t Go','Eight audio uploads; If I Don’t Go lyric video; five more lyric videos 4–17 Nov','Focus track has a lyric video. Bones For The Crows had earlier uploads. Simple Song lyric added 20 Nov at 17:00, after the main pull.']])
wat=table(['Window','Channel views gained','Read'],[
 ['Last 7 days (13–20 Nov)',f'+{g7:,}','Subscribers: 4.16M at both endpoints (rounded public counts).'],
 ['Last 30 days (21 Oct–20 Nov)',f'+{g30:,}',f'At least {older_min}% from older videos: the new uploads total {camp_total:,} lifetime.'],
 ['Last 90 days (22 Aug–20 Nov)',f'+{g90:,}','Includes the back catalogue.'],
 ['21 May → 13 Jul (before album announcement)',f'+{W["preSingle"][1]-W["first"][1]:,}',f'About {pace_pre/1e6:.2f}M a day.'],
 ['29 Oct → 20 Nov (album onwards)',f'+{W["latest"][1]-W["albumEve"][1]:,}',f'About {pace_post/1e6:.2f}M a day.']])
wat+=f'<p>The channel gained {RG["gain"]:,} views between 14 Jul and 20 Nov: {RG["snapshots"][0]["views"]:,} → {RG["snapshots"][1]["views"]:,} total views. This includes catalogue viewing.</p>'
wat+='<p>Subscribers increased from 4.09M on 14 Jul to 4.16M on 20 Nov: approximately +70k across the rollout (+1.7%). The album-release-day count was 4.15M, giving approximately +10k since 30 Oct. Public counts are rounded; this is channel-wide growth and cannot be attributed solely to the new album. Historical subscriber counts checked 23 Nov.</p>'
fw=table(['Upload','Day 1','Day 7','Last 7 days'],[[E(by[i]['title']),f'{WV[i].get("d1",0):,}' if WV[i].get('d1') else '—',f'{WV[i].get("d7",0):,}' if WV[i].get('d7') else (f'{WV[i]["d3"]:,} at day 3' if WV[i].get('d3') else '—'),f'+{WV[i]["g7"]:,}' if WV[i].get('g7') else '—'] for i in ['5l5OKWE3rbA','eSeczB9ZnzA','WsorAk6HH3Y','X4NJO6mkeuA','M58G75GoOpI','C8_F0AtqDNE','Ab4SSLrLt-Y','wpa65K2rTe4','_CAz7Cckq24']])
fw+=paid_note
fw+='''<h4>Reference points for the next uploads</h4><p>The four other lyric videos with a complete first week recorded 37k–172k total views. If I Don’t Go received approx. 369k paid views according to Paid Media; the reporting period is not confirmed, so its first week cannot be treated as an organic benchmark. The two measured BTS first weeks were 141,756 and 202,296 views. These are small-sample public totals with paid support not separated, not targets or forecasts; song demand varies. Establish separate baselines for acoustic and live uploads.</p><p>Compare each new upload with the same format at the same age, and confirm any paid support with the team. Compare Shorts with other Shorts over their first seven days; repeated response across clips can help shortlist songs.</p>'''
cat=table(['Video','Published','Views'],[[f'<a href="{yt(i)}" target="_blank" rel="noopener">{E(t)}</a>',d,f'{n:,}'] for i,d,n,t in D['catalogueTop']]+[[f'<a href="{yt(i)}" target="_blank" rel="noopener">{E(t)}</a>',d,f'{n:,}'] for i,d,t,n in D['live']])
grt=table(['Get Rollin’ video','Published','Views'],[[f'<a href="{yt(i)}" target="_blank" rel="noopener">{E(t)}</a>',d,f'{n:,}'] for i,d,t,n in D['getRollin']['singles']+D['getRollin']['later']])
walk=table(['Where','What the public page shows','Change'],[[a,b,c] for a,b,c in [
 ['Top of Home','No featured video or channel trailer','Feature Make Me Love You.'],
 ['Everything Under The Sun playlist','25 items mixing videos, visualisers, BTS, audio, lyric videos and an interview','Track order first; extras after.'],
 ['Official Nickelback Videos','57 videos; new singles first, How You Remind Me 45th','A hits + new album shelf on Home.'],
 ['Live From Nashville','2024 live visualisers, on Home','Keep; add new-song live takes when made.'],
 ['Tour','EUTS tour with Don Broco, first stop Pittsburgh 5 Feb 2027','Countdown Shorts from mid-January.']]])
method=f'''<p>Main metrics: public YouTube data covering 688 uploads, read {D['retrieved']}. The analysis covers the planned album rollout: 14 Jul (album announcement / Rattle The Cage) to the 20 Nov, 14:10Z snapshot. It excludes the earlier Bones For The Crows releases and is not the complete album-era total.</p><p>Channel follow-up: checked {E(CHECK['fetchedAt'])}. Bones For The Crows has a 20 Mar visualiser and 23 Apr lyric video. Simple Song’s lyric video was published 20 Nov at 17:00, after the main snapshot, and is now live. These status updates inform the recommendations; their views are not mixed into the 20 Nov totals.</p><p>Comparison windows: 2022 first single (7 Sep) to album + 21 days; 2026 album announcement (14 Jul) to album + 21 days. Different campaign lengths are stated. Bones For The Crows predates the 2026 window. Cross-year lifetime views show accumulated scale, not like-for-like performance or efficiency.</p><p>Growth data: 180 daily channel snapshots (21 May–20 Nov 2026) and daily video view counts. {E(D['watcherGaps'].replace("Watcher's per-video series", "Daily video tracking"))}</p><p>Plan: {E(D['coachMeta'].replace("The Coach shows", "The album plan lists"))}</p><p>Lifetime views are totals at the main pull, not views earned inside the campaign. Public views include paid support. Paid Media reported approx. 369k paid views for the If I Don’t Go lyric video (feedback received 24 Nov). Reporting dates and alignment with the 20 Nov snapshot were not supplied, so this is shown as separate context: no paid share, organic remainder or first-week paid split is calculated. Other uploads’ paid/organic splits, retention, click-through and traffic sources need YouTube Studio. Like-rate comparisons use the median likes/views per upload; they do not measure subscriber conversion. Comments are qualitative and relevance-ranked.</p><p>December–February programming is proposed, subject to footage, budget, band availability and team approval. First-week reference points describe measured public lyric and BTS totals, including any paid support; no equivalent acoustic or live benchmark is established.</p>'''
analysis=f'''<section id="analysis" class="analysis-sheet" role="dialog" aria-modal="true" aria-labelledby="analysis-title" tabindex="-1" hidden><header class="analysis-toolbar"><a class="brand" href="#analysis">Nickelback · channel analysis</a><button id="close-analysis" type="button" aria-label="Close analysis">Close ×</button></header><div class="analysis-sheet-inner analysis-content appendix clean-analysis"><span class="label">Evidence · uploads and channel growth checked 20 Nov 2026</span><h2 id="analysis-title">What’s on the channel.<br><span class="serif">What the album did.</span></h2><nav class="audit-nav" aria-label="Analysis sections"><a href="#inventory">Campaign uploads</a><a href="#plan-delivery">Plan vs delivery</a><a href="#growth">Growth</a><a href="#first-week">First weeks</a><a href="#catalogue">Catalogue</a><a href="#get-rollin">Get Rollin’</a><a href="#fans-data">Fan comments</a><a href="#bts-data">BTS</a><a href="#walk">Channel walk</a><a href="#method">Method</a></nav>
{sec('inventory',f'Campaign uploads · {len(V)} ({len(L)} long-form, {len(S)} Shorts), {camp_total:,} lifetime views',inv)}{sec('plan-delivery','Album rollout vs public uploads',pvd)}{sec('growth','Channel growth',wat)}{sec('first-week','First-week views',fw)}{sec('catalogue','Catalogue and live',cat)}{sec('get-rollin','Last album · Get Rollin’',grt+table(['Matched phase','Get Rollin’ · 2022','Everything Under The Sun · 2026'],C['rows'])+'<p>'+E(compare_note)+'</p>')}{sec('fans-data','Fan comments',table(['Theme','Comments','Top comment'],[[t['label'],f"{t['count']} of {t['of']}",'“'+E(t['quote'])+f'” · {t["likes"]:,} likes'] for t in SN['themes']])+'<p>'+E(SN['sample'])+' '+E(SN['watch'])+'</p>')}{sec('bts-data','Behind-the-scenes films',table(['Film','Released','Days after video','Views','Week one','Like rate'],[[E(n),d_,dd,f'{v:,}',f'{w1:,}' if w1 else '—',f'{100*l/v:.1f}%'] for i,n,d_,dd,v,l,w1 in D['bts']])+'<p>'+E(D['btsNote'])+'</p>')}{sec('walk','Channel walk · 20 Nov',walk)}{sec('method','Method and gaps',method)}</div></section>'''
page=f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Nickelback × YouTube — Everything Under The Sun, after the album</title><meta name="description" content="Nickelback YouTube deep dive: what worked on Everything Under The Sun and the post-album rollout."><meta name="robots" content="noindex"><link rel="stylesheet" href="/nickelback/deck.css"><link rel="stylesheet" href="/nickelback/nb.css"></head><body><a class="skip" href="#deck">Skip to deck</a><header class="topbar"><a class="brand" href="#intro"><span>Nickelback</span><span class="brand-platform"> × YouTube</span></a><nav aria-label="Deep dive"><a href="#delivered">Campaign</a><a href="#compare">Last album</a><a href="#working">What works</a><a href="#fans">Fans</a><a href="#formats">Formats</a><a href="#station">Station</a><a href="#rollout">Rollout</a><a href="#analysis" class="analysis-tab" aria-haspopup="dialog">Analysis</a><button id="present" type="button" aria-pressed="false">Present</button></nav></header><main id="deck">{''.join(slides)}</main>{analysis}<div class="present-controls" aria-label="Presentation controls"><button id="previous" aria-label="Previous slide">←</button><span id="page-count" aria-live="polite"></span><button id="next" aria-label="Next slide">→</button></div><script src="/nickelback/deck.js"></script></body></html>'''
(OUT/'index.html').write_text(page)
print(f'Built {len(slides)} slides; {len(V)} campaign uploads; checks passed.')
