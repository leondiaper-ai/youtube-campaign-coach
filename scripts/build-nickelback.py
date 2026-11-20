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

# 01 · cover ─────────────────────────────────────────────────────────
nb=(END-START).days//7+1;bins=[[0,0] for _ in range(nb)]
for v in V:bins[(day(v['date'])-START).days//7][0 if v['fmt']=='L' else 1]+=1
mx=max(a+b for a,b in bins);aw=(ALBUM-START).days//7
cells=''.join(f'<i class="{"rel" if n==aw else "full" if a else "sh"}" style="height:{max(6,round(100*(a+b)/mx))}%" title="Week of {(START+dt.timedelta(days=7*n)).strftime("%-d %b")}: {a} long-form, {b} Shorts"></i>' for n,(a,b) in enumerate(bins))
slides.append(f'''<section class="slide cover dark night-cover" id="intro" data-title="Everything Under The Sun · post-album"><img class="cover-bg" src="https://i.ytimg.com/vi/qki8O42Ct1w/maxresdefault.jpg" alt="Nickelback performing in the Rattle The Cage video" fetchpriority="high"><div class="cover-shade"></div><div class="inner"><span class="mono">YouTube deep dive · Everything Under The Sun · after the album · 20 Nov 2026</span><h1 class="cover-record">nickelback</h1><p class="cover-line">The album is out. The hit is climbing.<br><span>What keeps it going?</span></p><div class="cadence"><div class="cad-bars">{cells}</div><div class="cad-key"><span><i class="full"></i>long-form</span><span><i class="rel"></i>album week</span><span><i class="sh"></i>Shorts only</span><span class="cad-range">every week · 14 Jul → 20 Nov 2026</span></div></div></div><div class="folio"><span>Nickelback × YouTube</span><span>01 / Everything Under The Sun · post-album</span></div></section>''')

# 02 · the opportunity ─────────────────────────────────────────────
slide('opportunity','The opportunity',head('The opportunity','Make Me Love You became the hit.<br><span class="serif">Now the album needs its next chapter.</span>')+f'''
<div class="op-stats mt"><div><b>{k(mm['views'])}</b><span>views on the Make Me Love You video · +{k(WV['5l5OKWE3rbA']['g30'])} in the last 30 days</span></div><div><b>{g30/1e6:.1f}M</b><span>channel views in the last 30 days · at least {older_min}% from older videos</span></div><div class="op-small"><b>310k→37k</b><span>first-week views, first lyric video vs the fifth</span></div></div>
<div class="op-grid mt"><a class="op-photo" href="{yt('5l5OKWE3rbA')}" target="_blank" rel="noopener">{img('5l5OKWE3rbA','Make Me Love You video')}<span class="st st-on">Official video · 24 Sep</span><b>Make Me Love You</b></a>
<ol class="op-list"><li><b>01</b><div><h3>Connect the hits to the new album.</h3><p>Most viewing is the catalogue. Put new songs next to How You Remind Me and Photograph so those fans find them.</p></div></li><li><b>02</b><div><h3>Change the format.</h3><p>The lyric videos have trended down. The next moments should be a music video, an acoustic take and live.</p></div></li><li><b>03</b><div><h3>Give the hit a second version.</h3><p>Make Me Love You is still adding over 250k views a week. An acoustic version keeps it moving.</p></div></li></ol></div>''')

# 03 · what the campaign delivered ─────────────────────────────────
def pos(d):return round(100*(day(d)-START).days/(END-START).days,2)
plan=[('2026-07-14','Rattle The Cage + album announced'),('2026-08-21','Leave Me Behind'),('2026-09-25','Make Me Love You'),('2026-10-30','Album + If I Don’t Go')]
actual=[('qki8O42Ct1w','Rattle The Cage video',None),('Kco5B5M-uu0','Leave Me Behind visualiser',None),('c6woWwSkm-k','Leave Me Behind video',None),('5l5OKWE3rbA','Make Me Love You video',None),('X4NJO6mkeuA','Album · If I Don’t Go lyric',None),('M58G75GoOpI','5 more lyric videos','2026-11-04')]
pl=''.join(f'<span class="tl-plan{" alt" if n%2 else ""}" style="left:{pos(d)}%"><i></i><em>{E(t)}</em><small>{day(d).strftime("%-d %b")}</small></span>' for n,(d,t) in enumerate(plan))
ac=''.join(f'<a class="tl-up{" lo" if n%2 else ""}" style="left:{pos(dd or by[i]["date"])}%" href="{yt(i)}" target="_blank" rel="noopener">{img(i,t)}<em>{E(t)}</em><small>{day(dd or by[i]["date"]).strftime("%-d %b")}</small></a>' for n,(i,t,dd) in enumerate(actual))
ticks=''.join(f'<i style="left:{pos(v["date"])}%"></i>' for v in S)
months=''.join(f'<span style="left:{pos(f"2026-{m:02d}-01")}%">{dt.date(2026,m,1).strftime("%b")}</span>' for m in range(8,12))
slide('delivered','What the campaign delivered',head('Album rollout · July → now','Every single got the full treatment.<br><span class="serif">The album tracks got lyric videos.</span>')+f'''
<div class="tl mt"><div class="tl-row tl-row-plan"><span class="tl-lab">The plan</span>{pl}</div><div class="tl-axis">{months}</div><div class="tl-row tl-row-up"><span class="tl-lab">What went up</span>{ac}</div><div class="tl-shorts"><span class="tl-lab">Shorts · {len(S)}</span>{ticks}</div></div>
<div class="dl3 mt"><div><span class="st st-on">Delivered</span><p>Each single got a music video, a visualiser and a behind-the-scenes film. Album day had audio for every song. {len(S)} Shorts, about {spw:.0f} a week.</p></div><div><span class="st st-diff">Delivered differently</span><p>Leave Me Behind’s video came 24 days after the song. The focus track, If I Don’t Go, got a lyric video rather than a music video.</p></div><div><span class="st st-gap">No matching public upload</span><p>A live or acoustic version of any new song. Lyric videos for Chasin Famous and Simple Song.</p></div></div>''')

# 03b · last album vs this one ─────────────────────────────────────
C=D['compare'];td=C['thoseDays'];nl=C['nextLongFormAfterGetRollin']
crow=''.join(f'<tr><td>{a}</td><td>{b}</td><td>{c}</td></tr>' for a,b,c in C['rows'])
slide('compare','Last album vs this one',head('Get Rollin’ (2022) vs Everything Under The Sun · first single → 3 weeks after the album','More around every single.<br><span class="serif">And the album didn’t go quiet.</span>',WORK)+f'''
<div class="cmp mt"><div class="table-wrap cmp-t"><table><thead><tr><th></th><th>Get Rollin’ · 2022</th><th>Everything Under The Sun · 2026</th></tr></thead><tbody>{crow}</tbody></table></div>
<div class="cmp-hi"><div class="cmp-big"><b>0 → 5</b><span>long-form uploads in the three weeks after the album. Last time the next one came {nl[2]} days later.</span></div>
<a class="cmp-tile" href="{yt('5l5OKWE3rbA')}" target="_blank" rel="noopener">{img('5l5OKWE3rbA','Make Me Love You')}<div><b>{k(mm['views'])}</b><span>Make Me Love You, in eight weeks. Those Days, the last album’s second single, has {k(td[2])} after four years.</span></div></a>
<div class="cmp-back"><span class="st st-gap">One step back</span><p>Last time every album track got a visualiser on release day. This time they went up as audio, with lyric videos following one by one.</p></div></div></div>''')

# 04 · what is working ──────────────────────────────────────────────
def panel(cls,id,alt,status,mono,big,unit,text,action):
 return f'<a class="pnl {cls}" href="{yt(id)}" target="_blank" rel="noopener">{img(id,alt)}{status}<div class="pnl-txt"><span class="mono">{mono}</span><b class="pnl-big">{big}</b><span class="pnl-unit">{unit}</span><p>{text}</p><p class="pnl-act">→ {action}</p></div></a>'
iidg=by['X4NJO6mkeuA'];sh=by['jC7jXZ3iA4k'];rc=by['qki8O42Ct1w']
slide('working','What is working',head('Views at 20 Nov · 7- and 30-day gains from Watcher','A ballad broke through.<br><span class="serif">The catalogue keeps the lights on.</span>',WORK)+'<div class="pnls four mt">'
 +panel('p1','5l5OKWE3rbA','Make Me Love You video','<span class="st st-on">Official video · 24 Sep</span>','The hit',k(mm['views']),f'views · {k(WV["5l5OKWE3rbA"]["d7"])} in its first week',f'Still adding {k(WV["5l5OKWE3rbA"]["g7"])} a week, eight weeks in.','Give it a second version.')
 +panel('p2','qki8O42Ct1w','Rattle The Cage video','<span class="st st-on">Official video · 14 Jul</span>','The rock single',k(rc['views']),'views · the first single','The heavier lead single landed too.','Keep both sides of the band in the plan.')
 +panel('p3','X4NJO6mkeuA','If I Don’t Go lyric video','<span class="st st-on">Lyric video · 30 Oct</span>','Best album-day upload',k(iidg['views']),f'views · {k(WV["X4NJO6mkeuA"]["d7"])} in week one','The focus track, with only a lyric video so far.','Make it the next music video.')
 +panel('p4','jC7jXZ3iA4k','Make Me Love You Short','<span class="st st-on">Short · 29 Sep</span>','Best campaign Short',k(sh['views']),'“If you’re only gonna break my heart…”','A lyric line from the hit, over the video.','Cut more lyric-line Shorts from the hit.')
 +'</div><div class="elsewhere"><span class="mono">The catalogue · lifetime</span>'+''.join(f'<a href="{yt(i)}" target="_blank" rel="noopener"><b>{k(n)}</b> {E(t)}</a>' for i,d,n,t in D['catalogueTop'][:4])+f'<a href="{yt(D["bestOf"][0])}" target="_blank" rel="noopener"><b>{k(D["bestOf"][3])}</b> The Best of Nickelback (Jun 2026)</a><span class="el-note">The channel gained {g30/1e6:.1f}M views in 30 days. Even counting every view the new uploads have ever had, at least {older_min}% came from older videos.</span></div>')

# 04b · what fans are saying ─────────────────────────────────────
SN=D['sentiment']
cards=''.join(f'<a class="fan" href="{yt(t["video"])}" target="_blank" rel="noopener"><span class="mono">{t["label"]}</span><b>{t["count"]}<small>/{t["of"]}</small></b><span class="fan-n">comments {t["note"]}</span><blockquote>“{E(t["quote"])}”<cite>{t["likes"]:,} likes</cite></blockquote></a>' for t in SN['themes'])
ex=''.join(f'<a class="fx2" href="{yt(i)}" target="_blank" rel="noopener">{img(i,n)}<div><span class="mono">{E(n)}</span><p>“{E(q)}” <small>{l:,} likes</small></p><small>{E(note)}</small></div></a>' for i,n,note,q,l in SN['extra'])
slide('fans','What fans are saying',head('800 top comments across 8 new-album videos · read 20 Nov','“They’re back.”<br><span class="serif">And fans are emotional about it.</span>',WORK)+f'<div class="fans mt">{cards}</div><div class="fx2s mt">{ex}</div>')

# 05 · lyric run fading, second life works ──────────────────────────
mxl=max(WV[i]['d7'] for i,_,kk in lyr if kk=='d7')
btsbars=''.join(f'<li class="lf-bts"><span class="lf-n">{E(n)} BTS</span><span class="lf-bar"><i style="width:{max(3,round(100*w1/mxl))}%"></i></span><b>{k(w1)}</b><small>{dd} days after its video</small></li>' for i,n,dt_,dd,v,l,w1 in D['bts'] if w1)
bars=''.join(f'<li><span class="lf-n">{E(n)}</span><span class="lf-bar"><i style="width:{max(3,round(100*WV[i][kk]/mxl))}%"></i></span><b>{k(WV[i][kk])}</b><small>{"3 days so far" if kk=="d3" else day(by[i]["date"]).strftime("%-d %b")}</small></li>' for i,n,kk in lyr)
gr=D['getRollin'];ga=day(gr['album'])
def months(d):x=day(d);return (x.year-ga.year)*12+x.month-ga.month
tiles=''.join(f'<a class="gr" href="{yt(i)}" target="_blank" rel="noopener">{img(i,t)}<b>{k(n)}</b><span>{E(t.replace(" (Official Music Video)"," · music video").replace(" (Official Lyric Video)"," · lyric video"))}</span><small>{months(d)} months after the album</small></a>' for i,d,t,n in gr['later'])
slide('formats','Change the format',head('First-week views · Watcher','Lyric videos are fading.<br><span class="serif">Music videos and BTS films still work.</span>',FIX)+f'''
<div class="lf-grid mt"><div><span class="mono">Everything Under The Sun · lyric videos, week one</span><ol class="lf">{bars}</ol><span class="mono lf-sub">Behind-the-scenes films, week one</span><ol class="lf">{btsbars}</ol><p class="lf-note">Both tracked BTS films beat three of the five lyric videos in week one, and fans like them more: 2–3% of viewers hit like, against under 1% on the Make Me Love You video. Leave Me Behind’s came 4 days after its video and is the biggest ({k(by['eSeczB9ZnzA']['views'])}); the other two came a month later. Last Night Was Fun is off to a better start than the lyric run: {k(WV['_CAz7Cckq24']['d3'])} in three days.</p></div>
<div><span class="mono">Last album · Get Rollin’ (Nov 2022) · videos made months, even years, later</span><div class="grs">{tiles}</div></div></div>''')

# 06 · which songs lead ─────────────────────────────────────────────
songs=[('If I Don’t Go','X4NJO6mkeuA',['X4NJO6mkeuA','dJcskN9tRWQ'],'Music video','January','The focus track and the album’s biggest song after the singles.'),
 ('I Already Know','M58G75GoOpI',['M58G75GoOpI','tPIfFakY8O0'],'Live or acoustic take','December','The strongest week right now.'),
 ('Lift Somebody Up','Ab4SSLrLt-Y',['Ab4SSLrLt-Y','rSeGbbhUzHU'],'Shorts','Ongoing','Its lyric video is still climbing fast.'),
 ('Technicolor Steamboat','oMpMkM-NEJc',['oMpMkM-NEJc','wpa65K2rTe4'],'Station + Shorts','Ongoing','People found it through the audio, not the lyric video.'),
 ('Chasin Famous','fut4QlGfYk4',['fut4QlGfYk4'],'Lyric video','Next week','The best audio-only song. No video yet.')]
rows=[]
for n,thumb,ids,role,when,why in songs:
 life=sum(by[i]['views'] for i in ids);g=sum(WV.get(i,{}).get('g7',0) for i in ids);rows.append((n,thumb,life,g,role,when,why))
mxs=max(r[2] for r in rows)
li=''.join(f'<li class="{"top" if i<2 else ""}"><b class="rk">{i+1}</b><a class="sg-img" href="{yt(t)}" target="_blank" rel="noopener">{img(t,n)}</a><div class="sg-n"><h3>{n}</h3><small>+{g:,} in the last 7 days</small></div><div class="sg-bar"><span style="width:{max(2,round(100*life/mxs))}%"></span><b>{k(life)}</b></div><div class="sg-role"><span class="role role-{"on" if i<2 else "opt"}">{when}</span><span class="role-t">{role}</span><p>{why}</p></div></li>' for i,(n,t,life,g,role,when,why) in enumerate(rows))
slide('songs','Which album songs lead next',head('Album tracks beyond the singles · views across each song’s uploads','If I Don’t Go gets the next video.<br><span class="serif">I Already Know gets the live take.</span>',DO)+f'<p class="why mt">Which album songs do people already want? We added up each song’s uploads and checked the last 7 days. If I Don’t Go leads overall; I Already Know has the most momentum.</p><div class="sg-head"><span></span><span></span><span class="mono">Song</span><span class="mono">Views across its uploads</span><span class="mono">Next step</span></div><ol class="sglist mt">{li}</ol>')

# 07 · station: catalogue ↔ album ───────────────────────────────────
seq=[('1cQh1ccqu8M','How You Remind Me','cat'),('5l5OKWE3rbA','Make Me Love You','new'),('BB0DU4DoPP4','Photograph','cat'),('X4NJO6mkeuA','If I Don’t Go','new'),('GP7zpdwo3Xo','Far Away','cat'),('qki8O42Ct1w','Rattle The Cage','new'),('_JQiEs32SqQ','Savin’ Me','cat'),('M58G75GoOpI','I Already Know','new')]
st=''.join(f'<a class="stn stn-{c}" href="{yt(i)}" target="_blank" rel="noopener">{img(i,t)}<span class="stn-tag">{"Catalogue" if c=="cat" else "New album"}</span><b>{E(t)}</b></a>' for i,t,c in seq)
slide('station','A Nickelback YouTube Station',head('Idea · a Nickelback YouTube Station','Turn catalogue viewing<br><span class="serif">into album viewing.</span>',DO)+f'''
<p class="why mt"><b>What is a YouTube Station?</b> An always-on stream of the band’s videos, programmed like a radio station. Fans tune in for the hits; the new album plays in between.</p>
<div class="stn-row mt">{st}</div>
<div class="stn-steps"><span><b>01</b> Fans tune in for the hits</span><span class="ar">→</span><span><b>02</b> The new songs play next to them</span><span class="ar">→</span><span><b>03</b> The album stays in the mix</span><span class="st st-diff">Proposed · confirm with YouTube</span></div>
<div class="hw mt"><div><span class="mono">Why</span><p>The catalogue is where the viewing is: How You Remind Me alone has {k(D['catalogueTop'][0][2])} views.</p></div><div><span class="mono">The mix</span><p>Alternate a hit with a new song, as above. Every album track, plus the three singles.</p></div><div><span class="mono">Keep it fresh</span><p>Add each new video as it lands: Chasin Famous, the acoustic Make Me Love You, If I Don’t Go.</p></div><div><span class="mono">Tour mode</span><p>From January, lean into live: Red Rocks, Live From Nashville and the songs on the setlist.</p></div></div>''')

# 08 · the rollout ───────────────────────────────────────────────────
def wk(n,date,title,fmt,why,shorts,status,kind='ess'):
 return f'<article class="wk wk-{kind}"><div class="wk-h"><span class="wk-n">{n}</span><span class="wk-d">{date}</span></div><h3>{title}</h3><span class="wk-f">{fmt}</span><span class="wk-s wk-s-{status[0]}">{status[1]}</span><dl><dt>Why</dt><dd>{why}</dd><dt>Shorts</dt><dd>{shorts}</dd></dl></article>'
R=('r','Ready to make');P=('p','Needs production');H=('h','Shorts only')
slide('rollout','The post-album rollout',head('Next 8 weeks · 23 Nov → 18 Jan · tour starts 5 Feb','One new moment a week.<br><span class="serif">Building to If I Don’t Go and the tour.</span>',DO)+'<div class="wks w8 mt">'
 +wk('W1','23 Nov','Chasin Famous','Lyric video','The best audio-only song gets its video.','Lyric lines',R)
 +wk('W2','30 Nov','Make Me Love You','Acoustic version','A second version of the hit while it’s still climbing.','Acoustic moments',P)
 +wk('W3','7 Dec','Simple Song','Lyric video','Completes the set: every album song has a video.','Lyric lines',R)
 +wk('W4','14 Dec','I Already Know','Live or acoustic take','The album’s strongest week right now.','Performance cuts',P)
 +wk('W5','21 Dec','Everything Under The Sun','Full album video','The Best Of compilation pulled 1.5M. One click for the holidays.','Track-by-track',R)
 +wk('W6','28 Dec','Year in review','Shorts only','Old hit, new song, side by side.','Catalogue → new',H,'hold')
 +wk('W7','4 Jan','If I Don’t Go','Music video','The focus track’s first music video.','Teaser + clips',P)
 +wk('W8','11 Jan','If I Don’t Go','Behind the scenes','BTS lands best within a week of its video.','Tour countdown starts',P)
 +f'</div><div class="ess-opt"><span><b>The rhythm</b> · 3–5 Shorts a week around one long-form moment (they averaged {spw:.1f} in the campaign)</span><span><b>The follow-up</b> · each priority song gets a second format within 7–14 days</span></div>')

# 09 · running it ───────────────────────────────────────────────────
slide('run','Running it',head('Who does what · how we’ll know','Keep the album moving<br><span class="serif">into the tour.</span>',DO)+f'''
<div class="run2 mt"><div class="na">
<article><span class="who">Channel team</span><ul><li>Feature Make Me Love You at the top of Home.</li><li>Set up the YouTube Station with YouTube.</li><li>Put the album playlist in track order.</li><li>Lyric videos for Chasin Famous and Simple Song; the full album video.</li></ul></article>
<article><span class="who">Creative + production</span><ul><li>Make Me Love You acoustic version.</li><li>I Already Know live or acoustic take.</li><li>If I Don’t Go music video for early January, with a BTS film the week after.</li></ul></article>
<article><span class="who">Band + socials</span><ul><li>Lyric-line and performance Shorts, 3–5 a week.</li><li>Tour countdown from mid-January.</li></ul></article></div>
<div class="know"><span class="mono">How we’ll know it’s working</span><p class="kn-range"><b>110k+</b> first-week views for a lyric video<small>four of the five with a full first week got there</small></p><p class="kn-range"><b>140k–200k</b> for a behind-the-scenes or acoustic-style video<small>what the two BTS films did in week one</small></p><ul><li>If a new format beats its range, give the next song the same treatment.</li><li>If a Short does better than its full video, put that song forward next.</li><li>Read it again in mid-January, before the tour.</li></ul></div></div>''')

# ── analysis ───────────────────────────────────────────────────────
def table(h,rows):return '<div class="table-wrap"><table class="audit-table"><thead><tr>'+''.join(f'<th>{x}</th>' for x in h)+'</tr></thead><tbody>'+''.join('<tr>'+''.join(f'<td>{c}</td>' for c in r)+'</tr>' for r in rows)+'</tbody></table></div>'
def sec(id,t,b):return f'<section class="audit-section" id="{id}"><h3>{t}</h3>{b}</section>'
inv=table(['Published','Video','Format','Views','Likes','Comments'],[[v['date'],f'<a href="{yt(v["id"])}" target="_blank" rel="noopener">{E(v["title"])}</a>','Short' if v['fmt']=='S' else 'Long-form',f'{v["views"]:,}',f'{v["likes"]:,}',f'{v["comments"]:,}'] for v in sorted(V,key=lambda v:v['date'],reverse=True)])
pvd=table(['Plan moment','What went up (public)','Read'],[
 ['14 Jul · Rattle The Cage + announce','Music video and visualiser 14 Jul; BTS 14 Aug; 10 Shorts to mid-August','Delivered.'],
 ['21 Aug · Leave Me Behind','Visualiser 21 Aug; music video 14 Sep; BTS 18 Sep','Delivered; video 24 days after the song.'],
 ['25 Sep · Make Me Love You','Music video and visualiser 24 Sep; BTS 23 Oct; 7 Shorts','Delivered a day early. No lyric or live/acoustic version.'],
 ['30 Oct · Album + If I Don’t Go','Audio for every song; If I Don’t Go lyric video; five more lyric videos 4–17 Nov','Delivered; focus track has a lyric video, not a music video.']])
wat=table(['Window','Channel views gained','Read'],[
 ['Last 7 days (13–20 Nov)',f'+{g7:,}','Subscriber count shows 4.16M throughout (rounded public figure).'],
 ['Last 30 days (21 Oct–20 Nov)',f'+{g30:,}',f'At least {older_min}% from older videos: the new uploads total {camp_total:,} lifetime.'],
 ['Last 90 days (22 Aug–20 Nov)',f'+{g90:,}','Includes the back catalogue.'],
 ['21 May → 13 Jul (before the first single)',f'+{W["preSingle"][1]-W["first"][1]:,}',f'About {pace_pre/1e6:.2f}M a day.'],
 ['29 Oct → 20 Nov (album onwards)',f'+{W["latest"][1]-W["albumEve"][1]:,}',f'About {pace_post/1e6:.2f}M a day.']])
fw=table(['Upload','Day 1','Day 7','Last 7 days'],[[E(by[i]['title']),f'{WV[i].get("d1",0):,}' if WV[i].get('d1') else '—',f'{WV[i].get("d7",0):,}' if WV[i].get('d7') else (f'{WV[i]["d3"]:,} at day 3' if WV[i].get('d3') else '—'),f'+{WV[i]["g7"]:,}' if WV[i].get('g7') else '—'] for i in ['5l5OKWE3rbA','eSeczB9ZnzA','WsorAk6HH3Y','X4NJO6mkeuA','M58G75GoOpI','C8_F0AtqDNE','Ab4SSLrLt-Y','wpa65K2rTe4','_CAz7Cckq24']])
cat=table(['Video','Published','Views'],[[f'<a href="{yt(i)}" target="_blank" rel="noopener">{E(t)}</a>',d,f'{n:,}'] for i,d,n,t in D['catalogueTop']]+[[f'<a href="{yt(i)}" target="_blank" rel="noopener">{E(t)}</a>',d,f'{n:,}'] for i,d,t,n in D['live']])
grt=table(['Get Rollin’ video','Published','Views'],[[f'<a href="{yt(i)}" target="_blank" rel="noopener">{E(t)}</a>',d,f'{n:,}'] for i,d,t,n in D['getRollin']['singles']+D['getRollin']['later']])
walk=table(['Where','What the public page shows','Change'],[[a,b,c] for a,b,c in [
 ['Top of Home','No featured video or channel trailer','Feature Make Me Love You.'],
 ['Everything Under The Sun playlist','25 items mixing videos, visualisers, BTS, audio, lyric videos and an interview','Track order first; extras after.'],
 ['Official Nickelback Videos','57 videos; new singles first, How You Remind Me 45th','A hits + new album shelf on Home.'],
 ['Live From Nashville','2024 live visualisers, on Home','Keep; add new-song live takes when made.'],
 ['Tour','EUTS tour with Don Broco, first stop Pittsburgh 5 Feb 2027','Countdown Shorts from mid-January.']]])
method=f'''<p>Catalogue: every public upload from the YouTube Data API through our Watcher integration (688 rows, uncapped), read {D['retrieved']}. The campaign window follows the plan: 14 Jul (first single) to 20 Nov.</p><p>Watcher: 180 daily channel snapshots (21 May–20 Nov 2026) and per-video daily series. {E(D['watcherGaps'])}</p><p>Plan: {E(D['coachMeta'])}</p><p>Lifetime views are totals at 20 Nov, not views earned inside the campaign. Not used: retention, click-through, traffic sources or paid/organic splits. These need Studio.</p>'''
analysis=f'''<section id="analysis" class="analysis-sheet" role="dialog" aria-modal="true" aria-labelledby="analysis-title" tabindex="-1" hidden><header class="analysis-toolbar"><a class="brand" href="#analysis">Nickelback · channel analysis</a><button id="close-analysis" type="button" aria-label="Close analysis">Close ×</button></header><div class="analysis-sheet-inner analysis-content appendix clean-analysis"><span class="label">Evidence · catalogue and Watcher read 20 Nov 2026</span><h2 id="analysis-title">What’s on the channel.<br><span class="serif">What the album did.</span></h2><nav class="audit-nav" aria-label="Analysis sections"><a href="#inventory">Campaign uploads</a><a href="#plan-delivery">Plan vs delivery</a><a href="#growth">Growth</a><a href="#first-week">First weeks</a><a href="#catalogue">Catalogue</a><a href="#get-rollin">Get Rollin’</a><a href="#fans-data">Fan comments</a><a href="#bts-data">BTS</a><a href="#walk">Channel walk</a><a href="#method">Method</a></nav>
{sec('inventory',f'Campaign uploads · {len(V)} ({len(L)} long-form, {len(S)} Shorts), {camp_total:,} lifetime views',inv)}{sec('plan-delivery','Album rollout vs public uploads',pvd)}{sec('growth','Watcher growth',wat)}{sec('first-week','First-week views',fw)}{sec('catalogue','Catalogue and live',cat)}{sec('get-rollin','Last album · Get Rollin’',grt+table(['Matched phase','Get Rollin’ · 2022','Everything Under The Sun · 2026'],C['rows'])+'<p>'+E(C['note'])+'</p>')}{sec('fans-data','Fan comments',table(['Theme','Comments','Top comment'],[[t['label'],f"{t['count']} of {t['of']}",'“'+E(t['quote'])+f'” · {t["likes"]:,} likes'] for t in SN['themes']])+'<p>'+E(SN['sample'])+' '+E(SN['watch'])+'</p>')}{sec('bts-data','Behind-the-scenes films',table(['Film','Released','Days after video','Views','Week one','Like rate'],[[E(n),d_,dd,f'{v:,}',f'{w1:,}' if w1 else '—',f'{100*l/v:.1f}%'] for i,n,d_,dd,v,l,w1 in D['bts']])+'<p>'+E(D['btsNote'])+'</p>')}{sec('walk','Channel walk · 20 Nov',walk)}{sec('method','Method and gaps',method)}</div></section>'''
page=f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Nickelback × YouTube — Everything Under The Sun, after the album</title><meta name="description" content="Nickelback YouTube deep dive: what worked on Everything Under The Sun and the post-album rollout."><meta name="robots" content="noindex"><link rel="stylesheet" href="/nickelback/deck.css"><link rel="stylesheet" href="/nickelback/nb.css"></head><body><a class="skip" href="#deck">Skip to deck</a><header class="topbar"><a class="brand" href="#intro"><span>Nickelback</span><span class="brand-platform"> × YouTube</span></a><nav aria-label="Deep dive"><a href="#delivered">Campaign</a><a href="#compare">Last album</a><a href="#working">What works</a><a href="#fans">Fans</a><a href="#formats">Formats</a><a href="#station">Station</a><a href="#rollout">Rollout</a><a href="#analysis" class="analysis-tab" aria-haspopup="dialog">Analysis</a><button id="present" type="button" aria-pressed="false">Present</button></nav></header><main id="deck">{''.join(slides)}</main>{analysis}<div class="present-controls" aria-label="Presentation controls"><button id="previous" aria-label="Previous slide">←</button><span id="page-count" aria-live="polite"></span><button id="next" aria-label="Next slide">→</button></div><script src="/nickelback/deck.js"></script></body></html>'''
(OUT/'index.html').write_text(page)
print(f'Built {len(slides)} slides; {len(V)} campaign uploads; checks passed.')
