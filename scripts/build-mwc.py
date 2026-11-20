"""Man/Woman/Chainsaw × YouTube — Cannonball and the live-show rollout.

Generates public/mwc/index.html from public/mwc/research-2026-11-20.json.
Same deck framework and night-mode treatment as the Blondshell deep dive
(deck.css + deck.js), with a Cannonball skin in mwc.css.
Run: python scripts/build-mwc.py
"""
import json,html,datetime as dt,statistics as st,pathlib

ROOT=pathlib.Path(__file__).resolve().parent.parent
OUT=ROOT/'public/mwc'
D=json.load(open(OUT/'research-2026-11-20.json'))
E=lambda s:html.escape(str(s),quote=True)
V=[dict(zip(['id','date','dur','fmt','type','title','views','likes','comments'],r)) for r in D['videos']]
by={v['id']:v for v in V}
day=lambda s:dt.date.fromisoformat(s)
END=day('2026-11-20');START=day('2026-04-20');ALBUM=day('2026-08-07')
def k(n):
 return f'{n/1000:.1f}k' if n>=1000 else f'{n:,}'
def ago(v):return (END-day(v['date'])).days

# ── checks against the capture ──────────────────────────────────────
assert len(V)==46 and sum(v['fmt']=='S' for v in V)==21
camp=[v for v in V if START<=day(v['date'])<=END]
campL=[v for v in camp if v['fmt']=='L'];campS=[v for v in camp if v['fmt']=='S']
assert (len(camp),len(campL),len(campS))==(33,14,19)
totL=sum(v['views'] for v in campL)
nose=by['5J3nZT--jBc']['views'];nose_share=round(100*nose/totL)
live_s=[v['views'] for v in campS if v['type']=='liveshort'];oth_s=[v['views'] for v in campS if v['type']=='short']
med_live,med_oth=int(st.median(live_s)),int(st.median(oth_s));ratio=med_live/med_oth
assert (len(live_s),len(oth_s),med_live,med_oth)==(6,13,2685,972)
W=D['watcherChannel'];g7=W['latest'][1]-W['d7'][1];g30=W['latest'][1]-W['d30'][1];g90=W['latest'][1]-W['d90'][1]
assert (g7,g30,g90)==(20200,65777,239603)
nose30=D['watcherVideo']['5J3nZT--jBc']['gain30'];nose_ch_share=round(100*nose30/g30)
postL=[v for v in V if day(v['date'])>ALBUM and v['fmt']=='L']
assert len(postL)==3
gap1=(day('2026-09-17')-ALBUM).days;gap2=(END-day('2026-10-29')).days
days_since_album=(END-ALBUM).days
calc={'campaignUploads':len(camp),'campaignLongForm':len(campL),'campaignShorts':len(campS),'campaignLongFormLifetimeViews':totL,
 'nosediveShareOfCampaignLongForm':nose_share,'liveShortsMedian':med_live,'otherShortsMedian':med_oth,'ratio':round(ratio,1),
 'channelGain7':g7,'channelGain30':g30,'channelGain90':g90,'nosedive30':nose30,'nosediveShareOfChannel30':nose_ch_share,
 'longFormSinceAlbum':len(postL),'daysSinceAlbum':days_since_album,'gapAfterAlbumDays':gap1,'daysSinceLastLongForm':gap2}
json.dump(calc,open(OUT/'calculations-2026-11-20.json','w'),indent=1)

# ── helpers ─────────────────────────────────────────────────────────
def src(id):
 v=by.get(id);sh=v and v['fmt']=='S'
 return f'https://i.ytimg.com/vi/{id}/{"oar2" if sh else "maxresdefault"}.jpg'
def img(id,alt='',cls=''):
 return f'<img class="{cls}" src="{src(id)}" onerror="this.onerror=null;this.src=\'https://i.ytimg.com/vi/{id}/hqdefault.jpg\'" alt="{E(alt)}" loading="eager">'
def yt(id):return f'https://www.youtube.com/watch?v={id}'
def head(kicker,h,sec=None):
 tag=f'<span class="sec sec-{sec[0]}">{sec[1]}</span>' if sec else ''
 return f'{tag}<span class="label">{kicker}</span><h2>{h}</h2>'
slides=[]
def slide(id,title,body,cls='dark'):
 slides.append(f'<section class="slide {cls}" id="{id}" data-title="{E(title)}"><div class="inner">{body}</div><div class="folio"><span>Man/Woman/Chainsaw × YouTube</span><span>{len(slides)+1:02d} / {E(title)}</span></div></section>')
WORK=('works','What is working');FIX=('fix','What needs attention');DO=('do','What to do')

# 01 · cover ─────────────────────────────────────────────────────────
A=START;nb=(END-A).days//7+1;bins=[[0,0] for _ in range(nb)]
for v in camp:
 bins[(day(v['date'])-A).days//7][0 if v['fmt']=='L' else 1]+=1
mx=max(a+b for a,b in bins);aw=(day('2026-08-06')-A).days//7;sw=(day('2026-10-07')-A).days//7
def cell(n,a,b):
 c='rel' if n==aw else 'full' if a else 'sh'
 extra=' show' if n==sw else ''
 return f'<i class="{c}{extra}" style="height:{max(6,round(100*(a+b)/mx))}%" title="Week of {(A+dt.timedelta(days=7*n)).strftime("%-d %b")}: {a} long-form, {b} Shorts"></i>'
cells=''.join(cell(n,a,b) for n,(a,b) in enumerate(bins))
slides.append(f'''<section class="slide cover dark night-cover" id="intro" data-title="Cannonball and the live show"><img class="cover-bg" src="https://i.ytimg.com/vi/ztvoyjwp2gQ/maxresdefault.jpg" alt="Man/Woman/Chainsaw on stage at Electric Ballroom, confetti over the crowd" fetchpriority="high"><div class="cover-shade"></div><div class="inner"><span class="mono">YouTube deep dive · Cannonball and the live show · 20 Nov 2026</span><h1 class="cover-record">man/<br>woman/<br>chainsaw</h1><p class="cover-line">Cannonball is out. The show is filmed.<br><span>Let’s put it to work.</span></p><div class="cadence"><div class="cad-bars">{cells}</div><div class="cad-key"><span><i class="full"></i>long-form</span><span><i class="rel"></i>album day</span><span><i class="sh"></i>Shorts only</span><span><i class="show"></i>Electric Ballroom, 7 Oct</span><span class="cad-range">every week · 20 Apr → 20 Nov 2026</span></div></div></div><div class="folio"><span>Man/Woman/Chainsaw × YouTube</span><span>01 / Cannonball and the live show</span></div></section>''')

# 02 · the opportunity ─────────────────────────────────────────────
slide('opportunity','The opportunity',head('The opportunity','Nosedive opened the door.<br><span class="serif">The live show can keep it open.</span>')+f'''
<div class="op-stats mt"><div><b>{k(nose)}</b><span>views on the Nosedive video · still +{k(nose30)} in the last 30 days</span></div><div><b>{ratio:.1f}×</b><span>live Shorts vs other Shorts · median {med_live:,} vs {med_oth:,} views ({len(live_s)} vs {len(oth_s)} Shorts)</span></div><div><b>54 min</b><span>Electric Ballroom show, multicam, already edited · unlisted, 4 views</span></div></div>
<div class="op-grid mt"><a class="op-photo" href="{yt('ztvoyjwp2gQ')}" target="_blank" rel="noopener">{img('ztvoyjwp2gQ','Electric Ballroom full show')}<span class="st st-gap">Unlisted · since 27 Oct</span><b>Live at Electric Ballroom · 7 Oct 2026</b></a>
<ol class="op-list"><li><b>01</b><div><h3>Lead with Nosedive, live.</h3><p>It is the song people already come for. Start the live chapter there.</p></div></li><li><b>02</b><div><h3>Then the full show, with chapters.</h3><p>It is already edited. A week after Nosedive, make it public with a setlist people can jump through.</p></div></li><li><b>03</b><div><h3>Make live easy to find.</h3><p>Name the song in every Short, link each one to its performance, and move the live shelf up the homepage.</p></div></li></ol></div>''')

# 03 · what the campaign delivered ─────────────────────────────────
def pos(d):return round(100*(day(d)-START).days/(END-START).days,2)
plan=[('2026-04-20','Nosedive + album announced'),('2026-05-25','Goddamn, Lizard Man!'),('2026-06-22','Get Up and Dance'),('2026-07-27','“IG single” TBC'),('2026-08-07','Cannonball out'),('2026-10-07','UK headline tour')]
actual=[('5J3nZT--jBc','Nosedive video'),('s5qH_WbW35w','Goddamn visualiser'),('N9xUTqsKENQ','Get Up and Dance'),('Ntc1efcKcR8','Something Else to Give'),('c0UQqT4q4KM','8 album tracks · audio'),('XQEpEF2O3VI','Still Angry · live'),('p6MYhf0BGbM','BBC Radio 1 session')]
pl=''.join(f'<span class="tl-plan{" alt" if n%2 else ""}" style="left:{pos(d)}%"><i></i><em>{E(t)}</em><small>{day(d).strftime("%-d %b")}</small></span>' for n,(d,t) in enumerate(plan))
actual.insert(6,('ztvoyjwp2gQ','Electric Ballroom · filmed, unlisted'))
dov={'c0UQqT4q4KM':'2026-08-07','ztvoyjwp2gQ':'2026-10-07'}
ac=''.join(f'<a class="tl-up{" lo" if n%2 else ""}{" tl-film" if i=="ztvoyjwp2gQ" else ""}" style="left:{pos(dov.get(i) or by[i]["date"])}%" href="{yt(i)}" target="_blank" rel="noopener">{img(i,t)}<em>{E(t)}</em><small>{day(dov.get(i) or by[i]["date"]).strftime("%-d %b")}</small></a>' for n,(i,t) in enumerate(actual))
ticks=''.join(f'<i style="left:{pos(v["date"])}%"></i>' for v in campS)
months=''.join(f'<span style="left:{pos(f"2026-{m:02d}-01")}%">{dt.date(2026,m,1).strftime("%b")}</span>' for m in range(5,12))
slide('delivered','What the campaign delivered',head('Original Coach plan → album → now','The plan landed up to album day.<br><span class="serif">After it, long-form went quiet.</span>')+f'''
<div class="tl mt"><div class="tl-row tl-row-plan"><span class="tl-lab">Coach plan</span>{pl}</div><div class="tl-axis">{months}<span class="tl-gap" style="left:{pos('2026-08-07')}%;width:{pos('2026-09-17')-pos('2026-08-07')}%">{gap1} days · no long-form</span><span class="tl-gap now" style="left:{pos('2026-10-29')}%;width:{100-pos('2026-10-29')}%">{gap2} days and counting</span></div><div class="tl-row tl-row-up"><span class="tl-lab">What went up</span>{ac}</div><div class="tl-shorts"><span class="tl-lab">Shorts</span>{ticks}</div></div>
<div class="dl3 mt"><div><span class="st st-on">Delivered</span><p>Nosedive video, then 7 Shorts in three weeks. Both single visualisers on time. The tour captured on multicam.</p></div><div><span class="st st-diff">Delivered differently</span><p>The “IG single” became Something Else to Give, two weeks early and as audio. Album day was eight audio uploads, no new video.</p></div><div><span class="st st-gap">No matching public upload</span><p>Album trailer, an album-week video, lyric or acoustic follow-ups, most of the instore Shorts, and the tour performance itself.</p></div></div>''')

# 04 · what is working ──────────────────────────────────────────────
def panel(cls,id,alt,status,mono,big,unit,text,action):
 return f'<a class="pnl {cls}" href="{yt(id)}" target="_blank" rel="noopener">{img(id,alt)}{status}<div class="pnl-txt"><span class="mono">{mono}</span><b class="pnl-big">{big}</b><span class="pnl-unit">{unit}</span><p>{text}</p><p class="pnl-act">→ {action}</p></div></a>'
sa,sa_audio=by['XQEpEF2O3VI'],by['dp7QE7uCgzI']
slide('working','What is working',head('Owned-channel results · lifetime views at 20 Nov','Nosedive is the door.<br><span class="serif">Live is the strongest format after it.</span>',WORK)+'<div class="pnls four mt">'
 +panel('p1','5J3nZT--jBc','Nosedive official video','<span class="st st-on">Official video · 20 Apr</span>','The door',k(nose),f'views · {nose_share}% of campaign long-form',f'Still adding {k(nose30)} a month, seven months in.','Open the live chapter with Nosedive.')
 +panel('p2','UFuaAn_LEBA','Nosedive live at Rock Werchter Short','<span class="st st-on">Short · 30 Jul</span>','Best Short',k(by['UFuaAn_LEBA']['views']),'Nosedive, live at Rock Werchter','Live Shorts: median 2,685 views. Other Shorts: 972.','Cut the Shorts from the show.')
 +panel('p3','p6MYhf0BGbM','Cannonball BBC Radio 1 session','<span class="st st-on">Live session · 29 Oct</span>','Still travelling',k(by['p6MYhf0BGbM']['views']),'in 22 days · Breeders cover, BBC Radio 1','The strongest long-form start since album day.','A live performance can still reach people now.')
 +panel('p4','XQEpEF2O3VI','Still Angry live at The George Tavern','<span class="st st-on">Live · 17 Sep</span>','Live beats audio',k(sa['views']),f'Still Angry live, in {ago(sa)} days',f'The album audio has {k(sa_audio["views"])} in {ago(sa_audio)} days.','Give album songs a live version, not just audio.')
 +'</div><div class="elsewhere"><span class="mono">On other channels · not owned results</span><a href="'+yt('FYWaJTOyUp0')+'" target="_blank" rel="noopener"><b>70.0k</b> KEXP full set</a><a href="'+yt('oNEYcO80r7g')+'" target="_blank" rel="noopener"><b>49.1k</b> Yala! TV</a><a href="'+yt('dMuWt0CH-ns')+'" target="_blank" rel="noopener"><b>22.5k</b> Close Encounter Club</a><a href="'+yt('QRyikZqmUjk')+'" target="_blank" rel="noopener"><b>5.5k</b> fan-filmed Nosedive</a><span class="el-note">Full sets find an audience. On their own channel, the Electric Ballroom show is a test.</span></div>')

# 05 · what needs attention ─────────────────────────────────────────
fixes=[('The full show is hidden.','Unlisted since 27 Oct. 4 views, no chapters.','Add chapters. Make it public on 8 Dec.','ztvoyjwp2gQ'),
 ('A broken video is still on the channel.','The Goddamn, Lizard Man! visualiser says “Video unavailable”. Views stuck at 10,551.','Restore it or take it down.','s5qH_WbW35w'),
 ('Live is hard to find.','The live playlist is the last shelf on Home, misses the BBC Radio 1 session, and four of its seven videos are other channels’.','A “Live at Electric Ballroom” playlist, second on Home.','68xngpq0mwo'),
 ('Shorts don’t name the song.','Only 8 of 21 do. Titles like “🫧” give a new viewer nowhere to go.','Song name in every song Short, linked to its performance.','KxJXwrQEdkE')]
fx=''.join(f'<li><b>{i:02d}</b><div class="fx-img">{img(t[3],t[0])}</div><div class="fx-p"><h3>{t[0]}</h3><p>{t[1]}</p></div><div class="fx-f"><span class="mono">Fix</span><p>{t[2]}</p></div></li>' for i,t in enumerate(fixes,1))
slide('attention','What needs attention',head('Public channel · 20 Nov','Four things to sort<br><span class="serif">before the show goes out.</span>',FIX)+f'<ol class="fxlist mt">{fx}</ol>','light')

# 06 · which songs lead ─────────────────────────────────────────────
WV=D['watcherVideo']
songs=[('Nosedive','5J3nZT--jBc',WV['5J3nZT--jBc']['gain30'],nose+by['UFuaAn_LEBA']['views'],'Week 1','Lead performance','The song people already come for. Fans film it at shows too.'),
 ('Only Girl','6CGR08BdwHA',WV['6CGR08BdwHA']['gain30'],by['6CGR08BdwHA']['views']+by['G-g2lz1IvPA']['views'],'Week 3','Second performance','Second-strongest single. It opened the Birmingham show the night before.'),
 ('Get Up and Dance','N9xUTqsKENQ',WV['N9xUTqsKENQ']['gain30'],by['N9xUTqsKENQ']['views']+by['280up2PwGhk']['views'],'Optional','Week 5, or a Short','A big chorus. Its live Short already has 3.2k.'),
 ('Something Else to Give','Ntc1efcKcR8',WV['Ntc1efcKcR8']['gain30'],by['Ntc1efcKcR8']['views'],'Reserve','If needed','Solid, but no live version on the channel yet.'),
 ('Canyons','g3cNb695QmU',WV['g3cNb695QmU']['gain30'],by['g3cNb695QmU']['views'],'Optional','Week 5','The most-viewed album track with no video. A live take would be its first.')]
others=sum(x[2] for x in songs[1:]);top=songs[0][2]
assert top>2.5*others
mxg=max(x[2] for x in songs)
rows=''.join(f'''<li class="{"lead" if i<2 else ""}"><b class="rk">{i+1}</b><a class="sg-img" href="{yt(id)}" target="_blank" rel="noopener">{img(id,n)}</a><div class="sg-n"><h3>{n}</h3><small>{k(life)} views across its videos</small></div><div class="sg-bar"><span style="width:{max(2,round(100*g/mxg))}%"></span><b>+{g:,}</b></div><div class="sg-role"><span class="role role-{"on" if i<2 else "opt"}">{wkn}</span><span class="role-t">{role}</span><p>{why}</p></div></li>''' for i,(n,id,g,life,wkn,role,why) in enumerate(songs))
slide('songs','Which songs lead the live rollout',head('Song demand · views gained in the last 30 days on their own channel','Lead with Nosedive.<br><span class="serif">Follow with Only Girl.</span>',DO)+f'<p class="why mt">Before cutting anything: which songs do people already want? Nosedive gained <b>{top:,}</b> views in the last 30 days, more than the next four songs together (<b>{others:,}</b>). So it goes first, and Only Girl follows.</p><div class="sg-head"><span></span><span></span><span class="mono">Song</span><span class="mono">Demand now · last 30 days</span><span class="mono">In the rollout</span></div><ol class="sglist mt">{rows}</ol><p class="fine-print">Check against the Electric Ballroom setlist before cutting.</p>')

# 07 · the rollout ───────────────────────────────────────────────────
def wk(n,date,title,fmt,purpose,support,dest,prod,review,kind='ess'):
 return f'''<article class="wk wk-{kind}"><div class="wk-h"><span class="wk-n">{n}</span><span class="wk-d">{date}</span></div><h3>{title}</h3><span class="wk-f">{fmt}</span><dl><dt>Why</dt><dd>{purpose}</dd><dt>Shorts + socials</dt><dd>{support}</dd><dt>Check</dt><dd>{review}</dd></dl></article>'''
slide('rollout','The live-show rollout',head('Recommended sequence · Day 0 = Tue 1 Dec','One song first. The full show a week later.<br><span class="serif">Then decide what’s next.</span>',DO)+'<p class="why mt">Why this order: Nosedive is where the audience already is. Their 2024 George Tavern run worked this way: The Boss live went first (now 19.5k), the full set nine days later (17.6k). The show is already edited, so the extra work is trims and verticals.</p><div class="wks mt">'
 +wk('Prep','23–27 Nov','Get the footage ready','Behind the scenes','Everything below comes from the existing edit.','—','—','Setlist + timestamps, three performance trims, five verticals, chapters, thumbnails.','Nothing goes out until the setlist is logged.','prep')
 +wk('Week 1','Tue 1 Dec · Day 0','Nosedive','Live performance','Meet the Nosedive audience with the band on stage.','Vertical Nosedive moment on Day 0, a second on Day 3. Band posts the same vertical with the link.','The performance, then the Live playlist.','Trim from the master, title, thumbnail.','48 hours and 7 days.')
 +wk('Week 2','Tue 8 Dec · Day 7','The full show','Full show · 54 min · make public','The complete night, for people the performance hooked.','Confetti or crowd vertical. Community post with the setlist. Band: “full show now on YouTube”.','Chapters, so people can jump to songs.','Chapters and description, then switch to public.','48 hours, and Nosedive at 7 days.')
 +wk('Week 3','Tue 15 Dec · Day 14','Only Girl','Live performance','The second single, with the set’s opening energy.','Verticals on Day 14 and Day 17.','The full-show chapter and the Live playlist.','Trim from the master.','48 hours and 7 days.')
 +wk('Week 4','22 Dec – 2 Jan','Hold for Christmas','No new long-form','Let the first three uploads work. Read the Day 28 numbers on 29 Dec.','Optional: one festive vertical from the show.','—','—','Day 28 review.','hold')
 +wk('Week 5','Tue 5 Jan · optional','Canyons','Live performance','Only if Nosedive and Only Girl reach the band’s usual live range.','Two verticals.','The full show and the Live playlist.','Trim from the master.','48 hours and 7 days.','opt')
 +'</div><div class="ess-opt"><span><b>Essential</b> · Nosedive live, the full show, Only Girl live, five verticals</span><span><b>Optional</b> · Canyons or Get Up and Dance live, two extra verticals each</span><span>Each upload gets 7 days of support before the next. A planning choice, not an algorithm rule.</span></div>')

# 08 · running it: journey, owners, review points ──────────────────
B=D['benchmarks']
slide('run','Running it',head('Production brief','Five days of prep.<br><span class="serif">Then press go on 1 December.</span>',DO)+f"""
<div class="jr mt"><span class="mono">How viewers move</span><ol><li><b>Band socials</b>the same vertical, pointing to YouTube</li><li><b>Short</b>related video set to that song’s performance</li><li><b>Performance</b>end screen and pinned comment → the full show</li><li><b>Full show</b>chapters for every song → Nosedive video</li><li class="end"><b>Home</b>“Live at Electric Ballroom” playlist, second shelf</li></ol></div>
<div class="run2 mt"><div class="na">
<article><span class="who">Edit · Eddie Suthers</span><ul><li>Log the setlist with timestamps.</li><li>Trim Nosedive and Only Girl. Canyons optional.</li><li>Five verticals and thumbnail frames.</li></ul></article>
<article><span class="who">Channel · label team</span><ul><li>Chapters on the full show; end screens, pinned comments, Shorts related video.</li><li>Live playlist up the homepage; Cannonball in album order.</li><li>Restore or remove the broken Goddamn visualiser.</li></ul></article>
<article><span class="who">Socials · band + Ash (PACT)</span><ul><li>Post on 1, 4, 8, 15 and 18 Dec.</li><li>Same vertical on Instagram and TikTok, pointing to YouTube.</li></ul></article></div>
<div class="know"><span class="mono">How we’ll know</span><p class="kn-range"><b>{B['XQEpEF2O3VI']['day2'][1]:,}–{B['p6MYhf0BGbM']['day2'][1]:,}</b> at 48 hours · <b>{B['XQEpEF2O3VI']['day7'][1]:,}–{B['p6MYhf0BGbM']['day7'][1]:,}</b> at 7 days<small>their last two live uploads: Still Angry and the BBC Radio 1 session</small></p><ul><li><b>In range at 7 days:</b> release the next performance.</li><li><b>A Short beats its performance:</b> switch to the song people chose.</li><li><b>All three below range:</b> stop new edits, keep cutting Shorts from the full show.</li></ul><p class="kn-studio">Click-through, view duration and Shorts-to-performance clicks need Studio.</p></div></div>
<div class="need mt"><span class="mono">Needed to finalise</span><p><b>Setlist and timestamps</b> · <b>public or Premiere</b> for the existing upload · <b>covers</b> in the set cleared · <b>Studio access</b></p></div>""")

# ── analysis sheet ─────────────────────────────────────────────────
def table(headers,rows):
 return '<div class="table-wrap"><table class="audit-table"><thead><tr>'+''.join(f'<th>{h}</th>' for h in headers)+'</tr></thead><tbody>'+''.join('<tr>'+''.join(f'<td>{c}</td>' for c in r)+'</tr>' for r in rows)+'</tbody></table></div>'
def sec(id,title,body):return f'<section class="audit-section" id="{id}"><h3>{title}</h3>{body}</section>'
typ={'video':'Official video','visualiser':'Visualiser','audio':'Audio','live':'Live performance','fullshow':'Full show','short':'Short','liveshort':'Live Short'}
inv=table(['Published','Video','Format','Views','Likes','Comments'],[[v['date'],f'<a href="{yt(v["id"])}" target="_blank" rel="noopener">{E(v["title"])}</a>',typ[v['type']],f'{v["views"]:,}',f'{v["likes"]:,}',f'{v["comments"]:,}'] for v in sorted(V,key=lambda v:v['date'],reverse=True)])
pvd=table(['Coach moment','Planned support','What went up (public)','Read'],[
 ['20 Apr · Nosedive + announce','4–5 Shorts in release week; album trailer; Community Posts; live content','Nosedive video 20 Apr; 7 Shorts 21 Apr–8 May','Delivered. No matching album trailer.'],
 ['25 May · Goddamn, Lizard Man!','Hero asset, Shorts, playlist add','Visualiser 28 May (now “Video unavailable”); audio re-upload 28 Sep','Delivered three days late; later replaced.'],
 ['22 Jun · Get Up and Dance','Hero asset, Shorts, playlist add','Visualiser 22 Jun; signing and BBC 6 Music BTS Shorts 15–16 Jun','Delivered.'],
 ['27 Jul · “IG single” TBC','Video or visualiser; lyric +7–10 days; BTS / acoustic / story +14–21 days','Something Else to Give audio 14 Jul','Delivered differently: earlier, audio only. No matching follow-ups.'],
 ['7 Aug · Cannonball','Focus-track video; album trailer; 4–5 Shorts','Eight album tracks as audio (6 Aug, 23:00 UTC); 2 Shorts 7–9 Aug','No matching album-week video or trailer.'],
 ['7 Aug · UK instores','~6 Shorts through 19 Sep; Community Posts','Shorts 9 Aug and 21 Aug','Partly delivered.'],
 ['19 Sep · UK tour from 7 Oct','Performance capture; live upload; 1–2 vertical performance Shorts','Electric Ballroom filmed (unlisted 27 Oct); The Thing Short 28 Sep; Still Angry live 17 Sep; BBC Radio 1 session 29 Oct','Captured. The tour performance is not public yet.']])
wat=table(['Window','Channel views gained','Read'],[
 ['Last 7 days (13–20 Nov)',f'+{g7:,}','Subscribers +70 (3,720 → 3,790).'],
 ['Last 30 days (21 Oct–20 Nov)',f'+{g30:,}',f'Nosedive alone: +{nose30:,} ({nose_ch_share}%).'],
 ['Last 90 days (22 Aug–20 Nov)',f'+{g90:,}','Includes the back catalogue.'],
 ['25 May → album eve (6 Aug)','+145,581','About 2,000 a day.'],
 ['Album eve → 20 Nov','+330,820','About 3,100 a day: the channel grew faster after release, with few new uploads.']])
vg=table(['Video','30-day gain','7-day gain'],[[E(by[i]['title']),f'+{D["watcherVideo"][i].get("gain30",0):,}',f'+{D["watcherVideo"][i].get("gain7",0):,}' if 'gain7' in D['watcherVideo'][i] else '—'] for i in ['5J3nZT--jBc','6CGR08BdwHA','N9xUTqsKENQ','Ntc1efcKcR8','tLbnM2tj78I','UFuaAn_LEBA','g3cNb695QmU','XQEpEF2O3VI','68xngpq0mwo','SMTUzSLutNY','s5qH_WbW35w']])
live=table(['Upload','Channel','Published','Length','Views'],[[f'<a href="{yt(i)}" target="_blank" rel="noopener">{E(t)}</a>',E(c),d,f'{s//60}:{s%60:02d}',f'{n:,}'] for i,c,t,d,s,n in D['thirdParty']]+[[f'<a href="{yt(v["id"])}" target="_blank" rel="noopener">{E(v["title"])}</a>','Own channel',v['date'],f'{v["dur"]//60}:{v["dur"]%60:02d}',f'{v["views"]:,}'] for v in V if v['type'] in('live','fullshow')])
walk=table(['Where','What the public page shows','Fix'],[
 ['Featured video','Nosedive official video','Keep. Swap to Nosedive live on 1 Dec if it performs.'],
 ['Cannonball playlist','12 items, not in album order; both versions of Only Girl','Match the album order YouTube’s own release uses.'],
 ['Live Performances playlist','Last shelf on Home; 3 own + 4 other-channel videos; no BBC Radio 1 session','Add the BBC session and the new performances; move up.'],
 ['Music videos shelf','YouTube-generated; opens on the BBC cover, Goddamn audio, Still Angry live','Fine to keep below the live shelf.'],
 ['Goddamn, Lizard Man! visualiser','“Video unavailable” signed out in the UK; still in uploads; views frozen at 10,551','Restore or remove from public view.'],
 ['Shorts','8 of 21 name a song; 14 have no description','Song name in every song Short; set Related Video in Studio.'],
 ['Electric Ballroom full show','Unlisted, 27 Oct, 4 views, no chapters, no captions','Chapters, then public on 8 Dec.']])
method=f'''<p>Catalogue: every public upload from the YouTube Data API through our Watcher integration (46 rows, uncapped), read 20 Nov 2026 at 10:35 UTC. Format: a Short is a video on the channel’s Shorts tab (21). Maegan (Visualizer) is 53 seconds but horizontal, so it counts as long-form.</p>
<p>Watcher: 180 daily channel snapshots (25 May–20 Nov 2026) and per-video daily series. The channel counter updates every 1–4 days, so windows use the nearest stored day. Per-video series start 15 Sep, so earlier first-week figures are not available.</p>
<p>Coach: the original campaign record, created 18 May 2026 and last edited 29 May 2026. No earlier version is stored, so the plan shown is the 29 May version. {D['coachNote']}</p>
<p>Campaign window: Coach 20 Apr → 20 Nov. The cycle began earlier: Only Girl (Single Version), the album’s opening track, came out on 17 Nov 2025. Album day follows Bandcamp (7 Aug 2026); the album tracks went up at 23:00 UTC on 6 Aug, midnight UK time.</p>
<p>Lifetime views are totals at 20 Nov, not views earned inside the campaign. Window gains come from Watcher only.</p>
<p>The live show: {E(D['liveShow']['note'])}</p>
<p>{E(D['thirdPartyNote'])} Not used: retention, click-through, geography, traffic sources or paid/organic splits. These need Studio.</p>'''
review=table(['Their live uploads','48 hours','7 days','Later'],[['Still Angry · live, Sep',f"{B['XQEpEF2O3VI']['day2'][1]:,}",f"{B['XQEpEF2O3VI']['day7'][1]:,}",f"{B['XQEpEF2O3VI']['day29'][1]:,} at 4 weeks"],['BBC Radio 1 session · Oct',f"{B['p6MYhf0BGbM']['day2'][1]:,}",f"{B['p6MYhf0BGbM']['day7'][1]:,}",f"{B['p6MYhf0BGbM']['day22'][1]:,} at 3 weeks"],['Live Short · BBC session',f"{B['CPcSNw-SFOg']['day1'][1]:,} at day 1",f"{B['CPcSNw-SFOg']['day7'][1]:,}",'—'],['Live Short · The Thing, Newcastle',f"{B['fMfcJK1yRdQ']['day1'][1]:,} at day 1",f"{B['fMfcJK1yRdQ']['day7'][1]:,}",'—']])+'<p>Two long-form uploads: a guide, not a target. Packaging changes: if views stall early but viewers watch for long (Studio), change the thumbnail and title first.</p>'+table(['Packaging','Example'],[['Performance title','Man/Woman/Chainsaw - Nosedive (Live at Electric Ballroom)'],['Short title','Nosedive, live at Electric Ballroom 🔥 full performance on our channel'],['Pinned comment','The full show from Electric Ballroom, 7 Oct 2026, is up now. Every song’s in the chapters 👇'],['Chapters','00:00 Intro, then one line per song from the setlist log']])
analysis=f'''<section id="analysis" class="analysis-sheet" role="dialog" aria-modal="true" aria-labelledby="analysis-title" tabindex="-1" hidden><header class="analysis-toolbar"><a class="brand" href="#analysis">Man/Woman/Chainsaw · channel analysis</a><button id="close-analysis" type="button" aria-label="Close analysis">Close ×</button></header><div class="analysis-sheet-inner analysis-content appendix clean-analysis"><span class="label">Evidence · catalogue and Watcher read 20 Nov 2026</span><h2 id="analysis-title">What’s on the channel.<br><span class="serif">What the plan said.</span></h2><nav class="audit-nav" aria-label="Analysis sections"><a href="#inventory">Uploads</a><a href="#plan-delivery">Plan vs delivery</a><a href="#growth">Growth</a><a href="#live-evidence">Live evidence</a><a href="#walk">Channel walk</a><a href="#review">Review points</a><a href="#method">Method</a></nav>
{sec('inventory',f'All {len(V)} public uploads · {len(V)-21} long-form, 21 Shorts',inv)}{sec('plan-delivery','Original Coach plan vs public uploads',pvd)}{sec('growth','Watcher growth',wat+vg)}{sec('live-evidence','Live performances · own channel and others',live)}{sec('walk','Channel walk · 20 Nov',walk)}{sec('review','Review points and packaging',review)}{sec('method','Method and gaps',method)}</div></section>'''

page=f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Man/Woman/Chainsaw × YouTube — Cannonball and the live show</title><meta name="description" content="Man/Woman/Chainsaw YouTube deep dive: what worked on Cannonball, what needs attention and the Electric Ballroom live-show rollout."><meta name="robots" content="noindex"><link rel="stylesheet" href="/mwc/deck.css"><link rel="stylesheet" href="/mwc/mwc.css"></head><body><a class="skip" href="#deck">Skip to deck</a><header class="topbar"><a class="brand" href="#intro"><span>Man/Woman/Chainsaw</span><span class="brand-platform"> × YouTube</span></a><nav aria-label="Deep dive"><a href="#delivered">Campaign</a><a href="#working">What works</a><a href="#attention">What needs attention</a><a href="#rollout">Live rollout</a><a href="#run">Running it</a><a href="#analysis" class="analysis-tab" aria-haspopup="dialog">Analysis</a><button id="present" type="button" aria-pressed="false">Present</button></nav></header><main id="deck">{''.join(slides)}</main>{analysis}<div class="present-controls" aria-label="Presentation controls"><button id="previous" aria-label="Previous slide">←</button><span id="page-count" aria-live="polite"></span><button id="next" aria-label="Next slide">→</button></div><script src="/mwc/deck.js"></script></body></html>'''
(OUT/'index.html').write_text(page)
print(f'Built {len(slides)} slides; {len(V)} uploads; checks passed.')
