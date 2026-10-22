<p align="right">
  <a href="README.md">English</a> | <a href="README.ko.md">한국어</a> | <a href="README.ja.md">日本語</a> | <strong>中文</strong>
</p>

<p align="center">
  <img src="assets/hero.png" alt="Off the Wall：终端上的像素鹦鹉，引用你过去的纠正" width="100%" />
</p>

<h1 align="center">Off the Wall</h1>

<p align="center">
  <strong>别再对编程智能体重复同一句话。</strong>
  <br/>
  <sub>适用于 <strong>Claude Code</strong> 和 <strong>Codex</strong> 的插件：把你以前的纠正原文放在下一次回答之前。</sub>
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
  <a href="#quick-start">快速开始</a> ·
  <a href="#report">报告</a> ·
  <a href="#how">工作方式</a> ·
  <a href="#routing">路由</a> ·
  <a href="#evidence">依据</a> ·
  <a href="#privacy">隐私</a>
</p>

**在智能体回答之前，逐字引用你的纠正。一分钟告诉你最常纠正什么。子智能体用更便宜的模型。**

“别问了，自己选一个做”“你真的跑过测试了吗？”这类纠正，通常到下一个会话就被忘了。Off the Wall 保存这些消息，并在每次
回答前，把最相关的几条以你自己的原话交给智能体。它使用你已经付费的 Claude 或 ChatGPT 订阅运行，不需要 API 密钥。

> Off the Wall 是刚发布的 0.1 版本。下面的数字来自一个人的历史记录，请用你自己的记录运行报告。

---

## 为什么用 Off the Wall

| 问题 | 发生了什么 | Off the Wall |
| :-- | :-- | :-- |
| 重复的纠正 | 这个月第十次说“别问了，直接做” | 把你过去的话放在下一次回答之前 |
| 记不住的规则 | 把纠正总结成一行规则，效果很小 | 引用而不是总结。总结并不比随机规则好（[依据](#evidence)） |
| 所有子智能体都用大模型 | 连搜索、grep 都用最贵的模型 | 编排者为每个子智能体指定模型；测试中便宜 43–61% |
| 又一笔账单 | 记忆工具常常需要 API 密钥 | 判定通过你已经在用的 `claude` 或 `codex` CLI 运行 |

<a id="quick-start"></a>
## 快速开始

**1. 安装**

在 Claude Code 中输入：

```
/plugin install off-the-wall --marketplace toranalytics/off-the-wall
```

Codex：

```bash
codex plugin marketplace add toranalytics/off-the-wall
codex plugin add off-the-wall@off-the-wall
```

然后在 Codex 中打开一次 `/hooks` 并信任 Off the Wall 的钩子。在信任之前，Codex 不会运行插件钩子。

**2. 用示例历史试运行报告**（不需要你自己的记录）

```bash
git clone https://github.com/toranalytics/off-the-wall && cd off-the-wall
node bin/otw.mjs report --host claude --claude-dir examples/claude-history --days 0
```

**3. 用你自己的历史运行，并从中开始引用**

```bash
node bin/otw.mjs report --seed
```

需要 Node 18 或更高版本。已在 macOS 上用 Claude Code 2.1.301 和 codex-cli 0.162.1 测试。

<a id="report"></a>
## 你最常纠正什么

<p align="center">
  <img src="assets/report.svg" alt="Off the Wall report 输出：20 次回复中 9 次是纠正，按类型分组并附原话" width="92%" />
</p>

`report` 读取你机器上已有的 Claude Code 和 Codex 历史（`~/.claude/projects`、`~/.codex/sessions`），用一个小模型找出
你纠正智能体做事方式的回复。上图是在[示例历史](examples/claude-history)上的真实输出。加上 `--seed` 会保存找到的
纠正，从下一个提示开始就会引用。

最后会打印一个链接，打开本仓库 [Discussions](https://github.com/toranalytics/off-the-wall/discussions/categories/show-and-tell)
中预填好的帖子，内容是你最常纠正的前三类及次数。只包含次数和类型名称，不包含任何被引用的原话。是否发布由你决定；
这是告诉我你的第一名是否和我一样的最快方式。

<a id="how"></a>
## 智能体看到什么

<p align="center">
  <img src="assets/context.svg" alt="回答前 Off the Wall 添加的内容：6 条过去纠正的原文，以及预测你会如何反对的指示" width="92%" />
</p>

| 时机 | Claude Code | Codex |
| :-- | :-- | :-- |
| 每个提示 | 引用最多 6 条过去的纠正：与请求最相似的 3 条，然后是最新的 | 相同 |
| 每个提示 | 在独立进程中判定上一个回答和你的新消息，是纠正就保存 | 相同 |
| 回合结束 | 保留回答结尾供判定使用 | 相同 |
| 会话开始 | 添加路由规则 | 添加路由规则 |
| 子智能体启动 | 没有 `model` 的 `Agent` 调用每回合退回一次 | 没有 `model` 或 `reasoning_effort` 的 `spawn_agent` 调用每回合退回一次 |

没有任何步骤等待模型调用：判定在你的提示发出之后单独运行。

<a id="routing"></a>
## 更便宜的子智能体

<p align="center">
  <img src="assets/routing.svg" alt="同一委派任务的成本：开启路由 $0.171 和 $0.173，关闭 $0.300 和 $0.439" width="92%" />
</p>

| 等级 | 何时 | Claude Code | Codex |
| :-- | :-- | :-- | :-- |
| small | 检索或转换：查找、grep、列出、提取、格式转换 | `haiku` | 账号中的快速模型，`low` |
| mid | 有明确目标和标准：调查、评审、实现、测试 | `sonnet` | 主力模型，`medium` |
| large | 需要先判断问题是什么：根因、设计、迁移计划 | `opus` | 顶级模型，`high` |

几步就能完成的工作，由主模型自己做最便宜。Codex 的模型名因账号而异，所以 Off the Wall 读取 Codex 保存的列表
（`~/.codex/models_cache.json`），根据描述分成三个等级。

<a id="evidence"></a>
## 依据

<p align="center">
  <img src="assets/evidence.svg" alt="与不附加任何内容相比的胜/平/负：真实纠正 36/3/0，Off the Wall 25/11/3，随机规则 18/15/6，总结规则 14/17/8" width="92%" />
</p>

所有测量数字都来自一个人的真实历史（9/20 的报告示例来自虚构会话），是初步结果而不是普遍规律。重放了 39 个真实请求，Opus 5.5 在每种条件下作答，Sonnet
在不知道来源的情况下两两比较，并交换顺序问两次。路由方面，在另外留出的 30 次真实委派中，选中人工标注模型 28 次，
从未选择更弱的模型。详情见 [English README](README.md#evidence)。

<a id="privacy"></a>
## 隐私

所有数据都保存在你机器上的 `~/.otw`。唯一离开机器的是判定调用，而且它通过你自己的 `claude` 或 `codex` CLI。
删除 `~/.otw` 即可忘记一切。

## 限制

- Windows：CI 中测试和钩子运行检查已通过（Node 18–22），但尚未在 Windows 上运行真实的 Claude Code 或 Codex 会话。
- 判定有时会漏掉（Claude Haiku：精确率 0.82，召回率 0.72）。
- 引用只对模型可见，会话中不会显示给你。

## 收录于

- [awesome-codex-plugins](https://github.com/hashgraph-online/awesome-codex-plugins)
- [awesome-ai-plugins](https://github.com/hashgraph-online/awesome-ai-plugins)
- [awesome-ai-agent-tools](https://github.com/michielhdoteth/awesome-ai-agent-tools)
- [Awesome-Vibe-Coding](https://github.com/0xWelt/Awesome-Vibe-Coding)
- [awesome-vibe-coding-resources](https://github.com/acvnace/awesome-vibe-coding-resources)
- [awesome-coding-agents](https://github.com/kailiu42/awesome-coding-agents)

## 许可证

MIT © [Junebeom Seo](https://github.com/toranalytics)
