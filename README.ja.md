<p align="right">
  <a href="README.md">English</a> | <a href="README.ko.md">한국어</a> | <strong>日本語</strong> | <a href="README.zh-CN.md">中文</a>
</p>

<p align="center">
  <img src="assets/hero.png" alt="Off the Wall: ターミナルの上で過去の指摘を引用するピクセルアートのオウム" width="100%" />
</p>

<h1 align="center">Off the Wall</h1>

<p align="center">
  <strong>すでにした指摘を、コーディングエージェントに思い出させる。</strong>
  <br/>
  <sub><strong>Claude Code</strong> と <strong>Codex</strong> 用のプラグイン。同じ作業ディレクトリであなたが以前した指摘を、次の回答の前にそのまま置きます。</sub>
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
  <a href="#routing">モデル選択</a> ·
  <a href="#evidence">根拠</a> ·
  <a href="#privacy">プライバシー</a>
</p>

**同じ作業ディレクトリでのあなたの指摘を、エージェントが答える前に原文のまま引用します。何を一番よく指摘しているかを、ローカルでモデルの分類として示すレポートがあります。サブエージェントのモデル選択のガイドも提供します。**

「聞かずに選んで進めて」「本当にテストを実行した?」といった指摘は、たいてい次のセッションで忘れられます。
Off the Wall はそうしたメッセージをローカルに保存し、回答の前に、同じ作業ディレクトリで記録された指摘を最大 6 件、あなた自身の
言葉でエージェントに見せます。すでに使っている `claude` / `codex` CLI を経由するので、別途 API キーは不要です。
ただし、何も外部に出ないという意味ではありません。[プライバシー](#privacy)を参照してください。

> これは 0.2.1 の未リリース安全性候補です。安定版リリースや実利用効果を示すものではありません。以下の数値は以前のバージョンで一人の履歴から得たものなので、ぜひ自分の履歴でレポートを実行してください。

> 初期版の注意: 効果の根拠は1人のテキスト再生実験であり、指摘の減少、費用削減、業務完了の改善を一般的に保証するものではありません。入力分類器はホストやプラグインの自動テキストをユーザーの返答と誤認することがあり、人間が書いた入力を完全に見分けるものでもありません。集計の回数はモデルの分類で誤りがあり得るので、共有する前に元のメッセージをローカルで確認してください。

---

## なぜ Off the Wall か

| 問題 | 起きること | Off the Wall |
| :-- | :-- | :-- |
| 繰り返す指摘 | 今月 10 回目の「聞かずにやって」 | 過去のあなたの言葉を次の回答の前に置く |
| 定着しないルール | 指摘を一行ルールに要約しても変化が少ない | 要約せず、あなた自身の言葉を引用。小さな再生実験 1 件では、要約ルールはランダムなルールより良くなかった([根拠](#evidence)) |
| すべてのサブエージェントが高価なモデル | 検索や grep まで最上位モデルで動くことがある | サブエージェントごとのモデル選択ガイドと、`model` 引数がない呼び出しを差し戻すチェック。より安いルーティングや費用削減は保証しません |
| 別の API キー | メモリツールは独自の API キーが必要なことが多い | 判定はすでに使っている `claude` / `codex` CLI で実行するため別途キーは不要。抜粋は引き続きあなたのプロバイダーが処理します([プライバシー](#privacy)) |

<a id="quick-start"></a>
## クイックスタート

**1. インストール**

Claude Code のプロンプトで:

```
/plugin install off-the-wall --marketplace toranalytics/off-the-wall
```

Codex:

```bash
codex plugin marketplace add toranalytics/off-the-wall
codex plugin add off-the-wall@off-the-wall
```

その後 Codex で `/hooks` を一度開き、Off the Wall のフックを信頼してください。信頼されるまで Codex はプラグインのフックを実行しません。

**2. サンプル履歴でレポートを試す**(自分の履歴は不要)

```bash
git clone https://github.com/toranalytics/off-the-wall && cd off-the-wall
node bin/otw.mjs report --host claude --claude-dir examples/claude-history --days 0
```

**3. 自分の履歴で実行し、そこから引用を始める**

```bash
node bin/otw.mjs report --seed
```

`--seed` なしの `report` は明示的なプロバイダー処理で、`capture: false` でも実行できます。`--seed` には capture が有効で、分類が終わるまで保存先と設定が変わらないことが必要です。許可が取り消された場合、結果は保存されません。

`--seed` は選んだ履歴を読み直し、ホストの履歴に作業ディレクトリが記録されている場合に、出所情報(プロジェクトのハッシュと入力の出所)を
付けて保存します。作業ディレクトリが不明なターンは保存されず、スキップ数だけが報告されます。自動で昇格して安全扱いになることもありません。
[範囲と古い記録](#scope)を参照してください。

Node 18 以上が必要です。過去の記録: 以前のバージョンを macOS の Claude Code 2.1.301 と codex-cli 0.162.1 で試しました。0.2.0 候補は macOS で合成のランチャー/ワーカー確認を行っただけです。この 0.2.1 候補の実際のホストでの再読み込みと効果は未検証です。

<a id="report"></a>
## 何を一番よく指摘しているか

<p align="center">
  <img src="assets/report.svg" alt="架空のサンプル履歴の保存済み分類から描いた report の形式: 候補の返答 20 件のうち 9 件が指摘の可能性ありと判定、種類ごとに原文付き。新しいモデル実行ではありません" width="92%" />
</p>

`report` はマシン上にすでにある Claude Code と Codex の履歴(`~/.claude/projects`、`~/.codex/sessions`)を読み、
小さなモデルで、エージェントの仕事の仕方を指摘した返答を見分けます。上の画像は[サンプル履歴](examples/claude-history)
の保存済みの分類を現在の report 形式で描いたものです。この履歴は作り物で、現在の CLI を新しく実行したり、モデルを新たに呼び出した
結果ではありません。分類はモデルが行うため誤りがあり得ます。report がどう見えるかを示すだけで、モデルやユーザーにどんな結果が出るかは
示していません。選ばれた抜粋はあなた自身の `claude` / `codex` CLI を通してモデルに送られます。`--seed` を付けると見つけた指摘を保存し、
そのプロジェクトで次のプロンプトから引用を始められます。

最後に、このリポジトリの [Discussions](https://github.com/toranalytics/off-the-wall/discussions/categories/show-and-tell)
への投稿リンクが表示されます。多かった指摘の種類トップ3と回数が入力済みで、引用されたあなたの言葉は含まれません。
回数はモデルの分類で誤りがあり得るので、元のメッセージをローカルで確認し、公開する前にあなた自身で内容を確認してください。
自動で投稿されることはありません。

<a id="how"></a>
## エージェントに見えるもの

<p align="center">
  <img src="assets/context.svg" alt="回答前に Off the Wall が追加するブロックの形式を示す図: 指摘の原文の例と、指摘を予測せよという指示。引用はサンプルレポートから取ったもので、関連度で選んだものではありません" width="92%" />
</p>

| タイミング | Claude Code | Codex |
| :-- | :-- | :-- |
| プロンプトごと | 過去の指摘を最大 6 件引用(各 200 文字まで)。正規化した同じ作業ディレクトリ(プロジェクトキー)のもので、関連度の基準を通ったものに限ります。無いことも 6 件未満であることも普通です。他のプロジェクトの指摘や最新のもので埋めることはしません | 同じ |
| プロンプトごと | 直前の回答と新しいメッセージを別プロセスで判定し、指摘ならプロジェクトのハッシュと入力の出所を付けて保存 | 同じ |
| ターン終了 | 判定用に回答の末尾を保持 | 同じ |
| セッション開始 | ルーティングのルールを追加 | ルーティングのルールを追加 |
| サブエージェント開始 | `model` のない `Agent` 呼び出しをターンごとに一度差し戻す | `model` か `reasoning_effort` のない `spawn_agent` 呼び出しをターンごとに一度差し戻す |

モデル呼び出しを待つ段階はありません。判定はプロンプトが送られた後に別に動きます。

引用ブロックには、過去の履歴は実行・公開・削除・開示の許可ではなく、現在の依頼と安全上の指示が優先される、という文言が入ります。

上の画像は `scripts/make-assets.mjs` がサンプルレポートの引用に対して `correctionBlock` を直接呼び出して作ったものです。形式を
示すだけで、関連度・作業ディレクトリ・マッチガードによる実際の選択結果ではありません。

<a id="scope"></a>
### 範囲と古い記録

- 引用には作業ディレクトリと出所情報が必要です。cwd のないプロンプトやプロジェクトキーのない記録には、自動の引用は付きません。
- 範囲は正規化した作業ディレクトリ(プロジェクトのハッシュとして保存)です。サブディレクトリ、移動したディレクトリ、git worktree は意図的に
  自動でまとめません。それぞれ別のプロジェクトです。
- 新しい記録にはプロジェクトのハッシュと入力の出所が付きます。プロジェクトがない、または出所不明の古い記録はディスクには残りますが、
  引用からは除外されます。削除や書き換えはしません。
- `report --seed` は選んだ履歴を読み直し、プロジェクトと出所が分かる記録だけを追記し、cwd 不明でスキップした分を報告します。
  出所のない記録を新たに保存することはなく、自動で「安全」に昇格することもありません。
- 入力分類器は明示的なメタ・非人間の出所のテキストと既知の自動化エンベロープを除外し、通常の Markdown や長い英語の文章は
  残します。フィルターであり、人間が書いた入力を完全に見分けるものではありません。
- 関連度の基準(マッチガード)は、保存された指摘が依頼と十分に似ていて引用する価値があるかを判定します。現在の閾値は初期の
  エンジニアリング上の設定で、較正された精度の数値ではなく、適合率や再現率を主張するものでもありません。
- このバージョンにはメモリ管理 UI や削除コマンドはありません。ローカルの記録を消すには `~/.otw` 以下のファイルをご自身で
  削除してください([プライバシー](#privacy))。`capture: false` にすると、新しいプロンプトや回答の抜粋は保存されません(すでに保存された指摘は消えません)。`status` で、
  プロジェクトと出所が付いた記録と隔離された記録の件数を確認できます。

<a id="routing"></a>
## サブエージェントのモデル選択ガイド

<p align="center">
  <img src="assets/routing.svg" alt="過去の 1 タスク、各条件 2 回の実行: モデルルールあり $0.171 と $0.173、なし $0.300 と $0.439。平均でも保証でもありません" width="92%" />
</p>

メインモデルがオーケストレーターとして、タスクに何が委ねられているかを見てサブエージェントのモデルを選びます。Off the Wall は
このガイドを与え、`model` 引数の抜けをチェックするだけです。モデルを強制せず、より安いルーティングや費用削減を
保証しません。図は過去のテスト 1 件です。[根拠](#evidence)を参照してください。

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
  <img src="assets/evidence.svg" alt="何も付けない場合との勝ち・引き分け・負け: 実際の指摘 36/3/0、Off the Wall 25/11/3、ランダムなルール 18/15/6、要約ルール 14/17/8" width="92%" />
</p>

測定値はすべて一人の履歴から得たもので(9/20 のレポート例は架空のセッション)、一般法則ではなく探索的な最初の結果です。
公開しているこの架空デモは、コンテキストが説明どおりに組み立てられることだけを確認するもので、モデルやユーザーの結果については
何も示しません。

**1 人のテキスト再生実験であり、一般的な発見ではありません。** 1 人のユーザーの履歴から選んだ依頼 39 件をテキストとして再実行しました。
どれも実際には直後に指摘があり、その指摘がテキストだけで判断できるものです。Opus 5.5 が各条件で回答し、
Sonnet(人ではなくモデル)が順序を入れ替えて二回、どちらの回答か分からない状態で比較し、両方の順序で一致したときだけ勝ちと
数えました。Off the Wall の条件は引用 6 件と「指摘を予測せよ」の 1 行を組み合わせたもので、何も付けない場合に対して
25 勝 11 分 3 敗、ランダムルールに対して 17 勝 14 分 8 敗でした(39 件での傾向にすぎず、確定した結果ではありません)。
要約した一行ルールはランダムルールに勝てませんでした。独立した再現実験ではなく、実際の製品での利点を示すものでもありません。
引用と指摘予測の 1 行を同時に試したので、引用だけで差が生じたという意味でもありません。「引用は要約より優れている」という
一般的な主張の根拠にはなりません。この 39 件の実験は、現在のセレクターや更新後のブロック文言を使っていません。

**モデル選択。** 別に取り分けた過去の委任 30 件で、三つの等級のルールに従った Opus は、人が決めたモデルを 28 回選び、
より弱いモデルを選んだことはありませんでした。上の費用の図は、モデルがラベルを付けた、範囲の限られた過去の実験 1 件です。タスクは 1 つ、
各条件 2 回、当時のメインモデルと価格です。2 組はそれぞれ約 43%、61% 安くなりましたが、平均ではなく参考値であり、
現在または一般により安いサブエージェントや費用削減を保証するものではありません。Codex のモデル対応は同じ等級を類推で
合わせたもので、測定していません。細かい判定器の表は [English README](README.md#evidence) を参照してください。

<a id="settings"></a>
## 設定

`~/.otw/config.json` は任意で、ファイルがなければ通常の既定値を使います。有効な部分設定のスキーマは変わらず、明示した値が自動検出より優先されます。`recall`、`capture`、`routing` は文字列でなく JSON の真偽値が必要です。先頭の UTF-8 BOM 1 個は許容します。既存ファイルが読めない、不正な JSON、オブジェクトでない、型・未知のキー・入れ子の値が不正な場合は安全側に停止し、3 フラグとも `false` になります。手動の `report` も履歴の読み取りやプロバイダー呼び出しの前に停止します。`node bin/otw.mjs status` は生の設定値やエラーではなく、安全化した `config-invalid` を表示します。

`recall` は引用、`capture` は新しい抜粋の保存と指摘の記録、`routing` はモデル選択の案内を制御します。すべてのキーは任意です。設定例は [English README](README.md#settings) を参照してください。

<a id="privacy"></a>
## プライバシー

保存はローカルですが、ローカル保存であっても何も外部に出ないわけではありません。Off the Wall は `~/.otw` に次を保存します:
- `corrections.jsonl`(もう引用されない古い記録を含む)
- セッションごとの状態
- `log.jsonl`
- report と共有の回数(リンクを開いてあなたが投稿するまで、このマシンの中だけにあります)

外に送られるものは次のとおりで、常にあなた自身の `claude` / `codex` CLI を経由してあなたのモデルプロバイダーに送られます:
- 判定はアシスタントの回答とあなたの返答の抜粋を送ります。
- `report` は選ばれた履歴の抜粋を送ります。
- 引用は、引用された指摘をホストモデルのコンテキストに入れます。

パブリッシャー側のテレメトリはなく、別途 API キーも不要です。ただし、プロバイダーが処理しないという意味ではありません。
プロバイダーはこれらの抜粋をそのまま見ますし、契約プランの利用量や料金が発生することがあります。既定のイベントログとエラーログには原文の抜粋は含まれません。`OTW_DEBUG` を設定すると、
原文の抜粋が `~/.otw/log.jsonl` に書かれることがあります。不明な履歴フレームや大きすぎるフレームは安全側で拒否され、プロジェクトや保留状態を推測しません。`~/.otw` を削除すると Off the Wall が保存したものは忘れますが、
Claude Code や Codex の履歴やプロバイダー側のコピーまでは消えません。削除コマンドはまだありません。共有は手動です。
Discussions のリンクは回数と種類名を入力済みにするだけで、公開する前にあなたが確認します。

### Capture の制御と削除

- 条件を満たすフォアグラウンドの capture または明示的な `report --seed` が、必要に応じて `.capture-generation` と空の保存対象ファイルを作ります。ジョブはその世代、保存先ルートと指摘ファイルの識別情報、設定のファイルシステム上のリビジョンに結び付き、プロバイダー呼び出し直前と追記直前に再確認します。この保存許可がない旧キュージョブは破棄し、既存の指摘は暗黙の移行なしに保持します。 設定ファイルがない場合はルートディレクトリのリビジョンも確認するため、無関係な項目の作成・削除でも古いジョブを安全側に無効化することがあります。

- capture の無効化、設定リビジョンの変更、`corrections.jsonl` の削除、保存先全体の削除・置換により、古い結果はデバッグ抜粋も含め保存されません。ワーカーはディレクトリを再作成しません。新しいフォアグラウンドの人間のプロンプト/セッションは新しい保存先を初期化できますが、古い結果は入りません。保存先全体を削除すると設定も消えるため、次の対象プロンプト/セッションでは既定値により capture が再び有効になり得ます。

- これは結果保存の許可の取り消しであり、プロセスの終了や送信済みテキストの撤回ではありません。呼び出し済みのプロバイダー処理は完了し、利用量が発生することがあります。ファイルの直接編集や切り詰めは削除/取り消し操作ではありません。指摘ファイルか保存先フォルダを削除してください。メタデータ/タイムスタンプの感度はファイルシステム次第で、あらゆる外部書き込みに対する原子的・即時の取消しを保証しません。

- POSIX では新しいディレクトリ/ファイルに `0700`/`0600` を要求し、既存の権限は一括変更しません。セッション書き込みは一時ファイルと rename で原子的に置換しますが、並行フック全体の順序や破損状態からの回復は保証しません。個別メモリ UI や新しい clear/pause コマンドはありません。

## 制限

- ネイティブ判定のツール/コンテキスト分離は未修正で、実際のホストでの再読み込みと効果も未検証です。
- Windows: CI は Windows・Linux・macOS の Node 18/20/22 を検査します。現在の結果は PR のチェックを確認してください。Windows の実際の Claude Code/Codex セッションは未検証で、POSIX 用の模擬プロバイダー連携テスト 2 件は Windows ではスキップします。
- 判定は見逃すことがあります(Claude Haiku: 適合率 0.82、再現率 0.72、ある 1 人のラベル基準)。
- 入力分類器とマッチガードはフィルターです。自動テキストが返答として扱われることも、関連する指摘が漏れることもあります。
- 範囲は正確に同じ作業ディレクトリ単位です。関連するフォルダ、移動したプロジェクト、worktree どうしでは引用を共有しません。
- 引用はモデルにだけ見え、セッション中に画面には表示されません。
- メモリ管理 UI や削除コマンドはまだありません。

## 掲載先

- [awesome-codex-plugins](https://github.com/hashgraph-online/awesome-codex-plugins)
- [awesome-ai-plugins](https://github.com/hashgraph-online/awesome-ai-plugins)
- [awesome-ai-agent-tools](https://github.com/michielhdoteth/awesome-ai-agent-tools)
- [Awesome-Vibe-Coding](https://github.com/0xWelt/Awesome-Vibe-Coding)
- [awesome-vibe-coding-resources](https://github.com/acvnace/awesome-vibe-coding-resources)
- [awesome-coding-agents](https://github.com/kailiu42/awesome-coding-agents)
- [awesome-agent-memory](https://github.com/mnemoverse/awesome-agent-memory)
- [awesome-context-engineering](https://github.com/yzfly/awesome-context-engineering)
- [awesome-agent-memory](https://github.com/mnemoverse/awesome-agent-memory)

コミュニティのプラグインディレクトリ: [Claude & Codex Plugins](https://claudecodexplugins.com/plugins/toranalytics/off-the-wall/off-the-wall).

## ライセンス

MIT © [Junebeom Seo](https://github.com/toranalytics)

[Privacy](https://github.com/toranalytics/off-the-wall#privacy)
