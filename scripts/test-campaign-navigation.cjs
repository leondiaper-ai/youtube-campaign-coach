const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const React = require('react');
const {renderToStaticMarkup} = require('react-dom/server');
let query = new URLSearchParams('behaviour=artist-one');
const slots=[];let cursor=0;
const mod={exports:{}};
const code=ts.transpileModule(fs.readFileSync('src/components/CampaignStatusBoard.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
function req(name){
  if(name==='react')return {...React,useState:init=>{const i=cursor++;if(!(i in slots))slots[i]=typeof init==='function'?init():init;return [slots[i],v=>{slots[i]=typeof v==='function'?v(slots[i]):v;}];},useCallback:f=>f};
  if(name==='next/navigation')return {useSearchParams:()=>query,useRouter:()=>({replace(){},push(){}}),usePathname:()=>'/campaigns'};
  if(name==='next/link')return {__esModule:true,default:({children,...props})=>React.createElement('a',props,children)};
  if(name==='@/lib/labels')return {getLabelWorkspace:()=>null};
  if(name==='@/lib/artists')return {fmtNum:String};
  if(name==='@/lib/youtubeGrowthOS')return {DECISION_STYLE:{}};
  if(name==='./CampaignBehaviour')return {__esModule:true,default:({slug})=>React.createElement('div',{'data-behaviour':slug},'Behaviour for '+slug)};
  if(name==='./CampaignDecisionCard')return {};
  return require(name);
}
new Function('require','module','exports',code)(req,mod,mod.exports);
const Board=mod.exports.default;
function render(search,market='uk'){
  query=new URLSearchParams(search);cursor=0;
  return renderToStaticMarkup(React.createElement(Board,{initialCards:[],availableArtists:[{slug:'artist-one',name:'Artist One'},{slug:'artist-two',name:'Artist Two'}],market}));
}
assert.ok(render('behaviour=artist-one').includes('Behaviour for artist-one'));
const board=render('');
assert.ok(board.includes('No campaigns yet'));
assert.ok(!board.includes('data-behaviour'), 'removing query must close behaviour without a remount');
assert.ok(render('behaviour=artist-two').includes('Behaviour for artist-two'));
assert.ok(render('behaviour=artist-one').includes('Behaviour for artist-one'), 'browser Back switches artist');
assert.ok(!render('market=australia','australia').includes('data-behaviour'));
assert.ok(render('market=australia&behaviour=artist-two','australia').includes('/campaigns?market=australia'));
console.log('PASS: retained component follows board, artist changes, Back/Forward and regional URLs.');
