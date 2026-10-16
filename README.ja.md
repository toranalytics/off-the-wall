<p align="right">
  <a href="README.md">English</a> | <a href="README.ko.md">한국어</a> | <strong>日本語</strong> | <a href="README.zh-CN.md">中文</a>
</p>

<p align="center">
  <img src="assets/hero.png" alt="ownwords: ターミナルの上で過去の指摘を引用するピクセルアートのオウム" width="100%" />
</p>

<h1 align="center">ownwords</h1>

<p align="center">
  <strong>コーディングエージェントに同じことを二度言わない。</strong>
  <br/>
  <sub><strong>Claude Code</strong> と <strong>Codex</strong> 用のプラグイン。あなたが以前した指摘を、次の回答の前にそのまま置きます。</sub>
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
  <a href="#quick-start">クイックスタート</a> ·
  <a href="#report">レポート</a> ·
  <a href="#how">仕組み</a> ·
  <a href="#routing">ルーティング</a> ·
  <a href="#evidence">根拠</a> ·
  <a href="#privacy">プライバシー</a>
</p>

**エージェントが答える前に、あなたの指摘を原文のまま引用します。何を一番よく指摘しているかを 1 分で示します。サブエージェントはより安いモデルで動かします。**

「聞かずに選んで進めて」「本当にテストを実行した?」といった指摘は、たいてい次のセッションで忘れられます。
ownwords はそうしたメッセージを保存し、毎回の回答の前に、最も関係のあるものをあなた自身の言葉でエージェントに
見せます。すでに払っている Claude または ChatGPT のプランで動き、API キーは不要です。

> ownwords は 0.1 の新しいプロジェクトです。以下の数値は一人の履歴から得たものなので、ぜひ自分の履歴でレポートを実行してください。

---

## なぜ ownwords か

| 問題 | 起きること | ownwords |
| :-- | :-- | :-- |
| 繰り返す指摘 | 今月 10 回目の「聞かずにやって」 | 過去のあなたの言葉を次の回答の前に置く |
| 定着しないルール | 指摘を一行ルールに要約しても変化が少ない | 要約ではなく引用。要約はランダムなルールより良くなかった([根拠](#evidence)) |
| すべてのサブエージェントが高価なモデル | 検索や grep まで最上位モデルで動く | オーケストレーターがサブエージェントごとにモデルを指定。テストで 43–61% 安価 |
| 追加の請求 | メモリツールは API キーが必要なことが多い | 判定はすでに使っている `claude` / `codex` CLI で実行 |

<a id="quick-start"></a>
## クイックスタート

**1. インストール**

Claude Code のプロンプトで:

```
/plugin install ownwords --marketplace toranalytics/off-the-wall
```

Codex:

```bash
codex plugin marketplace add toranalytics/off-the-wall
codex plugin add ownwords@ownwords
```

その後 Codex で `/hooks` を一度開き、ownwords のフックを信頼してください。信頼されるまで Codex はプラグインのフックを実行しません。

**2. サンプル履歴でレポートを試す**(自分の履歴は不要)

```bash
git clone https://github.com/toranalytics/off-the-wall && cd off-the-wall
node bin/ownwords.mjs report --host claude --claude-dir examples/claude-history --days 0
```

**3. 自分の履歴で実行し、そこから引用を始める**

```bash
node bin/ownwords.mjs report --seed
```

Node 18 以上が必要です。macOS の Claude Code 2.1.301 と codex-cli 0.162.1 でテストしました。

<a id="report"></a>
## 何を一番よく指摘しているか

<p align="center">
  <img src="assets/report.svg" alt="ownwords report の出力: 20 回の返答のうち 9 回が指摘、種類ごとに原文付き" width="92%" />
</p>

`report` はマシン上にすでにある Claude Code と Codex の履歴(`~/.claude/projects`、`~/.codex/sessions`)を読み、
小さなモデルで、エージェントの仕事の仕方を指摘した返答を見分けます。上の画像は[サンプル履歴](examples/claude-history)
での実際の出力です。`--seed` を付けると見つけた指摘を保存し、次のプロンプトからすぐに引用が始まります。

<a id="how"></a>
## エージェントに見えるもの

<p align="center">
  <img src="assets/context.svg" alt="回答前に ownwords が追加するブロック: 過去の指摘 6 件の原文と、指摘を予測せよという指示" width="92%" />
</p>

| タイミング | Claude Code | Codex |
| :-- | :-- | :-- |
| プロンプトごと | 過去の指摘を最大 6 件引用: 依頼に最も近い 3 件、次に最新のもの | 同じ |
| プロンプトごと | 直前の回答と新しいメッセージを別プロセスで判定し、指摘なら保存 | 同じ |
| ターン終了 | 判定用に回答の末尾を保持 | 同じ |
| セッション開始 | ルーティングのルールを追加 | ルーティングのルールを追加 |
| サブエージェント開始 | `model` のない `Agent` 呼び出しをターンごとに一度差し戻す | `model` か `reasoning_effort` のない `spawn_agent` 呼び出しをターンごとに一度差し戻す |

モデル呼び出しを待つ段階はありません。判定はプロンプトが送られた後に別に動きます。

<a id="routing"></a>
## より安いサブエージェント

<p align="center">
  <img src="assets/routing.svg" alt="同じ委任タスクのコスト: ルーティングあり $0.171 と $0.173、なし $0.300 と $0.439" width="92%" />
</p>

| 等級 | いつ | Claude Code | Codex |
| :-- | :-- | :-- | :-- |
| small | 検索・変換: 探す、grep、一覧、抽出、形式変換 | `haiku` | アカウントの高速モデル、`low` |
| mid | 目標と基準がある仕事: 調査、レビュー、実装、テスト | `sonnet` | 主力モデル、`medium` |
| large | 何が問題かから決める仕事: 根本原因、設計、移行計画 | `opus` | 最上位モデル、`high` |

数ステップで終わる仕事はメインモデルが自分でやるのが最も安価です。Codex のモデル名はアカウントごとに異なるため、
Codex が保持する一覧(`~/.codex/models_cache.json`)を読み、説明から三つの等級に分けます。

<a id="evidence"></a>
## 根拠

<p align="center">
  <img src="assets/evidence.svg" alt="何も付けない場合との勝ち・引き分け・負け: 実際の指摘 36/3/0、ownwords 25/11/3、ランダムなルール 18/15/6、要約ルール 14/17/8" width="92%" />
</p>

数値はすべて一人の実際の履歴から得たもので、一般法則ではなく最初の結果です。実際の依頼 39 件を再実行し、Opus 5.5 が
各条件で回答し、Sonnet が順序を入れ替えて二回、どちらの回答か分からない状態で比較しました。ルーティングは、別に取り
分けた実際の委任 30 件で、人が決めたモデルを 28 回選び、より弱いモデルを選んだことはありませんでした。詳細は
[English README](README.md#evidence) を参照してください。

<a id="privacy"></a>
## プライバシー

すべてのデータはあなたのマシンの `~/.ownwords` に残ります。外に出るのは判定の呼び出しだけで、それもあなた自身の
`claude` / `codex` CLI を通ります。`~/.ownwords` を削除するとすべて忘れます。

## 制限

- Windows: CI でテストとフックの実行確認は通過しています(Node 18–22)。実際の Claude Code / Codex セッションでは未確認です。
- 判定は見逃すことがあります(Claude Haiku: 適合率 0.82、再現率 0.72)。
- 引用はモデルにだけ見え、セッション中に画面には表示されません。

## ライセンス

MIT © [Junebeom Seo](https://github.com/toranalytics)
