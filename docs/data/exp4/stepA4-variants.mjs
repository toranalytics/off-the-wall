import fs from 'node:fs'; import path from 'node:path'; import { pathToFileURL } from 'node:url'
const root='/Users/SJB/.aside/u/0/sessions/2026-10-22_0s8heOAE5qcpaKfV/tmp/claude-cli/config/plugins/cache/off-the-wall/off-the-wall'; const src=path.join(root,fs.readdirSync(root)[0],'src')
const { features, build, MIN_SIMILAR, QUOTES } = await import(pathToFileURL(path.join(src,'similar.mjs')).href)
const { TASKS } = await import('./tasks4.mjs'); const store = JSON.parse(fs.readFileSync('../otw-exp2/store/store.json','utf8'))
function wq(f, idf, unseen) { const vec=new Map(); let sq=0; for (const [k,tf] of f){const w=(1+Math.log(tf))*(idf.get(k)??unseen); if(w>0){vec.set(k,w);sq+=w*w}} return {vec,norm:Math.sqrt(sq)} }
const scores=(ix,q)=>{const {vec,norm}=wq(features(q),ix.idf,ix.unseen);const o=new Array(ix.docs.length).fill(0);if(!norm)return o;for(const d of ix.docs){if(!d.norm)continue;let dot=0;for(const[k,w]of vec){const v=d.vec.get(k);if(v)dot+=w*v}o[d.i]=dot/(norm*d.norm)}return o}
const T = f => store.map(r=>String(f(r)).slice(0,300)); const A=build(T(r=>r.about||r.quote)), Q=build(T(r=>r.quote)), R=build(T(r=>r.rule)), AQ=build(T(r=>(r.about||'')+' '+r.quote))
function pick(p, v){ let sc; const a=scores(A,p); if(v==='V0') sc=a; else if(v==='V2') {const q=scores(Q,p); sc=a.map((x,i)=>Math.max(x,q[i]))} else if(v==='V3'){const q=scores(Q,p), r=scores(R,p); sc=a.map((x,i)=>Math.max(x,q[i],r[i]))} else if(v==='V4'){const r=scores(R,p); sc=a.map((x,i)=>Math.max(x,r[i]))}
  const out=[],seen=new Set(); for(const x of sc.map((s,i)=>({s,i})).filter(x=>x.s>=MIN_SIMILAR).sort((a,b)=>b.s-a.s)){const r=store[x.i];const k=r.quote;if(seen.has(k))continue;seen.add(k);out.push(r);if(out.length>=QUOTES)break} return out }
const res={}; for (const v of ['V0','V2','V3','V4']) for (const half of ['odd','even','all']) { const ts=TASKS.filter((t,i)=>half==='all'||(half==='odd'?i%2===0:i%2===1)); let hit=0,picks=0,any=0; for(const t of ts){const p=pick(t.prompt,v);picks+=p.length;if(p.length)any++;if(p.some(x=>x.id===t.pref))hit++} res[`${v}/${half}`]={n:ts.length,hit,hitRate:+(hit/ts.length).toFixed(2),picks,withBlock:any} }
console.table(res)
