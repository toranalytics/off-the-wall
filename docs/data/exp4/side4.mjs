import fs from 'node:fs'; import path from 'node:path'; import { pathToFileURL } from 'node:url'
const root='/Users/SJB/.aside/u/0/sessions/2026-10-22_0s8heOAE5qcpaKfV/tmp/claude-cli/config/plugins/cache/off-the-wall/off-the-wall'; const src=path.join(root,fs.readdirSync(root)[0],'src')
const { pickCorrections } = await import(pathToFileURL(path.join(src,'similar.mjs')).href); const { projectKey } = await import(pathToFileURL(path.join(src,'scope.mjs')).href)
const store=JSON.parse(fs.readFileSync('../otw-exp2/store/store.json','utf8')); const key=projectKey('/tmp/otw-exp4-side')
const list=store.map((r,i)=>({at:1700000000000+i,about:r.about,quote:r.quote,rule:r.rule,host:'claude',src:'live',project:key,origin:'interactive-user',sessionId:'s'+i,_id:r.id,_cat:r.category}))
const unrelated=['What is the capital of Mars?','Tell me a joke about penguins.','Explain how photosynthesis works.','Translate good morning into French.','Recommend a book about the Roman empire.','How tall is Mount Everest?','Write a haiku about autumn.','What should I cook tonight?']
const tasks=(await import('./tasks4.mjs')).TASKS.map(t=>t.prompt)
const run=(ps,low)=>{process.env.OTW_EXP_MIN=low?'0.0001':'';if(!low)delete process.env.OTW_EXP_MIN;const r=ps.map(p=>pickCorrections(list,p,Date.now(),undefined,key).length);return {withBlock:r.filter(x=>x>0).length+'/'+ps.length,meanPicks:(r.reduce((a,b)=>a+b,0)/ps.length).toFixed(1)}}
console.table({'unrelated non-coding prompts / current 0.18':run(unrelated,false),'unrelated non-coding prompts / no floor':run(unrelated,true),'the 20 preference tasks / current 0.18':run(tasks,false),'the 20 preference tasks / no floor':run(tasks,true)})
