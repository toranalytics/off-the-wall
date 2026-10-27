import fs from 'node:fs'; import path from 'node:path'; import { pathToFileURL } from 'node:url'
const root='/Users/SJB/.aside/u/0/sessions/2026-10-22_0s8heOAE5qcpaKfV/tmp/claude-cli/config/plugins/cache/off-the-wall/off-the-wall'
const src=path.join(root,fs.readdirSync(root)[0],'src')
const { pickCorrections } = await import(pathToFileURL(path.join(src,'similar.mjs')).href)
const { projectKey } = await import(pathToFileURL(path.join(src,'scope.mjs')).href)
const { TASKS } = await import('./tasks.mjs'); const store = JSON.parse(fs.readFileSync('store/store.json','utf8'))
const key = projectKey('/Users/SJB/.aside/u/0/sessions/2026-10-22_0s8heOAE5qcpaKfV/tmp/claude-cli/exp2/work')
const list = store.map((r,i)=>({ at: 1700000000000+i, about:r.about, quote:r.quote, rule:r.rule, host:'claude', src:'live', project:key, origin:'interactive-user', sessionId:'s'+i, _id:r.id, _cat:r.category }))
const N=store.length, K=15; const nCat = c => store.filter(r=>r.category===c).length
const choose=(n,k)=>{let r=1;for(let i=1;i<=k;i++)r=r*(n-k+i)/i;return r}
let hits=0, withBlock=0, totalPicks=0, noisePicks=0, relPicks=0, expect=0; const rows=[]
for (const t of TASKS) { const picks = pickCorrections(list, t.prompt, Date.now(), 3, key); const k=picks.length; const rel=picks.filter(p=>p._cat===t.category).length
  const chance = k? 1 - choose(N-nCat(t.category),k)/choose(N,k) : 0
  rows.push({task:t.id,cat:t.category,k,rel,noise:picks.filter(p=>p._cat==='noise').length,cats:picks.map(p=>p._cat).join('/'),chance:+chance.toFixed(2)}); if(k)withBlock++; if(rel>0)hits++; totalPicks+=k; relPicks+=rel; noisePicks+=picks.filter(p=>p._cat==='noise').length; expect+=chance }
console.table(rows)
console.log(`tasks with any block: ${withBlock}/${TASKS.length}; tasks whose block has >=1 same-category correction: ${hits}/${TASKS.length}; expected by chance (same k, random picks): ${expect.toFixed(1)}`)
console.log(`picks total ${totalPicks}: same-category ${relPicks}, noise ${noisePicks}`)
