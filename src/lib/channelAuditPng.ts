import { auditNumber as n, type ChannelAudit } from './channelAudit';

/** Local canvas export: no data or artwork is sent to an image service. */
export async function downloadAuditPng(a:ChannelAudit, quick=false) {
  if(quick)return downloadIntelPng(a);
  const {toCanvas}=await import('qrcode');
  const canvas=document.createElement('canvas');canvas.width=1600;canvas.height=1000;
  const c=canvas.getContext('2d');if(!c)throw Error('Canvas unavailable');
  const ink='#141414', muted='#776F65', orange='#FF4A1C', blue='#2C25FF', rule='#E5DED2';
  c.fillStyle='#FAF7F2';c.fillRect(0,0,1600,1000);
  function text(value:string,x:number,y:number,size=20,color=ink,bold=false) {c!.font=`${bold?700:400} ${size}px Arial, sans-serif`;c!.fillStyle=color;c!.fillText(value,x,y);}
  function wrap(value:string,x:number,y:number,width:number,size=20,maxLines=3,color=ink,bold=false) {
    c!.font=`${bold?700:400} ${size}px Arial, sans-serif`;const words=value.split(/\s+/);const lines:string[]=[];let line='';
    for(const word of words){const next=line?line+' '+word:word;if(c!.measureText(next).width>width && line){lines.push(line);line=word;}else line=next;}if(line)lines.push(line);
    lines.slice(0,maxLines).forEach((l,i)=>{let out=l;if(i===maxLines-1 && lines.length>maxLines){while(c!.measureText(out+'…').width>width)out=out.slice(0,-1);out+='…';}text(out,x,y+i*(size+7),size,color,bold);});
  }
  function line(y:number){c!.strokeStyle=rule;c!.beginPath();c!.moveTo(48,y);c!.lineTo(1552,y);c!.stroke();}
  text('YOUTUBE / CHANNEL AUDIT',48,44,15,orange,true);
  wrap(a.name,48,103,1120,44,1,ink,true);
  text(a.catalogue?.complete?'FULL PLAYLIST SCANNED':'PARTIAL INVENTORY',1210,43,14,muted,true);
  text('Channel reading '+(a.dataAt?.slice(0,10)??'unavailable'),1210,69,14,muted);
  text('Upload scan '+(a.catalogue?.fetchedAt.slice(0,10)??'recent cache'),1210,91,14,muted);
  const metrics=[['SUBSCRIBERS',a.stats.subs],['LIFETIME CHANNEL VIEWS',a.stats.lifetimeViews],['CHANNEL VIEWS / 30D',a.stats.views30d],['CHANNEL VIEWS / 7D',a.stats.views7d]] as const;
  metrics.forEach(([label,value],i)=>{const x=48+i*390;text(n(value),x,165,34,ink,true);text(label,x,190,12,muted,true);});
  line(212);
  wrap(a.visuals.takeaway,48,249,1460,25,2,ink,true);
  const s=a.visuals.split,total=s.longform+s.shorts,lf=total?s.longform/total:0;
  text('LONG-FORM  '+n(s.longform)+' views',48,320,19,orange,true);text('SHORTS  '+n(s.shorts)+' views',1130,320,19,blue,true);
  c.fillStyle=rule;c.fillRect(48,335,1504,14);c.fillStyle=orange;c.fillRect(48,335,1504*lf,14);c.fillStyle=blue;c.fillRect(48+1504*lf,335,1504*(total?1-lf:0),14);
  text('Lifetime views across '+(s.longformCount+s.shortsCount)+' analysed uploads · not a split of the channel lifetime counter',48,375,13,muted);
  text('WHAT WORKS HERE?',48,424,18,ink,true);
  const max=Math.max(...a.visuals.formats.map(f=>f.views),1);
  const formatRows=a.visuals.formats.filter(f=>f.count>0 || ['omv','live','lyric','visualiser','bts','acoustic','short'].includes(f.key));
  const rowStep=Math.min(43,300/formatRows.length);
  formatRows.forEach((f,i)=>{const y=466+i*rowStep;text(f.name,48,y,16,ink,true);c.fillStyle=rule;c.fillRect(260,y-14,280,12);c.fillStyle=f.key==='short'?blue:orange;c.fillRect(260,y-14,280*f.views/max,12);text(f.count?n(f.views):'—',558,y,18,ink,true);text(f.count?`${f.count} uploads · ${n(f.median)} median · ${f.verdict}`:'0 uploads · Not identified',655,y,13,muted);});
  text('Lifetime counts; ages differ. Format labels are inferred. 3+ examples = repeat evidence, not proven uplift.',48,783,12,muted);
  text('PRIORITIES',1035,424,18,ink,true);
  (a.visuals.actions.length?a.visuals.actions:a.priorities).slice(0,3).forEach((p,i)=>{text('0'+(i+1),1035,466+i*89,17,orange,true);wrap(p,1077,466+i*89,460,17,3);});
  text('KEY MARKETS / MONTHLY VIEWS',1035,752,14,ink,true);
  if(a.territories.length)a.territories.slice(0,3).forEach((t,i)=>text(t.name+'  '+n(t.views)+(t.estimated?' est.':''),1035,780+i*23,15,muted));else text('Country data unavailable',1035,780,15,muted);
  text('WEEKLY PUBLISHING',48,830,16,ink,true);
  text(`${a.visuals.activeWeeks}/${a.visuals.coveredWeeks} covered weeks active · last 13 calendar weeks`,48,852,13,muted);
  const mx=Math.max(...a.visuals.weeks.map(w=>w.longform+w.shorts),1);
  a.visuals.weeks.forEach((w,i)=>{const x=48+i*67,lfh=w.longform/mx*65,sh=w.shorts/mx*65;c.globalAlpha=w.covered?1:0.3;c.fillStyle=orange;c.fillRect(x,933-lfh,38,lfh);c.fillStyle=blue;c.fillRect(x,933-lfh-sh,38,sh);c.fillStyle=rule;if(!lfh&&!sh)c.fillRect(x,931,38,2);c.globalAlpha=1;text(w.date.slice(8)+'/'+w.date.slice(5,7),x,953,10,muted);});
  const url='https://youtube-campaign-coach.vercel.app/watcher/'+encodeURIComponent(a.slug);
  const qr=document.createElement('canvas');await toCanvas(qr,url,{width:112,margin:1,color:{dark:ink,light:'#FAF7F2'}});c.drawImage(qr,1438,838,112,112);
  const marketDate=a.territoryNote.match(/reported (\d{4}-\d{2}-\d{2})/)?.[1];
  if(marketDate)text('Chartmetric reported '+marketDate,1035,857,11,muted);
  wrap(url.replace('https://',''),1035,885,380,10,2,muted);
  text('Open channel & source links →',1140,926,13,muted);
  text('Watcher · YouTube cached data / Chartmetric markets · Partial/complete coverage shown above · Current week incomplete',48,983,11,muted);
  const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error('Export failed');
  const objectUrl=URL.createObjectURL(blob);const link=document.createElement('a');link.href=objectUrl;link.download=`${a.slug}-channel-audit-${a.generatedAt.slice(0,10)}.png`;link.click();setTimeout(()=>URL.revokeObjectURL(objectUrl),1000);
}

/** Compact evidence sheet for the same quick intel shown in the modal. */
async function downloadIntelPng(a: ChannelAudit) {
  const {toCanvas}=await import('qrcode');
  const canvas=document.createElement('canvas');canvas.width=1600;canvas.height=1000;
  const c=canvas.getContext('2d');if(!c)throw Error('Canvas unavailable');
  const ink='#141414',muted='#776F65',orange='#FF4A1C',blue='#2C25FF',rule='#E5DED2';
  c.fillStyle='#FAF7F2';c.fillRect(0,0,1600,1000);
  const text=(v:string,x:number,y:number,size=18,color=ink,bold=false)=>{c.font=`${bold?700:400} ${size}px Arial, sans-serif`;c.fillStyle=color;c.fillText(v,x,y);};
  function wrap(v:string,x:number,y:number,width:number,size=18,maxLines=3,color=ink,bold=false){
    c!.font=`${bold?700:400} ${size}px Arial, sans-serif`;const words=v.split(/\s+/),lines:string[]=[];let row='';
    for(const word of words){const next=row?row+' '+word:word;if(c!.measureText(next).width>width && row){lines.push(row);row=word;}else row=next;}if(row)lines.push(row);
    lines.slice(0,maxLines).forEach((line,i)=>{let out=line;if(i===maxLines-1 && lines.length>maxLines){while(c!.measureText(out+'…').width>width)out=out.slice(0,-1);out+='…';}text(out,x,y+i*(size+6),size,color,bold);});
  }
  const i=a.intel,act=i.activity;
  text('YOUTUBE / QUICK CHANNEL INTEL',48,42,15,orange,true);
  wrap(a.name,48,100,1120,42,1,ink,true);
  text(i.window.from+' — '+i.window.to,1190,42,15,muted);
  text(i.window.playlistComplete?'Uploads playlist scanned':'Partial inventory',1190,68,14,muted);
  if(i.reviewedReleases)text('Releases check '+i.reviewedReleases.checkedAt,1190,94,13,muted);
  [[n(a.stats.subs),'SUBSCRIBERS'],[String(act.uploads),'UPLOADS FOUND / 6 MONTHS'],[String(act.shorts),'SHORTS IDENTIFIED / 6 MONTHS'],[n(act.views),'LIFETIME VIEWS ON THESE UPLOADS']].forEach(([value,label],j)=>{text(value,48+j*390,170,38,ink,true);text(label,48+j*390,197,12,muted,true);});
  wrap(i.headline,48,260,1495,30,2,ink,true);
  wrap(i.read,48,328,1495,18,2,muted);
  if(i.coverageWarning)wrap(i.coverageWarning,48,380,1495,15,1,orange,true);
  text('WHERE PEOPLE RESPOND',48,432,16,ink,true);
  i.proof.slice(0,2).forEach((v,j)=>{
    const x=48+j*530;
    wrap(v.title,x,470,480,21,2,ink,true);
    text(v.publishedAt.slice(0,10)+' · '+v.format+(v.older?' · older example':''),x,529,13,muted);
    text(n(v.views)+' views',x,567,28,ink,true);
    text((v.likes==null?'Likes unavailable':n(v.likes)+' likes')+' · '+(v.comments==null?'Comments unavailable':n(v.comments)+' comments'),x,596,16,muted);
    text('youtube.com/watch?v='+v.id,x,622,12,muted);
  });
  text('NEXT USEFUL STEP',1135,432,16,orange,true);
  const action=i.next[0];
  if(action){wrap(action.title,1135,470,410,23,2,ink,true);wrap(action.action,1135,535,410,18,6);}
  text('PUBLISHING RHYTHM / ALL UPLOADS FOUND',48,698,16,ink,true);
  const max=Math.max(1,...i.months.map(m=>m.videos+m.shorts+m.audio));
  const step=1450/i.months.length;
  i.months.forEach((m,j)=>{
    const x=48+j*step,barWidth=Math.min(100,step-25),h=112/max;let bottom=872;
    for(const [value,color] of [[m.videos,orange],[m.shorts,blue],[m.audio,'#8F887E']] as const){c.fillStyle=color;c.fillRect(x,bottom-value*h,barWidth,value*h);bottom-=value*h;}
    if(m.videos+m.shorts+m.audio===0){c.fillStyle=rule;c.fillRect(x,870,barWidth,2);}
    text(String(m.videos+m.shorts+m.audio),x,bottom-12,17,ink,true);text(m.label+(m.partial?'*':''),x,897,14,muted);
  });
  text('Videos',48,933,13,orange,true);text('Shorts',130,933,13,blue,true);text('Release audio',207,933,13,'#8F887E',true);text('*Partial month · Views/likes/comments are lifetime counts; not unique fans or subscriber conversion.',350,933,12,muted);
  const url='https://youtube-campaign-coach.vercel.app/watcher/'+encodeURIComponent(a.slug);
  const qr=document.createElement('canvas');await toCanvas(qr,url,{width:96,margin:1,color:{dark:ink,light:'#FAF7F2'}});c.drawImage(qr,1450,77,96,96);
  text('Source: cached YouTube Data API · Playlist + stated reviewed sources; no exhaustive Releases/Topic or third-party inventory · Open channel via QR',48,977,11,muted);
  const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error('Export failed');
  const objectUrl=URL.createObjectURL(blob),link=document.createElement('a');link.href=objectUrl;link.download=`${a.slug}-quick-intel-${i.window.to}.png`;link.click();setTimeout(()=>URL.revokeObjectURL(objectUrl),1000);
}
