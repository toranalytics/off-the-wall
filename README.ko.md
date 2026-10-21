<p align="right">
  <a href="README.md">English</a> | <strong>한국어</strong> | <a href="README.ja.md">日本語</a> | <a href="README.zh-CN.md">中文</a>
</p>

<p align="center">
  <img src="assets/hero.png" alt="Off the Wall: 터미널 위의 픽셀 앵무새가 과거 지적을 인용하는 그림" width="100%" />
</p>

<h1 align="center">Off the Wall</h1>

<p align="center">
  <strong>코딩 에이전트에게 같은 지적을 두 번 하지 마세요.</strong>
  <br/>
  <sub><strong>Claude Code</strong>와 <strong>Codex</strong>용 플러그인. 사용자가 예전에 한 지적을 다음 답 앞에 그대로 둡니다.</sub>
</p>

<p align="center">
  <a href="https://github.com/toranalytics/off-the-wall/actions/workflows/ci.yml"><img alt="tests" src="https://img.shields.io/github/actions/workflow/status/toranalytics/off-the-wall/ci.yml?branch=main&label=tests&style=flat-square"></a>
  <a href="https://github.com/toranalytics/off-the-wall/releases"><img alt="release" src="https://img.shields.io/github/v/release/toranalytics/off-the-wall?style=flat-square"></a>
  <a href="LICENSE"><img alt="MIT license" src="https://img.shields.io/badge/license-MIT-green?style=flat-square"></a>
  <img alt="Claude Code plugin" src="https://img.shields.io/badge/Claude%20Code-plugin-d97757?style=flat-square">
  <img alt="Codex plugin" src="https://img.shields.io/badge/Codex-plugin-10a37f?style=flat-square">
  <img alt="no dependencies" src="https://img.shields.io/badge/dependencies-0-blue?style=flat-square">
</p>

<p align="center">
  <a href="#빠른-시작">빠른 시작</a> ·
  <a href="#왜-off-the-wall인가">왜</a> ·
  <a href="#무엇을-가장-많이-지적했나">보고</a> ·
  <a href="#에이전트가-보는-것">작동 방식</a> ·
  <a href="#더-싼-하위-에이전트">라우팅</a> ·
  <a href="#근거">근거</a> ·
  <a href="#설정">설정</a> ·
  <a href="#개인정보">개인정보</a>
</p>

**에이전트가 답하기 전에 사용자의 지적을 원문 그대로 인용합니다. 무엇을 가장 많이 지적했는지 1분 만에 보여 줍니다. 하위 에이전트는 더 싼 모델로 돌립니다.**

"묻지 말고 골라서 해", "테스트 진짜 돌려 본 거 맞아?" 같은 지적은 보통 다음 세션이면 잊힙니다. Off the Wall은 그런
메시지를 모아 두었다가, 답할 때마다 가장 관련 있는 것을 사용자의 말 그대로 에이전트에게 다시 보여 줍니다. 이미
내고 있는 Claude나 ChatGPT 구독으로 돌고, API 키는 필요 없습니다.

> Off the Wall은 이제 막 나온 0.1 버전입니다. 아래 숫자는 한 사람의 기록에서 나왔으니, 직접 자기 기록으로 보고를 돌려 보세요.

---

## 왜 Off the Wall인가

| 문제 | 일어나는 일 | Off the Wall |
| :-- | :-- | :-- |
| 반복되는 지적 | 이번 달에만 "묻지 말고 그냥 해"를 열 번째 말함 | 사용자가 예전에 한 말을 다음 답 앞에 둠 |
| 남지 않는 규칙 | 지적을 깔끔한 한 줄 규칙으로 요약해도 바뀌는 게 적음 | 요약이 아니라 인용. 요약은 무작위 규칙보다 낫지 않았음([근거](#근거)) |
| 모든 하위 에이전트가 비싼 모델 | 검색·grep까지 가장 비싼 모델로 돎 | 오케스트레이터가 하위 에이전트마다 모델을 지정. 시험에서 43~61% 저렴 |
| 또 다른 요금 | 기억 도구는 대개 API 키가 필요함 | 판정을 이미 쓰는 `claude`나 `codex` 명령으로 돌림 |

## 빠른 시작

**1. 설치**

Claude Code 입력창에서:

```
/plugin install off-the-wall --marketplace toranalytics/off-the-wall
```

Codex:

```bash
codex plugin marketplace add toranalytics/off-the-wall
codex plugin add off-the-wall@off-the-wall
```

그다음 Codex에서 `/hooks`를 한 번 열어 Off the Wall 훅을 승인하세요. Codex는 승인 전까지 플러그인 훅을 실행하지 않습니다.

**2. 예시 기록으로 보고 돌려 보기** (자기 기록이 없어도 됩니다)

```bash
git clone https://github.com/toranalytics/off-the-wall && cd off-the-wall
node bin/otw.mjs report --host claude --claude-dir examples/claude-history --days 0
```

**3. 자기 기록으로 돌리고, 거기서부터 인용 시작**

```bash
node bin/otw.mjs report --seed
```

Node 18 이상이 필요합니다. macOS의 Claude Code 2.1.301과 codex-cli 0.162.1에서 시험했습니다.

## 무엇을 가장 많이 지적했나

<p align="center">
  <img src="assets/report.svg" alt="Off the Wall 보고 출력: 답 20개 중 9개가 지적, 종류별 묶음과 원문 인용" width="92%" />
</p>

`report`는 컴퓨터에 이미 있는 Claude Code와 Codex 대화 기록(`~/.claude/projects`, `~/.codex/sessions`)을 읽고,
사용자 답 가운데 에이전트의 일하는 방식을 지적한 것을 작은 모델로 가려냅니다. 그리고 가장 많이 지적한 종류를
사용자의 말과 함께 보여 줍니다. 위 그림은 [예시 기록](examples/claude-history)에 실제로 돌린 출력입니다. 판정
한 번에 약 20턴을 묶습니다. 시험에서는 100턴에 Codex로 약 50초, 65턴에 Claude로 약 75초 걸렸습니다.

`--seed`를 붙이면 찾은 지적을 저장합니다. 그래서 몇 주를 써 볼 필요 없이 다음 요청부터 바로 인용이 붙습니다.

마지막에는 이 저장소의 [Discussions](https://github.com/toranalytics/off-the-wall/discussions/categories/show-and-tell)에
가장 많이 지적한 종류 세 가지와 횟수를 채운 글쓰기 링크가 나옵니다. 들어가는 것은 횟수와 종류 이름뿐이고, 인용된
사용자의 말은 들어가지 않습니다. 올릴지는 사용자가 정합니다. 내 1위와 같은지 알려 주는 가장 빠른 방법입니다.

## 에이전트가 보는 것

<p align="center">
  <img src="assets/context.svg" alt="에이전트가 답하기 전에 Off the Wall이 붙이는 문구: 과거 지적 원문 6개와 지적을 예측하라는 지시" width="92%" />
</p>

| 시점 | Claude Code | Codex |
| :-- | :-- | :-- |
| 요청마다 | 과거 지적을 최대 6개 인용(각 200자까지): 이번 요청과 가장 비슷한 3개, 그다음 최근 것 | 같음 |
| 요청마다 | 직전 답과 새 메시지를 별도 프로세스에서 판정해, 지적이면 저장 | 같음 |
| 턴 끝 | 판정용으로 답의 끝부분을 보관 | 같음 |
| 세션 시작 | 라우팅 규칙 추가 | 라우팅 규칙 추가 |
| 하위 에이전트 시작 | `model`이 없는 범용 `Agent` 호출을 턴마다 한 번 되돌려 보냄(fork와 이름 있는 에이전트 종류는 통과) | `model`이나 `reasoning_effort`가 없는 `spawn_agent` 호출을 턴마다 한 번 되돌려 보냄 |

모델 호출을 기다리는 단계는 없습니다. 판정은 별도 프로세스에서 요청과 나란히 돌고, 요청은 그것을 기다리지 않습니다. 요청이 한국어면 인용 문구도
한국어(측정한 문구 그대로)로, 그 밖에는 영어로 붙습니다.

## 더 싼 하위 에이전트

<p align="center">
  <img src="assets/routing.svg" alt="같은 위임 작업의 비용: 라우팅 켬 $0.171, $0.173, 끔 $0.300, $0.439" width="92%" />
</p>

메인 모델이 오케스트레이터가 되어, 하위 에이전트에게 무엇을 결정하도록 맡기는지를 보고 모델을 고릅니다.

| 등급 | 언제 | Claude Code | Codex |
| :-- | :-- | :-- | :-- |
| small | 조회·변환: 찾기, grep, 나열, 추출, 형식 변환 | `haiku` | 계정의 빠른 모델, `reasoning_effort: low` |
| mid | 목표와 기준이 주어진 일: 조사, 검토, 구현, 테스트 | `sonnet` | 주력 모델, `medium` |
| large | 무엇이 문제인지부터 정해야 하는 일: 근본 원인, 설계, 이전 계획 | `opus` | 최상위 모델, `high` |

몇 단계면 끝나는 일은 메인 모델이 직접 하는 게 가장 쌉니다. Codex 모델 이름은 계정마다 다르기 때문에, Codex가
계정별로 보관하는 목록(`~/.codex/models_cache.json`)을 읽고 모델 설명을 보고 세 등급으로 나눕니다. Codex에는
"대화가 필요 없으면 `fork_turns: "none"`을 넘기라"는 규칙도 들어갑니다. 넘기지 않으면 대화 전체가 하위 에이전트에
복사되고, 모델이 다르면 그 내용이 하나도 캐시되지 않습니다.

## 근거

<p align="center">
  <img src="assets/evidence.svg" alt="아무것도 안 붙인 경우 대비 승·무·패: 실제 지적 36/3/0, Off the Wall 25/11/3, 무작위 규칙 18/15/6, 요약 규칙 14/17/8" width="92%" />
</p>

측정한 숫자는 모두 한 사람의 실제 기록에서 나왔습니다. 일반 법칙이 아니라 첫 결과로 봐 주세요. 위의 20개 중 9개
보고는 지어낸 예시 세션에서 나온 것입니다.

**요약보다 인용이 낫습니다.** 실제 요청 39개를 다시 돌렸습니다. 모두 실제로는 바로 뒤에 지적이 나왔고, 그 지적이
글만 보고 판단 가능한 경우들입니다. 조건마다 Opus 5.5가 답했습니다. 채점은 Sonnet이 두 답을 비교하는 방식으로 했고,
어느 쪽 답인지 모르게 했으며, 순서를 바꿔 두 번 물었습니다. 두 번 모두 같은 쪽을 골라야 승리로 셌습니다. 인용에
"지적을 예측하라"는 한 줄을 더한 조건은 아무것도 안 붙인 답에 25승 11무 3패(p < 0.001), 무작위 규칙에 17승 14무
8패(39건에서 p = 0.11, 아직 확정이 아닌 우세)입니다. 요약 규칙은 무작위 규칙을 이기지 못했습니다.

**라우팅.** 따로 떼어 둔 실제 위임 30건에서 세 등급 규칙을 따른 Opus는 사람이 정한 모델을 28번 골랐고, 더 약한
모델을 고른 적은 없었습니다. "작은 일은 직접 하라"는 줄은 그 측정 뒤에 추가했습니다. 위 비용 비교는 작업 하나를
조건마다 두 번 돌린 것이라 평균이 아니라 참고 수치입니다. Codex 모델 대응은 같은 등급을 유추로 맞춘 것이고
측정하지 않았습니다.

<details>
<summary><strong>판정기: 지적을 얼마나 잘 찾나</strong></summary>

- 한 턴씩 판정: 사람이 표시한 56개 턴 끝에서 Claude Haiku의 정밀도는 0.82, 재현율은 0.72였습니다.
- `report`의 묶음 판정: 턴 끝 100개(지적 50개, 지적 아닌 것 50개)에서 한 턴씩 판정한 결과와 비교했고, 모델마다
  두 번씩 돌렸습니다. 결과를 가른 것은 묶음 크기가 아니라 판정 모델이었습니다. 그래서 기본값을 Haiku와 Codex
  주력 모델로 정했습니다.

| 판정 모델 (호출당 쌍 수) | 한 턴씩 판정과 일치 | 두 번 결과 겹침 |
| :-- | --: | --: |
| Claude Haiku (20) | 84, 90 | 0.83 |
| Claude Sonnet (20) | 81, 71 | 0.60 |
| gpt-6.1-sol (20) | 88, 88 | 0.92 |
| gpt-6-luna (20) | 61, 56 | 0.38 |
| gpt-6-luna (5) | 64, 66 | 0.39 |

- 예시 기록에서는 보고를 두 번 돌려 답 20개 중 같은 지적 9개를 찾았습니다. 그중 1개만 분류가 달랐습니다.

</details>

## 설정

`~/.otw/config.json`이며 모든 항목은 생략 가능합니다. 여기 적은 값이 자동 감지보다 우선합니다.

```json
{
  "recall": true,
  "capture": true,
  "routing": true,
  "judge": { "claude": "haiku", "codex": "gpt-6.1-sol" },
  "models": {
    "claude": { "small": "haiku", "mid": "sonnet", "large": "opus" },
    "codex": { "small": "gpt-6-luna", "mid": "gpt-6.1-sol", "large": "gpt-6-astra" }
  }
}
```

`node bin/otw.mjs status`로 저장 상태를 볼 수 있습니다.

## 개인정보

모든 자료는 사용자 컴퓨터의 `~/.otw`에 남습니다.
- `corrections.jsonl`
- 세션별 상태
- `log.jsonl`

밖으로 나가는 것은 판정 호출뿐이고, 그것도 사용자 본인의 `claude`나 `codex` 명령을 거칩니다. `~/.otw`를
지우면 전부 잊습니다.

## 한계

- Windows: CI에서 테스트와 훅 실행 시험은 통과했습니다(Node 18~22). 다만 Windows에서 실제 Claude Code나 Codex 세션을 돌려 보지는 않았습니다.
- 판정기가 놓칠 때가 있습니다(Claude Haiku: 정밀도 0.82, 재현율 0.72). Codex에서는 이 저장소에서 설치한 플러그인으로
  실제 세션을 돌려 기본 판정 모델이 지적 2번을 모두 잡았습니다. 이전의 gpt-6-luna 판정기는 2번 중 1번이었습니다.
- 인용은 모델에게만 보입니다. 세션 중에 사용자 화면에는 나오지 않습니다.

## 개발

```bash
npm test                          # node --test, 의존성 없음
node scripts/make-assets.mjs      # 실제 출력과 측정 숫자로 README 그림을 다시 그림
OTW_DEBUG=1 claude ...       # 모든 훅 이벤트를 ~/.otw/log.jsonl에 기록
```

[CONTRIBUTING.md](CONTRIBUTING.md)를 참고하세요. 변경 내역은 [CHANGELOG.md](CHANGELOG.md)에 있습니다.

## 등재된 목록

- [awesome-codex-plugins](https://github.com/hashgraph-online/awesome-codex-plugins)
- [awesome-ai-plugins](https://github.com/hashgraph-online/awesome-ai-plugins)
- [awesome-ai-agent-tools](https://github.com/michielhdoteth/awesome-ai-agent-tools)
- [Awesome-Vibe-Coding](https://github.com/0xWelt/Awesome-Vibe-Coding)
- [awesome-vibe-coding-resources](https://github.com/acvnace/awesome-vibe-coding-resources)

## 라이선스

MIT © [Junebeom Seo](https://github.com/toranalytics)
