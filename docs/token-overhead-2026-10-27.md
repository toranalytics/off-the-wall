# OTW recall/routing token overhead (single machine, Codex 0.162.1, model gpt-6-luna low effort)
Synthetic prompts, isolated CODEX_HOME/OTW_HOME, 6 synthetic seeded corrections. Second turn of `codex exec resume`. n=1 per condition: indicative only, not a statistical result.
| condition | last-turn input tokens | extra developer messages (chars) |
|---|---|---|
| recall off, routing off | 13,743 | none |
| recall only | 14,028 (+285) | recall block 1,015 |
| routing only | 14,364 (+621) | routing text 1,531 appeared twice after resume |
| both on | 14,781 (+1,038) | routing 1,531 x2 + recall 1,015 |
Notes: cached-token counts varied between runs and are not comparable. Disabling the plugin with `plugins."off-the-wall@off-the-wall".enabled=false` did NOT stop hooks in exec mode (recall block still present), so the OTW config file was used for the baseline. The routing text being injected twice after a resume is an observed duplication to investigate. This measures prompt size only; it does not measure answer quality or cost savings.
