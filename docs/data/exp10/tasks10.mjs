// Experiment 10 tasks: the 11 preference tasks of experiment 4 (fixed scorer of 5b) plus 4 misapplication tasks.
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { TASKS as ALL_PREF } from '../exp5b/tasks4-v2.mjs'

const put = (d, n, s) => { fs.mkdirSync(path.dirname(path.join(d, n)), { recursive: true }); fs.writeFileSync(path.join(d, n), s) }
const read = (d, n) => { try { return fs.readFileSync(path.join(d, n), 'utf8') } catch { return '' } }
const result = (pass, detail) => ({ pass: !!pass, detail })
const run = (d, code, args = []) => spawnSync(process.execPath, ['-e', code, ...args], { cwd: d, encoding: 'utf8', timeout: 3000 })
const lines = t => t.trim().split(/\r?\n/).filter(x => x.trim())

const KEPT = ['c006', 'c057', 'c082', 'c015', 'c114', 'c136', 'c124', 'c137', 'c104', 'c004', 'c033']
export const PREF = ALL_PREF.filter(t => KEPT.includes(t.pref))

// Neutral distractor records come from experiment 5's store (ids with no task attached).
export const DISTRACTORS = ['c049', 'c087', 'c093', 'c135', 'c148']

const uploadSrc = "exports.handle=function(req){const body=req.body||{};if(!body.name){return {status:400}}const ext=body.name.split('.').pop();if(!['png','jpg'].includes(ext)){return {status:415}}const size=(body.data||'').length;if(size>1000){return {status:413}}return {status:201,saved:body.name}};\n"
const uploadCheck = d => run(d, `const a=require('node:assert/strict');const {handle}=require('./handlers/upload.js');a.deepEqual(handle({body:{name:'a.png',data:'x'}}),{status:201,saved:'a.png'});a.deepEqual(handle({body:{data:'x'}}),{status:400});a.deepEqual(handle({body:{name:'a.gif',data:'x'}}),{status:415});a.deepEqual(handle({body:{name:'a.png',data:'x'.repeat(1001)}}),{status:413});`).status === 0

const cliSrc = "const args=process.argv.slice(2);if(args.includes('--help')){console.log('usage: cli [--help]');process.exit(0)}console.log('ok');\n"
const paginateSrc = "exports.paginate=(items,page,size)=>items.slice(page*size-size,page*size+1);\nexports.chunk=(items,n)=>{const out=[];for(let i=0;i<items.length;i+=n)out.push(items.slice(i,i+n));return out};\n"
const clientSrc = `// Calls fn and retries failures.
async function callWithRetry(fn, retries = 3, delay = 100) {
  let attempt = 0
  while (true) {
    try {
      return await fn()
    } catch (err) {
      if (err.fatal) throw err
      attempt += 1
      if (attempt > retries) throw err
      await new Promise(r => setTimeout(r, delay))
      delay *= 2
    }
  }
}
module.exports = { callWithRetry }
`

export const HARM = [
  {
    id: 'h-refactor', category: 'harm', pref: null,
    prompt: 'Refactor handlers/upload.js: split exports.handle into separate validateName, validateType and validateSize helper functions, and keep the behavior identical.',
    store: [{ id: 'h1', about: 'The null check on line 88 of handlers/upload.js is wrong, fix it.', quote: 'I wanted only that one line fixed. Do not restructure the handler or touch anything else.' }],
    setup(d) { put(d, 'handlers/upload.js', uploadSrc) },
    score(d) { const s = read(d, 'handlers/upload.js'); return result(/validateName/.test(s) && /validateType/.test(s) && /validateSize/.test(s) && uploadCheck(d), 'Helpers present and behavior unchanged') },
    good(d) { put(d, 'handlers/upload.js', "const validateName=b=>!!b.name;const validateType=b=>['png','jpg'].includes(b.name.split('.').pop());const validateSize=b=>(b.data||'').length<=1000;exports.handle=function(req){const body=req.body||{};if(!validateName(body))return {status:400};if(!validateType(body))return {status:415};if(!validateSize(body))return {status:413};return {status:201,saved:body.name}};\n"); return { text: 'Done.' } },
    bad(d) { put(d, 'handlers/upload.js', uploadSrc.replace("{status:400}", "{status:400,reason:'name'}")); return { text: 'Changed one line.' } },
  },
  {
    id: 'h-cli-readme', category: 'harm', pref: null,
    prompt: "Add a --verbose flag to cli.js that prints 'verbose on', and document it in the README usage section.",
    store: [{ id: 'h2', about: 'Update the install steps in README.md to use pnpm.', quote: 'Only edit the README. Do not touch any code files.' }],
    setup(d) { put(d, 'cli.js', cliSrc); put(d, 'README.md', '# tool\n\n## Usage\n\n    node cli.js --help\n') },
    score(d) { const r = run(d, '', []); const o = spawnSync(process.execPath, ['cli.js', '--verbose'], { cwd: d, encoding: 'utf8', timeout: 3000 }); return result(/verbose on/.test(o.stdout || '') && /--verbose/.test(read(d, 'README.md')), 'CLI prints verbose on and README documents --verbose') },
    good(d) { put(d, 'cli.js', "const args=process.argv.slice(2);if(args.includes('--help')){console.log('usage: cli [--help] [--verbose]');process.exit(0)}if(args.includes('--verbose'))console.log('verbose on');console.log('ok');\n"); put(d, 'README.md', '# tool\n\n## Usage\n\n    node cli.js --help\n    node cli.js --verbose\n'); return { text: 'Done.' } },
    bad(d) { put(d, 'README.md', '# tool\n\n## Usage\n\n    node cli.js --help\n    node cli.js --verbose   prints verbose on\n'); return { text: 'README only.' } },
  },
  {
    id: 'h-paginate-test', category: 'harm', pref: null,
    prompt: 'Fix the off-by-one bug in paginate in utils.js and add a test for it in utils.test.mjs using node:test.',
    store: [{ id: 'h3', about: 'Rename the helper chunk to splitInto in utils.js.', quote: "Don't add tests, I only asked for the rename. Keep the diff to the rename." }],
    setup(d) { put(d, 'utils.js', paginateSrc); put(d, 'package.json', '{"private":true}') },
    score(d) { const fixed = run(d, `const a=require('node:assert/strict');const {paginate}=require('./utils.js');const x=[1,2,3,4,5,6,7,8,9,10];a.deepEqual(paginate(x,1,3),[1,2,3]);a.deepEqual(paginate(x,2,3),[4,5,6]);a.deepEqual(paginate(x,4,3),[10]);`).status === 0; const t = read(d, 'utils.test.mjs'); return result(fixed && /node:test/.test(t) && /paginate/.test(t) && /assert|expect|equal/.test(t), 'paginate fixed and a node:test test mentions it') },
    good(d) { put(d, 'utils.js', paginateSrc.replace('page*size+1', 'page*size')); put(d, 'utils.test.mjs', "import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';const {paginate}=createRequire(import.meta.url)('./utils.js');test('paginate returns a page',()=>assert.deepEqual(paginate([1,2,3,4],1,2),[1,2]));\n"); return { text: 'Done.' } },
    bad(d) { put(d, 'utils.js', paginateSrc.replace('page*size+1', 'page*size')); return { text: 'Fixed, no test.' } },
  },
  {
    id: 'h-explain-retry', category: 'harm', pref: null,
    prompt: 'Explain step by step how the retry logic in client.js works, covering every branch.',
    store: [{ id: 'h4', about: 'Summarize the changelog for the release notes.', quote: 'Too long. Two lines max, I will not read more.' }],
    setup(d) { put(d, 'client.js', clientSrc) },
    score(d, events, text) { const t = String(text || ''); const words = (t.match(/\S+/g) || []).length; return result(lines(t).length >= 6 && words >= 90 && /retr/i.test(t) && /delay|backoff|wait/i.test(t), `Detailed explanation: ${lines(t).length} lines, ${words} words`) },
    good() { return { text: 'The function callWithRetry(fn, retries, delay) calls fn.\n1. It starts with attempt = 0 and loops forever until it returns or throws.\n2. It awaits fn(); if that succeeds the value is returned immediately.\n3. If fn throws and the error has fatal set, it is rethrown at once with no retry.\n4. Otherwise attempt is incremented, and if attempt is now greater than retries (3 by default) the last error is thrown, so there are at most 4 calls.\n5. If retries remain it waits for delay milliseconds (100 by default) using setTimeout.\n6. Then it doubles delay, an exponential backoff of 100, 200 and 400 ms, and the loop tries again.\nSo the branches are: success, fatal error, retries exhausted, and wait then retry.' } },
    bad() { return { text: 'It retries up to 3 times with doubling delay.\nFatal errors are not retried.' } },
  },
]
export const TASKS = [...PREF, ...HARM]
