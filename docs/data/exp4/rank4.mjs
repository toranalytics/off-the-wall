import fs from 'node:fs'; import path from 'node:path'; import { pathToFileURL } from 'node:url'
const root='/Users/SJB/.aside/u/0/sessions/2026-10-22_0s8heOAE5qcpaKfV/tmp/claude-cli/config/plugins/cache/off-the-wall/off-the-wall'; const src=path.join(root,fs.readdirSync(root)[0],'src')
const { features, build } = await import(pathToFileURL(path.join(src,'similar.mjs')).href); const { TASKS } = await import('./tasks4.mjs'); const store=JSON.parse(fs.readFileSync('../otw-exp2/store/store.json','utf8'))
function wq(f,idf,u){const vec=new Map();let sq=0;for(const[k,tf]of f){const w=(1+Math.log(tf))*(idf.get(k)??u);if(w>0){vec.set(k,w);sq+=w*w}}return{vec,norm:Math.sqrt(sq)}}
const sc=(ix,q)=>{const{vec,norm}=wq(features(q),ix.idf,ix.unseen);const o=new Array(ix.docs.length).fill(0);if(!norm)return o;for(const d of ix.docs){if(!d.norm)continue;let dot=0;for(const[k,w]of vec){const v=d.vec.get(k);if(v)dot+=w*v}o[d.i]=dot/(norm*d.norm)}return o}
const T=f=>store.map(r=>String(f(r)).slice(0,300)); const A=build(T(r=>r.about)),Q=build(T(r=>r.quote)),R=build(T(r=>r.rule))
const res={}; for(const v of ['V0 about','V3 about|quote|rule']){ const ranks=TASKS.map(t=>{const a=sc(A,t.prompt);let s=a;if(v.startsWith('V3')){const q=sc(Q,t.prompt),r=sc(R,t.prompt);s=a.map((x,i)=>Math.max(x,q[i],r[i]))}const order=s.map((x,i)=>({x,i})).sort((p,q)=>q.x-p.x).map(o=>store[o.i].id);return order.indexOf(t.pref)+1});
  const at=n=>ranks.filter(r=>r<=n).length; res[v]={'@6':at(6),'@12':at(12),'@20':at(20),'@30':at(30),median:ranks.slice().sort((a,b)=>a-b)[10],ranks:ranks.join(',')} }
console.table(res)
