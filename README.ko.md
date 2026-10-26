<p align="right">
  <a href="README.md">English</a> | <strong>한국어</strong> | <a href="README.ja.md">日本語</a> | <a href="README.zh-CN.md">中文</a>
</p>

<p align="center">
  <img src="assets/hero.png" alt="Off the Wall: 터미널 위의 픽셀 앵무새가 과거 지적을 인용하는 그림" width="100%" />
</p>

<h1 align="center">Off the Wall</h1>

<p align="center">
  <strong>이미 한 지적을 코딩 에이전트에게 다시 떠올리게 하세요.</strong>
  <br/>
  <sub><strong>Claude Code</strong>와 <strong>Codex</strong>용 플러그인. 같은 작업 디렉터리에서 사용자가 예전에 한 지적을 다음 답 앞에 그대로 둡니다.</sub>
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
  <a href="#하위-에이전트-모델-선택-안내">모델 선택</a> ·
  <a href="#근거">근거</a> ·
  <a href="#설정">설정</a> ·
  <a href="#개인정보">개인정보</a>
</p>

**같은 작업 디렉터리에서 한 지적을, 에이전트가 답하기 전에 원문 그대로 인용합니다. 무엇을 가장 많이 지적했는지 로컬에서, 모델의 분류로 보여 주는 보고를 제공합니다. 하위 에이전트의 모델 선택 안내도 제공합니다.**

"묻지 말고 골라서 해", "테스트 진짜 돌려 본 거 맞아?" 같은 지적은 보통 다음 세션이면 잊힙니다. Off the Wall은 그런
메시지를 로컬에 모아 두었다가, 답하기 전에 같은 작업 디렉터리에 기록된 지적을 최대 6개까지 사용자의 말 그대로
에이전트에게 다시 보여 줍니다. 이미 쓰는 `claude`나 `codex` 명령을 거치므로 별도 API 키는 필요 없습니다. 그렇다고
아무것도 밖으로 나가지 않는 것은 아닙니다. [개인정보](#개인정보)를 참고하세요.

> 이 문서는 검토용으로 소스를 공개한 0.2.0 미출시 안전성 후보를 설명합니다. 안정판 출시나 실사용 효과를 뜻하지 않습니다. 아래 숫자는 이전 버전에서 한 사람의 기록으로 얻은 것이니, 직접 자기 기록으로 보고를 돌려 보세요.

> 초기 버전 안내: 효과 근거는 한 사람의 텍스트 재생 실험이며, 반복 지적 감소·비용 절감·업무 완수 개선을 일반적으로 보장하지 않습니다. 입력 분류기는 호스트나 플러그인의 자동 문구를 사용자 답변으로 잘못 처리할 수 있고, 사람이 쓴 입력을 완벽히 가려내지는 못합니다. 집계 횟수는 모델의 분류라 틀릴 수 있으니, 공유하기 전에 원문을 로컬에서 확인하세요.

---

## 왜 Off the Wall인가

| 문제 | 일어나는 일 | Off the Wall |
| :-- | :-- | :-- |
| 반복되는 지적 | 이번 달에만 "묻지 말고 그냥 해"를 열 번째 말함 | 사용자가 예전에 한 말을 다음 답 앞에 둠 |
| 남지 않는 규칙 | 지적을 깔끔한 한 줄 규칙으로 요약해도 바뀌는 게 적음 | 요약하지 않고 사용자의 말을 그대로 인용. 작은 재생 실험 하나에서 요약 규칙은 무작위 규칙보다 낫지 않았음([근거](#근거)) |
| 모든 하위 에이전트가 비싼 모델 | 검색·grep까지 가장 비싼 모델로 돌 수 있음 | 하위 에이전트마다 모델을 고르는 안내와, `model` 인자가 빠진 호출을 되돌려 보내는 점검. 더 싼 라우팅이나 비용 절감을 보장하지는 않음 |
| 또 다른 API 키 | 기억 도구는 대개 자체 API 키가 필요함 | 판정을 이미 쓰는 `claude`나 `codex` 명령으로 돌려 별도 키가 없음. 발췌문은 여전히 사용자의 제공자가 처리함([개인정보](#개인정보)) |

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

`--seed`는 사용자가 고른 기록을 다시 읽고, 호스트 기록에 작업 디렉터리가 있으면 출처 정보(프로젝트 해시와 입력 출처)를
붙여 저장합니다. 작업 디렉터리를 알 수 없는 턴은 저장되지 않고(건너뛴 수만 보고됩니다) 자동으로 승격되지도 않습니다.
[범위와 이전 기록](#범위와-이전-기록)을 참고하세요.

Node 18 이상이 필요합니다. 과거 기록: 이전 버전을 macOS의 Claude Code 2.1.301과 codex-cli 0.162.1에서 시험했습니다. 이 0.2.0 후보는 macOS에서 가상의 실행기·워커 점검만 거쳤고, 현재의 실제 Claude Code나 Codex 세션에서는 돌려 보지 않았습니다.

## 무엇을 가장 많이 지적했나

<p align="center">
  <img src="assets/report.svg" alt="가상의 예시 기록의 보관된 분류로 그린 보고 형식: 후보 답 20개 중 9개가 지적일 수 있다고 표시됨, 종류별 묶음과 원문 인용. 새로 돌린 모델 결과가 아님" width="92%" />
</p>

`report`는 컴퓨터에 이미 있는 Claude Code와 Codex 대화 기록(`~/.claude/projects`, `~/.codex/sessions`)을 읽고,
사용자 답 가운데 에이전트의 일하는 방식을 지적한 것을 작은 모델로 가려냅니다. 그리고 가장 많이 지적한 종류를
사용자의 말과 함께 보여 줍니다. 분류는 모델이 하므로 틀릴 수 있습니다. 위 그림은 [예시 기록](examples/claude-history)의 보관된 분류를 현재 보고 형식으로
그린 것입니다. 이 기록은 지어낸 것이고, 현재 CLI를 새로 돌리거나 모델을 새로 호출한 결과가 아닙니다. 보고가 어떻게 보이는지만 보여 줄 뿐,
모델이나 사용자에게 어떤 결과가 나는지는 보여 주지 않습니다. 판정 한 번에 약 20턴을 묶습니다. 이전 버전 시험에서는 100턴에 Codex로 약 50초, 65턴에 Claude로 약 75초 걸렸습니다. 고른 발췌문은
사용자 본인의 `claude`나 `codex` 명령을 거쳐 모델에 전달됩니다.

`--seed`를 붙이면 찾은 지적을 저장합니다. 그래서 몇 주를 써 볼 필요 없이 그 프로젝트의 다음 요청부터 인용을 시작할 수 있습니다.

마지막에는 이 저장소의 [Discussions](https://github.com/toranalytics/off-the-wall/discussions/categories/show-and-tell)에
가장 많이 지적한 종류 세 가지와 횟수를 채운 글쓰기 링크가 나옵니다. 들어가는 것은 횟수와 종류 이름뿐이고, 인용된
사용자의 말은 들어가지 않습니다. 횟수는 모델의 분류라 틀릴 수 있으니, 원문을 로컬에서 확인하고 게시 전에 내용을
직접 검토하세요. 대신 올려 주는 것은 없습니다.

## 에이전트가 보는 것

<p align="center">
  <img src="assets/context.svg" alt="에이전트가 답하기 전에 Off the Wall이 붙이는 문구의 형식을 보여 주는 예시 그림: 지적 원문 예시와 지적을 예측하라는 지시. 인용문은 예시 보고에서 가져온 것이며 관련성으로 고른 것이 아님" width="92%" />
</p>

| 시점 | Claude Code | Codex |
| :-- | :-- | :-- |
| 요청마다 | 과거 지적을 최대 6개 인용(각 200자까지). 같은 정규화된 작업 디렉터리(프로젝트 키)의 것만, 매칭 가드를 통과한 것만 씁니다. 6개보다 적거나 하나도 없는 것이 정상이며, 다른 프로젝트의 지적이나 최근 것으로 채우지 않습니다 | 같음 |
| 요청마다 | 직전 답과 새 메시지를 별도 프로세스에서 판정해, 지적이면 프로젝트 해시와 입력 출처를 붙여 저장 | 같음 |
| 턴 끝 | 판정용으로 답의 끝부분을 보관 | 같음 |
| 세션 시작 | 라우팅 규칙 추가 | 라우팅 규칙 추가 |
| 하위 에이전트 시작 | `model`이 없는 범용 `Agent` 호출을 턴마다 한 번 되돌려 보냄(fork와 이름 있는 에이전트 종류는 통과) | `model`이나 `reasoning_effort`가 없는 `spawn_agent` 호출을 턴마다 한 번 되돌려 보냄 |

모델 호출을 기다리는 단계는 없습니다. 판정은 별도 프로세스에서 요청과 나란히 돌고, 요청은 그것을 기다리지 않습니다. 요청이 한국어면 인용 문구도
한국어로, 그 밖에는 영어로 붙습니다. 현재의 문구와 선택기는 앞선 39건 실험에 쓰이지 않았습니다.

인용 블록에는 과거 기록이 실행·게시·삭제·공개의 허락이 아니며 현재 요청과 안전 규칙이 우선한다는 문구도 들어갑니다.

위 그림은 `scripts/make-assets.mjs`가 예시 보고의 인용문에 `correctionBlock`을 직접 호출해 만든 것입니다. 형식만
보여 줄 뿐, 관련성·작업 디렉터리·매칭 가드로 실제로 고른 결과가 아닙니다.

### 범위와 이전 기록

- 인용에는 작업 디렉터리와 출처 정보가 필요합니다. cwd가 없는 요청이나 프로젝트 키가 없는 기록에는 자동 인용이 붙지 않습니다.
- 범위는 정규화된 작업 디렉터리(프로젝트 해시로 저장)입니다. 하위 디렉터리, 옮긴 디렉터리, git worktree는 일부러 자동으로
  묶지 않으며, 각각 별개의 프로젝트입니다.
- 새 기록에는 프로젝트 해시와 입력 출처가 붙습니다. 프로젝트가 없거나 출처를 알 수 없는 이전 기록은 디스크에 남지만
  인용에서는 제외됩니다. 삭제하거나 고쳐 쓰지 않습니다.
- `report --seed`는 고른 기록을 다시 읽어, 호스트 기록에 cwd 메타데이터가 있는 곳에 출처 정보를 붙일 수 있습니다.
  다시 읽을 때는 프로젝트와 출처가 알려진 기록만 추가하고, cwd를 몰라 건너뛴 수를 보고합니다. 출처 없는 기록을 새로 저장하지 않으며, 자동으로 "안전" 승격되지도 않습니다.
- 입력 분류기는 명시적인 메타·비사람 출처의 글과 알려진 자동화 래퍼를 제외하고, 일반 Markdown과 긴 영어 글은
  그대로 둡니다. 필터일 뿐 사람이 쓴 입력을 완벽히 가려내는 장치가 아닙니다.
- 매칭 가드는 저장된 지적이 요청과 충분히 비슷해 인용할 만한지를 가립니다. 현재 임계값은 초기 엔지니어링 설정입니다. 필터일 뿐 보정된 정확도 수치가 아니며,
  정밀도나 재현율을 주장하지 않습니다.
- 이번 버전에는 기억 관리 UI나 삭제 명령이 없습니다. 로컬 기록을 지우려면 `~/.otw` 아래 파일을 직접 지우세요
  ([개인정보](#개인정보)). `capture: false`이면 새 프롬프트·답 발췌를 보관하지 않습니다(이미 저장된 지적은 지워지지 않음). `node bin/otw.mjs status`로 프로젝트·출처가 붙은 기록과 격리된 기록의 수를 볼 수 있습니다.

## 하위 에이전트 모델 선택 안내

<p align="center">
  <img src="assets/routing.svg" alt="과거의 작업 하나, 조건마다 2회 실행: 모델 규칙 적용 $0.171, $0.173, 미적용 $0.300, $0.439. 평균도 보장도 아님" width="92%" />
</p>

메인 모델이 오케스트레이터가 되어, 하위 에이전트에게 무엇을 결정하도록 맡기는지를 보고 모델을 고릅니다. Off the Wall은
이 안내를 주고 `model` 인자가 빠졌는지 점검할 뿐입니다. 모델을 강제하지 않으며, 더 싼 라우팅이나 비용 절감을
보장하지 않습니다. 그림은 과거의 시험 하나입니다. [근거](#근거)를 참고하세요.

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

측정한 숫자는 모두 한 사람의 기록에서 나왔습니다. 일반 법칙이 아니라 탐색적인 첫 결과로 봐 주세요. 위의 20개 중 9개
보고는 지어낸 예시 세션에서 나온 것입니다. 공개된 이 가상 데모는 문맥이 설명한 대로 만들어진다는 것만 확인할 뿐,
모델이나 사용자에게 어떤 결과가 나는지는 말해 주지 않습니다.

**한 사람의 텍스트 재생 실험이며 일반적인 발견이 아닙니다.** 한 사용자의 기록에서 고른 요청 39개를 글로 다시 돌렸습니다.
모두 실제로는 바로 뒤에 지적이 나왔고, 그 지적이 글만 보고 판단 가능한 경우들입니다. 조건마다 Opus 5.5가 답했습니다.
채점은 Sonnet(사람이 아닌 모델)이 두 답을 비교하는 방식으로 했고, 어느 쪽 답인지 모르게 했으며, 순서를 바꿔 두 번
물었습니다. 두 번 모두 같은 쪽을 골라야 승리로 셌습니다. Off the Wall 조건은 인용 6개와 "지적을 예측하라"는 한 줄을
함께 쓴 것으로, 아무것도 안 붙인 답에 25승 11무 3패, 무작위 규칙에 17승 14무 8패였습니다(39건에서의 우세일 뿐
확정된 결과가 아닙니다). 요약한 한 줄 규칙은 무작위 규칙을 이기지 못했습니다. 독립적인 재현이 아니고, 실제 제품에서의
이점을 보여 주지 않으며, 인용과 지적 예측 문구를 함께 시험했으므로 인용만으로 차이가 생긴다는 뜻도 아닙니다.
"인용이 요약보다 낫다"는 일반적인 주장을 뒷받침하지 않습니다. 이 39건 시험은 현재의 선택기나 갱신된 블록 문구를 쓰지 않았습니다.

**모델 선택.** 따로 떼어 둔 과거 위임 30건에서 세 등급 규칙을 따른 Opus는 사람이 정한 모델을 28번 골랐고, 더 약한
모델을 고른 적은 없었습니다. "작은 일은 직접 하라"는 줄은 그 측정 뒤에 추가했습니다. 위 비용 그림은 모델이 붙인
라벨을 쓴, 범위가 좁은 과거 실험 하나입니다. 작업 하나를 조건마다 두 번 돌렸고, 당시의 메인 모델과 가격이
적용됐습니다. 두 쌍은 각각 약 43%, 61% 저렴했지만 평균이 아니라 참고 수치이며, 현재 또는 일반적으로 더 싼
하위 에이전트나 비용 절감을 보장하지 않습니다. Codex 모델 대응은 같은 등급을 유추로 맞춘 것이고 측정하지 않았습니다.

<details>
<summary><strong>판정기: 지적을 얼마나 잘 찾나</strong></summary>

- 한 턴씩 판정: 한 사용자의 기록에서 사람이 표시한 56개 턴 끝에서 Claude Haiku의 정밀도는 0.82, 재현율은 0.72였습니다.
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

- 이전 버전, 가상의 예시 기록: 보고를 두 번 돌려 답 20개 중 같은 지적 9개를 찾았습니다. 그중 1개만 분류가 달랐습니다.

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

저장은 로컬이지만, 로컬 저장이 아무것도 밖으로 나가지 않는다는 뜻은 아닙니다. Off the Wall은 `~/.otw`에 다음을 둡니다.
- `corrections.jsonl` (더는 인용되지 않는 이전 기록 포함)
- 세션별 상태
- `log.jsonl`
- 보고·공유 횟수(사용자가 링크를 열어 직접 게시하기 전까지 이 컴퓨터에만 있음)

밖으로 나가는 것은 다음이며, 항상 사용자 본인의 `claude`나 `codex` 명령을 거쳐 사용자의 모델 제공자에게 갑니다.
- 판정은 어시스턴트 답과 사용자 답의 발췌문을 보냅니다.
- `report`는 고른 기록 발췌문을 보냅니다.
- 인용은 인용된 지적을 호스트 모델의 문맥에 넣습니다.

게시자 쪽 텔레메트리는 없고 별도 API 키도 필요 없습니다. 그렇다고 제공자가 처리하지 않는다는 뜻은 아닙니다. 제공자는
이 발췌문을 그대로 보며, 사용 중인 요금제의 사용량이나 요금이 적용될 수 있습니다. 기본 이벤트·오류 로그에는 원문 발췌가 들어가지 않습니다. `OTW_DEBUG`를 켜면 원문 발췌가
`~/.otw/log.jsonl`에 기록될 수 있습니다. 알 수 없거나 너무 큰 기록 프레임은 안전하게 거부되어, 프로젝트나 보류 상태를 추측하지 않습니다. `~/.otw`를 지우면 Off the Wall이 저장한 것은 잊지만, Claude Code나 Codex의
대화 기록이나 제공자 쪽 사본까지 지워지지는 않습니다. 삭제 명령은 아직 없습니다. 공유는 수동입니다. Discussions 링크는
횟수와 종류 이름만 채워 두며, 게시 전에 사용자가 검토합니다.

## 한계

- Windows: CI는 Windows·Linux·macOS에서 Node 18/20/22를 검사하며, 현재 결과는 PR 검사를 확인하세요. Windows의 실제 Claude Code/Codex 세션은 아직 미검증입니다. POSIX용 가짜 제공자 연동 검사 2개는 Windows에서 건너뜁니다.
- 판정기가 놓칠 때가 있습니다(Claude Haiku: 정밀도 0.82, 재현율 0.72, 한 사용자의 라벨 기준). 과거에 Codex에서는 이 저장소에서
  설치한 이전 버전 플러그인으로 실제 세션을 돌려 기본 판정 모델이 지적 2번을 모두 잡았습니다. 이전의 gpt-6-luna 판정기는 2번
  중 1번이었습니다. 두 건일 뿐 비율이 아닙니다.
- 입력 분류기와 매칭 가드는 필터입니다. 자동 문구가 답변으로 처리될 수도, 관련 있는 지적이 빠질 수도 있습니다.
- 범위는 정확히 같은 작업 디렉터리 단위입니다. 관련 폴더, 옮긴 프로젝트, worktree끼리는 인용을 공유하지 않습니다.
- 인용은 모델에게만 보입니다. 세션 중에 사용자 화면에는 나오지 않습니다.
- 기억 관리 UI나 삭제 명령은 아직 없습니다.

## 개발

```bash
npm test                          # node --test, 의존성 없음
node scripts/make-assets.mjs      # 예시 보고 출력과 기록된 숫자로 README 그림을 다시 그림
OTW_DEBUG=1 claude ...       # 모든 훅 이벤트를 ~/.otw/log.jsonl에 기록. 원문 발췌가 들어갈 수 있음
```

[CONTRIBUTING.md](CONTRIBUTING.md)를 참고하세요. 변경 내역은 [CHANGELOG.md](CHANGELOG.md)에 있습니다.

## 등재된 목록

- [awesome-codex-plugins](https://github.com/hashgraph-online/awesome-codex-plugins)
- [awesome-ai-plugins](https://github.com/hashgraph-online/awesome-ai-plugins)
- [awesome-ai-agent-tools](https://github.com/michielhdoteth/awesome-ai-agent-tools)
- [Awesome-Vibe-Coding](https://github.com/0xWelt/Awesome-Vibe-Coding)
- [awesome-vibe-coding-resources](https://github.com/acvnace/awesome-vibe-coding-resources)
- [awesome-coding-agents](https://github.com/kailiu42/awesome-coding-agents)
- [awesome-agent-memory](https://github.com/mnemoverse/awesome-agent-memory)

커뮤니티 플러그인 디렉터리: [Claude & Codex Plugins](https://claudecodexplugins.com/plugins/toranalytics/off-the-wall/off-the-wall).

## 라이선스

MIT © [Junebeom Seo](https://github.com/toranalytics)

[Privacy](https://github.com/toranalytics/off-the-wall#privacy)
