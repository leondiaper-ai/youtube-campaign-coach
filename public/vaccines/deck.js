(()=>{'use strict';
const slides=[...document.querySelectorAll('#deck > .slide')];
const toggle=document.getElementById('present');
const sheet=document.getElementById('analysis');
const close=document.getElementById('close-analysis');
const deck=document.getElementById('deck');
const header=document.querySelector('.topbar');
const controls=document.querySelector('.present-controls');
const auditHashes=new Set(['analysis','catalogue-audit','album-audit','audit-priorities']);
let index=0,presenting=false,analysisOpen=false,returnHash='#intro',returnScroll=0,returnFocus=null;
function show(i){
 index=Math.max(0,Math.min(slides.length-1,i));
 slides.forEach((s,n)=>s.classList.toggle('active',n===index));
 document.getElementById('page-count').textContent=`${index+1} / ${slides.length}`;
 document.getElementById('previous').disabled=index===0;
 document.getElementById('next').disabled=index===slides.length-1;
 if(presenting)window.scrollTo({top:0,behavior:'instant'});
}
function setPresent(on){
 if(on){const current=slides.findIndex(s=>s.getBoundingClientRect().bottom>100);index=Math.max(0,current);}
 presenting=on;document.body.classList.toggle('present',on);
 toggle.textContent=on?'Exit present':'Present';toggle.setAttribute('aria-pressed',String(on));show(index);
 if(!on)slides[index].scrollIntoView({behavior:'instant',block:'start'});
}
function openAnalysis(target='analysis',writeHistory=true){
 if(!analysisOpen){
  returnHash=presenting?'#'+slides[index].id:(auditHashes.has(location.hash.slice(1))?'#intro':location.hash||'#intro');
  returnScroll=window.scrollY;returnFocus=document.activeElement;
  analysisOpen=true;sheet.hidden=false;document.body.classList.add('analysis-open');
  deck.inert=true;header.inert=true;controls.inert=true;
  sheet.scrollTop=0;sheet.focus({preventScroll:true});
  if(writeHistory)history.pushState(null,'','#'+target);
 }else if(writeHistory)history.replaceState(null,'','#'+target);
 if(target!=='analysis')document.getElementById(target)?.scrollIntoView({behavior:'instant',block:'start'});
 else sheet.scrollTop=0;
}
function closeAnalysis(writeHistory=true){
 if(!analysisOpen)return;
 analysisOpen=false;sheet.hidden=true;document.body.classList.remove('analysis-open');
 deck.inert=false;header.inert=false;controls.inert=false;
 if(writeHistory)history.replaceState(null,'',returnHash);
 window.scrollTo({top:returnScroll,behavior:'instant'});
 if(returnFocus instanceof HTMLElement&&returnFocus.isConnected)returnFocus.focus({preventScroll:true});
}
function syncLocation(){const target=location.hash.slice(1);if(auditHashes.has(target))openAnalysis(target,false);else closeAnalysis(false);}
toggle.addEventListener('click',()=>setPresent(!presenting));
close.addEventListener('click',()=>closeAnalysis());
document.getElementById('previous').addEventListener('click',()=>show(index-1));
document.getElementById('next').addEventListener('click',()=>show(index+1));
document.addEventListener('keydown',e=>{
 if(analysisOpen){
  if(e.key==='Escape'){e.preventDefault();closeAnalysis();return;}
  if(e.key==='Tab'){
   const items=[...sheet.querySelectorAll('a[href],button,summary,input,select,textarea,[tabindex]:not([tabindex="-1"])')].filter(el=>el.getClientRects().length&&!el.disabled);
   const first=items[0],last=items[items.length-1];
   if(first&&e.shiftKey&&(document.activeElement===first||document.activeElement===sheet)){e.preventDefault();last.focus();}
   else if(first&&!e.shiftKey&&(document.activeElement===last||document.activeElement===sheet)){e.preventDefault();first.focus();}
  }
  return;
 }
 if(!presenting||/INPUT|TEXTAREA|SELECT|SUMMARY/.test(e.target.tagName))return;
 if(e.key==='Escape'){setPresent(false);return;}
 if(e.key==='ArrowRight'||e.key==='PageDown'){e.preventDefault();show(index+1);}
 if(e.key==='ArrowLeft'||e.key==='PageUp'){e.preventDefault();show(index-1);}
});
document.querySelectorAll('a[href^="#"]').forEach(a=>a.addEventListener('click',e=>{
 const target=a.hash.slice(1);
 if(auditHashes.has(target)){e.preventDefault();openAnalysis(target);return;}
 const n=slides.findIndex(s=>s.id===target);if(presenting&&n>=0)show(n);
}));
window.addEventListener('popstate',syncLocation);
window.addEventListener('hashchange',syncLocation);
show(0);syncLocation();
})();
