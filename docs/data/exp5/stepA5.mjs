import fs from 'node:fs'; import path from 'node:path'; import { pathToFileURL } from 'node:url'
const src='/Users/SJB/Desktop/ownwords-toranalytics/src'
const { pickCorrections } = await import(pathToFileURL(path.join(src,'similar.mjs')).href); const { projectKey } = await import(pathToFileURL(path.join(src,'scope.mjs')).href)
const { TASKS } = await import('../otw-exp4/tasks4.mjs'); const key=projectKey('/tmp/otw-exp5-stepA')
const mk=store=>store.map((r,i)=>({at:1700000000000+i*1000,about:r.about,quote:r.quote,rule:r.rule,host:'claude',src:'live',project:key,origin:'interactive-user',sessionId:'s'+i,_id:r.id,_pref:r.pref||r.id}))
const single=JSON.parse(fs.readFileSync('../otw-exp2/store/store.json','utf8')), full=JSON.parse(fs.readFileSync('store3.json','utf8'))
const kept=JSON.parse(fs.readFileSync('../otw-exp4/kept4.json','utf8'))
const out={}; for (const [name,store] of [['single (150)',single],['with repeats (240)',full]]) { const list=mk(store); for (const wide of [false,true]) { let hit=0,hitKept=0,picks=0,fam=0; for (const t of TASKS) { const p=pickCorrections(list,t.prompt,Date.now(),undefined,key,wide); picks+=p.length; const h=p.some(x=>x._pref===t.pref); if(h){hit++; if(kept.includes(t.id))hitKept++}; fam+=p.filter(x=>x._pref===t.pref).length } out[`${name} / ${wide?'no floor':'floor 0.18'}`]={targetHit_20:hit,targetHit_kept11:hitKept,picks,targetFamilyQuotes:fam,quotesPerPrompt:+(picks/20).toFixed(1)} } }
console.table(out)
