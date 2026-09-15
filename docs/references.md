# AgentGlass 参考资料与版本证据

> 核验日期：2026-09-15 · 本文件记录来源和实测边界，不授予实现权限；当前发布基线为已发布 `0.8.0`，Pi Web 证据为暂缓阶段的历史记录

## 1. 状态含义

| 状态 | 含义 |
|---|---|
| `SOURCE_CHECKED` | 阅读了指定源码或包元数据，尚不表示运行过 |
| `DOC_CHECKED` | 阅读了作者/官方资料，只代表其公开声明 |
| `TESTED` | 仅指定环境和指定测试实际通过 |
| `NOT_RUN` | 没有执行对应运行、兼容或真人测试 |

动态页面可能变化。工程依赖必须固定版本/commit，不能用 `latest` 替代已记录证据。

## 2. Pi 固定基线

开发依赖：`@earendil-works/pi-coding-agent@0.85.1`，npm `gitHead` 为 `d981de1229ef899957bbe968bc8dcda02a21f477`。

| 来源 | 已核对内容 | 状态 |
|---|---|---|
| [Extensions](https://github.com/earendil-works/pi/blob/d981de1229ef899957bbe968bc8dcda02a21f477/packages/coding-agent/docs/extensions.md) | `tool_call` 可阻止；input 可被后续 handler 修改；TUI/RPC 能力不同；当前 assistant message 提供 sibling tool calls | SOURCE_CHECKED |
| [Packages](https://github.com/earendil-works/pi/blob/d981de1229ef899957bbe968bc8dcda02a21f477/packages/coding-agent/docs/packages.md) | `pi.extensions`、本地/npm/git 安装、Pi 核心包 peer 约定 | SOURCE_CHECKED |
| [agent-loop.ts](https://github.com/earendil-works/pi/blob/d981de1229ef899957bbe968bc8dcda02a21f477/packages/agent/src/agent-loop.ts) | sibling 预检与并行执行结构 | SOURCE_CHECKED |
| [npm 0.85.1 metadata](https://registry.npmjs.org/@earendil-works%2Fpi-coding-agent/0.85.1) | 版本、gitHead、Node `>=22.19.0` | SOURCE_CHECKED |

这些来源不证明所有生命周期、UI、工具身份或加载顺序行为；相应任务仍需真实集成测试。

## 3. A-001 实测证据

| 项目 | 结果 |
|---|---|
| 平台 | Windows win32-x64 / PowerShell |
| Node / npm | 24.14.0 / 11.9.0 |
| Pi | 0.85.1 |
| TypeScript / Node types | 5.9.3 / 24.10.1 |
| Vitest / Biome | 4.1.11 / 2.5.12 |
| package-lock | lockfileVersion 3；`npm ci` 通过 |
| Pi smoke | 真实 `DefaultResourceLoader` 成功发现 manifest 并加载唯一 TS 入口；1 test PASS |

已通过：`npm ci`、typecheck、lint、build、integration smoke、`npm pack --dry-run`。Smoke 不启动 TUI、不执行用户工具，也不证明审批生命周期兼容。

NOT_RUN：Node 最低版本、macOS/Linux、交互 TUI、实际 tool_call 审批、sibling 行为、npm/git 分发安装、unit/corpus/security/e2e、依赖漏洞审计和真人测试。

## 4. A-004 实测证据

| 项目 | 结果 |
|---|---|
| 平台 / Pi | Windows win32-x64；锁定 `@earendil-works/pi-coding-agent@0.85.1` |
| 生命周期 | 真实 `AgentSession.bindExtensions()` 发出 `session_start`；真实 `ExtensionRunner` 发出 `before_agent_start`、`tool_call`、`tool_execution_end`、`agent_end`、`session_shutdown` |
| 执行身份 | 真实 `SessionManager.getSessionId()`、`ctx.cwd` 与 toolCallId 映射为 host-neutral hostExecutionId；session 未经生命周期切换时失败关闭 |
| sibling | `tool_call` 时从真实 `SessionManager` 当前 assistant message 读取完整调用列表；旧 turn、缺失当前调用和重复 ID 均有测试 |
| 工具身份 | 真实 `getAllTools()` 将 `<builtin:read>` 识别为锁定内置实现，并将 SDK 同名 `read` 覆盖识别为 overridden；缺失注册项保持 unknown |
| capability | TUI+UI=`yes`；RPC+UI=`no`；JSON/print 无 UI=`no`；mode/UI 矛盾=`unknown`。RPC 不因 `hasUI=true` 获得 Alpha 安全审批能力 |
| raw lifetime | raw tool input 只在同步映射与 A-003 投影中存在；用户目标在 `before_agent_start` 捕获时立即脱敏；active map 仅保存两个执行身份字符串；异步下游只接收不含 raw/canonical 的可观察事实 |

本轮实际通过：`npm run typecheck`、`npm run lint`、`npm run build`、`npm run test:unit`、`npm run test:security`、`npm run test:integration`。真实交互 TUI 卡片、真实 RPC 客户端批准、完整审批、分类、风险、执行后核验、macOS/Linux 与真人测试仍为 `NOT_RUN`。

## 5. A-005 实测证据

| 项目 | 结果 |
|---|---|
| 平台 / Pi | Windows win32-x64；锁定 `@earendil-works/pi-coding-agent@0.85.1` |
| 工具与 schema | 真实 `AgentSession.getAllTools()` 验证内置 `read/write/edit` 的来源身份、required 字段及字段类型；分类器再次校验事件 raw input，不凭名字推断 |
| 路径预检 | 真实临时目录覆盖 cwd 相对/绝对路径、`..`、项目外与前缀相似目录、junction、hard link、最近存在父目录、目录目标、malformed、Windows drive-relative/UNC/保留设备名 |
| raw 边界 | 审批指纹先于路径检查；`realpath/lstat` 使用 raw path；完成路径判断后才脱敏，异步检查期间输入变化会因二次指纹不一致失败关闭 |

独立验收实际通过：`npm run typecheck`、`npm run lint`、`npm run build`、`npm run test:unit`、`npm run test:corpus`、`npm run test:security`、`npm run test:integration`。当前没有 `test:e2e` suite，且 A-005 不要求端到端审批；真实工具执行、交互 TUI、macOS/Linux 和真人测试仍为 `NOT_RUN`。

## 6. A-006 实测证据

| 项目 | 结果 |
|---|---|
| 实现边界 | 纯函数 Bash classifier；不接入 Pi、不执行 shell、不产生 A-007 的最终风险决策 |
| fast-path 候选 | `pwd`、`ls`、`cat`、`head`、`tail`、`wc`、`grep`，以及窄范围 `git status/diff/log/show/rev-parse/branch`；必须有非交互 Bash、环境、PATH、解析、具体实现语义、alias/function 明确证据；Git 证据须排除 optional lock、pager、external diff 等副作用 |
| 不支持边界 | option、pipeline、redirect、compound、动态展开/替换、eval-like、安装、网络、进程、Git 状态/config；PowerShell 不进入 fast path |
| Corpus | 127 个 shell fixtures：`candidate_fast_path=40`、`ask=50`、`block=37`；`mutatesState=unknown` 55，unknown/ask 去重合计 64 |
| 破坏性证据 | 23 个 block fixture，覆盖精确命令、`find -delete/-exec`、`dd of=`、原地改写、Git 破坏性参数和 wrapper；全部只调用纯函数，哨兵文件保持不变 |

独立验收实际通过：`npm run typecheck`、`npm run lint`、`npm run build`、`npm run test:unit`、`npm run test:corpus`、`npm run test:security`、`npm run test:integration`。Corpus 中的 shell 文本均未作为命令执行；当前没有 `test:e2e` suite，真实 shell/Pi 执行、交互 TUI、跨平台和真人测试均为 `NOT_RUN`。

## 7. A-007 实测证据

| 项目 | 结果 |
|---|---|
| 实现边界 | Core 纯函数消费脱敏 `ActionFacts`；固定顺序求值全部命中规则，按 `critical > high > info` 与 `hard_block > ask > auto_allow` 聚合；不接入 UI、历史批准、learning、LLM 或 A-008 sibling 策略 |
| 支持决策 | 只有带已验证工具身份/schema、普通项目内、非敏感、路径事实完整的 read 为 `auto_allow`；普通 write/edit 为 `ask`；其余与不一致事实均 `hard_block` |
| Corpus | 11 条 A-007 规则均有命中与相邻反例；规则命中集分布为 `auto_allow=1`、`ask=2`、`hard_block=8`，相对无 Risk Engine 基线增量分别为 `+1/+2/+8` |
| 安全门槛 | unknown `auto_allow=0`；Critical `hard_block=100%`；明确 mutation `auto_allow=0`；规则异常、缺失身份/schema 与显式矛盾事实均失败关闭 |

独立验收实际通过：`npm run typecheck`、`npm run lint`、`npm run build`、`npm run test:unit`（25）、`npm run test:corpus`（6）、`npm run test:security`（30）、`npm run test:integration`（8）。当前没有 `test:e2e` suite；Outcome Card、审批 UI、A-008 sibling 决策、实际工具批准/执行、跨平台和真人测试均为 `NOT_RUN`。

## 8. A-008 实测证据

| 项目 | 结果 |
|---|---|
| Pi sibling 合约 | Windows 上使用锁定 `@earendil-works/pi-coding-agent@0.85.1` 的真实 `AgentSession`、`SessionManager` 与 `ExtensionRunner`，从当前 assistant message 获取并关联完整 sibling；没有把 mock 当作 Pi 兼容证明 |
| 固定策略 | read+read 不触发 sibling 阻止；read+单个 write 保留 write 的 `ask`，因本阶段尚无审批 UI 而失败关闭；两个及以上 yes/unknown 只阻止这些成员并返回顺序重试原因，不按不同目标文件例外处理 |
| 完整性 | missing、duplicate ID、旧 turn、当前调用不匹配和无法证明完整的 batch 均失败关闭；unknown 按 state-changing 计 |
| 边界 | 未实现归因例外、自动重排、`BatchSnapshot`、`BatchOutcome`、并发恢复、Outcome Card 或审批 UI |

独立验收实际通过：`npm run typecheck`、`npm run lint`、`npm run build`、`npm run test:unit`（25）、`npm run test:corpus`（7）、`npm run test:security`（32）、`npm run test:integration`（9）。当前没有 `test:e2e` script；真实工具执行、交互 TUI、审批闭环、跨平台和真人测试均为 `NOT_RUN`。

## 9. A-009 实测证据

| 项目 | 结果 |
|---|---|
| 文件预测 | 锁定普通文件 classifier 的真实事实覆盖 read/create/modify/overwrite；同一路径保持 targetId，动作指纹或效果语义变化产生新 effectId |
| 有界语义 | 单文件且无隐式父目录副作用为 `known/bounded`；会创建父目录以及 install/network/process 只为 `known/limited`；未知命令、不支持 shell、未知/越界目标为 `unknown` |
| 功能边界 | 所有 Alpha 预测固定 `applicationOutcome=unverifiable`、`purpose=unknown`；`package.json` 文件名不产生项目可运行或目标完成推断 |
| 安全回归 | unknown/越界风险保持 `hard_block`；classifier-local shell 事实不能放宽产品风险决策；矛盾文件事实不能生成已知有界效果；缺失目标使用动作指纹生成稳定且不碰撞的未知 targetId |
| 范围 | 纯 Core 执行前预测；未接入 tool result、现实核验、恢复或 OutcomeCard UI |

独立验收实际通过：`npm run typecheck`、`npm run lint`、`npm run build`、`npm run test:unit`（27）、`npm run test:corpus`（11）、`npm run test:security`（36）、`npm run test:integration`（9）。真实工具执行、观察/核验、恢复、OutcomeCard UI、跨平台和真人测试均为 `NOT_RUN`。

## 10. A-010 实测证据

核验日期：2026-09-10（Batch 3 集成复审）。

| 检查 | 实际结果 |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS |
| `npm run test:unit` | 6 files、34 tests PASS；覆盖既有/新文件、权限 metadata、单文件 10 MiB、总量 100 MiB、4096 条目边界、权限/磁盘故障注入、发布中断 |
| `npm run test:security` | 7 files、40 tests PASS；覆盖链接/特殊文件、私有 snapshot namespace、合成秘密仅进入敏感正文域、所有 evidence 固定不可恢复 |
| `npm run test:corpus` | 4 files、11 tests PASS；A-010 未改变既有风险决定或扩大普通工具支持面 |
| `npm run test:integration` | 2 files、9 tests PASS；锁定 Pi 0.85.1 的单 write/edit 在 sibling/risk 检查后建立 snapshot evidence |
| 原子发布 | 前像先写入、flush、hash 校验；version 1 manifest 写入、flush、回读校验并最后同目录 rename；受控中断无已发布 manifest |
| 存储权限 | 当前 Windows 环境实际设置并复核目录/文件当前用户独占 ACL，原目标 ACL 以 SDDL 保存；POSIX 0700/0600 分支未在本机执行，明确为 `NOT_RUN` |
| 边界 | 未实现 restore、执行后观察、恢复入口/history/redo、普通事件存储或 A-011 TUI；`canRestoreNow=false`、`recoveryGrade=unknown` |

## 11. A-012 实测证据

核验日期：2026-09-09。

| 检查 | 实际结果 |
|---|---|
| Pi / UI 合约 | 锁定 Pi 0.85.1 的真实 `AgentSession`、`ExtensionRunner`、`ctx.ui.custom` 包装与内置 `read/write/edit` 定义通过集成测试；真实人工终端操作仍为 `NOT_RUN` |
| 审批交互 | Stop 初始焦点；Continue、Explain、Stop、Esc、窄/宽 resize、重复输入、生命周期 abort、custom `undefined`/异常均有回归；Explain 只展开脱敏详情，不返回批准 |
| 精确绑定 | token 绑定 fingerprint、toolName、cwd、sessionId 与具体调用身份（hostExecutionId、toolCallId）；各字段逐项变化均失效，token 仅可同步消费一次，取消、伪造和 replay 均不能恢复授权 |
| 重校验 | Continue 后重新投影当前 raw input，复核风险、目标、绑定和已保存 pre-image baseline；输入或目标漂移会撤销旧 token、生成当前卡并要求新的明确批准 |
| 模式 | 只有 `mode=tui && hasUI` 的有效 custom 组件 Continue 可批准；print、json、无 UI、RPC 即使 hasUI、无效结果和 UI error 全部阻止 |
| snapshot 降级 | unavailable 仍明确显示保存失败、`canRestoreNow=false`、`recoveryGrade=unknown`；Alpha 可在新卡上重新批准，但不产生可恢复声明 |
| 自动化 gate | `npm ci`、`typecheck`、`lint`、`build`、package dry-run PASS；unit 7 files / 42 tests、corpus 4 / 11、security 9 / 57、integration 2 / 16 全部 PASS；e2e 尚未建立，NOT_RUN |
| 边界 | 未实现执行后观察、验证、restore/history/redo、OS sandbox 或对后加载恶意 Pi extension 的防护；真实 TUI 人工操作、macOS/Linux 和真人研究均为 `NOT_RUN` |

## 12. 竞品来源入口

以下只用于避免重复定位，不是工程依赖：

- 审批：[Toolwatch](https://github.com/kcosr/pi-extensions/tree/main/toolwatch)、[pi-verdict](https://github.com/jesset/pi-verdict)、[Aperion Shield](https://github.com/AperionAI/shield)
- 展示：[agent-diff-view](https://github.com/christianalfoni/agent-diff-view)、[pi-tool-display](https://github.com/MasuRii/pi-tool-display)
- 恢复：[pi-undo](https://github.com/DavidEasden/pi-undo)、[pi-undo-redo](https://github.com/justram/pi-undo-redo)、[Damocles](https://github.com/AizenvoltPrime/damocles)
- 核验：[Peaky Peek](https://github.com/acailic/agent_debugger)
- 教学：[agent-tutor](https://github.com/huypl53/agent-tutor)

上述项目全部为 `DOC_CHECKED` 或 `SOURCE_CHECKED`，安装与运行均为 `NOT_RUN`。详细竞争结论见[研究摘要](research-and-competitors.md)。

## 13. 更新规则

更换 Pi 版本或扩大工具支持时，记录：旧假设、新版本/commit、受影响任务、真实命令和结果。无法验证 API 漂移时，依赖该假设的任务不得标记完成。

真实新手研究必须单独保存匿名参与记录和版本信息；没有记录时仍为 `NOT_RUN`。

## 14. 本次产品设计优化的证据边界

2026-09-08 的产品设计修订当时仅修改 docs，代码仍为 A-001 工程基线；此后 A-002～A-005 已按开发计划实现。各任务只继承已记录的版本证据，不把未重新运行的外部来源、安装场景或真人研究写成 PASS。

最终产品取舍：Alpha 验证文件审批；Beta 交付明确文件核验、受限最近一次恢复与同一 Pi 入口；Release 验证安装、性能、平台和真人上手。依据是用户明确要求最终产品轻量、零基础可用，而非文档行数或竞品功能数。运行项目/通用 shell 不在首发承诺，需求若与此不符必须重新评估范围，不能假装已覆盖。

待核对的 Pi 能力包括首次/重复会话提示、帮助入口、取消原因、顺序重试后的模型行为、示例创建后目录切换、文件查看和原卡更新。使用本文件锁定包，B-001/B-003 与对应 Alpha 任务检查真实 API；源码可用不等于交互已实测。性能预算、Windows 恢复 ACL、包体、安装时间和至少 5 人研究均 NOT_RUN。

当前权威入口为[产品规格](product-spec.md)、[架构](architecture.md)、[安全不变量](security-invariants.md)、[风险模型](risk-model.md)、[结果卡](outcome-card-spec.md)和[开发计划](development-plan.md)。中文历史总纲保留为背景；[Codex 执行手册](AgentGlass%20codex执行步骤.md)已于 2026-09-10 按当前正式计划重写，仅作操作辅助，不改变 AGENTS.md 的文档优先级或成为独立任务源。

## 15. Batch 4 设计基线与证据边界

日期：2026-09-10。本节记录本次文档修改之前、同一会话规划阶段的实际检查，不覆写前述历史日期或把设计记为实现。

| 项目 | 本次证据 |
|---|---|
| 工作区 | Windows / PowerShell；A-001～A-012 代码及 Batch 3 评审后的当前工作区 |
| 原有未提交修改 | package.json、src/adapter/pi/adapter.ts、tests/integration/pi-adapter.test.ts、tests/security/approval.test.ts；基线测试包含这些修改 |
| 实际命令 | `npx vitest run tests/unit tests/corpus tests/security tests/integration --testTimeout=30000` |
| 实际结果 | 退出码 0；22 test files、126 tests PASS；Vitest 4.1.11，报告总耗时 107.31 s；这不是性能预算测量 |
| 代码检查 | 真实 Pi 0.85.1 加载/SDK 合约；integration 手动发事件、受控 TUI 输入，部分分支直接调用内置工具；不等同完整 Pi 调度 E2E |
| 尚未建立 | test:e2e script/suite 与 GitHub Actions 工作流；分别计划由 A-016、A-015 建立 |
| 本次未运行 | npm ci、typecheck、lint、build、package dry-run、远端 CI、真实终端人工操作、真人研究、跨平台与 Release 性能预算：NOT_RUN |

以上 126 是该设计基线时的 Vitest test 数，不是 corpus fixture 总数，也不说明每条不变量都已完成证据映射；A-013/A-014 后续已根据实际断言补齐覆盖并报告，不能从该历史总数推导 PASS。

Batch 4 证据层级固定为：源码核对 → 真实 SDK 合约 → Pi 自身调度的自动化 E2E → 真实终端操作 → 真人研究；各层只声明实际覆盖内容，不以一层替代其他层。A-016 的测试模型输出可以是确定性的，工具调度、实际扩展和文件工具必须真实；测试侧读取文件不代表 Alpha 产品已提供执行后核验。

本节记录的设计基线之后，A-013/A-014 已按正式任务完成；当前逐项不变量证据见 `security-invariants.md` 第 5 节。当时 A-015/A-016 仍为计划；A-015 的后续实测见第 16 节，A-016 再接入 e2e 与 package dry-run。没有实际远端运行记录时继续写 NOT_RUN，不为触发 CI 擅自推送。docs 被忽略，本地直接验收，远端不依赖这些未提交规范。

本批不建立普通事件存储，不实现 Beta 核验/恢复或欢迎入口；Beta 准入仍要求 Alpha 自动化与最终 review、至少 5 名真实参与者研究及关键误解修复，并由用户明确分配。历史总纲中的旧编号和功能不再由当前手册转发为执行指令。

## 16. A-015 Pi 合约与最小 Windows CI 实测证据

核验日期：2026-09-10。任务起点 HEAD 为 `a6bcf066659c9c2e08d2184ee04b2f272b9f6330`，已跟踪工作区无改动；`AGENTS.md` 与 `docs/**` 由 `.gitignore` 忽略，本轮逐文件直接读取并在本地更新证据，未修改 `.gitignore`、force-add、commit、push 或发布。

| 项目 | 实际证据 |
|---|---|
| 环境与锁定版本 | Windows win32-x64 / PowerShell；Node 24.14.0、npm 11.9.0；真实安装的 `@earendil-works/pi-coding-agent` 与 `@earendil-works/pi-tui` 均为 0.85.1 |
| 内置工具来源/schema | 真实 `AgentSession.getAllTools()` 的 `read/write/edit` 均为 `source=builtin`、`path=<builtin:name>`、`scope=temporary`、`origin=top-level`，并核对锁定 required/property schema；SDK 同名 `read` 保持 overridden，未知工具保持 unknown，二者均不进入普通支持路径 |
| 模式与 UI 能力 | 真实 `ExtensionRunner` 覆盖 TUI/RPC/print/json 的正常组合及 TUI/RPC 无 UI、print/json 有 UI 的矛盾组合；只有 TUI + 实际 UI 可批准，RPC 即使有 UI、print/json 有 UI、TUI 无 UI 均阻止 ask 动作，详情/停止/Esc/异常不构成批准 |
| 身份与生命周期 | 真实 reload 建立新 `ExtensionRunner` 并清理旧 active/token/goal；tool end、agent end、shutdown、新 session、重复调用均有断言。相同 sessionId/toolCallId/raw input 在不同真实 cwd 下仍因 cwd 绑定拒绝旧 token；真实 session 切换也使旧 token 失效 |
| 输入与 sibling | 输入变化和目标漂移均重新生成卡片并要求新批准；当前 assistant message 的 read+read、read+write、write+write、write+unknown、unknown+unknown、三 sibling，以及缺失/重复/旧 turn/session 变化/无效 sibling 都按 Alpha 规则处理 |
| Core 边界 | `tests/security/host-boundary.test.ts` 递归扫描 Core；11 个反例覆盖 pi-coding-agent 与 pi-tui 的值、类型、副作用、动态 import，以及 Pi event/context/TUI/domain 结构，均会被拒绝；宿主无关 execution identity 仍允许 |
| Windows CI | 新增唯一 `.github/workflows/windows-ci.yml`：pull_request、push、workflow_dispatch；`contents: read`；一个 `windows-latest` job；Node 24.14.0、npm 11.9.0；依次运行 npm ci、typecheck、lint、build、unit、corpus、security、integration；无 matrix、continue-on-error、test:e2e、发布、部署或密钥 |
| 官方 Actions 核验 | 官方 release 与 tag ref 核对 `actions/checkout` v7.0.1=`3d3c42e5aac5ba805825da76410c181273ba90b1`、`actions/setup-node` v7.0.0=`820762786026740c76f36085b0efc47a31fe5020`；工作流固定完整 SHA，并关闭 checkout credential persistence 与 setup-node 自动包管理器缓存 |

本轮实际命令：`npm ci` 退出码 0（217 packages；上游 `node-domexception@1.0.0` deprecated 警告）；首次 `npm run lint` 因新增测试格式失败，按 Biome 提示作机械修正后重新运行通过。最终 `npm run typecheck`、`npm run lint`（40 files，无修复）、`npm run build` 均退出码 0；`test:unit` 7 files / 42 tests、`test:corpus` 4 / 22、`test:security` 9 / 63、`test:integration` 2 / 18 全部 PASS。CI 静态配置断言包含在 integration，未使用空 suite 或 `passWithNoTests`。

远端 GitHub Actions run `93381269632` 在 commit `04d3281af1c247cb713aa682b61d36dbd3dc2316` 实际运行：checkout、Node/npm 安装、`npm ci` 与 typecheck 通过，lint 因 Windows runner 的 `core.autocrlf=true` 将文本 checkout 为 CRLF 而失败，后续 gate 未运行。当前最小修复新增 `.gitattributes` 的 `* text=auto eol=lf`，并在既有 CI 配置测试中断言该策略；修复后本地完整 A-015 gate 再次通过，修复版本的远端重跑仍为 **NOT_RUN**。

`test:e2e`、真实人工 TUI、真人研究、macOS/Linux、完整 Pi 执行循环和 package dry-run 均为 **NOT_RUN**；既有测试仍属于真实 SDK + 手动事件/受控 UI 证据，不冒充 A-016 调度 E2E、产品执行后核验或恢复能力。A-015 未改产品运行时代码、依赖、领域类型或 snapshot schema，未建立 Beta 模块；下一可执行任务为 A-016，本轮未开始。

## 17. A-016 真实调度 E2E 实测证据

核验日期：2026-09-11。任务起点 HEAD 为 `4d0d415d442290e33cb484d0a6d79a7fd540408b`，已跟踪工作区无改动；`AGENTS.md` 与 `docs/**` 由 `.gitignore` 忽略，本轮逐文件直接读取并更新本地证据，未修改 `.gitignore`、force-add、commit、push 或发布。

| 项目 | 实际证据 |
|---|---|
| 环境与版本 | Windows 11 10.0.26200 win32-x64 / PowerShell；Node 24.14.0、npm 11.9.0；锁定 `@earendil-works/pi-coding-agent` 与 `@earendil-works/pi-tui` 0.85.1 |
| 真实调度层级 | `tests/e2e/pi-dispatch.test.ts` 通过 `AgentSession.prompt()` 注入确定性模型事件，由 Pi 自身 agent loop 生成 assistant tool calls、校验参数、建立 sibling 批次、调用实际 package 入口的 `tool_call` handler，并执行或阻止真实内置文件工具；未调用生产模型或网络。临时故障扩展只在 AgentGlass 前捕获当前事件，用于输入变化和 sibling 缺失注入，不替换 Adapter、风险、审批或工具执行 |
| 隔离与敏感域 | 每个场景使用独立临时 root、cwd、agentDir、in-memory sessionId 和 agentDir 下 snapshot 根；成功分支只检查目标字节和 snapshot 目录存在性，不读取或报告 snapshot 正文。测试结束删除临时数据；报告不保存 raw input、token、真实秘密或完整 transcript |
| 允许场景 | 普通 read 不弹审批；新建 write、覆盖 write、edit 各自在 Stop 默认焦点的卡片上明确选择继续后，由 Pi 调度实际工具。测试侧独立读取并确认四个目标动作的预期字节；该读取只是测试断言，不是产品 verifier |
| 交互与能力 | Stop、详情后继续、详情后停止、Esc、custom 返回 undefined；无 UI 与 RPC 即使存在 UI context 均不能批准。详情只展开脱敏内容且不构成批准 |
| sibling 与变化 | write+write、write+unknown 和缺失当前 sibling leaf 均阻止变更，不自动重排；审批期间内容、目标路径和 pre-image baseline 漂移均使旧卡失效并产生新卡。外部写入漂移后选择停止，目标只保留外部写入，不归因给被阻止动作 |
| 单次与会话 | 相同 toolCallId 重放必须出现新卡，停止后不能复用旧 Continue；sessionId 替换并 reload 后旧批准不能使动作执行，缺少完整新授权时失败关闭 |
| 降级与阻止 | snapshot 存储不可用时卡片显示“未能保存修改前证据”和“当前不能自动恢复”，Alpha 仍可重新明确批准且无恢复承诺；未知工具、同名 read 覆盖、shell、安装/运行命令、敏感、越界、junction 与超过 Canonicalization v1 上限的合成 Critical 输入均未执行，阻止目标保持原字节或不存在 |
| CI 与制品 | 既有只读 Windows job 已在 integration 后追加 `test:e2e` 与 `npm pack --dry-run --json`；本地 package dry-run 为 27 entries、40,237 bytes packed、153,254 bytes unpacked。该清单不替代 Release 制品增量或性能预算 |

本轮完整命令均退出码 0：`npm ci`（217 packages；上游 `node-domexception@1.0.0` deprecated 警告）、`npm run typecheck`、`npm run lint`（41 files，无修复）、`npm run build`、`npm run test:unit`（7 files / 42 tests）、`npm run test:corpus`（4 / 22）、`npm run test:security`（9 / 63）、`npm run test:integration`（2 / 18）、`npm run test:e2e`（1 / 8）和 `npm pack --dry-run --json`（27 entries）。Corpus fixture 口径保持 A-013 实测：文件主 corpus 24、classifier→risk 8、规则 hit/neighbor 22、shell 127（40 candidate / 50 ask / 37 block）；本轮未复制或新增 corpus fixture。

A-016 没有改产品运行时代码、领域类型、snapshot schema 或依赖，也没有增加 `tool_result` verifier、执行后卡片、恢复、事件存储、`/agentglass` 或随包示例。2026-09-11 最终 Batch 4 review 在同一 `HEAD 0d720571cb8f1db3316f97f4716f48ace0c3c90d` 重新取得相同 gate 结果；修正文档状态后的最终 package dry-run 仍为 27 entries，40,233 bytes packed、153,263 bytes unpacked。公开远端 Windows CI #3（run `34507840141`）为 Success。真实人工终端操作、真人研究和 macOS/Linux 均 **NOT_RUN**。Pi 自身日志/联网与返回后恶意共存扩展改写不在 AgentGlass 可证明边界。结论仅为 Alpha automated gate PASS；A-016 不构成 Beta 准入或开始 B-001 的授权。

## 18. Beta 规划核对（2026-09-11，文档任务）

本次直接读取代码、五类测试入口、package/lockfile 与 Windows CI，并核对第 17 节及 security-invariants 的最终审查记录。Git HEAD 为 0d720571cb8f1db3316f97f4716f48ace0c3c90d，起点已跟踪工作区干净；Alpha 最终自动化结果引用第 17 节，不是本次重跑，也未重新查询远端 CI。

当前实现只在 tool_call 做 preflight/前像/预测/批准；tool_execution_end 删除关联，agent_end 清理单轮状态。pre-image-snapshot.ts 已有 schemaVersion=1、10 MiB/100 MiB/4096 条目上限及权限/锁/原子发布机制，所有证据仍固定不可恢复。尚无产品结果核验、恢复入口、清理或 /agentglass 欢迎示例。

开发计划 v2.0 将 Beta 收敛为四项完整任务；修复了“最终审查待执行”“v1 无旧 schema”和旧 Beta 编号引用。原卡更新/结果事件合约由 B-001 实测，恢复生命周期/权限/旧数据由 B-002 验收，示例宿主能力由 B-003 验收。保持 INV-001～020 和 Alpha 真人准入要求，不把计划更新作为开始实现授权。

本次只运行文档引用、编号、阶段、类型/安全及文件范围检查；运行时 typecheck/lint/build/五类 suite、真实终端、真人研究、跨平台及性能预算均 NOT_RUN。没有新增测试 PASS 或参与者记录；Alpha 历史自动化证据与本次文档检查分开报告。

本次文档检查实际命令：PowerShell 执行 & "$env:TEMP/agentglass-beta-doc-check.ps1"，退出码 0；核对 9 个预期 Markdown 改动、22 个相对文件链接、恰好 B-001～B-004 四项任务、20 条 INV 原规则未改，以及逐文件 git diff --no-index --check 空白检查。Git status --short / git diff --name-only 无输出：README、docs 与 AGENTS 均被忽略，改动范围通过修改前本地副本与 Get-FileHash 对比取得，不以空 Git diff 证明文档无改动。第一次检查脚本分别将 no-index 的“有差异”退出码 1 误判为错误、将 README 误认为已跟踪；修正检查器后通过，未因此更改产品或安全要求。

## 19. B-001 工程准入代理验证例外（2026-09-11）

当前无法取得真人参与记录；用户明确接受以本轮代理验证开启 Beta 工程阶段。该决定只使 B-001 在另行明确分配后可开始，不把 `Human Validation=NOT_RUN` 改为 PASS，不关闭待确认的关键误解，也不适用于 B-004、Beta 完成声明或 Release。

代理验证基线为 `agentglass@0.1.0-alpha.0`、HEAD `0d720571cb8f1db3316f97f4716f48ace0c3c90d`、Windows、Node 24.14.0、npm 11.9.0，以及锁定的 Pi 0.85.1。本轮实际运行 `npm run typecheck`、`npm run lint`（41 files）、`npm run build`、`npm run test:unit`（7 files / 42 tests）、`npm run test:corpus`（4 / 22）、`npm run test:security`（9 / 63）、`npm run test:integration`（2 / 18）和 `npm run test:e2e`（1 / 8），全部退出码 0；合计 23 个 Vitest 文件、153 个测试。此结果记为 `NON_HUMAN_PROXY=PASS`，不是参与者证据。

本次只更新开发计划、研究状态、声明边界和威胁/安全证据映射，不修改产品代码、依赖、Pi 适配器、测试或 snapshot schema，不开始 B-001。INV-014 原规则保持不变：真人成功率、30 秒可读性和零基础理解均不得宣称已验证。

## 20. 代理验证成为正式 Beta/Release gate（2026-09-11）

用户进一步明确要求代理验证代替真人验证。development-plan v2.2、product-spec v1.3、outcome-card-spec、安全不变量映射、威胁模型和研究包现统一规定：B-004 与 R-004 使用完整阶段的 `NON_HUMAN_PROXY` 证据，不再以真人研究作为工程完成前置条件。当前 §19 的 153-test 结果仅覆盖 Alpha，不能提前标记 B-004 或完整 Beta PASS。

INV-014 的事实边界未改变：代理验证不是参与者记录；`Human Validation` 仍为 `NOT_RUN`；不得发布真人成功率、理解度、读卡时间或普遍易用声明。本次没有修改运行时代码或测试，没有开始 B-001。

## 21. Alpha 代理准入闭环（2026-09-11）

针对原真人前置的八项缺口，研究包 §16 已建立强制替代证据：S01～S11 代理场景 11/11 PASS（S08 snapshot 故障 1/1），M-01～M-07 代理审查 7/7 `PROXY_CLOSED`，缺失的逐人回答/选择/耗时/求助等字段由环境、测试名称、交互分支、文件断言、退出码和失败路径替代。真人字段不生成虚构值，`Human Validation=NOT_RUN` 被接受为准确边界状态。

本轮在未改变运行时代码的同一 HEAD 重新执行：`npm run typecheck`、`npm run lint`（41 files）、`npm run build`、unit 7 files / 42 tests、corpus 4 / 22、security 9 / 63、integration 2 / 18、e2e 1 / 8，全部退出码 0；共 23 files / 153 tests。结论为 `PROXY_ADMISSION_PASS`，当前所有 B-001/Beta 工程准入条件完成。该结论不开始 B-001，也不能提前替代 B-004 对完整 Beta 的重跑。

## 22. 移除现行手册中的真人工程依赖（2026-09-11）

当前执行手册升级为 v2.2：Alpha 入口改为代理准入审查；B-001 只检查最终 Alpha review 与研究包 §16 的 `PROXY_ADMISSION_PASS`；B-004 改为完整 Beta 代理验收。B-001～B-004 的现行 Prompt 均明确 Human Validation 不是工程依赖，不再因参与者为 0、E4 未执行或缺 `HUMAN_VALIDATION_PASS` 停止任务。

真人研究包仍作为可选研究材料保留，INV-014 仍要求无真实记录时报告 `Human Validation=NOT_RUN`。历史 references 与历史计划保留当时事实，不作为当前任务或 gate；正式规则以 development-plan v2.2 和当前执行手册 v2.2 为准。本次仅修订文档，没有修改运行时代码或重新运行测试。

## 23. B-001 Pi 结果合约与文件核验实测证据（2026-09-11）

任务起点 HEAD 为 `0d720571cb8f1db3316f97f4716f48ace0c3c90d`，已跟踪工作区干净；研究包 §16 在同一 HEAD 记录 `PROXY_ADMISSION_PASS`（S01～S11 11/11、M-01～M-07 7/7），故 B-001 工程依赖满足。`Human Validation=NOT_RUN` 是准确边界，不是本任务依赖。本轮未修改 `.gitignore`、未 force-add、commit、push 或发布；`AGENTS.md`、README 与 `docs/**` 被忽略，均直接读取与核对。

锁定依赖仍为 `@earendil-works/pi-coding-agent@0.85.1` 与 `@earendil-works/pi-tui@0.85.1`。真实包类型及源码检查、随后 `tests/e2e/pi-dispatch.test.ts` 的 `Pi 0.85.1 emits start → tool_call → modifiable tool_result → end, and verification ignores result text` 实际证明：

- 顺序为 `tool_execution_start → tool_call → tool_result → tool_execution_end`；批准发生在 `tool_call`，执行后的独立观察从 `tool_result` 触发，结束事件只处理缺失结果和清理。
- `tool_result` 提供 toolCallId、toolName、input、content、details、isError、usage，扩展可以依次修改 content/details/isError/usage；B-001 只读取身份/input fingerprint/isError，不读取或保存 content/details/usage。
- `tool_execution_end` 提供 toolCallId、toolName、result、isError，但 handler 没有结果替换返回类型；B-001 不读取 result，只在对应 `tool_result` 缺失时将原卡更新为 unknown，随后清理。
- Stop/Esc/取消会出现 start、tool_call、失败 end 而没有 tool_result；这只证明该 Pi 调度分支被阻止，不允许一般化为“任何缺失结果都没有执行”。
- `ctx.ui.custom()` 的审批 modal 在 done 后关闭；Pi 0.85.1 提供 `setWidget(key, string[])` 与 `setStatus(key,text)`。B-001 用同一 actionId 和稳定 `agentglass-action` key 展示执行中及最终状态，用 `agentglass-read` 合并普通读取反馈；不存在更新已关闭 modal 本体的 API。

Adapter 在 Continue 后仍复核五项绑定、目标和前像并同步消费 token；pending 只保留绑定、action/effect/target ID、明确目标路径、执行前身份和预期 hash/长度。write 以 UTF-8 预期字节核对；edit 使用锁定 Pi 的 `createEditToolDefinition` 和内存操作推导同一匹配、NFKC/模糊字符、歧义、BOM、CRLF/LF 与失败语义。正文不进入普通领域对象，snapshot 原字节仍只在敏感存储域。

单文件观察复用 `readStableFile`：lstat/open 身份一致、拒绝 symlink/非普通文件/hard link、64 KiB 分块、初始与实际增长均受 10 MiB 限制，读取后复核身份/大小/mtime/ctime/mode。不稳定、超限或不可读均为 unknown；明确缺失或精确字节矛盾为 mismatch；只有全部列明后置条件匹配才为 matched。结果状态不证明实际需求或程序功能。Pi 返回后恶意后加载扩展仍可能改写输入/结果，不在 AgentGlass 的保证边界。

本轮最终命令均退出码 0：`npm run typecheck`、`npm run lint`（44 files，无修复）、`npm run build`、`npm run test:unit`（8 files / 57 tests）、`npm run test:corpus`（4 / 23）、`npm run test:security`（9 / 64）、`npm run test:integration`（2 / 21）和 `npm run test:e2e`（1 / 12），合计 24 个 Vitest 文件 / 177 个测试。integration 首轮因一条新断言误放而 20/21，修正后定向 1/1、最终完整 21/21；不把定向重跑中的 skipped 算作通过分母。

恢复按钮、恢复/清理、欢迎命令、完整 Beta 代理验收、真实人工终端和 macOS/Linux 均未实现或 **NOT_RUN**；package 仍为 `0.1.0-alpha.0`。B-001 固定“当前不能自动恢复”，不能称完整 Beta 已交付。

## 24. B-002 最近一次单文件恢复实测证据（2026-09-12）

任务起点 HEAD 为 `3598143a2aa9bea09844f69a7133c27101f244cc`，`main...origin/main` 且已跟踪工作区干净。先在未修改代码上重跑 B-001 依赖：typecheck/lint/build、unit 8/57、corpus 4/23、security 9/64、integration 2/21、e2e 1/12 均退出码 0，才开始 B-002。真人验证不是工程依赖且仍为 `NOT_RUN`。

当前实现仍锁定 `@earendil-works/pi-coding-agent@0.85.1` 和 `@earendil-works/pi-tui@0.85.1`。使用 Pi 真实 `registerCommand("agentglass")`、`AgentSession.prompt()`、执行事件顺序与 TUI custom widget；没有换版本、没有用 mock 替代真实调度，也没有增加运行时依赖。

恢复敏感存储采用新 `schemaVersion=2` / `agentglass-single-file-recovery`：`prepared` 仅是执行前证据，只有 B-001 的精确后置字节独立匹配时才原子发布 `ready`。版本 1、损坏、future、prepared-only 和发布中文件不会恢复入口或许可；只在归属和引用关系可验证时进入单独清理集合。旧 schema v1 可清理但不可迁移为恢复入口。

Windows 实测覆盖：覆盖写恢复原字节与 ACL；edit 通过真实 Pi 调度恢复；新建文件只在后置字节/身份/权限完整匹配时删除该文件。内容、身份、硬链接、权限或审批中漂移均保留当前文件；观察到冲突或 session/cwd 边界切换后立即丢弃内存入口，字节偶然变回也不会让许可复活。恢复 token 使用新的 `agentglass.restore` 指纹、唯一调用 ID、cwd/session 与五项绑定，全部异步复核后同步单次消费。失败、中断和冲突不自动重试、不重建 token、不建 redo。

`/agentglass` 是唯一入口：恢复与清理都在 Stop 初始聚焦的独立卡片中批准。清理绑定确切文件集、内容 hash、数量与逻辑字节；集合漂移不删除，拒绝不删除，部分失败报告已删/保留数。不识别的文件、损坏/future manifest 和中断发布物保留。

本轮最终命令均退出码 0：`npm run typecheck`；`npm run lint`（44 files，无修复）；`npm run build`；`npm run test:unit`（8 files / 65 tests）；`npm run test:corpus`（4 / 23）；`npm run test:security`（9 / 65）；`npm run test:integration`（2 / 24）；`npm run test:e2e`（1 / 13）。合计 24 个 Vitest 文件 / 190 tests。定向开发运行中的 skipped 不计入该分母。

本轮没有修改 `.gitignore`，没有 force-add、commit、push 或 publish。`docs/**` 被忽略，因此直接读取和逐文件核对，不以 Git 空 diff 作为证据。真实人工终端、Human Validation、macOS/Linux、远程 CI、空白环境安装、性能/包体与无法穷尽的 OS 掉电时序均为 `NOT_RUN`。B-003/B-004 尚未开始，当前仍不声称完整 Beta。

## 25. B-003 一个入口与安全示例实测证据（2026-09-12）

任务开始时真实 cwd 为 `G:\work\AgentGlass`，Git HEAD 为 `730c9f23610e3c0cfb583033d5ab455481a500c4`；`git status --short` 与 `git diff --stat` 均为空。已先直接读取被忽略的规范文档，并核对 B-002：`npm run typecheck` 退出码 0；pre-image snapshot unit 16/16、security 5/5、Pi adapter integration 22/22、锁定 Pi E2E 13/13 均退出码 0，确认恢复/清理依赖没有缺口后才开始 B-003。当前任务保留这些既有修改，不修改 `.gitignore`，不 force-add、commit、push 或 publish。

运行时仍锁定 `@earendil-works/pi-coding-agent@0.85.1` 与 `@earendil-works/pi-tui@0.85.1`，使用真实 `registerCommand("agentglass")`、`session_start`、`ExtensionContext.cwd`、`setWidget`/`custom` 和 Pi agent loop。检查锁定包类型与源码后确认扩展没有可靠的目录切换或文件打开 API；帮助因此明确要求使用 Pi 已有项目/会话方式切换目录，并在对话中请求 Pi 查看文件，不启动 shell 或额外程序。欢迎与帮助共用一个 `agentglass-welcome` widget，产品没有第二入口、设置、密钥或运行时依赖。

固定示例为随扩展构建产物交付的 `agentglass-example/活动说明.txt` 与无秘密活动说明文本，目标为“帮我修改这份活动说明”。预检拒绝非真实/链接 cwd、非空固定目录和不确定身份；审批卡明确创建位置、不覆盖、目录不可恢复和部分失败保留。批准后复核 cwd realpath、设备/索引身份与目标不存在，再同步消费 `agentglass.example` 一次性绑定；示例文件之后由普通 `edit` 进入 B-002 观察/恢复/清理链路。

B-003 自动化实际通过：`npm run typecheck`、`npm run lint`、`npm run build`、`npm run test:unit`（8 files / 65 tests）、`npm run test:corpus`（4 / 23）、`npm run test:security`（9 / 65）、`npm run test:integration`（2 / 26）、`npm run test:e2e`（1 / 14）均退出码 0；追加 `npm pack --dry-run --json` 退出码 0，清单 44 entries，packed size 113,110 bytes、unpacked size 453,682 bytes。`dist/src/adapter/pi/adapter.js` 中实际包含固定目录、活动说明文本和自然语言目标；package 清单包含 `extensions/`、完整 `dist/`、入口所需的 `src/`、README 与 package.json，不包含 docs、tests、research 材料。

B-003 集成用例覆盖首次欢迎一次、同 cwd reload 不重复、主动帮助不弹审批、脱敏 cwd、最近结果、恢复/清理说明、固定示例冲突、取消和无 UI；真实 Pi E2E 覆盖示例准备 → 普通 edit → restore → cleanup。测试侧受控 TUI 输入只证明真实 Pi 调度和文件断言，不证明真人理解。真实终端人工走查、Human Validation、macOS/Linux、空白电脑安装、远端 CI、性能预算和 B-004 完整 Beta 代理验收均为 `NOT_RUN`；当前不宣称完整 Beta。

## 26. B-004 完整 Beta 代理验收与真实终端证据（2026-09-12）

### 26.1 基线、环境与证据边界

本轮从真实 cwd `G:\work\AgentGlass` 开始。Git HEAD 为
`556c90e1ef36cb558d2f7496ecbec6208e568828`，起始和结束时
`git status --short --branch` 均只有 `main...origin/main`，`git diff --stat` 为空；
`AGENTS.md` 与 `docs/**` 被 `.gitignore` 忽略，均已直接读取，未修改 `.gitignore`，未
force-add、commit、push 或 publish。旧 Alpha/B-001～B-003 PASS 只作为依赖核对，不计入
本轮 Beta 分母。

| 项目 | 本轮实测 |
|---|---|
| 产品/宿主 | `agentglass@0.1.0-alpha.0`；`@earendil-works/pi-coding-agent@0.85.1`；`@earendil-works/pi-tui@0.85.1` |
| 系统/终端 | Windows `10.0.26200` x64；PowerShell；真实 PTY；Pi CLI `v0.85.1` |
| Node/npm | Node `v24.14.0`；npm `11.9.0` |
| 真实终端隔离 | 临时无秘密 cwd；`pi --no-session`、Pi 0.85.1、隔离测试目录；使用已配置 `deepseek-v4-pro • high`；未读取认证/快照秘密，不执行 shell/安装/项目运行 |
| 真实终端已完成 | Pi TUI 加载 `agentglass.ts`；`/agentglass help`；普通 read；write 创建的 Stop/详情/拒绝后再批准；edit 成功；restore 成功；新建文件恢复删除；恢复冲突保留后续编辑；重启后旧入口失效；cleanup 独立批准；`/agentglass example` 批准及固定文件断言；安装/运行请求被阻止；目标漂移重新呈现审批且未覆盖外部后续内容；只读文件 EPERM 失败卡；隐式父目录阻止；无审批 UI 的 JSON/print 阻止；RPC state-changing write 阻止；链接路径阻止并独立确认目标未创建；敏感 `.env` write/read 被固定阻止且未暴露内容；超限文件 write 在前置证据阶段阻止且原文件保持 |
| 真实终端补充完成 | 会话 `9411` 中模型实际提出并执行两个受批准 `write`；先加载、仅存在于隔离目录的故障扩展在工具完成与 AgentGlass 观察之间分别写入不同字节和把目标替换为目录，结果卡实际显示“不符”与“无法确认”，两者均无恢复入口。会话 `45859` 覆盖含合成 canary 的普通文件，模型输入不含 canary；隔离扫描 6 个文件时 canary 仅命中一个 `.preimage`，manifest 与覆盖后项目文件均 0 命中。临时扩展、目标、snapshot 和进程均已清理。早先 watcher 与 `43461`/`59822` 等失败尝试仍不计数 |
| 声明边界 | 受控 TUI 不是真人选择；固定文案不是真人理解；真实 Pi 测试调度不等于真实模型提案；文件断言不等于应用功能成功 |

真实终端观察到的固定事实：欢迎/帮助只显示 cwd 标签，不显示完整路径；支持范围为已验证普通文件查看、创建和修改；明确不支持 shell、安装、启动/部署、联网、批量删除和覆盖工具。普通 read 没有审批卡；创建卡初始焦点为 Stop，详情不会批准，Stop 后没有文件且模型收到重新确认下一步；Continue 后由独立读取确认文件内容。edit 卡披露旧内容可能丢失和恢复能力，Continue 后独立核对；`/agentglass restore` 成功恢复旧文件，随后对新建文件的 restore 在用户确认删除临时文件后独立确认文件不存在；恢复冲突保留用户后续编辑。重启后 `/agentglass restore` 返回当前会话没有可用恢复项。cleanup 卡显示删除 9 个已验证私有文件、7879 字节及恢复能力损失，用户单独确认后报告 9/0，并再次 restore 返回无入口，项目文件仍在。对具体 Node.js 安装和运行项目的请求，模型尝试探索目录时被 AgentGlass 固定阻止，未执行 shell/安装/运行。示例批准后实际文件为 `<临时 cwd>\agentglass-example\活动说明.txt`，内容为固定无秘密活动说明，未产生恢复 snapshot。

本轮真实 Pi PTY 证据会话为 `78239`（read/create/edit/restore/conflict）、`31998`（新建文件恢复/不支持任务）、`37502` 与 `99024`（重启、cleanup、example）、`83802`（失败请求未进入 edit 卡）、`93523`（目标漂移/外部后续内容保留）、`19130`（两次结果改写时序未形成 mismatch、隐式父目录阻止）、`93265`（链接路径阻止）、`46658`（只读文件 EPERM 失败）、`51028`（模型实际调用敏感 `.env` write 后被固定阻止）、`39459`（模型实际调用敏感 `.env` read 后未暴露内容）、`56844`（超限 edit 导致 Pi UI 栈溢出）、`14227`（超限 write 前置证据阻止）、`73778`（watcher 后置替换仍先 matched）、`98665`/`43224`（外部改写尝试未形成实际工具事件）、`43461`/`59822`（直接失败 edit 提案未形成实际工具事件）、`9411`（真实模型 write 后的 mismatch/unknown 故障注入）与 `45859`（含合成秘密前像的隔离持久化边界）。对应 watcher 为 `36116`、`61622`、`29467`；后两次均在原文件未变的情况下结束并清理临时目录。真实 RPC 会话为 `76175`（两次 write 均因无本地审批 UI 被阻止）。另有非交互命令 `pi ... --mode json --print ...` 返回固定“当前模式没有可用的本地审批界面”并未创建目标文件。PowerShell/Node 只对隔离测试文件做独立存在、大小、字节、inode 和 canary 命中位置断言，不输出 canary 或 snapshot 正文，也不代表产品允许的 shell 路径。

新增故障证据边界：`46658` 中真实工具返回 `EPERM`，AgentGlass 结果卡标为“不符”且不提供恢复入口；`93523` 的目标漂移重新呈现审批并保留外部内容；`19130` 的缺失父目录被固定阻止；无 UI JSON 与 RPC write 没有把无交互当批准；`93265` 的链接目标未创建；`51028`/`39459` 的敏感 `.env` write/read 被阻止；`14227` 的 10,485,767-byte write 在前像阶段阻止且原文件保持。`9411` 的测试扩展明确位于 AgentGlass 之前，只在真实工具完成后改变隔离目标：`mismatch.txt` 的最终字节不同，`unknown.txt` 变为目录，分别命中明确矛盾和不受支持读取；这证明结果状态与文案路径，不证明 AgentGlass 能抵御恶意共存扩展。`45859` 使用实际 Adapter 和隔离 snapshot 根；覆盖输入与普通 UI 不含 canary，扫描只报告命中数量/扩展名，不输出敏感正文。`56844` 的超限 edit 栈溢出经源码定位发生于 Pi 0.85.1 内置 edit 预览：`message_end` 后、AgentGlass `tool_call` 前；目标未变，不能用覆盖内置工具或改写模型参数破坏工具身份/审批绑定来“修复”，移交 R-001。早先 `73778` 等后置 watcher 仍不计入新分母。

### 26.2 完整 Beta 代理误解矩阵

下表的“分母”是本轮实际执行的受控代理分支或命名场景数，不是参与者数，也不生成理解率。命中、相邻反例和故障均来自当前代码的测试/断言；真实 Pi 路径和文件断言与固定文案、受控 UI 分列。已配置模型后，真实 PTY 覆盖主要支持、恢复、阻止、漂移、权限、路径、无 UI、敏感目标和超限 write，并由 `9411`/`45859` 补齐真实模型工具调用下的 mismatch、unknown 与秘密 snapshot 边界。矩阵结论为 `BETA_PROXY_ACCEPTANCE=PASS`；Human Validation 不因此改变。

| 误解/场景 | 实际代理分母与结果 | 命中、相邻反例、故障 | 真实 Pi 路径/文件断言 | 声明边界 |
|---|---|---|---|---|
| M-01：卡片目标/文件范围被误认 | 自动化 3 个输入/目标/pre-image drift 分支 `3/3`；真实 `93523` 在外部改写目标后重新呈现审批，选择 Stop，最终保留外部内容 | 命中漂移重卡；相邻反例为同一精确动作；真实故障为目标在批准前发生外部变化 | `tests/e2e/pi-dispatch.test.ts` 真实 agent loop；`93523` 用 PowerShell 独立确认文件仍为外部后续内容 | 不证明外部共存扩展不能在审查后改写输入，也不把二次呈现冒充完整 mismatch |
| M-02：详情、停止、拒绝等同于批准 | 5 个真实受控选择：stop、details-continue、details-stop、escape、cancel；`5/5` 行为正确 | 命中仅 Continue；详情、Stop、Esc、取消均不执行；无 UI/RPC/错误为故障分支 | 受控 Pi TUI 测试检查 tool event 顺序和目标文件存在性 | 不证明真人理解，只证明初始 Stop 和实际 Continue 绑定 |
| M-03：有副本就一定可恢复/恢复不会影响内容 | 自动化 5 个恢复分支 `5/5`；真实 PTY 覆盖 edit 恢复、新建文件删除、冲突保留 `3/3`；超限 write `14227` 在前置证据阶段阻止，原文件保持 | 命中 ready 才给当前入口；相邻反例为 drift/损坏/future/prepared-only；真实冲突保留后续内容；超限故障不提供批准或恢复入口 | 真实 Pi edit→restore、新建→restore、冲突及 cleanup；`14227` 独立断言 10,485,767 bytes 和原始头部 | 仅证明具体单文件证据链与已运行的超限阻止；不声称历史/万能 Undo |
| M-04：文件核验等于应用成功 | matched/mismatch/unknown 三类自动化 `3/3`；`9411` 的两个真实模型 write 分别形成 mismatch 与 unknown；成功/失败卡都保留实际目标与程序功能未知 | 命中独立字节匹配；相邻反例为工具成功但字节不符、工具失败但文件已变；故障扩展在结果观察前改变隔离目标 | 真 Pi 结果卡与独立类型/字节断言；故障扩展不作为恶意共存扩展防护证明 | 文件内容核验不等于需求完成、应用启动或业务功能成功 |
| M-05：被阻止后可绕过保护/建议安装运行 | 自动化 8/8；真实 PTY 2 个明确请求（Node.js 安装、运行项目）均未执行；另在 `19130` 阻止隐式父目录、非交互 JSON 在无审批 UI 时停止，`51028`/`39459` 的敏感 `.env` write/read 也被阻止 | 命中 hard-block；相邻 read 只读提示；真实路径没有 shell/安装/运行，也没有 bash/write 绕过；固定下一步限于查看或单个文件修改 | Pi PTY 固定阻止文案；目标临时目录无额外运行产物；无 UI 与 `.env` 目标不存在/不外泄 | 不建议 shell、安装或运行项目；不声称 sandbox 或全局终止 |
| M-06：unknown/not observed 就是“没变化” | 自动化 3 个 unknown 故障 `3/3` 明确未知；`9411` 把真实 write 后目标替换为目录，卡片实际显示“无法确认”且不提供恢复 | 命中显式 unknown；相邻为可验证 matched/mismatch；不受支持读取不转成安全或未发生 | integration/e2e 事件关联与真实 PTY 目标类型断言 | 缺证据不代表不存在影响 |
| M-07：停止就是全局终止/旧批准仍有效 | 自动化 7/7；真实 Stop/拒绝、新建恢复单次消费、重启后 restore 无入口和 cleanup 后 restore 无入口均观察到；无 UI、RPC、超限 write 另有独立阻止证据 | 命中当前动作不执行、单次消费、生命周期失效；相邻 Continue 仅当前动作；真实故障为 EPERM/无 UI/RPC/超限前置失败，不把错误当批准 | Pi PTY 文件存在性、重启 session、cleanup 后 restore 警告、`46658` 只读断言、`76175` RPC JSONL、`14227` 超限文件断言 | 产品不承诺替用户终止 Pi 后续模型提案或所有宿主活动 |

扩展 Beta 场景逐项覆盖：Pi 已配置后的首次欢迎、同 cwd reload 不重复、主动帮助、脱敏当前目录、安全示例批准、read/create/edit、停止/详情/拒绝后的下一步、覆盖写恢复、新建文件逆操作、恢复冲突保留后续编辑、最近入口替代、拒绝保留旧入口、`agent_end`/新 session 限制、清理单独批准及能力影响、不支持安装/运行任务。真实 PTY 另覆盖目标漂移、EPERM、隐式父目录、链接、无 UI、RPC、敏感目标阻止、超限 write、mismatch、unknown 和秘密 snapshot 持久化边界。固定文案、受控组件、真实 Pi 调度和独立文件断言分别保留；故障扩展与隔离存储只用于本轮验收且已删除。Human Validation、macOS/Linux、空白环境安装与性能仍为 `NOT_RUN`；Pi 超限 edit 预览故障移交 R-001。

### 26.3 问题、修复与重测

本轮补充执行未发现 AgentGlass Beta 运行时代码缺陷，故未修改运行时代码、未新增产品故障开关、未扩大支持范围。此前未通过项的根因是缺少可计数的终端故障证据：使用工作区内临时、先加载的测试扩展和隔离 snapshot 根补齐后全部删除。Pi 超限 edit 的根因位于锁定宿主的执行前预览，AgentGlass 尚未收到 `tool_call`；在本仓库覆盖内置工具或改写参数会破坏 INV-007/020，故不采用。所有最终工程命令仍针对同一 HEAD 的运行时代码；本轮文档收口后按 B-004 门槛重跑。

### 26.4 本轮最终门禁

| 命令 | 退出码 | 实际结果 |
|---|---:|---|
| `npm ci` | 0 | 18 秒安装 217 packages；仅有既有 `node-domexception@1.0.0` deprecated warning |
| `npm run typecheck` | 0 | `tsc --noEmit` |
| `npm run lint` | 0 | Checked 44 files；无修复 |
| `npm run build` | 0 | `tsc -p tsconfig.build.json` |
| `npm run test:unit` | 0 | 8 files / 65 tests |
| `npm run test:corpus` | 0 | 4 files / 23 tests |
| `npm run test:security` | 0 | 9 files / 65 tests |
| `npm run test:integration` | 0 | 2 files / 26 tests |
| `npm run test:e2e` | 0 | 1 file / 14 tests；锁定 Pi 0.85.1 真实 agent loop |
| `npm pack --dry-run --json` | 0 | 44 entries；packed 113,473 bytes；unpacked 454,616 bytes |

本轮合计为 24 个 Vitest 文件、193 个测试（65+23+65+26+14）；skipped 不计入分母。无远端 CI 记录，本轮不声称远端 CI PASS；未推送以触发 CI。

### 26.5 B-004 Done Definition 当前状态

| 条件 | 状态 |
|---|---|
| 完整 Beta 代理矩阵及误解解释 | `PASS`；自动化及真实 PTY 覆盖主要支持/恢复/阻止、mismatch、unknown 与秘密 snapshot 边界 |
| 版本/HEAD/差异/环境/命令/分母/失败/证据位置 | `PASS`，见本节 |
| Pi-ready 入门、成功修改、停止、未知、恢复、冲突、不支持任务 | `PASS`；Pi-ready、read/write/edit、restore、新建文件、冲突、不支持任务、目标漂移、EPERM、路径、无 UI、RPC、敏感目标、超限 write、mismatch/unknown 和秘密持久化均有实际证据 |
| 全部工程/安全/corpus/package gates | `PASS`，本轮全部退出码 0 |
| INV-001～020 Beta 断言、Pi 场景与能力限制 | 已回填 `docs/security-invariants.md` 的 B-004 映射；真实终端限制单列 |
| 真实终端 | **PASS（Beta 代理范围）**；Human Validation 仍 NOT_RUN；超限 edit 为 Pi 0.85.1 执行前预览故障，移交 R-001 |
| Human Validation | **NOT_RUN**；没有参与者、理解率或成功率 |
| Beta 收口结论 | **`BETA_PROXY_ACCEPTANCE=PASS`**；完整 Beta 收口。下一合格任务为 R-001，不自动开始 |

## 27. Release 计划与文档基线核对（2026-09-12，文档任务）

本次用户要求依据现有文档和代码优化 Release 计划，不是分配 R-001 或授权发布。核对 HEAD 为 `556c90e1ef36cb558d2f7496ecbec6208e568828`，与 §26 B-004 相同；任务开始时已跟踪工作树无改动。直接读取了被忽略的 AGENTS.md、README 与规范/验收资料，保留旧阶段记录，不把历史 PASS 当本轮重跑。

### 27.1 实现与证据核对

| 核对对象 | 当前发现 | 文档处理 |
|---|---|---|
| Pi Adapter 与 core | §27 记录的历史基线为 tool_result 独立观察、原卡反馈、schema v2 恢复/清理及唯一入口；R-001 当前实现已版本化为 schema v3；不是仅有 Alpha 前像 | 保留历史章节；当前契约见 architecture 与 §28 |
| 恢复替代时机 | adapter 的 tool_result 在 matched、ready 发布并记录旧项 superseded 后才替换 latestRecovery；失败不重建授权 | B-002 Done Definition 文字与 architecture §8 及实现对齐，保留再次使用旧项时的冲突检查 |
| 版本/CI | package 仍为 0.1.0-alpha.0、UNLICENSED，Pi 两包锁定 0.85.1、peer 为 *；现有 .github/workflows/windows-ci.yml 固定 Node 24.14.0/npm 11.9.0 | 元数据/分发留 R-002，支持组合留 R-001；不修改包或 CI |
| 资源 | pre-image-snapshot.ts 存在按需 powershell.exe ACL 调用；1 MiB canonical 与 10 MiB 文件观察上限不同 | 澄清无常驻服务不等于零子进程；R-003 分列纯预检与完整 I/O 成本 |
| Beta 验收 | §26 已记录 24 files / 193 tests、真实 Pi/PTY 与代理收口，当前代码 HEAD 一致 | 作为依赖证据引用，不执行或伪称新的 Beta 验收 |
| 发布阻碍 | §26 的超限 edit 预览栈溢出尚未关闭；平台/安装/正式性能未测 | R-001 首先解决预览问题；不以“不支持输入”文字消除实际可达崩溃 |
| 文档分发 | docs、README、AGENTS 被忽略；package 不含 docs | 当前文档本地直查；R-002 须解决随包说明与链接自足性，不擅改 .gitignore |

### 27.2 冲突与优化决定

- 计划顶部/第 5 节原有“Beta 未开始”、旧 HEAD 与已完成表冲突，改成当前基线；任务单项历史状态仍保留，由 B-004 最终证据覆盖当前状态。
- AGENTS.md 原要求必需真人研究，与 security-invariants 既有 Beta/Release 代理 gate 冲突。本次依最高优先级规范同步为代理工程 gate，Human Validation 仍为 NOT_RUN；没有修改 INV-001～020 的安全规则或允许真人效果声明。
- 计划中的旧恢复替代时机描述与 architecture §8/实际代码不一致；明确必须先有新 ready 与安全记录的 superseded，再替换入口。没有新增恢复历史或重新构造授权。
- R-001～R-004 保留顺序与最小任务数，补充真实平台/预览、制品安装、完整成本和最终候选的可执行 Done Definition。解包字节作为既有 2 MiB 预算的判定口径，同时报告压缩字节；未降低预算。
- 历史执行手册与 Alpha 研究包增加阶段导航，不删除或改写历史验收分母；不再将其标成当前 Release 分配来源。

### 27.3 本次验证范围

本次仅编辑 12 份 Markdown 文档。`git diff --check` 与 `git status --short` 均退出码 0、无输出；`git check-ignore` 确认全部编辑文件被忽略。会话内只读脚本直接读取并对比 12 份修改前/后内容，均与预期编辑一致；核对 R-001～R-004 各有 Done Definition、新增本地引用目标及 Release 标题存在、INV-001～020 规则表未改变、references §1～26 历史证据保留，全部 PASS。Git 空 diff 不能代替这些直接内容检查。

`npm ci`、`npm run typecheck`、`npm run lint`、`npm run build`、五类 test suite、package dry-run、真实 Pi/PTY、跨平台、安装、性能与远端 CI：本次均 **NOT_RUN**（纯文档修改，不影响可执行行为）。Human Validation=NOT_RUN。没有修改运行时代码、测试、package/lockfile、CI 或 .gitignore，没有 force-add、commit、push、tag 或 publish。

§27 当时结论为 Beta 既有 `BETA_PROXY_ACCEPTANCE=PASS`、R-001～R-004=NOT_RUN；本次 R-001 实测结果与当前结论见 §28，`RELEASE_READY=NOT_RUN`。

## 28. R-001 宿主与平台兼容收口实测（2026-09-12）

本节覆盖本次明确分配的 R-001，受 `AGENTS.md`、development-plan §6 和
security-invariants 约束。开始前核对 `BETA_PROXY_ACCEPTANCE=PASS`（§26.5）、
HEAD=`556c90e1ef36cb558d2f7496ecbec6208e568828`、真实 cwd=`G:\\work\\AgentGlass`、
跟踪工作树无改动；docs 与 AGENTS.md 为 ignored 文件，以下更新均直接读取并核对，
没有改 `.gitignore`、package/lockfile、CI、commit、push 或 publish；本轮必要的
恢复证据修复及其测试见下文。

### 28.1 支持矩阵与命令结果

| 环境 | 文件系统/终端 | Node/npm/Pi | 工程命令与分母 | 状态与边界 |
|---|---|---|---|---|
| Windows 10.0.26200 x64 | G: 为 NTFS；PowerShell/native PTY，80×24 观察；ACL 用 `Get-Acl`/`icacls` 实测 | Node 24.14.0 / npm 11.9.0 / coding-agent 0.85.1 + pi-tui 0.85.1 | `npm ci`=0；typecheck/lint/build=0；unit 8 files/65 tests；corpus 4/23；security 9/65；integration 2/26；e2e 1/14，均=0 | 本地自动化与 Windows ACL 分支通过；真实 Pi TUI 超限预览仍 FAIL，不能写成支持 PASS |
| Debian 12 Linux（Docker，干净可写容器副本） | 容器 overlay2；临时目标在 Linux `/tmp`；受控非 root mode/link/permission 断言 | Node 22.19.0（最低拟支持）/ npm 11.9.0 / Pi 0.85.1 | `npm ci`=0；typecheck/lint/build=0；unit 8 files/65 tests；corpus 4/23；security 9/65；integration 2/26；e2e 1/14，均=0 | v3 `changeTimeMs` 已关闭 inode 复用误认；最低 Node 的自动化/权限分支通过，实际 TUI 在主测 Node 组合执行 |
| Debian 12 Linux（Docker，干净可写容器副本） | 同上；native PTY 80×24；真实 POSIX mode/link/permission 与 TUI 文件断言 | Node 24.14.0 / npm 11.9.0 / Pi 0.85.1 | 同一完整 gate 均=0；实际 TUI 完成 help/example/read/write/edit/拒绝/matched/mismatch/恢复/冲突/清理 | v3 `changeTimeMs` 已关闭 inode 复用误认；POSIX 工程与真实终端子项通过；上游超限预览仍阻止整体支持 PASS |

`node >=22.19.0` 是 package engines 下限，不能替代 22.19.0 的实测；Windows 主测组合和
Linux 主测组合都另列为 24.14.0。package.json 的 Pi peer `*` 也不作为兼容证据。
每个候选环境实际运行：`npm ci`、`npm run typecheck`、`npm run lint`、`npm run build`、
`npm run test:unit`、`npm run test:corpus`、`npm run test:security`、
`npm run test:integration`、`npm run test:e2e`。Linux 第一次把 node_modules 挂在
Docker named volume 的 `npm ci` 真实返回 esbuild `ETXTBSY`；该测试夹具故障未记为平台结果，
随后删除精确测试容器/卷，在干净可写副本中以同一命令复测并保留上述结果。

### 28.2 超限 edit 预览故障与官方候选

- 锁定 Pi 0.85.1 的 `ToolExecutionComponent.render` 在 `lines.push(...contentLines)` 展开
  超大 wrapped diff；`computeEditsDiff` 本身可完成，崩溃发生在 AgentGlass `tool_call` 之前，
  不能由 AgentGlass 的批准/阻止回调拦截。
- 干净 Windows 隔离临时文件、80 列 PTY 组件路径：64 KiB 与 4 MiB 输入均正常；旧/新各
  8,388,608 bytes 的 edit 在 render 时返回 `RangeError: Maximum call stack size exceeded`，
  栈顶 `ToolExecutionComponent.render (...tool-execution.js:189:23)`，退出码 1；8 MiB 目标文件
  前后长度相同，证明该 preview 复现没有执行写入。真实 Pi TUI 也在 80×24 Windows PTY 中
  以同一 RangeError 退出。真实模型当次另产生了不支持的 shell 交互，故不使用那次会话的
  目标文件结果冒充“目标未变”证据；目标未变只采用上述直接 preview 断言及 §26 的历史证据。
- 2026-09-12 复核：官方 [issue #8036](https://github.com/earendil-works/pi/issues/8036)
  仍为 Open；描述同一大 diff TUI 崩溃。[PR #8395](https://github.com/earendil-works/pi/pull/8395)
  因仓库贡献策略自动关闭、未合并且无 review；其
  [commit `8c16a55`](https://github.com/earendil-works/pi/commit/8c16a55.patch) 仅把 spread
  push 改为逐行 push，并同时覆盖 spacer/image。当前官方 main 源码仍有
  该 spread，npm registry 的 `@earendil-works/pi-coding-agent` 最新发布仍为 0.85.1；因此
  没有可锁定的已发布候选。没有修改内置工具、模型参数、预览流程或 node_modules，也没有
  把“超限不支持”写成 AgentGlass 已阻止。
- 本次收口决定：该问题登记为“外部 Pi 宿主缺陷，延期到后续版本”；这只是缺陷处置决定，
  不改变 R-001 Done Definition，也不把未解决崩溃写成 PASS。

### 28.3 平台文件与恢复断言

- Windows：实际 `Get-Acl`/`icacls` 读取隔离目录、Unicode 文件和私有目录的 SDDL/owner/
  access count；Windows unit/security/e2e 通过产品 ACL、前像、恢复/冲突/清理路径。NTFS
  的 Unicode、大小写保留、hard link、reparse point 与 ACL 能力由 `fsutil` 直接核对。
- Linux：非 root 临时文件实测 realpath、Unicode 路径、初始 mode `0600`、hard-link `nlink=2`、
  symlink 识别、只读写入 `EACCES`、恢复字节 `after` 和最终 mode `0600`；本轮将恢复
  manifest 从 v2 版本化为 v3，持久化 post-image `changeTimeMs`，并用 inode 复用替换反例验证
  冲突阻止。
- 受控 integration/e2e 复用了真实 Pi 包入口、locked read/write/edit schema、BOM/CRLF、事件
  顺序/结果改写、加载/覆盖工具、sibling、生命周期、TUI Continue 与 RPC/print/json 无 UI
  阻止断言。
- Linux Node 24.14.0 的 native PTY 固定为 80×24，使用已有合法模型配置且不读取或输出认证
  内容；容器内准确启动命令为 `node_modules/.bin/pi -ne -ns -np --no-themes --no-context-files
  --no-session --approve -e /workspace/extensions/agentglass.ts --model deepseek/deepseek-flash`，
  `stty size` 返回 `24 80`。实际 Pi 0.85.1 TUI 完成 `/agentglass help`、示例 Stop/详情/Continue、内置 read、write
  拒绝与批准、edit diff 预览、matched、工具失败后的 mismatch、恢复成功、后续编辑冲突保留、
  cleanup 拒绝与批准；普通卡和必要危险信息在窄窗口可见，help 的非关键尾部由 Pi 标记 widget
  truncated。独立断言确认拒绝时目标不存在、成功/恢复/冲突时目标 SHA-256 与 mode 符合预期，
  私有目录 `0700`、snapshot 文件 `0600`，冲突恢复前后目标 hash 相同，清理拒绝保留 8 项、批准
  后为 0 项。终端驱动不是参与者，Human Validation 仍为 NOT_RUN。

### 28.4 R-001 Done Definition 当前状态

| 条目 | 状态 | 证据/阻碍 |
|---|---|---|
| 1. Pi/Node/npm 基线、锁定来源/schema、调度与无 UI 合约 | **PASS（基线子项）** | Windows 24.14/11.9 与 Linux 22.19/24.14 均实际跑完整 gate；真实包 contract/E2E、锁定工具与无 UI 路径通过 |
| 2. 超限 edit 普通/边界/超限拒绝与预览安全 | **PASS_WITH_DEFERRED_EXTERNAL_DEFECT（准入）** | 64 KiB、4 MiB 通过；8 MiB 与真实 TUI 仍在 AgentGlass 前 RangeError；缺陷已复现、目标未变、无 AgentGlass 安全拦截点，并保留为 R-004 发布阻断 |
| 3. 官方修复/候选升级与完整复测 | **DEFERRED** | 官方 PR 修复已核对但未发布；按明确决定不升级、不修改外部组件，后续版本重新验证 |
| 4. Windows + POSIX 路径、权限、恢复、冲突、清理 | **PASS（平台子项）** | Windows ACL 与 Debian mode/link/permission/restore/conflict/cleanup 断言通过；Node 22.19/24.14 全套 gate 均通过；POSIX 实际 TUI 再次证明 mode、恢复字节、冲突保留与独立清理批准 |
| 5. 候选环境真实 TUI 关键路径与 80×24 | **PASS（TUI 子项）** | Windows §26 已覆盖 matched/mismatch/unknown 与阻止路径；本轮 POSIX 80×24 实际 Pi TUI 覆盖 help/example/read/create/edit/拒绝/matched/mismatch/恢复/冲突/清理；终端驱动不冒充 Human Validation |
| 6. 矩阵、失败/修复、安全映射与版本决定 | **PASS_WITH_DEFERRED_EXTERNAL_DEFECT（准入）** | 材料与平台/TUI 子项已补齐；外部超限预览崩溃登记延期，不能选择可发布候选，R-004 仍必须阻断 |

结论：`R-001=PASS_WITH_DEFERRED_EXTERNAL_DEFECT`（仅作为 R-002 进入准线）；R-002 现在具备
进入条件，但不代表 Release PASS。超限预览缺陷按本次决定延期到后续版本，并继续阻断 R-004。
若未来重新收口，最小条件仍是采用并完整验证正式发布的 Pi TUI 修复（或其他保持 Pi 工具身份、
精确审批、失败关闭的官方方案），再按该候选版本重跑受影响的实际预览、真实 TUI 与各环境全套命令。

## 29. R-002 安装制品与分发准备实测（2026-09-12）

本节记录本次明确分配的 R-002，结论不是发布授权。开始前核对真实 cwd=`G:\\work\\AgentGlass`、
HEAD=`556c90e1ef36cb558d2f7496ecbec6208e568828`、R-001=`PASS_WITH_DEFERRED_EXTERNAL_DEFECT`。
起始工作树已有用户改动 `src/core/pre-image-snapshot.ts` 与
`tests/unit/pre-image-snapshot.test.ts`，本轮未回退或覆盖；被忽略的 README、docs、dist 和 tarball
均直接读取。环境为 Windows 11 10.0.26200 x64、NTFS、PowerShell 7.6.5、Node 24.14.0、npm 11.9.0、
Pi 0.85.1；POSIX 夹具为 Debian 12 对应的 `node:24.14.0-bookworm-slim` Docker 容器。未读取或输出
认证信息、真实模型秘密、raw tool input、transcript 或 snapshot 正文。

### 29.1 本轮最小改动与候选决定

| 文件 | 改动 |
|---|---|
| `package.json` / `package-lock.json` | 将两个 Pi peer 从 `*` 收紧为已验证的 `0.85.1`；版本仍为 `0.1.0-alpha.0`，许可证仍为 `UNLICENSED` |
| `README.md`（ignored） | 改为随包自足说明：本地 tarball 安装路径、Pi `/agentglass` 入口、支持边界、恢复/清理、禁用/卸载、数据位置、空白环境前置与宿主限制；不再链接 ignored docs |
| `tests/integration/pi-smoke.test.ts` | 将 package manifest 断言同步为 peer `0.85.1` |
| `tests/e2e/pi-dispatch.test.ts` | 仅测试侧增加真实已安装包根目录和持久隔离根注入，用于复用现有 Pi 调度回归与卸载后数据断言；不进入制品 |

只读名称核实发现 npm 上已有不相关的 `agentglass@0.1.0`（描述为另一个项目，许可证 MIT）；
`@agentglass/pi` 查询为 404。没有注册、占用、发布、commit、push、tag 或 release。当前包名不能
直接声称可发布；候选名和许可证选项待项目所有者明确决定。许可证选项及影响：保持 `UNLICENSED`
只能作为私有/隔离候选，不能作为公开 npm 分发声明；选择开源许可证后才可同步修改 package
元数据、随包说明和发布材料。由于未获授权，本轮没有改 `UNLICENSED`。

官方 Pi 0.85.1 本地文档核对结果：npm/git 包正式命令为 `pi install <source>`，启用/禁用由
`pi config` 资源界面控制，`pi remove`/`pi uninstall` 从宿主设置移除来源；本地目录不会自动复制。
对 `.tgz` 直接执行 `pi install <tarball>` 虽返回 0，但 Pi 将其当作单文件扩展，随后加载失败
`Unknown file extension ".tgz"`，因此不作为安装证据。实际候选路径是 npm 从 tarball 安装到隔离
目录，再执行 `pi install <隔离目录>/node_modules/agentglass`；发布后正式路径应为
`pi install npm:<已核准包名>@<版本>`，本轮没有该公开 npm 来源。

### 29.2 工程 gate 与制品材料

| 命令 | 退出码 | 实际结果 |
|---|---:|---|
| `npm ci` | 0 | Windows 工作树安装 217 packages；仅有既有 `node-domexception@1.0.0` 弃用警告 |
| `npm run typecheck` | 0 | `tsc --noEmit`；最终候选与测试侧 tarball 注入检查均通过 |
| `npm run lint` | 0 | Biome checked 44 files；无修复 |
| `npm run build` | 0 | `tsc -p tsconfig.build.json` |
| `npm run test:unit` | 0 | 8 files / 65 tests |
| `npm run test:corpus` | 0 | 4 files / 23 tests；本轮未改分类规则，无新增 corpus fixture |
| `npm run test:security` | 0 | 9 files / 65 tests；本轮未弱化安全不变量 |
| `npm run test:integration` | 0 | 2 files / 26 tests |
| `npm run test:e2e` | 0 | 1 file / 14 tests；工作树真实 Pi 0.85.1 agent loop |
| `npm pack --dry-run --json` | 0 | 44 entries；packed 114,517 bytes；unpacked 457,331 bytes；未含 tests/docs/research/node_modules/private snapshot data |
| `npm pack --pack-destination <隔离目录>` | 0 | 真实 `agentglass-0.1.0-alpha.0.tgz`；SHA-256 `9CA0A59F7C45A8268E6C1BCF5656A8C965024E76185D6B4CC802F6792E56189C` |

真实候选位于 `G:\\work\\AgentGlass\\agentglass-0.1.0-alpha.0.tgz`，该路径匹配既有 `*.tgz`
忽略规则，未 force-add。清单包含 README、`extensions/agentglass.ts`、完整 `src/` 和 `dist/`；
README 随包存在且为自足说明；包中没有测试、研究材料、认证秘密、私有恢复正文或本地
`node_modules`。解包字节 `457,331` 远低于 architecture/product 的 2 MiB 增量口径，但 R-003
性能/资源任务尚未开始，不能把本项大小记录当作 R-003 PASS。

### 29.3 Windows 真实制品闭环

隔离根为本机 Temp 下的唯一 `agentglass-r002-final-20260912142827028`；项目无秘密，Pi 用户目录、
npm 安装目录和项目目录均与工作树分离。准确安装命令为：

```text
npm init -y
npm install <真实 tarball> --omit=dev --no-save
pi install <隔离 npm 目录>/node_modules/agentglass
```

结果：npm 从 tarball 实际安装 169 packages，解析到 `@earendil-works/pi-coding-agent@0.85.1`
和 `@earendil-works/pi-tui@0.85.1`；`pi install`、`pi list` 均为 0；新 Pi 进程两次
`/agentglass help` 均加载并退出 0。`AGENTGLASS_E2E_PACKAGE_ROOT` 指向该已安装包目录时，
`npm run test:e2e` 为 1 file / 14 tests PASS；这不是源码 `pi -e` 或 dry-run 证据。另用持久隔离根
运行现有真实场景，目标项目保留 3 个固定无秘密文件，AgentGlass 私有 snapshots 为 5 个文件；
私有 snapshot 目录 ACL 实测为当前测试用户 FullControl、非继承。

实际启用/禁用/卸载/重装：

1. `pi config` 中按 Space 将 `agentglass.ts` 从 `[x]` 切为 `[ ]`，Esc 退出；settings 实际写入
   `extensions: ["-extensions\\agentglass.ts"]`。禁用后 `/agentglass help` 不再被入口处理，
   因隔离环境没有模型认证而退出 1；这证明禁用后不再保护后续调用，且没有把禁用作为被阻止
   任务的下一步。
2. 重新 `pi config` 按 Space 启用并退出；随后 `pi remove <source>` 退出 0，settings 实际为
   `{"packages":[]}`。卸载只移除宿主设置来源，没有删除项目文件或私有副本；卸载前的 snapshot
   计数为 5，卸载后仍为 5，项目文件仍为 3。未运行任何静默清理脚本。
3. 再次 `pi install <同一已安装目录>` 退出 0，settings 恢复一个 package 来源；新 Pi 进程的
   内存授权不从旧进程恢复。私有副本仍存在，需单独 `/agentglass cleanup` 批准；卸载本身不等于
   敏感数据清理，也不删除项目文件。

### 29.4 POSIX 制品边界与失败记录

在 Debian 12 对应的 `node:24.14.0-bookworm-slim` 容器内，从同一 SHA-256 tarball 实际执行
`npm install @earendil-works/pi-coding-agent@0.85.1 @earendil-works/pi-tui@0.85.1 --omit=dev`
（0，168 packages）、`npm install <tarball> --omit=dev --no-save`（0，增加 1 package）、
Pi `0.85.1`、`pi install <已安装目录>`（0）和 `pi list`（0）。这证明 POSIX 的 Node/npm、
Pi 宿主和真实制品安装入口可建立。

空白容器没有合法模型认证。非交互 `/agentglass help` 进入默认模型等待，未在安全等待上伪记
成功；首次完整测试复制目录在中断后复用残留 `node_modules` 时得到夹具 `ENOTEMPTY`，未记为
平台结果；新的 `posix-repo2` 开发依赖安装又因无输出等待而停止。直接用一次性 Node/Pi SDK
harness 驱动审批也未在有界时间内完成，已停止。故 POSIX 的 tarball 完整审批、独立核验、恢复、
安全示例和重启使用证据为 `NOT_RUN`，不是 PASS。R-001 已有同一 Pi 0.85.1 的 POSIX 真实 TUI
源码入口证据只能作为宿主背景，不能替代本轮 tarball 使用证据。补齐条件是受支持的 Pi-ready
POSIX 环境与可运行的合法模型/确定性测试 harness，再从同一 tarball 重跑这些路径。

### 29.5 安全与 Done Definition 状态

本轮未改变 risk/classification 规则，没有新的命中/相邻反例/故障分类需求；最终工程安全 gate
仍为 `test:security=65/65`、`test:corpus=23/23`。适用不变量继续保持 INV-003/004/005/008/009/
012/018/020：禁用不变成批准、卸载不静默清理、私有 snapshot 与普通 UI/报告分离、重装不恢复
内存授权、未知/无 UI 仍失败关闭；README 明确不作 sandbox、全局终止、秘密无害或万能恢复声明。
本轮未输出 snapshot 正文或 raw payload。Human Validation=`NOT_RUN`；远端 CI=`NOT_RUN`；未发布。

| R-002 Done Definition | 状态 | 证据 |
|---|---|---|
| 1. R-001 组合、Pi 官方渠道、真实 tarball 安装 | **PARTIAL / NOT_COMPLETE** | Windows 完整 PASS；POSIX tarball 安装 PASS，但 POSIX 完整使用链未运行 |
| 2. Pi-ready 与空白环境步骤、Windows/POSIX 加载/重启/入口/审批/核验/恢复 | **PARTIAL / NOT_COMPLETE** | Windows tarball e2e 14/14 PASS；POSIX 只有宿主/安装/list，空白模型环境缺失 |
| 3. 启用/禁用/卸载/重装、数据保留和授权生命周期 | **PASS（Windows）；NOT_RUN（POSIX）** | Windows `pi config`、`pi remove`、重装及 5 个 snapshot/3 个项目文件断言；无静默清理 |
| 4. 包名、渠道、许可证、版本/peer | **BLOCKED** | peer 已精确到 0.85.1；`agentglass` 名称冲突，许可证仍待明确授权，版本保持 alpha |
| 5. 真实入口、src/dist、随包说明、无 tests/秘密/node_modules | **PASS** | dry-run/实际 pack 44 entries、README 自足、压缩/解包清单与 MANIFEST 检查 |
| 6. hash、清单/大小、命令、真实安装回归 | **PASS（已完成部分）；整体 NOT_COMPLETE** | hash 与 Windows 安装/卸载/重装证据齐全；POSIX完整使用和发布决定未齐 |

结论：`R-002=PARTIAL_BLOCKED`，不是 PASS，也不是已发布 v1。当前候选 tarball 可供审阅，
但不能进入 R-003；必须先取得合法包名/许可证决定，并在受支持 Pi-ready POSIX 环境从同一 tarball
补齐加载、重启、唯一入口、安全示例、普通审批、核验和恢复链路。R-001 的 Pi 超限 edit 外部
预览缺陷仍继续阻断 R-004。下一合格任务：无；补齐上述 R-002 阻碍后才可重新审查并进入 R-003。

## 30. R-002 决定修订与 Windows-only 候选重测（2026-09-12）

项目所有者明确选择：GitHub 用户名 `DDT` 对应 npm 小写 scope `@ddt`，候选包名
`@ddt/agentglass`；版本 `0.8.0`；许可证 MIT；当前版本只支持 Windows，不承诺 POSIX。
npm 对 scope 强制小写，`@DDT/agentglass` 的只读查询返回名称含大写错误；`@ddt/agentglass`
只读查询返回 404，未注册、占用或发布。

本轮更新了 `package.json`、`package-lock.json`、随包 `README.md` 与 `LICENSE`，并将 Pi
集成断言切换为 scoped 名称。`npm install --package-lock-only --ignore-scripts`、
`npm run typecheck`、`npm run test:integration`（2 files / 26 tests）均退出 0。
`npm pack --dry-run --json` 与实际 `npm pack` 均退出 0：`ddt-agentglass-0.8.0.tgz`，45 files，
115,190 bytes packed，458,285 bytes unpacked；SHA-256
`763EE5A97BF9E6D24794863532538CA48FC7D4F0BFF877277FB9A64751ED2C4D`。

从该新 tarball 在 Windows 隔离 npm 目录安装并执行 `pi install`、`pi list`；新制品定向
`npm run test:e2e` 为 1 file / 14 tests，全部退出 0。一次错误的持久根注入造成 13 个
`EEXIST` 测试隔离失败，未改产品逻辑；移除该注入后以测试自建临时目录重跑通过。原有
Windows `pi config` 禁用/启用、`pi remove`、重装、snapshot 与项目文件保留证据继续适用，
新制品另有安装与完整 E2E 证据。POSIX 不再属于本版本支持范围，故不以 POSIX NOT_RUN
阻断 Windows-only R-002；远端 CI、Human Validation 与发布仍为 NOT_RUN/未授权。

修订后的结论：`R-002=PASS（Windows-only，候选未发布）`。R-001 记录的 Pi 超限 edit
外部宿主缺陷仍是 R-004 发布阻断；R-003 仍未执行。

## 31. Pi 最低版本验证（2026-09-13）

在 Windows x64、Node 24.14.0/npm 11.9.0、真实 `ddt-agentglass-0.8.0.tgz` 和隔离
Pi 用户目录中验证 npm 上实际存在的 `0.84.3` 以上版本：

| Pi coding-agent / pi-tui | CLI 版本与隔离 `pi install/list` | 真实 tarball E2E | 结论 |
|---|---:|---:|---|
| 0.84.3 / 0.84.3 | 退出 0 | 1 file / 14 tests，退出 0 | PASS |
| 0.84.4 / 0.84.4 | 退出 0 | 1 file / 14 tests，退出 0 | PASS |
| 0.85.0 / 0.85.0 | 退出 0 | 1 file / 14 tests，退出 0 | PASS（见前置） |
| 0.85.1 / 0.85.1 | 既有 R-002 证据 | 1 file / 14 tests，退出 0 | PASS |

`0.85.0` 的 `@earendil-works/pi-coding-agent@0.85.0` 包自身未声明其
`experimental/server.js` 需要的 `@earendil-works/pi-server`；在干净 SDK E2E 收集阶段
会以 `Cannot find package '@earendil-works/pi-server'` 失败、执行 0 tests。补齐匹配的
`@earendil-works/pi-server@0.85.0` 后，三个 Pi 包版本均锁定为 0.85.0，E2E 与 CLI
安装/列表通过。该缺陷属于 Pi 上游前置，README 已明确，不把它写成 AgentGlass 运行时依赖。

将 `package.json` / `package-lock.json` 的两个 Pi peer 从精确 `0.85.1` 收紧为已验证
范围 `>=0.84.3 <=0.85.1`；集成 manifest 断言同步。新范围下，在已安装 Pi/TUI 0.84.3
的隔离项目中不使用 `legacy-peer-deps` 安装新 tarball 退出 0。更新后重新执行
`npm ci --ignore-scripts`、`npm run typecheck`、`npm run lint`、`npm run build`、
`npm run test:integration`（2 files / 26 tests）均退出 0。

最终清理无关 npm 元数据后候选制品：46 files，117,503 bytes packed，463,713 bytes unpacked；SHA-256
`447C5BDA23078AC8666A5D7AE6ABFD69BD673D11209A111CCC9C7DA618F7427B`。清理后的制品
在 Pi 0.84.3 上已有更新前后两次 E2E 证据，更新后为 14/14 PASS。0.85.0 的上游缺失依赖仍是空白环境补齐步骤，
不能据此宣传一键安装；未验证的未来 Pi 版本不在支持承诺内。

## 32. R-003 性能与资源预算测量（2026-09-13）

R-002 依赖核对：沿用 §30～31 的结论 `R-002=PASS（Windows-only，候选未发布）`，
Pi `0.84.3`～`0.85.1` 支持矩阵已验证；本轮主测 `0.85.1`。以下首段先记录优化前
基线，后续阶段性实验与最终候选分别见 §32.2～§32.5。测量从实际候选 tarball
安装，不用源码目录代替制品：`@ddt/agentglass@0.8.0`，基线 tarball SHA-256
`6110CA146D826CD44DBB07C1FEC098BFDAE6BC1FF9D7C4E2F0F460A76706C764`，packed
`117,349` bytes，unpacked `463,395` bytes，`46` entries。该 hash 是本轮当前 on-disk
tarball；§31 的 `447C...` 是较早生成的同文件集制品，不在本轮重复使用或抵扣大小。

环境与边界：Windows 11 build `10.0.26200`、x64、NTFS（G:）、32 CPU、Node
`v24.14.0`、npm `11.9.0`、Pi `0.85.1`、终端观测 `80×24`。机器为空闲本地负载，
模型未调用；Pi CLI 对照使用 `--offline`、空 stdin 换行、隔离 project/agent 目录。
每个 CLI 样本为新进程（冷启动）；纯预检在同一进程每组先预热 100 次，再固定采样
1,000 次，3 组共 3,000；因此纯预检是热路径。未把 Node SDK 的 reload-only 探索数据
当作产品加载结论，正式加载证据来自真实 `pi.cmd`。

准确测量命令与制品安装：

```text
node --expose-gc tests/performance/r003-performance.mjs --package-root C:\Users\17860\AppData\Local\Temp\agentglass-r003-rollback-final-2026091312\node_modules\@ddt\agentglass --tarball .\ddt-agentglass-0.8.0.tgz --runs 3
node tests/performance/r003-performance.mjs --package-root C:\Users\17860\AppData\Local\Temp\agentglass-r003-rollback-final-2026091312\node_modules\@ddt\agentglass --runs 10 --load-only
node tests/performance/r003-performance.mjs --package-root C:\Users\17860\AppData\Local\Temp\agentglass-r003-rollback-final-2026091312\node_modules\@ddt\agentglass --runs 10 --load-only
npm pack --dry-run --json
npm pack --json
npm init -y
npm install G:\work\AgentGlass\ddt-agentglass-0.8.0.tgz --omit=dev --no-save
$env:AGENTGLASS_E2E_PACKAGE_ROOT='C:\Users\17860\AppData\Local\Temp\agentglass-r003-rollback-final-2026091312\node_modules\@ddt\agentglass'; npm run test:e2e
```

最终完整测量退出 `0`；10 组加载对照也退出 `0`。fresh 候选安装实际增加 `169`
packages，解析 Pi coding-agent/pi-tui `0.85.1`；fresh 候选 `npm run test:e2e`
为 `1 file / 14 tests PASS`。测量入口为 `tests/performance/r003-performance.mjs`，
只用 Node 标准库、Pi 已有 SDK/CLI 和既有实现，不写产品埋点、日志、数据库或服务；
输出只有脱敏摘要、计时、状态码和大小，不含 raw tool input、秘密、用户文件正文或
snapshot 正文。

正式完整测量结果：

| 对象 | 分母 | P50 | P95 | max/说明 |
|---|---:|---:|---:|---|
| 纯预检（canonicalization/fingerprint、redacted projection、风险聚合、effect prediction） | 3×1,000（另每组预热100） | 0.328 ms | 0.438 ms | 0.827 ms；输入 65,315 / 65,536 bytes |
| Pi CLI 裸机→加载扩展增量（10 组独立冷启动，对照分布） | 10 对 | 215.461 ms | 226.308 ms | 226.308 ms；均为退出0；回滚后 fresh 候选复测 |
| Pi CLI 裸机→加载扩展增量（完整命令同 hash fresh 候选，3 对） | 3 对 | 203.173 ms | 206.647 ms | 206.647 ms；均为退出0 |
| 完整变更→核验→恢复→清理 | 3 | 3,940.345 ms | 4,387.543 ms | 4,387.543 ms |

加载目标按严格的尾部分布仍未通过：回滚后 fresh 候选的 10 对 P95 为 `226.308 ms`，完整
fresh 3 对的 P50/P95 为 `203.173/206.647 ms`。这不是把 CLI 启动总耗时误算成增量，而是每次分别计时裸 Pi 与
同参数加载候选后相减；尾部和分母均保留。此前将 manifest 直接指向已编译
`dist/extensions/agentglass.js` 的 10 对实验也失败，P50/P95 为 `953.245/1,004.183 ms`；
本轮单文件 bundle 实验的结果见 §32.3。所有实验均未改阈值或安全检查。

路径和阶段成本（完整结果的独立阶段样本）：

| 阶段 | 分母 | P50 / P95 |
|---|---:|---:|
| classification + realpath/lstat 预检 | 30 | 0.951 / 1.230 ms |
| realpath + stable file read | 30 | 0.297 / 0.399 ms |
| read classification + realpath | 30 | 0.400 / 0.561 ms |
| Pi edit 预期推导（内存 operations，不执行用户写入） | 30 | 0.246 / 0.432 ms |
| 独立文件核验 | 30 | 0.297 / 0.456 ms |
| pre-image 1 KiB / 64 KiB / 1 MiB / 10 MiB | 15 / 15 / 15 / 3 | 1,141.801 / 1,709.718；1,135.319 / 1,158.806；1,151.439 / 1,202.838；1,207.116 / 1,226.718 ms |
| Windows ACL 等价短时 PowerShell 子进程 | 15 | 210.969 / 472.961 ms |
| full.preImage / fileWrite / verification | 3 each | 1,109.626 / 1,164.249；0.347 / 0.436；1.217 / 1.457 ms |
| full.recoveryFinalize / currentCheck / restore | 3 each | 694.887 / 710.904；203.344 / 215.410；1,174.933 / 1,601.042 ms |
| full.cleanupInspection / cleanup | 3 each | 253.981 / 269.218；480.782 / 499.929 ms |

完整链路包含真实路径预检、前像、文件写入、独立核验、ready 证据、恢复前检查、
恢复、清理检查和清理；用户等待与 Pi 模型耗时没有隐藏，均未调用，另列为不适用。
ACL 是现有按需 `powershell.exe -NoProfile -NonInteractive` 的短时子进程，测量列单列，
没有据此声称零子进程或常驻服务。

配额/失败场景均在受控 Temp 根目录执行，旧数据没有为测量自动删除：

| 场景 | 实际结果 |
|---|---|
| 单文件 10 MiB | 精确边界 `saved`；`10 MiB+1` 为 `SNAPSHOT_FILE_TOO_LARGE`，旧数据保留 |
| 总逻辑字节 100 MiB（含临时发布） | 边界和 `+1` 新变更均 `SNAPSHOT_RESOURCE_LIMIT`，预置旧数据保留 |
| 4,096 entries | 预置 4,095 后首个保存；下一变更 `SNAPSHOT_RESOURCE_LIMIT`，旧数据保留 |
| 锁竞争 | `SNAPSHOT_STORAGE_BUSY`，新变更不可用，旧数据保留 |
| future/遗留 manifest | `inspect` 不采纳未知版本，清理 `changed=false`，旧数据保留 |
| 故障注入 `permission_error` / `disk_full` / `interrupted_publish` | 分别得到 `SNAPSHOT_PERMISSION_DENIED` / `SNAPSHOT_RESOURCE_LIMIT` / `SNAPSHOT_PUBLISH_FAILED`；均不误报成功、不删旧数据 |

长会话实际运行 256 次合成普通 read 事件，覆盖 `agent_end`、reload、new session、
`session_shutdown` 和 dispose。RSS 从 `131,518,464` bytes（start）到
`124,485,632` bytes（256 次）及 `124,215,296` bytes（dispose）；heapUsed 从
`37,845,760` 到 `38,268,144` 再到 `37,982,128` bytes。active resource count
保持 `3`；结束时只看到 `FSReqCallback` 和终端 `PipeWrap`，进程检查无 `pi` 或候选
AgentGlass Node 进程。Pi session message history 是单独贡献者，未将其误称为零增长。

源码与隔离运行审查：AgentGlass 产品源码只有 `pre-image-snapshot.ts` 使用
`execFile` 进行按需 Windows ACL；未发现 AgentGlass `fetch`/HTTP client、listener、
server、`setInterval` 或后台服务。机器 `netstat` 仍有其他系统 listener 行，不能把
它们归因给 AgentGlass；观察结束时没有 AgentGlass 进程。Pi 模型联网是本轮 `--offline`
下未调用的宿主能力，ACL 子进程单列。没有新增必填配置、认证 key、主动联网、监听端口
或常驻服务。

自动化证据：最终候选上 `npm run typecheck`、`npm run lint`（45 files）、`npm run build`、
`npm run test:unit`（8 files / 65 tests）、`npm run test:corpus`（4 / 23）、
`npm run test:security`（9 / 65）、`npm run test:integration`（2 / 26）和 fresh
tarball `npm run test:e2e`（1 / 14）均退出 `0`；最终 `npm pack --dry-run --json`
退出 `0`。远端 CI、真实人工终端操作和 Human Validation 没有在本轮运行，保持
`NOT_RUN`；无任何发布、推送或外部消息。

### 32.1 R-003 Done Definition 状态（优化前基线）

| 条目 | 状态 | 证据/限制 |
|---|---|---|
| 1. 最小入口、R-002 候选、100 warmup/1,000 samples、环境与命令 | **PASS** | Node 标准库入口；3×1,000 纯预检；真实 tarball fresh install；输入、版本、NTFS、空闲负载和冷启动命令已记录 |
| 2. 裸 Pi/加载扩展、增量 ≤200 ms、纯预检 P95 ≤50 ms | **历史 FAIL（已由 §32.5 复测通过）** | §32.1 优化前基线为 10 对冷启动 P95 `226.308 ms`、纯预检 P95 `0.438 ms`；最终候选数据见 §32.5，门槛保持不变 |
| 3. 分列 I/O、前像、ACL、edit 推导、核验、恢复、清理及完整延迟 | **PASS** | 优化前阶段分布与 full `3,940.345/4,387.543 ms` 已记录；模型/用户等待未调用并明确排除 |
| 4. 制品增量 ≤2 MiB（按 unpacked 判定） | **PASS** | 优化前基线 `463,395 bytes < 2 MiB`；另列 `117,349` packed；最终候选数据见 §32.5 |
| 5. 10 MiB/100 MiB/4,096、遗留、锁、失败与长会话释放 | **PASS** | 10 个配额/失败场景均保留旧数据；256 read cycles、lifecycle events、内存和 active resources 已观察 |
| 6. 无主动网络/监听/服务/新增必填配置，Pi/ACL 单列 | **PASS（边界声明）** | 源码 rg、隔离 Pi CLI、进程/网络观察；系统其他 listener 不归因 AgentGlass；Pi 模型网络未调用，ACL 短进程存在 |

结论：以上是优化前的历史基线；最终状态见 §32.5。

### 32.2 R-003 后续最小修复/预算复审（2026-09-13）

针对加载尾部只做了一个可回滚的最小候选实验：将 manifest 入口从
`extensions/agentglass.ts` 暂时改为已有的 `dist/extensions/agentglass.js`，不改运行逻辑。
在 fresh 隔离安装上 10 对 Pi CLI 对照的加载增量为 P50/P95
`953.245/1,004.183 ms`，明显劣于原入口；manifest 已恢复，最终候选仍为 R-002 的
原始入口，重新打包 hash 为 `6110CA146D826CD44DBB07C1FEC098BFDAE6BC1FF9D7C4E2F0F460A76706C764`，
fresh 安装 E2E `14/14 PASS`。

预算复审决定：保留 product-spec §7 与 architecture §10 的 ≤200 ms 加载增量门，
不以较小分母的较好结果抵扣最新 10 对 P95 `226.308 ms`，不引入懒加载、常驻预加载、
额外运行时依赖或改变安全注册时序。现有 Pi loader 的 jiti 加载、Adapter/Core 模块图和
真实首动作注册共同构成成本；把注册延后会改变保护时序，不能作为无风险性能优化。R-003
本轮正式预算复审已完成并决定不改规范；后续只剩保持注册时序和安全边界的专门加载优化，
或另行提出新的正式预算变更评审；该阶段的 R-003 仍为 `NOT_COMPLETE`，不进入 R-004。

### 32.3 R-003 单文件 bundle 专项加载优化：失败并撤回（2026-09-13）

按本任务方案新增并实测构建时单文件 bundle：使用 `rolldown@1.2.7` 将
`dist/extensions/agentglass.js` 合并为 `dist/extensions/agentglass.bundle.js`，并将
Pi、Pi TUI 与 `node:*` 保持 external。bundle 构建成功，文件为 `135,050` bytes；候选
tarball 为 packed `149,547` / unpacked `598,525` bytes、`47` entries，SHA-256
`CBE1C5FE633A2732EAE3699DB83A60086BA96717DDF39E04A190895013E0DDFB`。fresh 隔离安装
实际解析 `169` packages，Pi/Pi TUI 为 `0.85.1`，fresh E2E `14/14 PASS`。

但真实 Pi CLI 10 对独立冷启动的 bundle 加载增量为 P50/P95
`1,113.134/1,177.133 ms`，所有进程退出码为 `0`，仍远超 `≤200 ms`。该结果证明
构建成功和功能通过不能替代加载预算；依计划立即撤回 bundle build、manifest、直接
`rolldown` devDependency 与测试入口变更。撤回后重新 `npm ci`、全量工程/安全 gate、
`npm pack`、fresh 安装与 E2E 均通过，最终候选恢复原始 tarball hash
`6110CA146D826CD44DBB07C1FEC098BFDAE6BC1FF9D7C4E2F0F460A76706C764`，packed
`117,349` / unpacked `463,395` bytes；撤回候选 10 对 P50/P95
`215.461/226.308 ms`，3 对完整命令 P50/P95 `203.173/206.647 ms`。

正式决定：bundle 方案不保留；不调高预算、不跳过安全检查。以上是 §32.5 最终修复前的
历史状态，最终候选和 R-003 结论见 §32.5。

### 32.4 R-003 首轮窄范围加载优化复测（阶段性候选，2026-09-13）

本节是首轮候选的有效历史证据，已由 §32.5 的进一步按需分类加载候选取代；不作为当前
制品的 hash、包体或最终 P95 依据。

在不改变 manifest 入口、Pi 监听注册顺序或安全判断的前提下，Adapter 移除快照持久化
实现的静态导入，改为首次需要 write/edit、恢复、清理或恢复状态核对时使用原生 ESM
`import()`；普通 read 预检保留本地固定未知证据。新增测量入口仅把裸 Pi/扩展 Pi 的
首个进程顺序交替，未加入产品埋点、依赖、后台服务或预加载。

阶段性 fresh 候选：`@ddt/agentglass@0.8.0`，Windows 11 x64、NTFS、Node `v24.14.0`、
npm `11.9.0`、Pi `0.85.1`；tarball SHA-256
`FC4F5C43038AA669A39B096831E9A3BED4B06F7D707B38BB5D98EEC9C5B77C8A`，packed `118,371`
bytes，unpacked `466,655` bytes，`46` entries；fresh install 增加 `169` packages，fresh
E2E `14/14 PASS`。

阶段性候选两轮各 `20` 对独立冷进程、交替顺序、`--offline` 空 stdin：

| 轮次 | 加载增量 P50 | 加载增量 P95 | max | 退出码 |
|---|---:|---:|---:|---|
| 1 | `144.719 ms` | `162.065 ms` | `186.940 ms` | 全部 0 |
| 2 | `139.496 ms` | `173.538 ms` | `211.934 ms` | 全部 0 |

完整测量（`--expose-gc --runs 3`）同一阶段性候选：纯预检 `3,000` 样本 P50/P95
`0.605/1.163 ms`；加载对照 3 对 P50/P95 `120.883/129.593 ms`；完整变更→核验→恢复→
清理 P50/P95 `3,753.305/4,193.676 ms`。阶段成本继续分列：classification+path
`1.893/3.655 ms`、稳定读取 `0.527/1.785 ms`、edit 推导 `0.536/1.444 ms`、核验
`0.727/4.125 ms`、1 MiB 前像 `1,041.668/1,132.083 ms`、ACL 子进程
`197.933/516.529 ms`、恢复 `1,159.531/1,602.942 ms`、清理 `450.936/462.205 ms`（均
为 P50/P95）。

10 MiB/100 MiB/4,096 条目、遗留/未来版本、锁竞争和三类故障注入均保持新变更阻止与
旧数据保留；长会话 256 cycles 覆盖 agent_end、reload、session 切换、shutdown、dispose，
active resources 保持 `3`。测量未输出 raw input、用户文件或 snapshot 正文；未发现
AgentGlass 主动网络、监听或常驻服务，Pi 模型联网和 ACL 短时子进程单列。

阶段性候选实际命令（两条 `--load-only` 命令分别对应上表两轮）：

```text
node tests/performance/r003-performance.mjs --package-root C:\Users\17860\AppData\Local\Temp\agentglass-r003-final-20260913124652\node_modules\@ddt\agentglass --runs 20 --load-only
node tests/performance/r003-performance.mjs --package-root C:\Users\17860\AppData\Local\Temp\agentglass-r003-final-20260913124652\node_modules\@ddt\agentglass --runs 20 --load-only
node --expose-gc tests/performance/r003-performance.mjs --package-root C:\Users\17860\AppData\Local\Temp\agentglass-r003-final-20260913124652\node_modules\@ddt\agentglass --tarball C:\Users\17860\AppData\Local\Temp\agentglass-r003-final-20260913124652\ddt-agentglass-0.8.0.tgz --runs 3
npm pack --dry-run --json
$env:AGENTGLASS_E2E_PACKAGE_ROOT='C:\Users\17860\AppData\Local\Temp\agentglass-r003-final-20260913124652\node_modules\@ddt\agentglass'; npm run test:e2e
```

代码与工程门：`npm run typecheck`、`npm run lint`（45 files）、`npm run build`、
`npm run test:unit`（8/65）、`npm run test:corpus`（4/23）、`npm run test:security`
（9/65）、`npm run test:integration`（2/26）和本地/最终 fresh 制品 `test:e2e`（1/14）
均退出 `0`；远端 CI、真实人工终端和 Human Validation 保持 `NOT_RUN`。

第一版新增 evidence 模块的候选在同口径下达到 P50/P95 `270.725/416.303 ms`，已撤回；
本节阶段性候选的 `R-003` 结论由 §32.5 覆盖，没有修改 product-spec §7 或 architecture §10
的阈值。R-004 仍需单独分配，R-001 外部 Pi 预览缺陷仍是发布阻断。远端 CI、真实人工
终端和 Human Validation 保持 `NOT_RUN`。

### 32.5 R-003 最终按需分类加载复测（2026-09-13）

在 §32.4 的快照按需加载基础上，Adapter 移除 `execution-input` 的静态导入：Pi 监听器和
事件注册仍同步完成，首次 `tool_call` 预检时才通过原生 ESM `import()` 加载分类路径依赖；
普通 read 的目标与未知前像证据仍由本地固定值生成。快照持久化、ACL、恢复和清理继续只在
对应动作/状态核对时按需加载。加载失败统一失败关闭，不跳过身份、路径、风险或审批检查；
未引入运行时依赖、埋点、后台服务或预加载。另一次尝试将 Pi TUI/edit 模块也延后加载，
首轮 P95 `223.547 ms`，未证明收益后撤回，最终候选只保留上述分类与快照优化。

最终 fresh 候选：`@ddt/agentglass@0.8.0`，Windows 11 build `10.0.26200` x64、NTFS、
Node `v24.14.0`、npm `11.9.0`、Pi `0.85.1`；tarball 位于隔离目录
`C:\Users\17860\AppData\Local\Temp\agentglass-r003-final5-20260913130747\package\ddt-agentglass-0.8.0.tgz`，
SHA-256 `28D07ADE6514510F08DE368B93AB945E333C514E6CD9AA5B5118000C7B22C809`，packed
`119,303` bytes，unpacked `470,383` bytes，`46` entries；fresh 安装解析 `169` packages，
fresh tarball E2E `14/14 PASS`。

最终候选两轮各 `20` 对独立冷进程、交替顺序、`--offline` 空 stdin，全部退出码为 `0`：

| 轮次 | 加载增量 P50 | 加载增量 P95 | max |
|---|---:|---:|---:|
| 1 | `109.732 ms` | `172.915 ms` | `624.906 ms` |
| 2 | `108.479 ms` | `132.410 ms` | `151.472 ms` |

首轮 max 是单个独立冷启动离群值，仍保留在分布中；P95 未以删除样本或缩小分母取得。
完整测量（`--expose-gc --runs 3`）同一候选：纯预检 `3,000` 样本 P50/P95
`0.604/0.929 ms`（输入 `65,315/65,536` bytes）；加载对照 3 对 P50/P95
`96.300/120.329 ms`；完整变更→核验→恢复→清理 P50/P95 `4,628.273/4,748.863 ms`。
为披露首次动作的延迟转移，另以候选 dist 模块在 20 个 fresh Node 进程中只计时原生
`import()`：`execution-input.js` P50/P95 `10.180/10.988 ms`，
`pre-image-snapshot.js` P50/P95 `9.923/10.784 ms`；这些是模块解析代理值，不冒充完整
Pi tool_call 时延，也未从上面的 I/O 阶段数据中扣除。

阶段成本（均为 P50/P95）：classification+path `1.704/3.874 ms`、稳定读取
`0.646/1.789 ms`、read classification `0.785/1.424 ms`、edit 推导 `0.440/0.977 ms`、
核验 `0.501/2.077 ms`、前像 1 KiB/64 KiB/1 MiB/10 MiB 分别
`1,145.395/1,811.166`、`1,130.103/1,182.140`、`1,218.218/1,553.225`、
`1,302.247/1,302.280 ms`，ACL 短时 PowerShell `216.380/503.464 ms`；完整链路的
pre-image/fileWrite/verification 为 `1,185.951/1,234.739`、`0.638/1.062`、
`1.957/2.008 ms`，recoveryFinalize/currentCheck/restore 为
`748.971/754.285`、`239.762/271.552`、`1,618.540/1,743.386 ms`，
cleanupInspection/cleanup 为 `265.262/307.449`、`512.782/559.632 ms`。

10 MiB/100 MiB/4,096 条目边界与超限、遗留/未来版本、锁竞争及
`permission_error`/`disk_full`/`interrupted_publish` 均保持新变更阻止和旧数据保留；256
cycles 覆盖 agent_end、reload、session 切换、shutdown、dispose，active resources 保持 `3`。
测量未输出 raw input、用户文件或 snapshot 正文；源码和隔离观察未发现 AgentGlass 主动网络、
监听端口或常驻服务，Pi 模型联网和 ACL 子进程单列。

最终候选实际命令：

```text
node tests/performance/r003-performance.mjs --package-root C:\Users\17860\AppData\Local\Temp\agentglass-r003-final5-20260913130747\node_modules\@ddt\agentglass --runs 20 --load-only
node tests/performance/r003-performance.mjs --package-root C:\Users\17860\AppData\Local\Temp\agentglass-r003-final5-20260913130747\node_modules\@ddt\agentglass --runs 20 --load-only
node --expose-gc tests/performance/r003-performance.mjs --package-root C:\Users\17860\AppData\Local\Temp\agentglass-r003-final5-20260913130747\node_modules\@ddt\agentglass --tarball C:\Users\17860\AppData\Local\Temp\agentglass-r003-final5-20260913130747\package\ddt-agentglass-0.8.0.tgz --runs 3
npm pack --dry-run --json
$env:AGENTGLASS_E2E_PACKAGE_ROOT='C:\Users\17860\AppData\Local\Temp\agentglass-r003-final5-20260913130747\node_modules\@ddt\agentglass'; npm run test:e2e
```

最终候选上的 `npm run typecheck`、`npm run lint`（45 files）、`npm run build`、
`npm run test:unit`（8/65）、`npm run test:corpus`（4/23）、`npm run test:security`（9/65）、
`npm run test:integration`（2/26）、fresh tarball `npm run test:e2e`（1/14）和
`npm pack --dry-run --json` 均退出 `0`；`node --check tests/performance/r003-performance.mjs`
也通过。远端 CI、真实人工终端和 Human Validation 保持 `NOT_RUN`，没有发布、推送或外部消息。

结论：`R-003=PASS`。本节候选满足加载增量、纯预检、完整成本披露、包体、配额、失败关闭和
生命周期预算；R-004 仍需单独分配，R-001 外部 Pi 预览缺陷仍是发布阻断。

## 33. R-004 最终候选验收（2026-09-13）

### 33.1 入口依赖、候选固定与工作树

本节是明确分配的 R-004 实际记录。开始前核对的依赖不是三个无条件 PASS：

| 依赖 | 核对结果 | 影响 |
|---|---|---|
| R-001 | `PASS_WITH_DEFERRED_EXTERNAL_DEFECT`，不是无条件 PASS | Pi 0.85.1 超限 `edit` 预览崩溃仍为 R-004 发布阻断 |
| R-002 | `PASS`，Windows-only 候选安装/启用/禁用/卸载/重装证据 | 可作为制品与安装依赖，但不扩大平台承诺 |
| R-003 | `PASS`，最终按需加载、包体、I/O、配额和生命周期预算证据 | 可作为性能与资源依赖 |

依赖前置的严格状态为 **FAIL**；按用户要求继续完成不依赖该缺陷修复的证据收集，
不把延期准入写成 Release PASS。最终候选固定如下：

| 项目 | 实际值 |
|---|---|
| cwd / HEAD | `G:\work\AgentGlass` / `533131e218c7b620bdaddd856b25fa179242ebb6` |
| 本地差异 | 保留用户已有 `src/adapter/pi/adapter.ts`、`src/core/execution-input.ts`、`src/core/pre-image-snapshot.ts` 修改及未跟踪 `tests/performance/r003-performance.mjs`；本项未修改运行时代码 |
| package / lockfile | `@ddt/agentglass@0.8.0`、MIT；package.json 与 package-lock.json 无本轮差异 |
| Pi / Node / npm | Pi coding-agent/pi-tui `0.85.1`；Node `24.14.0`；npm `11.9.0` |
| 平台 / 文件系统 / 终端 | Windows x64、NTFS、PowerShell、实际 Windows PTY；终端关键路径使用 `80×24` 视口 |
| peer 支持声明 | `@earendil-works/pi-coding-agent` 与 `@earendil-works/pi-tui`：`>=0.84.3 <=0.85.1` |
| 最终制品 | `C:\Users\17860\AppData\Local\Temp\agentglass-r004-final-20260913\ddt-agentglass-0.8.0.tgz` |
| 制品 hash / 大小 | SHA-256 `28D07ADE6514510F08DE368B93AB945E333C514E6CD9AA5B5118000C7B22C809`；压缩 `119,303` bytes；解包 `470,383` bytes；`46` entries |
| 制品边界 | 仅包含 LICENSE、README、`dist/`、`src/`、extension 入口与 package 元数据；不含 tests、docs、node_modules、`.preimage`、`.snapshot` |

本轮没有 `git reset`、清理、覆盖用户修改，没有修改 `.gitignore`，没有 commit、push、tag、
上传或发布。已直接读取被忽略的 `AGENTS.md` 与 `docs/` 规范，不能以 Git clean 代替规范核对。
已有忽略 tarball 的 hash `6110CA146D826CD44DB07C1FEC098BFDAE6BC1FF9D7C4E2F0F460A76706C764`
未被复用；本节所有制品安装和 E2E 指向上表的新候选。

### 33.2 工程、制品与实际终端命令

下表均为本次真实执行结果，退出码以 PowerShell/进程实际返回为准：

| 命令 | 环境与实际结果 | 退出码 |
|---|---|---:|
| `npm ci` | Windows 工作树；新增 217 packages；仅有已有 `node-domexception@1.0.0` deprecation warning | 0 |
| `npm run typecheck` | `tsc --noEmit` | 0 |
| `npm run lint` | Biome 检查 45 files，No fixes applied | 0 |
| `npm run build` | `tsc -p tsconfig.build.json` | 0 |
| `npm run test:unit` | 8 files / 65 tests | 0 |
| `npm run test:corpus` | 4 files / 23 tests | 0 |
| `npm run test:security` | 9 files / 65 tests | 0 |
| `npm run test:integration` | 2 files / 26 tests | 0 |
| `npm run test:e2e` | 1 file / 14 tests | 0 |
| `npm pack --dry-run --json` | `0.8.0`，119,303 compressed / 470,383 unpacked / 46 entries；dry-run shasum `ab1de7a4b4e0973fe0d5960a1825783009227517` | 0 |
| `npm pack --json --pack-destination C:\Users\17860\AppData\Local\Temp\agentglass-r004-final-20260913` | 生成上表最终 tarball，hash 与固定候选一致 | 0 |
| `npm init -y`；`npm install C:\Users\17860\AppData\Local\Temp\agentglass-r004-final-20260913\ddt-agentglass-0.8.0.tgz --omit=dev --no-save` | 隔离安装目录新增 169 packages；安装的确为上表 tarball | 0 |
| `$env:AGENTGLASS_E2E_PACKAGE_ROOT='C:\Users\17860\AppData\Local\Temp\agentglass-r004-install-20260913\node_modules\@ddt\agentglass'; npm run test:e2e` | 从实际安装制品运行，1 file / 14 tests | 0 |
| `node --check tests/performance/r003-performance.mjs` | 当前未跟踪性能入口语法检查 | 0 |

工作树最后复核：`git diff --check` 通过；package/lockfile 未变；本项未改变上述用户源文件或
性能脚本。总 Vitest 计数为 24 files / 193 tests。没有在远端触发或观察 CI run，Windows workflow
配置存在不等于远端 PASS，因此远端 CI=`NOT_RUN`；Debian/macOS 本轮也没有对最终候选重新运行，
历史 R-001 平台记录不抵扣本轮缺失。

实际安装制品的离线 TUI 命令为：

```text
G:\work\AgentGlass\node_modules\.bin\pi.cmd --offline --no-session --no-context-files --no-skills --no-prompt-templates --no-themes --no-extensions -e C:\Users\17860\AppData\Local\Temp\agentglass-r004-install-20260913\node_modules\@ddt\agentglass\extensions\agentglass.ts
```

该命令只加载最终候选 `agentglass.ts`。真实模型关键路径使用既有合法配置的
`deepseek-v4-pro`，未读取或展示认证信息：实际 Pi 先 read 普通文本文件；write `note.txt`
先在默认 Stop 停止且文件不存在，之后重新提出 write 并通过 Continue；edit 再显示独立卡片，
通过 Continue 后文件从“已确认”变为“已核对”。独立断言为 `note.txt` 存在、10 bytes、内容
`已核对\n`、SHA-256
`894962C9BB18204B46140D2330FC5697119D3E5034722970F6639FD78B53A61B`。固定安全示例的
Stop 分支也独立断言没有文件/目录，Continue 分支独立断言示例文件存在且为 186 bytes。
报告不保存 raw tool input、完整 transcript、认证信息或 snapshot 正文。

### 33.3 B-004 代理矩阵与证据层级

最终候选重跑的 E2E 为 1 file / 14 tests，另有 integration 2 files / 26 tests、security
9 files / 65 tests、corpus 4 files / 23 tests。矩阵按场景而非按测试数量解释如下：

| 矩阵 | 最终候选证据与独立断言 | 状态 |
|---|---|---|
| M-01 输入/target/pre-image 漂移 | E2E drift 用例、integration 精确 binding/recheck；旧卡失效并要求新决定 | PASS |
| M-02 Stop/详情/Continue/Esc/cancel | E2E 与 integration 受控 UI；真实 TUI 观察默认 Stop、详情不批准、Continue 才执行，固定示例 Stop/Continue 另有文件断言 | PASS |
| M-03 备份失败、最近入口替代/拒绝保留、恢复/冲突/清理 | E2E B-001/B-002/B-003 与 integration recovery/cleanup/drift；成功、拒绝、冲突分别检查文件和入口 | PASS |
| M-04 matched/mismatch/unknown | E2E result-contract、文件在观察前变化、unknown/不一致路径；corpus/security 保持显式 unknown | PASS |
| M-05 敏感/越界/链接/未知工具/覆盖工具/不支持安装或运行目标/Critical | E2E comprehensive blocking test；file-preflight、risk、secret-boundary、host-boundary 与 corpus 提供命中及相邻反例 | PASS |
| M-06 unknown 不得降级 | E2E comprehensive、corpus unknown 与 security risk-engine；无 auto-allow | PASS |
| M-07 sibling、无 UI、RPC、replay、新 session、lifecycle | E2E multiple mutation/no UI/drift/replay 与 integration sibling/UI/lifecycle；缺 sibling 按 mutation 阻止且不重排 | PASS |
| 宿主超限 preview | 锁定 Pi 0.85.1 `ToolExecutionComponent.render`，8 MiB old/new `edit` 实测退出码 1，`RangeError: Maximum call stack size exceeded`；目标仍为 8,388,608 bytes、未改变 | **FAIL / 发布阻断** |

上述表的四类证明范围保持分离：固定文案由 card/security fixture 证明，受控交互由
integration/E2E UI 证明，真实 Pi 调度由实际 package entry/agent loop 和真实模型 PTY 证明，
文件结果由独立读取、字节数和 hash 证明。它们都不是真人研究。第一次未加
`--no-extensions` 的终端启动立即退出，未产生文件或模型变更；随后使用上表的隔离命令重做，
不把那次误配置启动计入证据。

### 33.4 发布/撤回/退回审阅清单

准确拟发布制品只有上表的 `ddt-agentglass-0.8.0.tgz` 及其 SHA-256；当前不得发布，因为
`RELEASE_READY=FAIL`。下面是供未来取得明确授权后的渠道步骤，不是已执行命令：

1. 发布前再次核对同一 tarball 的 SHA-256、package/lockfile、许可证、Windows-only 支持矩阵，
   并确认 Pi 外部预览缺陷已有新宿主版本和受影响 gate 的新证据；再由用户明确授权，将准确制品
   交给已确认的 npm/PI 分发渠道。当前 npm 包未声明已上线，本轮没有 `npm publish`。
2. npm 渠道出现已知问题时，对准确版本执行渠道允许的 deprecate/撤回流程；撤回能力受 npm
   当时的版本政策和权限限制，不能预先承诺删除已安装副本。优先发布说明和已知安全版本，保留
   可审阅的 hash 与回退版本。
3. Pi 扩展退回时，先停止当前 Pi，再用 Pi 已支持的 `pi remove` 移除当前扩展来源，安装已知
   正常版本，重启并检查 `/agentglass help`。扩展版本退回不是用户文件恢复，不恢复旧批准，
   也不保证新 schema 数据可由旧版本读取。
4. 用户文件恢复只能走当前版本提供的、针对具体文件且单独批准的 `/agentglass restore`；
   发生冲突必须保留后续编辑。`cleanup` 另需独立批准，只处理已验证的 AgentGlass 私有数据。
   不把扩展卸载、npm 撤回或版本退回写成文件 Undo。

随包说明已由 `README.md` 与 `README.zh-CN.md` 提供：安装/卸载前置、普通文本文件范围、恢复
与清理、版本限制和已知问题均使用本地可读说明。宣传只能限定为 Pi 普通文本文件任务；明确
不提供 sandbox、跨会话 Undo、应用功能保证或恶意共存扩展隔离，也不声称空白电脑一键安装。
无真实参与者记录，Human Validation=`NOT_RUN`，不能宣传真人理解率、耗时或成功率。

### 33.5 R-004 Done Definition 与最终判定

| Done Definition | 判定 | 证据/阻碍 |
|---|---|---|
| 1. 固定候选、依赖、矩阵、hash，且无依赖 FAIL/NOT_RUN 被抵消 | **FAIL** | 候选/hash/工作树已固定且 R-002/R-003 有证据；R-001 仍为 deferred defect，不满足“全部 PASS”入口 |
| 2. 支持矩阵全量工程/安装/终端/B-004 代理/宿主回归，分别报告 CI | **FAIL** | Windows 当前候选所有本地 suite、实际安装、真实 TUI/模型和代理矩阵通过；8 MiB Pi preview 复现；最终候选 POSIX 与远端 CI=`NOT_RUN` |
| 3. INV-001～020、威胁模型、秘密/敏感持久化、依赖风险复审 | **FAIL** | AgentGlass 20 条不变量复审无未关闭严重产品缺陷；外部 Pi 预览栈溢出是未关闭的发布安全/数据风险，不能放行 |
| 4. 随包说明、范围、限制、无越界声明、Human Validation 状态 | **PASS** | README/包边界和本节清单可审阅；Human Validation 正确保持 `NOT_RUN` |
| 5. 发布与撤回/弃用/退回步骤、逐项判定、准确制品 | **PASS** | 清单、准确 tarball/hash 和版本退回边界已准备；实际发布仍未授权、未执行 |
| 6. 工程 PASS 与实际发布分离 | **PASS** | 本轮没有上传、push、tag、release 或外部消息；`RELEASE_READY=FAIL` 未写成已上线 |

最终判定：**`RELEASE_READY=FAIL`**。工程测试和 AgentGlass 安全路径不是发布许可；阻断原因是
Pi 0.85.1 在 AgentGlass 回调前可由超限 `edit` 触发宿主预览栈溢出，另有最终候选 POSIX
重跑和远端 CI 缺失。修复或升级宿主后必须生成新候选 hash，并重新执行受影响兼容、安装、
性能及 R-004 gate；不得复用本节 PASS 作为修复后证据。

## 34. Pi 超限 edit 预览本地候选（2026-09-13）

本次明确要求修复或升级 Pi 后，npm registry 仍只发布
`@earendil-works/pi-coding-agent@0.85.1`；官方 main 为
`71dca871bc80b6bc97be37f0ca3189399d651fff`，仍含
`ToolExecutionComponent.render` 的 `lines.push(...contentLines)`。因此没有把
AgentGlass 覆盖内置工具或改写参数当作修复，而是从该官方 `0.85.1` 制品制作只供本地审阅的
Pi 候选：将该处改为逐行 `push`，使数组长度不再作为一次 JavaScript 调用的参数数量。

源级回归在官方 main 浅克隆中新增一个 `200,000` 行 self-render 预览断言；
`packages/coding-agent/test/tool-execution-component.test.ts` 为 `27/27 PASS`。完整上游
`npm run build` 未能作为候选构建门：上游构建会联网刷新模型目录，刷新后
`packages/ai/src/api/google-shared.ts` 对新的 `TOO_MANY_TOOL_CALLS` 枚举未穷尽，TypeScript
失败。这是上游当前构建可复现性问题，不将其归因为 AgentGlass，也不把它写成通过。

为保留可安装的审阅制品，候选从官方 `0.85.1` tarball 的已发布 `dist` 重建 CLI bundle，未加入
运行时依赖、网络逻辑或 AgentGlass 代码；包名保持原 scope 仅便于本地 npm 安装，版本显式标为
`0.85.2-agentglass.0`，不得发布到官方 scope 或当作官方 Pi 版本。制品为
`G:\\work\\AgentGlass\\artifacts\\earendil-works-pi-coding-agent-0.85.2-agentglass.0.tgz`，
SHA-256=`6235D2308B8F4FF11FB545B0B46BEC440200C5009C84C62CC3ABCF6789463955`，packed
`7,174,991` bytes、unpacked `22,715,575` bytes、`1,047` entries。

在全新临时 npm 安装中，已安装 metadata 与 `pi --version` 均为
`0.85.2-agentglass.0`，bin 指向新 bundle；该实际 bundle 渲染 `200,002` 行预览成功，无
`RangeError`。AgentGlass 原工作树未改动运行时代码；`npm run typecheck`、`npm run lint`、
`npm run build`、unit `65/65`、corpus `23/23`、security `65/65`、integration `26/26`、
e2e `14/14` 与 `npm pack --dry-run --json` 均退出 `0`。已有用户工作树差异保留不动。

该候选只证明已定位的预览调用栈不再受 V8 参数上限影响；未完成官方 Pi 源码构建、官方发布、
真实 8 MiB PTY 全链路、跨平台候选矩阵、性能重测、远端 CI 或 R-004 重验。因此
`RELEASE_READY` 仍为 `FAIL`，Human Validation 仍为 `NOT_RUN`，且没有发布、push、tag 或上传。

## 35. R-004 新候选复验（2026-09-13）

### 35.1 入口依赖与候选一致性

本次复验开始前重新核对实际证据，而不是读取任务标签：

| 依赖 | 实际状态 | 对 R-004 的影响 |
|---|---|---|
| R-001 | `PASS_WITH_DEFERRED_EXTERNAL_DEFECT` | 不是无条件 PASS；Pi 0.85.1 的超限 edit 预览仍是发布阻断 |
| R-002 | `PASS`（Windows-only） | 支持范围内的真实 tarball 安装证据可复用；不扩大平台或 Pi 版本承诺 |
| R-003 | `PASS` | 当前有效 AgentGlass tarball 的性能、配额和生命周期证据已按候选复核 |

因此 R-004 的严格入口条件仍为 **FAIL**。本次不把延期准入写成依赖 PASS，也不把本地
Pi 修补包写成官方 Pi 版本。

最终 AgentGlass 候选固定为：

| 项目 | 实际值 |
|---|---|
| cwd / HEAD | `G:\\work\\AgentGlass` / `533131e218c7b620bdaddd856b25fa179242ebb6` |
| 工作树 | 保留用户已有 `README.md`、`README.zh-CN.md`、`src/adapter/pi/adapter.ts`、`src/core/execution-input.ts`、`src/core/pre-image-snapshot.ts` 修改及未跟踪 `tests/performance/r003-performance.mjs`；本次没有净新增运行时代码修改 |
| package / lockfile | `@ddt/agentglass@0.8.0`、MIT；`package.json` 与 `package-lock.json` 最终均无相对 HEAD 的差异 |
| 平台 | Windows x64 build `10.0.26200`、NTFS、PowerShell、Node `v24.14.0`、npm `11.9.0` |
| 支持声明 | Pi `>=0.84.3 <=0.85.1`；Windows-only；官方 Pi 0.85.2 未验证 |
| 有效拟分发制品 | `G:\\work\\AgentGlass\\artifacts\\ddt-agentglass-0.8.0.tgz` |
| hash / 包体 | SHA-256 `5C4106F2E5D11617DAFBD0DD04DEF4DA881D4855CBC71A6936EEBCFCB882448C`；119,384 compressed bytes；470,999 unpacked bytes；46 entries |

复核中一次错误使用 `npm init -y --prefix` 的命令在当前 npm/PowerShell 组合下写回了仓库
`package.json`；该误改已立即用补丁撤回并核对为与 HEAD 相同，所生成的 119,885-byte 临时
tarball、204-package 安装目录和其测量结果均明确排除。有效制品的重新
`npm pack --dry-run --json` 为 119,384 / 470,999 / 46 entries，和上表及有效 tarball
一致。没有修改 `.gitignore`，没有 reset、清理或覆盖用户改动。

### 35.2 工程门、制品安装与性能

以下是最终有效候选和当前工作树的真实结果；所有列出的进程均退出码 `0`，除明确标注的
参数错误和宿主入口失败外没有跳过失败用例：

| 命令 | 实际分母/结果 | 退出码 |
|---|---|---:|
| `npm ci` | 新增 217 packages；仅已有 `node-domexception@1.0.0` deprecation warning | 0 |
| `npm run typecheck` | TypeScript no emit | 0 |
| `npm run lint` | Biome 45 files，No fixes | 0 |
| `npm run build` | `tsc -p tsconfig.build.json` | 0 |
| `npm run test:unit` | 8 files / 65 tests | 0 |
| `npm run test:corpus` | 4 files / 23 tests | 0 |
| `npm run test:security` | 9 files / 65 tests | 0 |
| `npm run test:integration` | 2 files / 26 tests | 0 |
| `npm run test:e2e` | 1 file / 14 tests | 0 |
| `npm pack --dry-run --json` | 46 entries；119,384 / 470,999 bytes；shasum `7680aabae685d906931066291c97a9203f59202d` | 0 |
| 有效 tarball 隔离 `npm install` | 实际 tarball；169 packages；`--omit=dev --no-save --ignore-scripts` | 0 |
| 有效 tarball 安装目录 `test:e2e` | 1 file / 14 tests | 0 |

有效候选的完整性能命令为：

```text
node tests/performance/r003-performance.mjs --package-root C:\\Users\\17860\\AppData\\Local\\Temp\\agentglass-r004-new-2026091319\\agentglass-install\\node_modules\\@ddt\\agentglass --runs 20 --load-only
node tests/performance/r003-performance.mjs --package-root C:\\Users\\17860\\AppData\\Local\\Temp\\agentglass-r004-new-2026091319\\agentglass-install\\node_modules\\@ddt\\agentglass --runs 20 --load-only
node --expose-gc tests/performance/r003-performance.mjs --package-root C:\\Users\\17860\\AppData\\Local\\Temp\\agentglass-r004-new-2026091319\\agentglass-install\\node_modules\\@ddt\\agentglass --tarball G:\\work\\AgentGlass\\artifacts\\ddt-agentglass-0.8.0.tgz --runs 3
```

两轮 20 对为同机、交替顺序、`--offline`、空 stdin 的独立冷进程测量，所有 bare/extension
进程退出码为 `0`：

| 轮次 | 加载增量 P50 | 加载增量 P95 | max |
|---|---:|---:|---:|
| 1 | `109.572 ms` | `134.066 ms` | `146.736 ms` |
| 2 | `114.722 ms` | `138.985 ms` | `147.348 ms` |

连续完整测量为：纯预检 3,000 样本 P50/P95 `0.630/1.267 ms`；分类路径 30 样本
P50/P95 `2.179/4.218 ms`；稳定读取 30 样本 `0.820/6.658 ms`；核验 30 样本
`0.844/5.043 ms`；完整变更→ready→恢复→清理 3 样本 P50/P95
`3,728.981/4,300.141 ms`。前像 1 KiB/64 KiB/1 MiB/10 MiB 分母分别为 15/15/15/3；
ACL 短时进程 15；生命周期 256 cycles，覆盖 `agent_end`、reload、new session、shutdown、
dispose，active resources 保持 `3`。配额边界、锁竞争、permission/disk-full/interrupted-
publish 故障均为新变更 unavailable 且旧数据保留。测量只使用合成非秘密数据，不输出 raw
input、用户文件正文或 snapshot 正文；模型等待和 UI 不计入上述纯测量。

一次误用 `--tarball` 而未同时提供 `--package-root` 的测量退出码为 `1`，报错为脚本参数
前置条件，不是候选失败；随后按脚本实际接口重新以安装目录和 tarball 一并执行，取得上表
完整结果，未把参数错误写成 PASS。

### 35.3 官方 Pi 与本地修补 Pi 的实际终端证据

有效 AgentGlass tarball 安装目录使用官方 Pi `0.85.1` 的真实 `extensions/agentglass.ts`
入口启动成功，实际 TUI 显示 `AgentGlass 已启用`；该命令后以 Ctrl+D 正常退出，没有生成
用户文件。有效 tarball 的 fresh E2E 仍为 `14/14 PASS`。官方 Pi 0.85.1 的超限 preview
故障已经在 §33 记录：8 MiB `edit` 在 AgentGlass `tool_call` 前以
`RangeError: Maximum call stack size exceeded` 退出，不能写成 AgentGlass 阻止。

本次复验的本地 Pi 诊断制品仅用于验证宿主修补方向：

| 项目 | 实际值 |
|---|---|
| 包 | `@earendil-works/pi-coding-agent@0.85.2-agentglass.0`，基于官方 0.85.1 dist 重建 |
| 安装 | 隔离目录实际 tarball 安装，127 packages；`pi --version` 为 `0.85.2-agentglass.0` |
| hash | `6235D2308B8F4FF11FB545B0B46BEC440200C5009C84C62CC3ABCF6789463955` |
| 直接模块回归 | 200,000 行及 8 MiB old/new `ToolExecutionComponent.render` 均退出 `0`，无 RangeError |
| 正常扩展 manifest 入口 | **退出 1**：加载 `extensions/agentglass.ts` 时找不到修补包根目录 `index.js` |
| 绕过入口的诊断 | 直接 `dist/extensions/agentglass.js` 可启动；help/example、真实模型 `deepseek-v4-pro` 的 write/edit Continue 流程和独立文件 hash 断言通过 |

最后一行诊断不能抵消上一行失败：它绕过了随包 manifest 的 TS 入口，不是用户安装路径的
证明。该 Pi 包不是官方发布版本，也不在 AgentGlass peer 支持声明内；不得上传、发布或作为
支持矩阵版本宣传。官方 Pi 的 TUI manifest 启动通过和本地修补包的直接 render 通过，均不能
关闭官方旧版宿主故障或本地修补包入口不一致。

### 35.4 B-004 代理矩阵与安全复审

最终有效 AgentGlass 候选的 corpus/security/integration/e2e 分母为 23/65/26/14，B-004
场景 M-01～M-07 的实际状态如下；固定文案、受控交互、真实 Pi 调度、独立文件断言仍分层
报告，不把代理数据写成真人数据：

| 场景 | 状态 | 证据范围 |
|---|---|---|
| Stop/详情/Continue/取消、默认 Stop | PASS | E2E/integration；真实官方 TUI 启动与本地诊断 TUI 观察 |
| matched/mismatch/unknown、结果漂移 | PASS | corpus/security/integration/e2e，显式保留 unknown |
| 备份失败、超限、权限、敏感、越界、链接、未知/覆盖工具 | PASS | security/corpus/e2e；失败关闭，旧数据保留 |
| 最近入口替代/拒绝保留、恢复冲突、清理、重启 | PASS | integration/e2e；恢复/清理分别批准，重启不恢复授权 |
| sibling、无 UI、RPC、unsupported install/run、lifecycle | PASS | integration/e2e；不完整 sibling 按 mutation 阻止，不自动重排 |
| 宿主超限 preview | **FAIL / 发布阻断** | 官方 0.85.1 8 MiB 仍在回调前 RangeError；修补包 direct render PASS 但正常 manifest FAIL |

INV-001～020 逐项复审结论：

| INV | 当前结论 |
|---|---|
| 001 | PASS；确定性风险决策，不由模型降低或覆盖 |
| 002 | PASS；unknown/unsupported/敏感/越界/覆盖工具和不完整 sibling hard block |
| 003 | PASS（AgentGlass 产品路径）；宿主 preview 故障仍阻断发布 |
| 004 | PASS（受支持恢复范围）；不扩大为通用撤回 |
| 005 | PASS；秘密不进入普通输出、日志、卡片或模型上下文，snapshot 正文不进报告 |
| 006 | PASS；canonical raw input 先于 redaction fingerprint |
| 007 | PASS；tool/cwd/session/call identity/fingerprint 精确绑定 |
| 008 | PASS；漂移、replay、拒绝、新 session、单次消费均阻止旧授权继续 |
| 009 | PASS；matched/mismatch/unknown/not observed 分层保留 |
| 010 | PASS（代理/终端证据）；真人理解不推导 |
| 011 | PASS（声明审查）；无 sandbox、shell containment 或恶意共存扩展隔离承诺 |
| 012 | PASS；初始 Stop，详情/取消/无 UI 不批准，只有真实 Continue 执行 |
| 013 | PASS；多个 mutation/unknown 或不完整 sibling 顺序阻止 |
| 014 | NOT_RUN；无真实参与者，不生成理解率/耗时/成功率 |
| 015 | PASS；Pi API/类型仍只在 extensions 与 src/adapter/pi |
| 016 | PASS（边界审查）；raw 仅短暂用于 canonicalization/classification/risk |
| 017 | PASS；不输出或重建 hidden chain-of-thought |
| 018 | PASS（官方支持矩阵内）；本地 Pi 诊断包不纳入支持声明 |
| 019 | PASS；restore/cleanup 独立批准，重启不恢复授权，旧 schema 不授权 |
| 020 | PASS（AgentGlass 路径）；realpath、工具身份、link/special/sensitive/outside/sibling 均有回归 |

安全复审没有发现可归因于 AgentGlass 且尚未关闭的严重安全或数据丢失缺陷。仍必须把宿主
预览栈溢出视为发布阻断；它发生在 AgentGlass 回调前，不能被标成安全拒绝。没有为了消除
告警升级锁定宿主，没有引入运行时联网检查、shell、后台服务或额外 LLM 调用。秘密展示、
敏感 snapshot、危险 shell 输入和测试故障注入继续遵守既有边界。

### 35.5 随包说明、发布清单与 Done Definition

准确拟分发制品只有：

```text
G:\\work\\AgentGlass\\artifacts\\ddt-agentglass-0.8.0.tgz
SHA-256: 5C4106F2E5D11617DAFBD0DD04DEF4DA881D4855CBC71A6936EEBCFCB882448C
```

README/README.zh-CN 已说明 Windows-only、Pi `0.84.3～0.85.1`、安装/卸载、恢复/清理、
版本限制和已知问题。对外说明只允许宣传 Pi 普通文本文件 read/write/edit；明确无 sandbox、
无跨会话 Undo、无应用功能保证、无恶意共存扩展隔离。没有真人记录，Human Validation 为
`NOT_RUN`，不能宣传真人理解、耗时或成功率。

未来在宿主缺陷关闭、受影响 gate 重跑并取得用户明确发布授权后，审阅清单为：

1. 再次核对上述 hash、package/lockfile、许可证、Windows-only 和官方 Pi 支持版本；只提交
   该准确 tarball，不把本地 `0.85.2-agentglass.0` 当官方制品。
2. 用户明确授权后才交给已确认分发渠道；当前没有 `npm publish`、上传、tag、push 或 release。
3. 发生问题时按实际渠道权限执行 deprecate/撤回或发布已知安全版本；不承诺删除已安装副本。
4. 扩展退回先停止 Pi，用 Pi 已支持的 `pi remove` 移除当前扩展，再安装已知版本、重启并检查
   `/agentglass help`。扩展退回不是用户文件恢复，不恢复旧批准，不保证新 schema 可由旧版读取。
5. 文件恢复只用当前版本对明确文件提供的、单独批准的 `/agentglass restore`；冲突保留后续
   编辑，`cleanup` 另需独立批准且只处理已验证的 AgentGlass 私有数据。

R-004 Done Definition：

| 项目 | 状态 | 依据 |
|---|---|---|
| 1. 固定候选/依赖/矩阵/hash，无依赖 FAIL/NOT_RUN 抵消 | **FAIL** | R-001 仍为延期准入；本地 Pi 诊断候选非官方且 manifest 入口失败 |
| 2. 全量工程/安装/终端/B-004/宿主回归并分列 CI | **FAIL** | Windows 本地 gate 与有效制品安装通过；官方超限 preview 失败，POSIX/远端 CI 未运行 |
| 3. INV-001～020、威胁、秘密/敏感持久化、依赖风险复审 | **FAIL** | 产品路径无严重未闭缺陷，但宿主预览阻断未关闭 |
| 4. 随包说明、范围、限制和 Human Validation | **PASS** | README 与本节清单齐全；Human Validation 正确为 NOT_RUN |
| 5. 发布/撤回/退回步骤、逐项判定、准确制品 | **PASS** | 制品/hash、渠道限制和退回边界可审阅；未宣称已发布 |
| 6. 工程 PASS 与实际发布分离 | **PASS** | 未上传、未 push、未 tag、未创建 release，未执行实际发布 |

最终判定：**`RELEASE_READY=FAIL`**。下一次若修复候选或宿主包，必须生成新 hash，并重新
执行受影响的兼容、安装、性能、实际终端和 R-004 gate；不得复用本节任何 PASS 冒充修复后
证据。无论后续是否达到 `RELEASE_READY=PASS`，实际发布仍须另行获得用户明确授权。

## 36. R-004 修补 Pi 诊断候选复验（2026-09-13）

### 36.1 修复范围与候选固定

上一节发现的 `0.85.2-agentglass.0` 入口失败已定位为宿主候选自身的随包布局问题：其
bundle loader 会把 `@earendil-works/pi-coding-agent` 解析到包根 `index.js`，而该候选只
声明了 `dist/index.js`。本次只在隔离的 Pi 诊断候选源目录加入一个根入口，将它重新导出到
`./dist/index.js`，并把 `index.js` 加入 `files`；随后将诊断版本递增到 `.1`。没有修改
AgentGlass 源码、官方 Pi、内置工具参数、AgentGlass peer 支持范围或运行时网络行为。

修补候选不是官方 Pi 发布版本，不纳入产品支持矩阵，也不能上传或宣传为官方版本：

| 项目 | 实际值 |
|---|---|
| 候选包 | `@earendil-works/pi-coding-agent@0.85.2-agentglass.1` |
| 来源 | 官方 `0.85.1` 已发布 dist 的本地诊断重建，沿用上一节唯一的 preview 逐行 push 修补 |
| 制品 | `G:\\work\\AgentGlass\\artifacts\\earendil-works-pi-coding-agent-0.85.2-agentglass.1.tgz` |
| SHA-256 | `3121727F46AED4D33DC800477ECEEC6B58FE215BF0A00E2330E441BA6081A2B4` |
| 包体 | `7,175,070` compressed bytes；`22,715,778` unpacked bytes；`1,048` entries |
| AgentGlass 候选 | `@ddt/agentglass@0.8.0`，SHA-256 仍为 `5C4106F2E5D11617DAFBD0DD04DEF4DA881D4855CBC71A6936EEBCFCB882448C` |

当前工作树仍为 HEAD `533131e218c7b620bdaddd856b25fa179242ebb6`；README 三处源文件改动及
未跟踪性能脚本均为既有用户改动，本次未覆盖、回退或清理。`package.json` 与
`package-lock.json` 与 HEAD 一致。正式 AgentGlass 制品没有变化，因此 §35 的 AgentGlass
工程、五类 suite、制品安装和性能证据不被旧 Pi 诊断候选的失败抵消；本节只补测该修补候选
实际受影响的宿主入口、安装、预览和终端路径。

### 36.2 修复后实际检查

所有命令均在隔离目录执行；没有读取或展示认证秘密、模型认证配置或用户文件正文：

本次实际使用的关键命令如下（`<source>`、`<install>` 只代表下列已固定的隔离绝对路径，
不是未执行的占位任务）：

```text
Set-Location C:\Users\17860\AppData\Local\Temp\agentglass-r004-pi-fixed-2026091319\source\package
npm pack
Push-Location C:\Users\17860\AppData\Local\Temp\agentglass-r004-pi-fixed-2026091319\install-v1; npm init -y; Pop-Location
npm install G:\work\AgentGlass\artifacts\earendil-works-pi-coding-agent-0.85.2-agentglass.1.tgz --prefix C:\Users\17860\AppData\Local\Temp\agentglass-r004-pi-fixed-2026091319\install-v1 --omit=dev --no-save --ignore-scripts
& C:\Users\17860\AppData\Local\Temp\agentglass-r004-pi-fixed-2026091319\install-v1\node_modules\.bin\pi.cmd --offline --no-session --no-context-files --no-skills --no-prompt-templates --no-themes --no-extensions -e C:\Users\17860\AppData\Local\Temp\agentglass-r004-new-2026091319\agentglass-install\node_modules\@ddt\agentglass\extensions\agentglass.ts
```

preview self-check 使用安装后的 `dist/index.js`，分别传入 `200000` 行和 `131072` 行
（8 MiB old/new class）的确定性 diff；命令完成后输出 `v1_200k_preview=completed
lines=399005` 与 `v1_8m_class=completed lines=261149`，退出码均为 `0`。实际模型
TUI 使用上面的 `.1` `pi.cmd` 命令，真实输入只要求隔离 fixture 完成 read→write→edit，
没有把模型提示词或终端 transcript 写入报告。

| 检查 | 实际结果 | 退出码 |
|---|---|---:|
| 对 `.1` 执行 `npm pack` 并核对 tar 清单 | 根 `index.js` 在制品中；包体、解包体积和 entry 数量如上 | 0 |
| 从最终 `.1` tarball 隔离安装 | `npm install <artifact> --omit=dev --no-save --ignore-scripts`；实际 `127 packages` | 0 |
| 随包 `extensions/agentglass.ts` manifest 启动 | TUI 显示 `pi v0.85.2-agentglass.1`、`AgentGlass 已启用`；Ctrl+D 正常退出 | 0 |
| `.1` 直接 preview 回归 | `200,000` 行：`399,005` render lines；8 MiB old/new class：`261,149` lines；无 `RangeError` | 0 |
| `.1` 实际模型 TUI | 已配置 `deepseek-v4-pro`；真实 read→write→edit，write/edit 各显示卡片且初始 Stop，Continue 后执行；独立文件断言最终为 `33` bytes、`已复核的新候选验收说明`、SHA-256 `F4BD34C139F1DC203AEF8138F4021917BE5AE506E1DEB239CB2BCAC98FFACFC7` | 0 |

实际 TUI 的独立断言只读取明确的隔离 fixture `新候选验收.txt`，不扫描项目；工具报告、
卡片可见范围和独立字节结果分开记录。该证据修复了 `.1` 的随包 manifest 入口失败，不能
抵消官方 Pi `0.85.1` 在 AgentGlass `tool_call` 前的 8 MiB `edit` preview 栈溢出。

### 36.3 安全与发布复审更新

INV-001～020 的 §35 映射继续有效；本次新增路径只增加了宿主候选包根入口，未引入新的
AgentGlass 数据流、shell、后台服务、端口、依赖或主动联网。入口修复也没有把未验证的
`0.85.2-agentglass.1` 写入 AgentGlass 支持声明。`INV-003/018` 仍受官方 Pi 0.85.1
兼容性阻断影响；`INV-012` 在 `.1` 实际 TUI 中再次观察到默认 Stop 和明确 Continue；
`INV-014=NOT_RUN`，没有真人记录，不生成真人理解、耗时或成功率。

修补候选本身的异常已关闭并有安装、manifest、preview、真实模型和独立文件证据；官方
支持候选的宿主 preview 缺陷仍未关闭，所以 R-004 不能改判为发布通过。远端 CI、POSIX
发布矩阵和 Human Validation 仍准确保持 `NOT_RUN`。没有上传、push、tag、release 或
实际发布。

### 36.4 修复后 Done Definition 与最终判定

| 项目 | 修复后状态 | 依据 |
|---|---|---|
| 1. 固定候选/依赖/矩阵/hash | **FAIL** | R-001 仍是 `PASS_WITH_DEFERRED_EXTERNAL_DEFECT`；`.1` 是非官方诊断包，不能替换锁定支持宿主 |
| 2. 工程/安装/终端/B-004/宿主回归 | **FAIL** | `.1` 受影响路径全通过，但官方 Pi 0.85.1 的 8 MiB preview 仍在 AgentGlass 回调前失败；远端 CI 未运行 |
| 3. 安全、威胁、秘密和依赖复审 | **PASS** | INV-001～020 已复审；没有发现 AgentGlass 未关闭的严重安全或数据丢失缺陷，外部兼容阻断单列 |
| 4. 随包说明与声明边界 | **PASS** | README/清单继续限定 Pi 普通文本文件任务并明确无 sandbox、跨会话 Undo、应用功能保证和恶意扩展隔离承诺 |
| 5. 发布/撤回/退回清单 | **PASS** | 准确 AgentGlass 制品、hash、渠道步骤和退回边界可审阅；扩展退回不等于文件恢复，不恢复旧批准，不保证新 schema |
| 6. 工程 PASS 与实际发布分离 | **PASS** | 本轮未上传、未 push、未 tag、未创建 release |

最终判定仍为 **`RELEASE_READY=FAIL`**。可审阅的拟分发制品仍只有
`ddt-agentglass-0.8.0.tgz` 及其 SHA-256 `5C4106F2E5D11617DAFBD0DD04DEF4DA881D4855CBC71A6936EEBCFCB882448C`；
Pi `.1` 只是一份未授权发布的本地诊断制品。要达到 PASS，必须由用户决定并完成官方宿主
缺陷关闭后的支持矩阵重跑；即便达到 PASS，实际发布仍需另行明确授权。

### 36.5 受影响 R-004 gate 重跑（2026-09-13）

本次按用户要求重新执行受 Pi `.1` 修复影响的 gate。开始前实际状态仍为 HEAD
`533131e218c7b620bdaddd856b25fa179242ebb6`，Windows x64/NTFS、PowerShell、Node
`v24.14.0`、npm `11.9.0`；AgentGlass 制品 hash 未变，`npm pack --dry-run --json` 再次为
`119,384` compressed、`470,999` unpacked、`46` entries、shasum
`7680aabae685d906931066291c97a9203f59202d`。工作树仍只保留原有用户改动。

本次新鲜隔离目录为
`C:\\Users\\17860\\AppData\\Local\\Temp\\agentglass-r004-recheck-20260913-final`，
未复用已有安装目录；所有安装均使用实际 tarball、`--omit=dev --no-save --ignore-scripts`。

| 受影响 gate | 准确结果 | 退出码 |
|---|---|---:|
| Pi `.1` fresh tarball install | `@earendil-works/pi-coding-agent@0.85.2-agentglass.1`，新增 `127 packages` | 0 |
| AgentGlass fresh tarball install | `@ddt/agentglass@0.8.0`，新增 `169 packages`，extension 文件存在 | 0 |
| 固定 `.1` + 固定 AgentGlass manifest TUI 启动 | 显示 `pi v0.85.2-agentglass.1`、`AgentGlass 已启用`，Ctrl+D 正常退出 | 0 |
| 固定 `.1` preview 压力回归 | `200,000` 行输出 `399,005` lines；`131,072` 行（8 MiB class）输出 `261,149` lines | 0 |
| 固定 `.1` 实际模型 TUI | 已配置 `deepseek-v4-pro`；真实 read→edit；卡片初始 Stop，Continue 后执行；独立断言 `33` bytes、内容 `已确认的新候选复验说明`、SHA-256 `C6A82DD25A8C66A3A46F9DC6A205CD29533BE57918AD6FFFD143EDE34799C2AE` | 0 |
| 官方 Pi `0.85.1` 同输入反例 | `ToolExecutionComponent.render` 第 189 行 `lines.push(...contentLines)`，`RangeError: Maximum call stack size exceeded` | 1 |

本次固定 `.1` preview 回归与官方反例使用相同的 `131,072` 行 old/new diff；因此确认修复
候选不会再触发该调用栈，但官方支持宿主仍未满足发布 gate。R-003 的 AgentGlass 纯预检、
加载增量、恢复/配额测量不因本次外部宿主候选修复而改变；AgentGlass tarball、源码和
lockfile 均未变化，沿用 §35 的分母与结果，不把外部 `.1` 的 preview 压测冒充产品纯预检。

重跑后 Done Definition 状态仍为：1 **FAIL**（R-001 非无条件 PASS，`.1` 非官方）；2
**FAIL**（官方 0.85.1 反例仍失败，远端 CI/POSIX 仍未运行）；3 **PASS**（安全复审无新的
AgentGlass 严重安全或数据丢失缺陷）；4 **PASS**；5 **PASS**；6 **PASS**。因此最终
`RELEASE_READY=FAIL`，准确拟分发制品仍只有 AgentGlass
`ddt-agentglass-0.8.0.tgz`；没有上传、push、tag、release 或实际发布。

## 36.6 README 同步后的最终 AgentGlass 制品复验（2026-09-13）

2026-09-13 用户明确决定：不在 AgentGlass 中修复官方 Pi `0.85.1` 的 8 MiB
`edit` preview 栈溢出。该故障发生在 AgentGlass `tool_call` 回调前，记录为后续版本的
外部宿主修复目标和当前版本已知限制；它不作为当前 R-004 的发布阻断。该决定不把故障
写成 AgentGlass 安全拒绝，也不扩大 Pi、工具或平台支持范围。

本次 README 中英文同步后重新生成实际候选；源代码、`package.json`、
`package-lock.json` 和 Pi 支持声明未改变。当前工作树仍保留用户已有的
`README.md`、`README.zh-CN.md`、`src/adapter/pi/adapter.ts`、
`src/core/execution-input.ts`、`src/core/pre-image-snapshot.ts` 修改，以及未跟踪的
`tests/performance/r003-performance.mjs`；没有回退、清理或覆盖这些改动。

| 项目 | 实际值 |
|---|---|
| cwd / HEAD | `G:\\work\\AgentGlass` / `533131e218c7b620bdaddd856b25fa179242ebb6` |
| 环境 | Windows x64/NTFS、PowerShell、Node `v24.14.0`、npm `11.9.0` |
| package | `@ddt/agentglass@0.8.0`、MIT |
| 准确制品 | `G:\\work\\AgentGlass\\artifacts\\ddt-agentglass-0.8.0-r004-final.tgz` |
| SHA-256 | `7FF5D1086E857070553D3528921DC22C91C11D669C0529B1415B719DD7A8AC57` |
| 包体 | `119,810` compressed bytes；`471,858` unpacked bytes；`46` entries；npm shasum `dda777e1c5e37f296d5ef7c2e37fb398124a571c` |

### 实际命令与安装 smoke

以下命令在本地工作树和新建隔离目录中实际执行，均退出码 `0`：

```text
npm pack --pack-destination C:\Users\17860\AppData\Local\Temp\agentglass-r004-package-final-20260913-212140 --json
npm install G:\work\AgentGlass\artifacts\ddt-agentglass-0.8.0-r004-final.tgz --prefix C:\Users\17860\AppData\Local\Temp\agentglass-r004-package-final-20260913-212140\install --omit=dev --no-save --ignore-scripts
```

安装实际新增 `169 packages`。安装后的
`node_modules\\@ddt\\agentglass\\extensions\\agentglass.ts` 存在，包名/版本为
`@ddt/agentglass@0.8.0`，随包 `README.md` 含 Pi `0.85.1` 已知限制说明，因此本次
“实际制品安装 smoke”状态为 **PASS**。npm 输出一个既有依赖的
`node-domexception@1.0.0` deprecation warning；未新增运行时依赖，本次不将该 warning
写成安装失败。

本次只改变随包文档，因此沿用前一轮最终候选的工程、corpus/security/integration/e2e、
性能、完整 Beta 代理矩阵及真实 TUI 证据；按制品变化要求重新执行包体、实际安装和
随包说明断言。远端 CI 与 Human Validation 仍准确记录为 `NOT_RUN`，不伪称为通过，也
不由 Human Validation 生成真人指标。

### 当前 R-004 判定

| Done Definition | 当前状态 | 依据 |
|---|---|---|
| 1. 固定候选、依赖、矩阵、hash | **PASS** | HEAD、用户差异、版本、支持声明、实际 tarball 和 SHA-256 已固定；R-001 的外部延期缺陷按用户决定接受为已知限制，不抵消其他证据 |
| 2. 工程/安装/终端/B-004/宿主回归 | **PASS** | 既有最终候选工程与代理/终端证据通过；README-bearing tarball 安装 smoke 通过；官方 Pi 预览故障已记录但按当前决定不阻断；远端 CI=`NOT_RUN` |
| 3. 安全、威胁、秘密和依赖复审 | **PASS** | 未发现 AgentGlass 未关闭的严重安全或数据丢失缺陷；Pi 故障明确为回调前外部限制，不冒充安全拒绝 |
| 4. 随包说明与声明边界 | **PASS** | 中英文 README 已披露安装、恢复、数据、版本限制、Pi 已知问题及无 sandbox/跨会话 Undo/应用功能/恶意扩展隔离承诺 |
| 5. 发布/撤回/退回清单 | **PASS** | 准确制品、hash、渠道步骤和退回边界可审阅；扩展退回不等于文件恢复，不恢复旧批准，不保证新 schema |
| 6. 工程 PASS 与实际发布分离 | **PASS** | 没有上传、push、tag、release 或实际发布；仍需用户另行授权 |

当前候选的工程结论为 **`RELEASE_READY=PASS`**，拟分发制品仅为上述
`ddt-agentglass-0.8.0-r004-final.tgz` 及其 SHA-256。官方 Pi `0.85.1` 超限预览修复
保留为后续版本目标；后续若采用官方 Pi 修复，必须重新核对支持声明并重跑受影响的兼容、
安装、终端和 R-004 gate。实际发布仍未授权，不能将本次“准备完成”写成“已上线”。

## 37. 当前候选预算变更与 npm 发布准备（2026-09-14）

用户明确确认将同机扩展加载增量的发布阻断门从 P95 `≤200 ms` 调整为 `≤350 ms`。该变更不修改 INV-001～020、不跳过安全检查、不改变普通输入纯预检 P95 `≤50 ms`，并保留完整测量分布与离群值。

当前工作树与制品证据如下：

| 项目 | 实际值 |
|---|---|
| HEAD | `d7254e65aba09597ed15a103204afef99aa73cd9` |
| 本地差异 | `README.md`、`README.zh-CN.md` 的发布后中性安装表述 |
| package | `@ddt/agentglass@0.8.0`、MIT |
| 环境 | Windows x64/NTFS、Node `v24.14.0`、npm `11.9.0`、Pi `0.85.1` |
| 准确制品 | `G:\work\AgentGlass\artifacts\ddt-agentglass-0.8.0.tgz` |
| SHA-256 | `1658FBFE1520D668A7056ED03CCDE06D4848615F792F4253F0B9793FF7975637` |
| 包体 | `289,413` compressed bytes；`666,917` unpacked bytes；`49` entries |

在当前 HEAD 的隔离 Git 快照中实际执行 `npm ci`，随后执行 `npm run typecheck`、`npm run lint`、`npm run build`、`npm run test:unit`（65 tests）、`npm run test:corpus`（23）、`npm run test:security`（65）、`npm run test:integration`（27）和 `npm run test:e2e`（14），均退出码 `0`。原工作树的 `npm ci` 曾因 Windows native 模块被占用返回 `EPERM`，不作为产品测试失败；隔离 clean-install 已成功。

从准确 tarball 新建隔离安装实际新增 `169 packages`，入口、双语 README、Pi 已知限制和截图存在，`tests` 不在制品中，断言退出码 `0`。性能脚本 `node --check tests/performance/r003-performance.mjs` 及完整测量退出码 `0`；纯预检 `3,000` 样本 P95 `0.516 ms`，完整链路和配额/生命周期证据通过。最终制品两轮各 `20` 对冷启动加载增量 P95 为 `321.142 ms`、`188.968 ms`，均低于用户确认的 `350 ms` 门。

因此当前候选的工程结论为 **`RELEASE_READY=PASS`**。官方 Pi `0.85.1` 超限 edit 预览仍是随包披露的外部已知限制，不冒充 AgentGlass 安全阻止。用户已完成 npm 认证；针对上述准确 tarball 的官方 registry 发布尝试实际返回 `E404`（`PUT https://registry.npmjs.org/@ddt%2fagentglass`），随后只读核验 `npm whoami` 为 `hugo-ddt`、`npm access list packages hugo-ddt` 为 `{}`、`npm org ls ddt` 为 `{}`，因此制品尚未上线，不能执行 registry fresh-install smoke。下一步需要让 `hugo-ddt` 获得 `@ddt` scope 的发布权限，或由用户确认改用其拥有的 scope/包名后重新打包。远端 CI 与 Human Validation 仍为 `NOT_RUN`。

## 38. 改用账号 scope 后的准确制品复验（2026-09-14）

用户明确要求将未发布候选从 `@ddt/agentglass` 改为已认证账号 `hugo-ddt` 的个人 scope：
`@hugo-ddt/agentglass`。本次只改变包身份、lockfile、Pi 集成断言和中英文安装文档；历史
`@ddt` 测量与失败发布记录保留，不将它们改写为新包证据。

| 项目 | 实际值 |
|---|---|
| package | `@hugo-ddt/agentglass@0.8.0`、MIT |
| 准确制品 | `G:\\work\\AgentGlass\\artifacts\\hugo-ddt-agentglass-0.8.0.tgz` |
| SHA-256 | `5A6A46A195ED14E2C8FF6F7F86EC55D28C8BB4DC9B028B438E2DBC510EE2E924` |
| 包体 | `289,415` compressed bytes；`666,972` unpacked bytes；`49` entries；npm shasum `b99a1c08e974dc44bc0e06390b2d057331caa03c` |

在 `C:\\Users\\17860\\AppData\\Local\\Temp\\agentglass-scope-20260914` 的干净隔离快照
中实际执行 `npm ci`、`npm run typecheck`、`npm run lint`、`npm run build`、`npm run test:unit`
（8 files / 65 tests）、`npm run test:corpus`（4 / 23）、`npm run test:security`（9 / 65）、
`npm run test:integration`（2 / 27）和 `npm run test:e2e`（1 / 14），均退出码 `0`。

从准确 tarball 新建隔离安装实际新增 `169 packages`，安装后的包名/版本为
`@hugo-ddt/agentglass@0.8.0`，入口 `extensions/agentglass.ts` 存在，随包 README 含
新 npm 包名和 Pi 已知限制，`tests` 未进入制品；断言退出码 `0`。此前性能证据对应的
运行时代码未改变，本次 scope 改名不改变实现路径；新包身份的上传和 registry fresh-install
仍待发布权限。当前仍为 `RELEASE_READY=PASS`（工程候选），不是已上线状态；远端 CI 与
Human Validation 仍为 `NOT_RUN`。

## 39. Pi 原生 Quick start 复验（2026-09-14）

用户要求按 Pi 官方包管理方式简化安装。参考
`https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/packages.md`，
中英文 README 的 Quick start 现在均只保留：

```text
pi install npm:@hugo-ddt/agentglass@0.8.0
```

删除了新手主流程中的手动 `npm install --prefix`、已安装目录拼接和本地 `.tgz` 下载步骤；
Pi 会负责安装并注册 `package.json` 中的扩展，并保留 `@0.8.0` 版本锁定。

README 变化属于随包内容，因此使用干净隔离目录重新打包和安装验证。准确制品如下：

| 项目 | 实际值 |
|---|---|
| package | `@hugo-ddt/agentglass@0.8.0`、MIT |
| 制品 | `G:\\work\\AgentGlass\\artifacts\\hugo-ddt-agentglass-0.8.0.tgz` |
| SHA-256 | `4A1F82A62F4F20236960B41C5CDAF1EB98B240CA9BA35E8780DDB2FD3F017902` |
| 包体 | `289,171` compressed bytes；`665,758` unpacked bytes；`49` entries；npm shasum `862b2770242a7d34050f88ad3c2742482b83096e` |

隔离安装新增 `169 packages`，断言实际安装目录为
`node_modules\\@hugo-ddt\\agentglass`，包名/版本、`extensions/agentglass.ts`、双语 Quick start
均正确，`tests` 不存在；断言退出码 `0`。本次只改变 README，未重新执行运行时代码测试；
前一节 scope 改名候选的 typecheck/lint/build/unit/corpus/security/integration/e2e 均已通过。
当前准确制品尚未上传 npm，等待用户确认后再发布；远端 CI 与 Human Validation 仍为
`NOT_RUN`。

## 40. 官方 npm 发布完成与 registry fresh-install smoke（2026-09-14）

用户确认发布改名后的准确制品。官方 npm publish 实际返回成功：

```text
+ @hugo-ddt/agentglass@0.8.0
```

发布命令使用官方 registry 和固定制品：

```text
npm publish G:\\work\\AgentGlass\\artifacts\\hugo-ddt-agentglass-0.8.0.tgz --access public --registry https://registry.npmjs.org
```

| 项目 | 实际值 |
|---|---|
| package | `@hugo-ddt/agentglass@0.8.0` |
| dist-tag | `latest` |
| 制品 SHA-256 | `4A1F82A62F4F20236960B41C5CDAF1EB98B240CA9BA35E8780DDB2FD3F017902` |
| npm shasum | `862b2770242a7d34050f88ad3c2742482b83096e` |

发布后使用官方 registry 新建隔离目录执行：

```text
npm install @hugo-ddt/agentglass@0.8.0 --prefix C:\\Users\\17860\\AppData\\Local\\Temp\\agentglass-registry-install-20260914 --omit=dev --no-save --ignore-scripts --registry https://registry.npmjs.org
```

实际新增 `169 packages`。安装断言退出码 `0`：包名/版本正确，
`node_modules\\@hugo-ddt\\agentglass\\extensions\\agentglass.ts` 存在，英文和中文 README
都使用 `pi install npm:@hugo-ddt/agentglass@0.8.0`，`tests` 不存在。至此 Release 的工程
候选与官方 npm 可安装性均有实际证据；远端 CI 与 Human Validation 仍为 `NOT_RUN`。

## 41. Pi Web W-001 真实合约证据（2026-09-14）

本节回填 W-001 实际证据。它不打开 AgentGlass RPC 审批，不代表公开 Pi Web 已兼容；下方 41.1～41.4 是进入 W-002 前的基线记录，W-002 完成后的当前证据见 §41.5。首版 AgentGlass 发布事实保留在 §40，不能用历史 Release PASS 替代本节宿主证据。

### 41.1 锁定制品、源码与环境

| 项目 | 实际值 |
|---|---|
| AgentGlass HEAD / cwd | `21a5295df8508ae4a683e43f8f458b042a3ff667` / `G:\work\AgentGlass` |
| Pi Web registry | `@agegr/pi-web@0.9.1`，registry `gitHead=553f2d774c37a976dd94f44e34ced24674829295` |
| registry metadata | `https://registry.npmjs.org/@agegr%2fpi-web/0.9.1`；tarball `https://registry.npmjs.org/@agegr/pi-web/-/pi-web-0.9.1.tgz`；integrity `sha512-b+oOwgH8eEr/0iLjYcCYwyddJO2OgbNDKGgyYIDQhEN6s5gIdo1OAkl6Q+0BwpPIaQ8WWtpusb9g7wMvhTFT0w==` |
| tarball | `C:\Users\17860\AppData\Local\Temp\agentglass-w001-piweb-20260914\registry\agegr-pi-web-0.9.1.tgz`；6052582 bytes；SHA-256 `E4063F4ACC10C098D91A2F3399538B5A938F9975595384A89C75AD61E2BE2CD7` |
| source checkout | `C:\Users\17860\AppData\Local\Temp\agentglass-w001-piweb-20260914`，detached `553f2d774c37a976dd94f44e34ced24674829295` |
| source lockfile | `package-lock.json` SHA-256 `D50CB30172A9A0369540ED490ED3F45D2CA77C8785AD852C7D20F03A5099F4F2` |
| Pi dependencies | `@earendil-works/pi-agent-core`, `pi-ai`, `pi-coding-agent`, `pi-tui` all `0.85.1` |
| source/package discrepancy | registry package is `0.9.1`; locked source checkout `package.json` is `0.9.0`; both resolve to the same recorded gitHead and must not be conflated |
| machine | Windows 11 Home Chinese `10.0.26200`; Node `v24.14.0`; npm `11.9.0`; Chrome `152.0.7977.83`; Edge `153.0.4234.32` |

The checkout was created outside the AgentGlass repository. `npm ci` completed with exit code 0 and installed 931 packages. The only test convenience change was a temporary one-line `e2e/run.mjs` `PW_EXECUTABLE_PATH` override to use the installed Chrome after the Playwright browser download timed out; it was restored semantically before completion. `next dev` briefly appended its documented generated block to `AGENTS.md`; that generated content was removed after the run. The checkout may still report line-ending-only modifications (`git diff --ignore-space-at-eol` is empty); no AgentGlass source, lockfile, user configuration or public upstream commit was changed. The checkout still contains the downloaded registry tarball as an untracked evidence artifact; its path and hash above are the reproducibility record.

### 41.2 Observed real host behavior

| Area | Actual evidence | Result |
|---|---|---|
| Pi extension loading/trust | `startRpcSession` calls `bindExtensions(... mode: "rpc")`; project `.pi/extensions` is gated by Pi project trust; extension binding precedes prompt/get_state readiness | PASS for observed baseline; RPC approval remains unavailable in AgentGlass |
| UI and Stop flow | `rpc-manager-extension-ui.test.mjs` 8 tests; `rpc-manager-widgets.test.mjs` 11 tests; `rpc-manager-shutdown.test.mjs` included in 33-test targeted run | PASS |
| event/reconnect transport | `agent-event-connection.test.mjs`, `agent-event-stream.test.mjs`, `agent-event-wire.test.mjs`: 22 tests; observed 30 s SSE heartbeat, 60 s browser ready timeout, 1 s retry | PASS for transport behavior |
| tool/session/project behavior | `rpc-manager.test.mjs` 42 tests plus project-trust/browser-notifications/shutdown targeted run (33 total) | PASS for observed wrapper behavior |
| real loopback browser | `PW_EXECUTABLE_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe NEXT_TELEMETRY_DISABLED=1 npm run test:e2e`: final exit 0; 7 PASS scenarios across 1280px and 390px, including slash-command extension dialogs, default focus/keyboard navigation, Esc cancel, Stop visibility, server expiry, session fixtures, reload/reconnect and routing | PASS |
| terminal script | `npm run test:terminal`: exit 1 because the isolated checkout lacked Playwright `chromium_headless_shell`; this direct terminal channel is outside AgentGlass protection and was not used as approval evidence | NOT_RUN for AgentGlass |
| deterministic model-driven real host | `node C:\Users\17860\AppData\Local\Temp\agentglass-w001-deterministic-driver-20260914.mjs`: exit 0；本机回环 OpenAI-compatible 假模型返回固定 tool call/text，真实 Pi agent loop 加载隔离扩展并触发 `setStatus`/`setWidget`/`select`/`custom`；两个 SSE listener 收到同一 pending request ID，当前宿主接受非 owner response | PASS for deterministic real-host scope; paid/live model streaming NOT_RUN |

The source package has no `typecheck` npm script (`npm run typecheck` exit 1, missing script); the upstream AGENTS command `node_modules/.bin/tsc --noEmit` exited 0. `npm run lint` exited 0. The deterministic real-host driver exited 0; it used only a local synthetic provider response and no paid/live model credentials. The full upstream `npm test` exited 1 with 1,020 tests / 1,003 pass / 15 fail / 2 skip; the failures were in extension/file-viewer source assertions, browser-hook source assertions, Windows WSL/PATH bash environment and native PTY lifecycle, not in the W-001 targeted RPC/UI/SSE/trust tests. `npm run build` was not run because upstream AGENTS forbids `next build` in the dev checkout and W-001 did not modify production code. The first browser attempt hit an upstream history-offset assertion; the identical isolated run was repeated and passed all seven scenarios. These outcomes are recorded separately; no transient first-run failure is hidden.

### 41.3 Frozen contract and known gaps

Architecture §12 now freezes `agentglass.pi-web.approval` capability version 1, the `connected` capability envelope, server-owned `connectionId`/`connectionGeneration`, per-request `requestGeneration`/`renderRevision`, `extension_ui_presented`/`extension_ui_render_failed`, owner-only response/input, fixed lifecycle error codes, a 10 s render acknowledgement limit, a 600 s approval limit, one pending request/eight live leases/64 KiB event bounds, and the existing 30 s/60 s/1 s transport limits. W-002 must implement and test this exact interface.

The real host baseline lacked those safety fields: new SSE listeners received replayed pending UI, POST responses had no connection ownership, and custom render failures could be returned as raw lines. Current `rpc+hasUI`, environment variables, method existence, ordinary RPC/print/json and the protocol label were therefore not approval evidence. The minimum W-002 acceptance matrix was recorded in architecture §12.4 and is now implemented only by the local patch documented in §41.5; AgentGlass still keeps the existing RPC `canPromptForApproval=no` guard until W-003 explicitly integrates it.

Status after W-001 (historical baseline): W-001 `PASS`; W-002～W-005 `NOT_STARTED`; AgentGlass production adapter changes `NOT_RUN`; AgentGlass full regression suites `NOT_RUN` because no AgentGlass executable code changed. Current W-002 local-patch status is recorded in §41.5; W-003～W-005 的当前实际状态以 §41.6 及后续证据为准，不再沿用本段的历史 `NOT_STARTED` 标签。Per the user's 2026-09-14 correction, upstream public patch/PR/release, remote CI, Edge/Node 22 matrix and Human Validation are `USER_CONFIRMED_COMPLETE`; their auditable artifacts, CI run identifiers, release links and participant records are not yet included in this section, so this label is not an engineering `PASS` or a fabricated Human Validation metric. No raw tool input, secret, token, full transcript, or snapshot body is stored in this evidence.

### 41.4 W-002 入口审查与 W-001 契约补充（2026-09-14）

进入 W-002 前的只读审查发现，原 §12 已列出能力字段，却没有把握手顺序、owner 选举、代次/过期和错误 body 写成可直接实现的规则。该缺口已在 architecture §12 补齐，决定如下：

- `connected.agentglass` 是服务端能力握手；浏览器必须在同一 agent POST 路由发送 `extension_ui_handshake`，服务端成功返回固定结构并在握手前不发送 AgentGlass 阻塞请求。
- 每个 session 采用 first-valid-handshake owner；后续连接是 observer。owner 的 SSE abort、主动关闭、硬过期或 session 销毁会使 pending 请求失效，observer 不晋升，未来请求须由新 SSE 重新握手。
- `connectionGeneration`/`requestGeneration`/`renderRevision` 的起点、递增、重启失效和不回绕规则已固定；AgentGlass connection lease 为 600 s 硬期限，不使用无 connection ID 的 Pi session liveness `/lease` 续期。
- 固定错误统一为 `{ "error": { "code": "..." } }`，增加 `AGENTGLASS_MALFORMED`（400）与 `AGENTGLASS_UNAVAILABLE`（503）；浏览器按 code 映射安全文案，不接收异常正文。
- `presented` 仅是受信 Pi Web 桥接的当前 revision 呈现确认，不宣称能隔离同源恶意脚本、同权限本机攻击或恶意共存扩展；现有 Origin/Host/Fetch Metadata/password 访问控制必须保持。

本补充只修改被忽略的规范/证据文档，没有修改 AgentGlass 源码、Pi Web checkout、测试、lockfile、`.gitignore` 或用户配置；在该入口审查时 W-002 实现、真实 bridge fault matrix 和 AgentGlass 回归仍为 `NOT_RUN`，后续实际实现记录见 §41.5。审查命令为规范文本 `rg` 交叉核对、`git status --short`、`git rev-parse HEAD` 与 `git diff --check`；本补充未重新执行运行时测试。

### 41.5 W-002 Pi Web 审批通道补齐（2026-09-14）

本节是 W-002 的实际完成记录。范围严格限定为 W-001 锁定的 Pi Web 本地 detached checkout；AgentGlass 仓库没有新增运行时代码、产品入口、配置开关、服务或端口。结果是本地联调范围的 `PASS`，不表示上游合入、不表示公开 `@agegr/pi-web@0.9.1` 兼容，也不启动 W-003。

#### 41.5.1 基线、差异与环境

| 项目 | 实际值 |
|---|---|
| Pi Web checkout | `C:\Users\17860\AppData\Local\Temp\agentglass-w001-piweb-20260914` |
| 基线 | detached `553f2d774c37a976dd94f44e34ced24674829295`；源码 `package.json` `0.9.0`；Pi 依赖 `0.85.1` |
| registry 对照 | `@agegr/pi-web@0.9.1`，gitHead 同上；tarball SHA-256 `E4063F4ACC10C098D91A2F3399538B5A938F9975595384A89C75AD61E2BE2CD7` |
| lockfile | `package-lock.json` SHA-256 `D50CB30172A9A0369540ED490ED3F45D2CA77C8785AD852C7D20F03A5099F4F2` |
| 工作树 | 保留原有 `AGENTS.md`/`e2e/run.mjs` 行尾差异与 `registry/` 未跟踪 tarball；W-002 改动未覆盖它们；无 commit/push/PR/tag/发布 |
| 环境 | Windows 11 Home Chinese `10.0.26200`、Node `v24.14.0`、npm `11.9.0`、Chrome `152.0.7977.83`、Edge `153.0.4234.32` |

W-002 新增/修改的 Pi Web 文件为：`app/api/agent/[id]/route.ts`、`components/ChatWindow.extension-request.test.mjs`、`components/ChatWindow.tsx`、`e2e/extension-dialog.mjs`、`hooks/useAgentSession.ts`、`lib/agent-client.ts`、`lib/agent-event-connection.test.mjs`、`lib/agent-event-connection.ts`、`lib/agent-event-stream.test.mjs`、`lib/agent-event-stream.ts`、`lib/rpc-manager.ts`、`lib/types.ts`、`lib/agentglass-channel.ts` 和 `lib/agentglass-channel.test.mjs`。临时 `PW_EXECUTABLE_PATH` 仅用于本机 E2E 选择已安装 Chrome，测试后已恢复 `e2e/run.mjs`；没有把它作为产品配置或补丁能力。

#### 41.5.2 实现与安全合约结果

| W-002 Done Definition | 实际结果 |
|---|---|
| 1. 现有桥接最小补丁 | `PASS`：复用现有 SSE `/api/agent/{id}/events`、POST `/api/agent/{id}` 和 extension UI bridge；无 AgentGlass 网页、服务、端口、运行时依赖或配置开关 |
| 2. capability/owner/生命周期 | `PASS`：版本 1 capability、session/connection/generation、request generation、render revision、first-valid owner、observer 不晋升、单 owner；close/cancel/Stop/切换/reload/shutdown/timeout/SSE abort 使 pending 失效，重连不恢复旧批准 |
| 3. render gate/固定安全错误 | `PASS`：只在可见并完成 presented 后接收；危险信息隐藏、未 presented、卸载、render failure、超限事件均 fail closed；固定 `AGENTGLASS_*` 错误，不返回异常正文 |
| 4. 同步复核/有界状态 | `PASS`：迟到、重复、跨 session、跨 connection、旧/未来 generation、旧 revision、未 presented 均拒绝；单 pending、8 connections、64 KiB event 有界；状态只在内存，无 approval/log body 持久化，不自动重试/撤回已执行效果 |
| 5. 测试与真实 bridge | `PASS`：类型、lint、112 项适用 Node 测试及真实 Chrome loopback 通过；复审修复覆盖连接租约主动失效、折叠/卸载撤销、Stop 初始焦点和不完整卡片；完整上游测试单独为基线失败，不隐藏；发布 build 未运行 |
| 6. 本地补丁边界 | `PASS`：仅 detached checkout，未合入、未发布、未提交上游变更；公开原版 0.9.1 兼容性 `NOT_RUN` |

安全映射：`INV-003/007/008/012/019` 由 capability、owner、request/revision、presented、single-use、断线/取消/超时合约覆盖；`INV-005/010/016/017` 由固定错误、卡片呈现 gate、事件上限和不输出 raw/secret/token/transcript/snapshot 合约覆盖；`INV-009/011/018/020` 的宿主边界和恶意共存扩展限制保持不变。`INV-001/002/004/006/013/014` 的完整 AgentGlass 风险/恢复/真人/工具身份闭环在 W-003 已按本地/真实 Edge 范围完成，W-004～W-005 的更宽验收仍为 `NOT_RUN`，没有被本地 Pi Web PASS 替代。

#### 41.5.3 实际命令与结果

在 checkout `C:\Users\17860\AppData\Local\Temp\agentglass-w001-piweb-20260914` 执行：

```text
node_modules\.bin\tsc --noEmit                         # exit 0
npm run lint                                             # exit 0
node --experimental-strip-types --test lib/agentglass-channel.test.mjs lib/agent-event-connection.test.mjs lib/agent-event-stream.test.mjs lib/agent-event-wire.test.mjs lib/rpc-manager-extension-ui.test.mjs lib/rpc-manager-widgets.test.mjs lib/rpc-manager.test.mjs lib/rpc-manager-shutdown.test.mjs lib/project-trust.test.mjs lib/browser-notifications.test.mjs components/ChatWindow.extension-request.test.mjs  # 112/112 PASS
$env:PW_EXECUTABLE_PATH='C:\Program Files\Google\Chrome\Application\chrome.exe'; $env:NEXT_TELEMETRY_DISABLED='1'; npm run test:e2e  # exit 0; 7/7 PASS
npm test                                                # exit 1; 1028 total / 1011 pass / 15 fail / 2 skip
```

适用 112 项测试包含有效握手/owner/observer、迟到/重复/跨连接/跨会话/未来版本、未呈现、渲染失败、owner 首渲染前断线、连接租约到期、折叠/卸载撤销、Stop/cancel/shutdown、revision、8 连接/单 pending/64 KiB 上限、SSE capability fail-closed 以及既有 Pi Web RPC/UI/SSE/trust 回归。真实 Chrome 7 个场景覆盖 1280px 与 390px 的 UI keyboard/取消/Stop/折叠撤销/服务器超时、session/reload/reconnect/route，并额外断言真实 handshake、presented 和带 request binding 的 response。真实 bridge 结果与 mock/合约测试分开记录。

完整 `npm test` 本轮复审未重跑；此前 W-002 基线为 1028 total / 1011 pass / 15 fail / 2 skip，失败为既有 extension/file-viewer/browser-hook 源码断言、Windows WSL/PATH bash 环境和 native PTY lifecycle，且不在上述 112 项适用 W-002 gate。`npm run build`、`npm run test:terminal`、AgentGlass 的 `npm run typecheck`/`lint`/`build`/`test:unit`/`test:corpus`/`test:security`/`test:integration`/`test:e2e` 均按上游-only/普通开发边界 `NOT_RUN`；没有把它们写成 PASS。Human Validation、远端 CI、公开上游合入/发布均为 `NOT_RUN`。证据未保存 raw tool input、秘密、授权 token、完整 transcript 或 snapshot 正文。
### 41.6 W-003 AgentGlass 完整接入（2026-09-14）

本节记录本轮唯一分配的 W-003。W-002 先经实际证据核验为 `PASS`：使用锁定的 Pi Web detached checkout、`agentglass.pi-web.approval` v1 契约、适用 Node 合约测试和真实 Chrome loopback E2E；补丁仍未合入或发布。W-003 将该契约接入 AgentGlass 的 Pi adapter，未把普通 RPC、print/json 或未知客户端变成审批通道，并在同一锁定组合完成真实 Edge 7/7 文件闭环。W-003 总状态为 `PASS`，但不改变公开 Pi Web 0.9.1 兼容性，也不替代 W-004 的更宽浏览器安全矩阵。

#### 41.6.1 基线、范围与差异

| 项目 | 实际值 |
|---|---|
| AgentGlass HEAD | `e1e7abf1e3a5eef28d5c23e51e58ba82955a508d`；初始工作树 clean；当前有 W-003 的 3 个代码/测试文件差异，另有未跟踪 `%SystemDrive%/` 外来目录已只读保留、未纳入本项 |
| AgentGlass 修改 | `src/adapter/pi/adapter.ts`、`tests/integration/pi-adapter.test.ts`、`tests/e2e/pi-dispatch.test.ts` |
| Pi Web checkout | `C:\Users\17860\AppData\Local\Temp\agentglass-w001-piweb-20260914`；detached `553f2d774c37a976dd94f44e34ced24674829295` |
| Pi Web W-003 上游差异 | 在 W-002 工作树之上增加/修改 `lib/agentglass-channel.ts`、`lib/agentglass-channel.test.mjs`、`lib/pi-types.ts`、`lib/rpc-manager.ts`、`lib/rpc-manager-extension-ui.test.mjs`，并在 `components/ChatWindow.tsx` 增加自定义卡片 Enter 正常完成的卸载边界标记；未 commit/push/PR/tag/合入/发布 |
| 依赖与制品 | Pi Web 源码 `package.json` `0.9.0`、Pi `0.85.1`；锁定 `package-lock.json` SHA-256 `D50CB30172A9A0369540ED490ED3F45D2CA77C8785AD852C7D20F03A5099F4F2`；AgentGlass `dist/extensions/agentglass.js` SHA-256 `4DFFE07C319ECC58BAC9441083059418B85FAD0B8F4AC9FB82EC4F4977448FBE`，编译 adapter `dist/src/adapter/pi/adapter.js` SHA-256 `C2043214B24DDC2D04F67C0133842DCFEC98898B24385C8B5FC22A8CB939029E` |
| 外部状态 | 保留上游原有 `AGENTS.md`/`e2e/run.mjs` 行尾差异和 `registry/` 未跟踪内容；未覆盖或清理用户已有修改 |
| 运行边界 | 仅 Windows 本机回环；未增加 AgentGlass 服务、端口、主动网络、运行时依赖、账户、配置开关、事件存储或恢复历史 |

W-003 的最小 bridge 在 Pi Web 的 extension UI context 暴露精确 `agentglassApproval`：能力标识 `agentglass.pi-web.approval`、版本 `1` 和动态 `isAvailable()`。adapter 同时检查 `rpc`、`hasUI`、取消状态及精确 bridge；只有当前服务端 session 存在已握手、未过期的 owner connection 才可用。该门是附加检查，未替代既有五项精确绑定、target/pre-image、请求代次、呈现确认、异步后的同步复核或单次消费。断线/到期/owner 失效返回 false；重连不恢复旧授权。

#### 41.6.2 W-003 Done Definition 与测试结果

| Done Definition | 实际结果 |
|---|---|
| 1. adapter 统一最小合格通道、Core 保持宿主无关 | `PASS`（代码审查与测试）：全部相关 mode/hasUI/UI 调用者统一到精确动态 bridge；普通 RPC/print/json 仍拒绝；未增加用户开关或 Core 宿主依赖 |
| 2. 完整既有功能、卡片与 TUI | `PASS`（确定性 Pi 调度范围）：帮助、固定示例、read/write/edit、同 actionId 结果、核验、最近结果、恢复、独立清理及 Stop/详情语义均有路径覆盖；TUI 回归通过 |
| 3. 既有 binding、target/pre-image、单次消费与连接/request 附加失效 | `PASS`（自动化）：合格 Web、普通 RPC、未来能力、失效连接、输入/目标漂移、内部变更以及 example/restore/cleanup 最后异步检查后的失效均有正例/邻近反例/故障检查；失败关闭 |
| 4. 重连只读当前安全结果、操作新审批 | `PASS`（代码/确定性范围）：旧授权不重建；session/cwd/reload/shutdown 与 agent_end 的既有入口规则未旁路；恢复/清理仍单独请求 |
| 5. 中文注释、全工程 gate、锁定 Pi/Pi Web 组合与 TUI | `PASS`（工程、上游适用检查与真实 Edge 组合）：见 41.6.3～41.6.4；上游完整 `npm test` 的既有失败单独保留 |
| 6. 浏览器入口/示例/恢复缺失不能称完整，不用 shell 绕过 | `PASS`：隔离 Edge 回环会话完成 `/agentglass help`、`example`、真实 Pi `write`、`read`、`edit`、`restore`、`cleanup` 共 7/7；浏览器 UI 显示审批/结果，文件由隔离目录独立读取核对，清理后恢复目录剩余文件为 0；未用 shell 代替审批、全局配置或真实秘密 |

因此 W-003 当前为 `PASS`。真实 Edge 证据与 mock/合约、确定性 Pi 调度、W-002 Chrome bridge 分开记录；W-004 的真实浏览器与安全故障矩阵仍为 `NOT_STARTED`。

#### 41.6.3 实际命令、环境与分母

在 `G:\work\AgentGlass`（Node `v24.14.0`、npm `11.9.0`、Windows 11 `10.0.26200`）执行：

```text
npm run typecheck    # exit 0
npm run lint         # exit 0
npm run build        # exit 0
npm run test:unit    # 8 files / 65 tests PASS
npm run test:corpus  # 4 files / 23 tests PASS
npm run test:security # 9 files / 65 tests PASS
npm run test:integration # 2 files / 32 tests PASS
npm run test:e2e     # 1 file / 15 tests PASS
```

在锁定 Pi Web checkout 执行：

```text
node_modules\.bin\tsc --noEmit  # exit 0
npm run lint                     # exit 0
node --experimental-strip-types --test lib/agentglass-channel.test.mjs lib/rpc-manager-extension-ui.test.mjs lib/terminal-input.test.mjs  # 21 / 21 PASS
npm run build                    # exit 0；保留既有 app/api/sessions/[id]/export/route.ts critical-dependency warning
npm test                         # exit 1；本轮尝试在既有 native PTY lifecycle 阻塞处中断；W-002 基线为 1028 total / 1011 pass / 15 fail / 2 skip
```

AgentGlass 的 15 项确定性 E2E 中，新增 W-003 场景完成 qualified Pi Web RPC 的帮助、示例、实际 Pi dispatch 文件修改、核验反馈、恢复和清理；另有普通 RPC 拒绝与连接失效 fail-closed 场景。该测试使用真实锁定 Pi SDK/扩展 dispatch 与确定性 UI context，不等同于浏览器操作。Pi Web W-003 新增的 bridge/extension UI 测试均为非空正例、邻近负例和断线故障；W-002 的 112 项适用测试与 7/7 Chrome loopback E2E 继续作为上游合约证据，真实 Edge 证据另列如下。

本轮真实浏览器使用隔离目录 `C:\Users\17860\AppData\Local\Temp\agentglass-w003-browser-20260914`、Edge `153.0.4234.32`、Node `v24.14.0`、本机 `127.0.0.1:30143`、Pi Web 源码 `0.9.0`/Pi `0.85.1` 和编译后的 AgentGlass extension；确定性模型只监听本机 `127.0.0.1:30144`，没有改动全局配置或写入真实秘密。真实浏览器场景结果与完整 UI 细节见 41.6.4。

安全映射：`INV-003/007/008/012/019` 由动态 capability、owner/connection 和 request 失效/同步消费回归覆盖；`INV-004/009/019` 由确定性与真实 Edge 执行、核验、恢复、冲突和清理路径覆盖；`INV-005/010/016/017` 由中文卡片、固定错误、普通 RPC 负例及无 raw/secret/token/snapshot 正文的测试覆盖；`INV-002/013/015/018/020` 由 Pi 工具身份、路径、sibling 与 Core/adapter 边界回归保持。W-004 的更宽浏览器故障矩阵、真人 Human Validation、远端 CI、公开上游发布和跨平台仍为 `NOT_RUN`；未保存 raw tool input、秘密、授权 token、完整 transcript 或 snapshot 正文。

#### 41.6.4 真实 Edge 浏览器闭环与评审

环境固定为 Windows 11 `10.0.26200`、Edge `153.0.4234.32`、Node `v24.14.0`、Pi Web 源码 `0.9.0`/Pi `0.85.1`、AgentGlass 编译入口 `dist/extensions/agentglass.js`，Pi Web dev server 使用本机回环 `127.0.0.1:30143`，确定性 OpenAI-compatible 模型仅使用隔离回环 `127.0.0.1:30144`。隔离工作目录为 `C:\Users\17860\AppData\Local\Temp\agentglass-w003-browser-20260914`；项目可信状态通过页面显式确认，未使用真实用户配置、真实模型凭据、shell 代替审批或自动重试。

真实浏览器 UI 与隔离文件断言的场景分母为 7，结果为 7/7：

| 场景 | 浏览器可见证据 | 独立结果断言 | 状态 |
|---|---|---|---|
| `/agentglass help` | 中文帮助卡片显示支持范围、Stop 默认和详情不授权 | 面板正常关闭，发送恢复可用 | PASS |
| `/agentglass example` | 固定示例审批卡；Stop 初始焦点，Continue 才确认 | `agentglass-example/活动说明.txt` 存在，186 bytes | PASS |
| 真实 Pi `write` | custom 审批卡与 `write browser-w003.txt` 工具条目 | 文件创建，19 bytes | PASS |
| 真实 Pi `read` | Pi 处理详情显示 `read browser-w003.txt` | 独立读取内容与预期原文一致 | PASS |
| 真实 Pi `edit` | custom 审批卡、`edit browser-w003.txt` 和执行后结果组件 | 文件变为 22 bytes，结果组件显示文件与卡片后置条件一致 | PASS |
| `/agentglass restore` | 独立恢复审批卡，说明单次消费与冲突检查 | 文件恢复到修改前 19 bytes，结果组件显示内容/存在状态/权限匹配 | PASS |
| `/agentglass cleanup` | 单独清理审批卡，显示 3 个已验证私有文件及字节数 | 清理结果显示 3 个成功、0 个失败；`.agentglass` 恢复目录剩余文件为 0 | PASS |

每个变更/清理审批卡均以 Stop 为当前选项；详情步骤没有批准效果，实际执行均通过键盘移动到 Continue 后再提交。edit 后展开的 `agentglass-action` 显示“已确认”、工具状态、独立文件核对和仍未知的实际需求/程序功能；restore 显示内容/存在状态/权限核对；cleanup 显示实际删除数。浏览器页面重载后仍显示当前安全结果/清理结果；没有恢复旧授权。W-004 的窄视口、断线/重连竞争、跨会话、多标签、迟到/重复、超时、漂移、敏感/链接/未知工具、配额/冲突故障矩阵不由本次 7/7 代替。

闭环首轮曾观察到 Pi Web custom 面板在正常 Enter 后被卸载清理误报为 render failure，导致该次审批失效；评审定位到宿主 UI 的正常完成边界，在锁定 checkout 的 `components/ChatWindow.tsx` 增加 Enter 标记后重载并重跑。上游适用测试与 build 均退出 `0`；浏览器开发日志 API 保留早期失效输入记录且不提供过程清除，因此不把其当作清洁日志或成功依据，最终 7/7 以修正后的可见 UI、Pi tool dispatch 和隔离目录断言为准。

本节未保存 raw tool input、秘密、授权 token、完整 transcript、浏览器 snapshot 正文或恢复副本正文。该证据是锁定本机补丁组合的工程联调，不是公开 Pi Web 0.9.1 兼容发布证据，也不是 Human Validation。

#### 41.6.5 W-004 前审查与最小修补（2026-09-14）

W-004 启动前的源码审查发现：普通工具路径已有动态 bridge 的最终同步复核，但 `example`、`restore`、`cleanup` 在审批返回后还会执行异步目录/恢复证据检查，随后直接消费 token；若连接在该窗口失效，原有五项 binding 仍可能相同，因而必须补上同一 fail-closed 门。审查还发现帮助面板和命令菜单在异步准备后需要在真正发送 UI 前再次确认当前合格通道。修补集中在 `src/adapter/pi/adapter.ts` 的 `approvalChannelStillValid` 共用 gate、帮助/菜单发送前检查，并在 `tests/integration/pi-adapter.test.ts:910`、`:938`、`:980` 增加三条独立连接失效回归；没有新增宿主抽象、服务、端口、依赖或配置开关。

修补后的 AgentGlass 工程 gate 为：`npm run typecheck`、`npm run lint`、`npm run build` 均 exit `0`；`test:unit` 8 files/65 tests、`test:corpus` 4 files/23 tests、`test:security` 9 files/65 tests、`test:integration` 2 files/32 tests、`test:e2e` 1 file/15 tests 全部 PASS。W-002 锁定 Pi Web checkout 的基线、detached HEAD、lockfile 与上游修改保持 41.5/41.6.1 记录不变；没有重新把上游完整 `npm test` 的历史失败写成 PASS。

修补后重新执行真实 Edge/Pi Web 回环闭环，场景分母为 7，结果 7/7 PASS。环境为 Windows 11 `10.0.26200`、Edge `153.0.4234.32`、Node `v24.14.0`、Pi Web 源码 `0.9.0`/Pi `0.85.1`，服务端仅监听 `127.0.0.1:30143`，确定性模型仅监听 `127.0.0.1:30144`；新鲜隔离目录为 `C:\Users\17860\AppData\Local\Temp\agentglass-w004-preflight-20260914`，只复制 AgentGlass extension 入口，不使用真实用户配置或秘密。`help` 显示中文支持/安全边界且正常关闭；`example` 通过 Stop 初始焦点后移动到 Continue 创建固定示例；真实 Pi `write`/`read`/`edit` 完成文件操作与 edit 后结果反馈；`restore` 以独立审批完成内容、存在状态和权限匹配；`cleanup` 以独立审批报告 `3` 个已删除、`0` 个失败。隔离目录独立核对：`browser-w003.txt` 存在且恢复后为 `19` bytes，示例文件为 `186` bytes，cleanup 后 `.agentglass` snapshot 目录不存在/剩余文件 `0`。没有通过 shell 代替审批、自动重试或保存 raw tool input、完整 transcript、snapshot 正文；浏览器开发日志包含先前失败尝试的累计记录，故不称为清洁日志。

该审查修补不启动 W-004；W-004 仍为 `NOT_STARTED`，其窄视口、Chrome/Node 22 组合、断线/多标签/跨会话/迟到重复/超时/漂移和敏感/配额/恢复冲突故障矩阵仍未运行。该真实 Edge 证据只证明锁定本地补丁组合的当前闭环，不表示公开 Pi Web `0.9.1` 兼容或发布，也不是 Human Validation。

### 41.7 W-004 安全与浏览器验收（2026-09-15，中间失败记录）

本节记录 W-004 中间失败的首次矩阵尝试，最终状态由 §41.8 覆盖。先复核 W-003 的实际前置条件：AgentGlass 仓库 `G:\work\AgentGlass` 的 HEAD 为 `814827da5df45d4b48dbadc24ddcc7913fa105b7`，工作树在执行前后均无 tracked/untracked 差异；W-003 的 3 个集成文件差异、锁定 Pi Web detached checkout、真实 Edge 文件闭环和评审均与 41.6 记录一致。因此没有把 W-004 当作 W-003 的替代开发。

#### 41.7.1 固定组合、制品和隔离边界

| 项目 | 实际值 |
|---|---|
| AgentGlass | `@hugo-ddt/agentglass@0.8.0`；HEAD `814827da5df45d4b48dbadc24ddcc7913fa105b7`；`package-lock.json` SHA-256 `4AEE1267BFE65905203F9A37A979AADE74A9BD9AE19CC91874BCFEF568F67F99`；`dist/extensions/agentglass.js` SHA-256 `4DFFE07C319ECC58BAC9441083059418B85FAD0B8F4AC9FB82EC4F4977448FBE` |
| Pi Web checkout | `C:\Users\17860\AppData\Local\Temp\agentglass-w001-piweb-20260914`；detached HEAD `553f2d774c37a976dd94f44e34ced24674829295`；源码 package `0.9.0`，锁定 host footer `web 0.9.0 / pi 0.85.1`，目标发布包基线 `@agegr/pi-web@0.9.1`；`package-lock.json` SHA-256 `D50CB30172A9A0369540ED490ED3F45D2CA77C8785AD852C7D20F03A5099F4F2` |
| Windows / Node | Windows build `10.0.26200`；Node `v22.19.0` 与 `v24.14.0` 均使用隔离路径，未修改全局 PATH、配置或用户会话 |
| Browser | Edge `153.0.4234.32`；Chrome `152.0.7977.83` |
| 服务与模型 | Pi Web 和合成模型仅绑定 `127.0.0.1` 的隔离端口；每次运行新建隔离 `agentDir`、project cwd、`.agentglass/snapshots` 恢复目录和浏览器 profile；模型只返回合成 read/write/edit/bash 工具调用，不使用真实密钥 |

Pi Web checkout 沿用 W-002/W-003 的已有修改，另为本任务在 `hooks/useAgentSession.ts` 增加同一 request id 的 `renderRevision` 去重和关闭终态门，在 `components/ChatWindow.extension-request.test.mjs` 增加对应静态回归。该 checkout 未 commit/push/PR/tag/发布；AgentGlass 仓库没有新增运行时代码或依赖。注释只说明浏览器内存态的安全意图，不持久化 raw input、token、transcript 或 snapshot 正文。

#### 41.7.2 自动化与上游检查

- Pi Web checkout：`node_modules\\.bin\\tsc --noEmit` exit `0`；`npm run lint` exit `0`；`npm run build` exit `0`，保留既有 `app/api/sessions/[id]/export/route.ts` dynamic dependency warning。
- Pi Web 适用 bridge/UI 集合：`node --experimental-strip-types --test components/ChatWindow.extension-request.test.mjs lib/agentglass-channel.test.mjs lib/rpc-manager-extension-ui.test.mjs lib/terminal-input.test.mjs`，27/27 PASS，包含新增迟到旧 revision/关闭终态回归。
- Pi Web 完整 `npm test` 实际为 1034 tests：1017 pass、15 fail、2 skipped、0 todo，exit `1`。失败集中在既有静态源码断言、Windows/WSL bash/PATH 和 native PTY 环境边界；不把该结果写成 PASS，也不借用历史 1011/15/2 记录替代本轮实际结果。
- `npm run test:e2e` 实际在 API 部分通过后于浏览器启动前失败：隔离 checkout 缺少 Playwright bundled Chromium executable；未下载浏览器到用户全局目录，故该 upstream E2E 记为 `NOT_RUN/FAIL`，不能替代 Edge/Chrome 实测。

#### 41.7.3 真实浏览器结果

使用隔离临时脚本 `C:\Users\17860\AppData\Local\Temp\agentglass-w004-run-20260914\probe.mjs`，通过真实 `/api/agent/new` 创建 Pi RPC session，真实加载 project `.pi/extensions/agentglass.js`，真实连接浏览器页面；每个组合均独立读取 `agentglass-example/活动说明.txt`，实际长度 186 bytes。最小组合结果为 4/4 PASS：

| Node | Edge | Chrome |
|---|---|---|
| 22.19.0 | PASS：真实握手、中文卡片、Stop→详情→Continue 分步输入、Pi example dispatch、独立文件存在/字节断言 | PASS：同上 |
| 24.14.0 | PASS：同上 | PASS：同上 |

真实 Edge/Node 24 的扩展探针还顺序触达了 help、Stop/默认 Enter、Esc、详情不批准、普通 create/overwrite/edit/consecutive read、canary 文本卡片和 unsupported-tool 分支；实际安全矩阵脚本在窄视口及后续漂移/断线链路出现等待或失败后停止，未生成可接受的整体 JSON PASS。该事实只证明已观察到的真实路径，不把未完成场景折算入 4/4 最小组合。

Pi Web custom UI 的真实键盘输入必须等待每次 `extension_ui_input` 造成的下一版 `renderRevision`；快速连续发送旧 revision 会被服务端固定 409 拒绝，这是预期的失效保护。必要的浏览器侧终态去重修补已在 41.7.1 记录，但 W-004 脚本仍暴露以下未通过/未完成项目：

- 长中文标签/390px 窄视口：Edge/Node 24 真实探针在卡片等待阶段 timeout，记 `FAIL`，没有截图替代行为证据。
- target mismatch/unknown/disappearance：外部漂移注入后的完整 AgentGlass 结果没有稳定收敛到独立文件/授权断言，记 `FAIL/NOT_RUN`；不能声称 mismatch 或 unknown 已通过。
- disconnect/reconnect、page unload、same-session 多标签 owner、cross-session response、late/duplicate、timeout、reload/restart、执行前后断线：脚本曾包含这些分支，但本轮未获得完整、独立、可复核的场景分母和结果，记 `NOT_RUN`。
- sensitive/outside/link、sibling 缺失/多变更、backup/quota、recovery conflict、旧入口替换拒绝、partial cleanup、old/corrupt/future schema：已有 AgentGlass 确定性 corpus/安全测试继续 PASS，但本轮真实浏览器验收未完成，记 `NOT_RUN`，不以 mock/contract 替代。
- canary 只使用合成文本并检查了 AgentGlass dialog 无 `script` 子树；没有保存完整浏览器日志、raw tool input、秘密、token、transcript 或 snapshot 正文。Pi Web 自带 transcript/upload/terminal/Git/config 仍在 AgentGlass 承诺外。

#### 41.7.4 Done Definition 与安全映射

1. **FAIL/部分 PASS**：四个 Node/Edge/Chrome 最小组合真实闭环 PASS；完整 W-004 浏览器故障矩阵不完整。
2. **FAIL**：基本文件流和审批控制项已有真实观察，但窄视口、matched/mismatch/unknown、恢复/清理的完整浏览器证明缺失。
3. **NOT_RUN**：断线、竞争、跨会话、超时、重启和可能已执行不自动重试的完整独立分母缺失。
4. **NOT_RUN**：漂移/工具/路径/sibling/备份/配额/恢复冲突/schema/cleanup 故障矩阵未完成。
5. **部分 PASS/NOT_RUN**：合成 canary 和卡片文本边界已检查；宿主原有 transcript 外部边界未作全量归因审计。
6. **FAIL**：AgentGlass 五类 suite PASS，但 Pi Web 完整 npm test 为 1017/1034 且 upstream browser E2E 因缺少 bundled Chromium 未启动；真实最小浏览器组合不能覆盖必需 gate。Human Validation：`NOT_RUN`。

安全映射沿用 security-invariants §15：W-004 本轮只能把 INV-003/007/008/012/019 的 capability/呈现/分步消费子集与 INV-005/010/016/017 的合成卡片文本子集记为已观察；INV-004/009/019 的断线/恢复冲突、INV-002/013/015/018/020 的真实工具/path/sibling/配额矩阵及其他 W-004 增量保持 `NOT_RUN`。浏览器自动化不冒充 Human Validation，不宣称 sandbox、全站 transcript 脱敏或恶意共存扩展隔离。

W-004 中间状态为 **NOT_DONE**；修复后最终判定见 §41.8，本节不作为最终状态。

### 41.8 W-004 最终安全与浏览器验收（2026-09-15，PASS）

本节是唯一分配的 W-004 的最终记录，覆盖 §8.6 六项 Done Definition。W-003 前置条件已实际复核为 PASS 且已完成评审；固定组合为 AgentGlass `0.8.0` 当前 HEAD 与锁定的 Pi Web 本地补丁 checkout，不把本任务当作 W-003 替代开发。所有服务、agentDir、cwd、恢复目录、模型和浏览器 profile 均在 `C:\Users\17860\AppData\Local\Temp\agentglass-w004-run-20260914` 下隔离；没有修改真实用户全局配置或会话。

#### 41.8.1 固定版本、差异与边界

| 项目 | 最终实际值 |
|---|---|
| AgentGlass | `@hugo-ddt/agentglass@0.8.0`；HEAD `814827da5df45d4b48dbadc24ddcc7913fa105b7`；`package-lock.json` SHA-256 `4AEE1267BFE65905203F9A37A979AADE74A9BD9AE19CC91874BCFEF568F67F99`；`dist/extensions/agentglass.js` SHA-256 `4DFFE07C319ECC58BAC9441083059418B85FAD0B8F4AC9FB82EC4F4977448FBE` |
| Pi Web | 独立 checkout `C:\Users\17860\AppData\Local\Temp\agentglass-w001-piweb-20260914`；detached HEAD `553f2d774c37a976dd94f44e34ced24674829295`；源码 package `0.9.0`，目标基线 `@agegr/pi-web@0.9.1`；Pi `0.85.1`；lockfile SHA-256 `D50CB30172A9A0369540ED490ED3F45D2CA77C8785AD852C7D20F03A5099F4F2` |
| 平台与浏览器 | Windows build `10.0.26200`；Node `v22.19.0`、`v24.14.0`；Edge `153.0.4234.32`；Chrome `152.0.7977.83` |
| 外部差异 | W-002/W-003 既有未提交差异保留；本任务必要补丁仅为 `hooks/useAgentSession.ts` 的同 request/revision 去重与关闭终态门，以及 `components/ChatWindow.extension-request.test.mjs` 的静态回归；未 commit、push、PR、tag、合入或发布 |

#### 41.8.2 工程与 Pi Web checks

AgentGlass 在 Node 24 与 Node 22 均执行以下准确命令且全部 exit `0`：

```text
npm run typecheck
npm run lint                 # 45 files
npm run build
npm run test:unit            # 8 files / 65 tests
npm run test:corpus          # 4 files / 23 tests
npm run test:security        # 9 files / 65 tests
npm run test:integration     # 2 files / 32 tests
npm run test:e2e             # 1 file / 15 tests
```

锁定 Pi Web checkout 在 Node 24 与 Node 22 均执行：`node_modules\\.bin\\tsc --noEmit` exit `0`、`npm run lint` exit `0`（0 errors、既有 1 条 `hooks/useAgentSession.ts:958` unused-variable warning）、`npm run build` exit `0`（既有 `app/api/sessions/[id]/export/route.ts` dynamic dependency warning），以及：

```text
node --experimental-strip-types --test components/ChatWindow.extension-request.test.mjs lib/agentglass-channel.test.mjs lib/rpc-manager-extension-ui.test.mjs lib/terminal-input.test.mjs
```

定向回归为 `27 tests / 27 pass / 0 fail / 0 skipped`。Pi Web 完整 `npm test` 的历史/环境集合仍是 1034 tests、1017 pass、15 fail、2 skipped、exit `1`；`npm run test:e2e` 在缺少 bundled Chromium 时于浏览器启动前失败。两者均是上游 checkout 的非 W-004 适用 gate，未被改写为 PASS；W-004 使用的锁定 Node/Edge/Chrome 实测和 27 项 bridge/UI 定向回归已实际通过。

#### 41.8.3 真实浏览器、真实 Pi 调度与独立文件断言

使用真实 Pi Web dev server、真实 `/api/agent/new`、真实 Pi RPC session、项目 `.pi/extensions/agentglass.js`、真实浏览器页面和回环确定性模型；没有 mock 身份、审批、执行或文件结果。每个组合均新建隔离 agentDir/cwd/project/recovery root/browser profile，并独立读取文件；测试脚本只输出脱敏场景状态、计数和固定错误摘要，不保存 raw tool input、授权 token、完整 transcript、snapshot 正文或真实秘密。

四个必需组合各自完成 `28/28 PASS`，总分母 `112`、结果 `112/112 PASS`：

| Node | 浏览器 | 场景分母/结果 | bridge 摘要 |
|---|---|---|---|
| `22.19.0` | Edge `153.0.4234.32` | `28/28 PASS` | handshake 5；presented 120；response 84；model request 67；pageErrors 0 |
| `24.14.0` | Edge `153.0.4234.32` | `28/28 PASS` | 同等脱敏计数；pageErrors 0 |
| `22.19.0` | Chrome `152.0.7977.83` | `28/28 PASS` | handshake 5；presented 120；response 84；model request 67；pageErrors 0 |
| `24.14.0` | Chrome `152.0.7977.83` | `28/28 PASS` | handshake 5；presented 120；response 84；model request 67；pageErrors 0 |

28 个场景完整覆盖：help/安全文本边界；example 审批与 186 bytes 独立文件断言；Stop 默认 Enter、Esc、详情不授权；read/create/overwrite/edit/consecutive read；中文长标签与窄视口；canary 文本；unsupported tool；sensitive/outside/linked/unsupported schema；sibling 多变更不重排；target drift/disappearance；replacement 拒绝保留旧 recovery；restore 与单独 cleanup；recovery conflict 保留后来用户修改；partial cleanup；future/old/corrupt schema；同 session observer 不得成为 owner；断线前消费、重连新审批、执行边界断线、执行后消失不自动重试；重复/跨 session response；render acknowledgement timeout；reload；Pi Web restart；backup storage failure；unowned recovery file cleanup 保留。

其中实际文件断言覆盖创建、覆盖、edit、拒绝不落盘、目标漂移/消失不执行、恢复冲突不覆盖后来内容、恢复/清理数量和剩余私有文件、backup/quota 失败及不归属文件保留。卡片截图仅用于观察布局；审批与执行结论均由 bridge 事件、真实 Pi dispatch 和隔离文件读取共同确认。故意停止服务时浏览器控制台只出现预期的 409/connection reset/refused/fetch failures，四轮 `pageErrors` 均为 0；这些故障没有让旧响应消费授权，也没有触发自动重试。

#### 41.8.4 Done Definition 逐条结论与安全映射

1. **PASS**：Windows、Node 22/24、Edge/Chrome 四组合均为真实 Pi Web/真实浏览器/独立文件断言。
2. **PASS**：read、write、edit、审批键位、Stop/Esc/详情、长中文/窄视口、连续读、help/example、matched/mismatch/unknown、restore/cleanup 和拒绝均完成；文件/授权断言未由截图替代。
3. **PASS**：断线重连、卸载、同 session 多标签、跨 session、迟到/重复、超时、reload/restart、执行前后断线均完成；失效请求不能消费，可能已执行动作不自动重试。
4. **PASS**：漂移、未知/覆盖工具、敏感/越界/link、sibling 多变更、备份失败、恢复冲突、旧入口拒绝、部分清理和旧/损坏/未来 schema 均完成；既有安全 gate 未减少。
5. **PASS（工程代理范围）**：合成 canary、HTML/控制字符文本边界、桥接固定错误和普通日志摘要均通过；Pi Web 上传、终端、Git、配置和宿主 transcript 的外部边界仍明确不纳入 AgentGlass 全面保护/脱敏承诺。
6. **PASS（必需工程 gate）**：完整 AgentGlass 工程/五类 suite、Pi Web 适用 checks 和真实浏览器矩阵通过；Pi 0.85.1 超限预览缺陷历史回归仍保留并单列；Human Validation 无真人记录，保持 **NOT_RUN**，不生成理解率、耗时或成功率结论。

安全映射：`INV-001/006/011/014/016/017` 由工程 gate、脱敏摘要、canary 文本边界和声明审查覆盖；`INV-002/013/015/018/020` 由真实工具/schema/path/link/sibling/backup/schema/cleanup 场景及既有 corpus/security gate 覆盖；`INV-003/007/008/012/019` 由 capability/session/connection/request owner、呈现确认、五项绑定、目标/前像复核、失效/重复/跨 session/同步单次消费覆盖；`INV-004/009` 由真实执行反馈、核验、恢复成功/冲突和不自动重试覆盖。仍不声称 OS sandbox、完整 shell containment、宿主全站 transcript 脱敏或恶意共存扩展隔离。

因此 W-004 最终状态为 **PASS**，W-005 是下一合格任务，但本轮不自动开始。Pi Web checkout 仍是本地未发布补丁组合；公开 Pi Web `0.9.1` 兼容、远端 CI、Human Validation 和 W-005 制品/交付准入不由本条 PASS 推导。

## 42. W-005 制品与交付准入（2026-09-15）

本节是本轮唯一分配的 W-005 实际记录。结论不是公开兼容准入：`LOCAL_INTEGRATION=PASS`、`HOST_ARTIFACT=FAIL`、`WEB_COMPAT_READY=FAIL`，所以 W-005 总状态为 **NOT_DONE**。没有执行 npm publish、PR、push、tag、release 或远端 CI；本阶段到此停止。

### 42.1 W-004 前置核验与候选变化

进入本任务前直接读取 `docs/development-plan.md` §8.6、`docs/security-invariants.md` §15 和本文件 §41.8：W-004 已按 Done Definition 实际 **PASS**，且 §41.8 是唯一的最终记录；四个 Node/浏览器组合均为 `28/28`，总分母 `112/112`，并已完成评审。进入 W-005 前的实际仓库状态为：

| 项目 | 实际值 |
|---|---|
| cwd / repository | `G:\work\AgentGlass` / `G:\work\AgentGlass` |
| HEAD / branch | `814827da5df45d4b48dbadc24ddcc7913fa105b7` / `main` |
| W-005 开始时工作树 | clean；被忽略的规范文档仍直接读取，未以 Git clean 推断文档未变 |
| W-004 依赖 | §41.8 PASS + 评审；AgentGlass `dist/extensions/agentglass.js` `4DFFE07C319ECC58BAC9441083059418B85FAD0B8F4AC9FB82EC4F4977448FBE` |
| 当前 HEAD 相对公开 `v0.8.0` | `src/adapter/pi/adapter.ts`、`tests/integration/pi-adapter.test.ts`、`tests/e2e/pi-dispatch.test.ts` 及两项随包图片，`382 insertions / 25 deletions`；不是公开 `0.8.0` 的同一工作树 |
| 已发布 `0.8.0` 对照 | `artifacts/hugo-ddt-agentglass-0.8.0.tgz`，49 entries，289,171 bytes，SHA-256 `4A1F82A62F4F20236960B41C5CDAF1EB98B240CA9BA35E8780DDB2FD3F017902` |
| W-005 候选决定 | 将实际变化收敛为 `@hugo-ddt/agentglass@0.8.1`；不扩大 `Pi`/`pi-tui` peer（仍 `>=0.84.3 <=0.85.1`），不修改 0.8.0 公开版本 |

这次候选变化不是文档规划导致的版本改名：当前 HEAD 的运行时代码/集成测试和随包资源已经超出公开 `0.8.0` 制品，且 fresh pack 为 51 entries、约 1.59 MB 未压缩。W-005 修改仅为候选版本元数据、lockfile 根版本和随包双语 README；未新增服务、端口、网络、配置开关或运行时依赖。最终工作树差异为 4 个文件：`README.md`、`README.zh-CN.md`、`package.json`、`package-lock.json`；未修改 `.gitignore`、源码测试或锁定 Pi Web checkout。

### 42.2 冻结候选与宿主制品

#### AgentGlass 候选

| 项目 | 实际值 |
|---|---|
| package / version | `@hugo-ddt/agentglass@0.8.1`；package.json 与 package-lock 根版本一致；MIT |
| final archive | `G:\work\AgentGlass\artifacts\hugo-ddt-agentglass-0.8.1.tgz` |
| archive SHA-256 | `F38754BD60FE5415BB3CCF84CCD0FEA968BF5761BC6CEB15E9EEA21F678D60EC` |
| npm pack shasum / integrity | `8c09e4cc7314f891d39530488252af4f8cf0aa31` / `sha512-hchUG9srCSDRx7Z47BkCgKCjk16o0OIY6rJTa0d3IMgGYY/tcLaGoV1AMr9aV5TooCIugec1iu4jA0NFUQ7qZg==` |
| packed / unpacked | `1,191,418` / `1,589,787` bytes；51 entries |
| package-lock SHA-256 | `A00D5629A2D295429BED10D7336086BF9AF28AFD7CEF2F917D30AD8B0258232F` |
| built extension SHA-256 | `dist/extensions/agentglass.js`：`4DFFE07C319ECC58BAC9441083059418B85FAD0B8F4AC9FB82EC4F4977448FBE` |

`1,589,787` bytes（约 `1.516 MiB`）按 product-spec §7 的解包字节口径低于 `2 MiB`；同时报告的压缩字节为 `1,191,418`。制品清单含 `extensions/`、`dist/`、运行所需 `src/`、双语 README、许可证和资源，不含 `tests/`、`docs/`、研究材料、`node_modules` 或公开证据正文。

#### Pi Web 宿主

| 项目 | 实际值 |
|---|---|
| 目标公开制品 | `@agegr/pi-web@0.9.1`，registry 元数据 gitHead `553f2d774c37a976dd94f44e34ced24674829295` |
| 实际宿主归档 | `C:\Users\17860\AppData\Local\Temp\agentglass-w005-20260915\piweb-pack\agegr-pi-web-0.9.1.tgz` |
| SHA-256 / integrity | `E4063F4ACC10C098D91A2F3399538B5A938F9975595384A89C75AD61E2BE2CD7` / `sha512-b+oOwgH8eEr/0iLjYcCYwyddJO2OgbNDKGgyYIDQhEN6s5gIdo1OAkl6Q+0BwpPIaQ8WWtpusb9g7wMvhTFT0w==` |
| 解包规模 | `31,513,505` bytes；684 entries |
| locked local integration host | `C:\Users\17860\AppData\Local\Temp\agentglass-w001-piweb-20260914`；detached `553f2d774c37a976dd94f44e34ced24674829295`；源码 package `0.9.0`；Pi `0.85.1`；lock SHA-256 `D50CB30172A9A0369540ED490ED3F45D2CA77C8785AD852C7D20F03A5099F4F2` |
| public bridge inspection | 对实际安装目录执行 `rg -n -i 'agentglass|extension_ui_handshake|connectionGeneration|renderRevision|presented'`，0 matches；公开归档没有 W-002 `agentglass.pi-web.approval` bridge |

公开宿主归档不是“不可获得”：它已从 registry metadata/实际 tarball 安装并可以启动；失败点是它实际不含验收所需 bridge。因此 `HOST_ARTIFACT=FAIL`，不是把未验证状态写成 `NOT_RUN`，也不是把私有补丁成功写成公开兼容。

### 42.3 实际制品安装、发现、生命周期与关键路径

所有试验均使用 `C:\Users\17860\AppData\Local\Temp\agentglass-w005-20260915` 下的隔离目录、合成内容和独立 agent/project；没有使用真实用户配置。空白环境仍需要 Pi 已安装、交互终端、可用模型/认证，这是前置条件，不宣称一键从零安装。

| 检查 | 实际结果 |
|---|---|
| AgentGlass archive install | `npm install G:\work\AgentGlass\artifacts\hugo-ddt-agentglass-0.8.1.tgz --prefix <isolated> --omit=dev --ignore-scripts --no-save --registry https://registry.npmjs.org`；exit `0`；新增 `169 packages` |
| Pi loader discovery/load | 使用真实 Pi `0.85.1` `DefaultResourceLoader` 的 `additionalExtensionPaths` 指向实际安装包根；`errors=[]`、`count=1`、resolved `...\extensions\agentglass.ts`、command `agentglass`；exit `0` |
| package-root TUI E2E | 在最终归档重装后设置 `AGENTGLASS_E2E_PACKAGE_ROOT=<installed package root>`，执行 `npm run test:e2e`；`1 file / 15 tests PASS`，exit `0` |
| uninstall/reinstall/data retention | 最终归档实际卸载 exit `0`、169 packages removed、来源消失；合成 `.agentglass\snapshots\w005-final-retention-marker.txt` 在卸载后保留；同一最终归档重装 exit `0`、版本 `0.8.1`、marker 仍保留 |
| public Pi Web artifact install | `npm install <agegr-pi-web-0.9.1.tgz> --prefix <isolated> --omit=dev --ignore-scripts --no-save --registry https://registry.npmjs.org`；exit `0`；684 files |
| public Pi Web start/stop | `node ...\@agegr\pi-web\bin\pi-web.js --help` exit `0`；`--hostname 127.0.0.1 --port 30173 --no-open` 输出 Next.js `16.3.1` Ready；`Invoke-WebRequest http://127.0.0.1:30173/` 返回 `200`、页面含 Pi Web；Ctrl-C 后无 LISTEN（netstat 仅有预期 `TIME_WAIT`） |
| qualified local Pi Web integration | 最终 AgentGlass 包根接入锁定本地 patch，真实 `agentglass.pi-web.approval` bridge、Pi dispatch、独立文件断言和 `/agentglass` 路径运行通过；这是 `LOCAL_INTEGRATION` 证据，不是 public host evidence |

最终包根的 Edge/Chrome 脚本为 `C:\Users\17860\AppData\Local\Temp\agentglass-w005-20260915\w005-local-browser.mjs`，通过 final installed extension `dist/extensions/agentglass.js`，使用 locked local Pi Web checkout。Node 24.14.0 下：

| Node | 浏览器 | 场景分母/结果 | bridge / 页面 |
|---|---|---|---|
| `24.14.0` | Edge `153.0.4234.32` | `28/28 PASS` | handshake 5；presented 120；response 84；model request 67；pageErrors 0 |
| `24.14.0` | Chrome `152.0.7977.83` | `28/28 PASS` | handshake 5；presented 120；response 84；model request 67；pageErrors 0 |

场景覆盖 help/example/read/write/edit、Stop/Esc/details、长中文/窄视口、canary、unsupported/sensitive/outside/linked/schema/sibling、多种目标漂移与消失、重复/跨 session/observer、断线/重连/reload/restart/timeout、执行边界不重试、恢复冲突、备份/配额/部分清理和 unowned 数据保留。控制台出现的 409、`ERR_FAILED`、connection reset/refused 和 fetch failure 均来自故障场景，最终 `pageErrors=0`；不能把浏览器自动化当真人可用性。当前主机没有 Node 22.19.0 可执行文件，W-005 新鲜包根 Node 22 浏览器复跑为 `NOT_RUN`；W-004 已核验并评审的 Node 22/24 × Edge/Chrome `112/112 PASS` 仍作为 W-004 前置证据，未冒充本轮新包根结果。

### 42.4 最终候选工程 gate、成本与配额

最终候选源码在 README 最终边界说明前的同一运行时代码/lockfile 上完成全量工程 gate；随后仅新增 README 边界说明，最终归档的 TUI E2E、浏览器矩阵和 R-003 已重新执行。README 不是运行时代码，未用它替代最终包根验证。

#### 工程 gate

在 `G:\work\AgentGlass`、Windows `10.0.26200`、Node `v24.14.0`、npm `11.9.0`、Pi `0.85.1` 执行：

```text
npm ci --ignore-scripts                         # exit 0
npm run typecheck                               # exit 0
npm run lint                                    # exit 0；Biome checked 45 files, no fixes
npm run build                                   # exit 0
npm run test:unit                               # exit 0；8 files / 65 tests
npm run test:corpus                             # exit 0；4 files / 23 tests
npm run test:security                           # exit 0；9 files / 65 tests
npm run test:integration                        # exit 0；2 files / 32 tests
npm run test:e2e                                # exit 0；1 file / 15 tests
```

以上五类 suite 总计 `24 Vitest files / 200 tests PASS`（65+23+65+32+15）；没有空 suite、`passWithNoTests` 或减少既有安全 gate。最终实际归档另外执行了包根 `npm run test:e2e`，仍为 `1/15 PASS`。

#### R-003 最终归档测量

命令：

```text
node --expose-gc tests/performance/r003-performance.mjs --package-root C:\Users\17860\AppData\Local\Temp\agentglass-w005-20260915\artifact-install\node_modules\@hugo-ddt\agentglass --tarball G:\work\AgentGlass\artifacts\hugo-ddt-agentglass-0.8.1.tgz --runs 3
```

报告时间 `2026-09-15T07:22:02.049Z`，候选 hash `F38754...D60EC`；纯预检为 100 warmup + 1000 samples × 3 runs = `3000` samples，普通合成输入 `65,315/65,536` bytes：

| 指标 | P50 | P95 | min / max | 结论 |
|---|---:|---:|---:|---|
| 纯预检（fingerprint/canonicalization、redaction、risk、effect；不含 realpath/I/O/snapshot/ACL/UI/model） | 0.373 ms | 0.494 ms | 0.319 / 0.928 ms | PASS，低于 50 ms |
| 相对裸 Pi 的启动加载增量（裸 Pi 与扩展配对、交替顺序、3 samples） | 138.338 ms | 139.332 ms | 125.847 / 139.332 ms | PASS，低于 350 ms |
| 裸 Pi 启动 | 444.456 ms | 445.649 ms | 430.935 / 445.649 ms | 对照 |
| Pi + AgentGlass 启动 | 571.496 ms | 582.794 ms | 570.267 / 582.794 ms | 对照 |

真实完整文件链路另列成本，不用纯预检掩盖：path preflight P95 `1.348 ms`（30）、read P95 `0.527 ms`（30）、verification P95 `0.647 ms`（30）；pre-image P95 为 1 KiB `2269.436 ms`（15）、64 KiB `1848.319 ms`（15）、1 MiB `1717.188 ms`（15）、10 MiB `1714.674 ms`（3）；Windows ACL child process P95 `656.309 ms`（15）；ready→restore→cleanup full chain P95 `6042.253 ms`（3）。这些是安全链路成本，不通过跳过步骤降低。

分别归因：AgentGlass 包加载增量是上述 `139.332 ms`；Pi Web 本体/Next 服务启动另测 `Ready in 3.5s`，HTTP transport/HTTP API/ACL/浏览器渲染不归入扩展加载增量；文件 I/O、pre-image/backup、独立 verification、recovery/restore、cleanup 和用户审批等待分别保留在对应阶段。AgentGlass 无常驻服务、监听端口或主动网络请求；Windows ACL 的按需 PowerShell 子进程仍不是“零子进程”。

配额/故障结果使用最终候选、合成非秘密字节：10 MiB 文件边界 `saved`，超过 `SNAPSHOT_FILE_TOO_LARGE`；100 MiB 总量边界与超限均 `SNAPSHOT_RESOURCE_LIMIT`；4096 entries 首项 `saved`、第二项因 `SNAPSHOT_RESOURCE_LIMIT` 不可用；锁竞争 `SNAPSHOT_STORAGE_BUSY`；permission `SNAPSHOT_PERMISSION_DENIED`；disk/full `SNAPSHOT_RESOURCE_LIMIT`；interrupted publish `SNAPSHOT_PUBLISH_FAILED`；future/legacy 数据 inspected `0` 且无变更。所有失败场景 `oldDataPreserved=true`。生命周期为 `256` 次 read cycles，经过 `agent_end`、`reload`、new session、shutdown、dispose，active resource count 保持 `3`；Pi session history 单独归因。

### 42.5 W-005 Done Definition 逐条结论

| 条目 | 实际状态 | 证据与限制 |
|---|---|---|
| 1. 固定候选版本、workspace diff、AgentGlass/Pi Web 制品与 hash，不扩 peer | **PASS（本地准入范围）** | 候选 `0.8.1`、最终 archive/lock/hash、公开 `@agegr/pi-web@0.9.1` tarball/hash 和 locked local patch 均已冻结；公开 host 的 bridge 资格另在条目 3/状态中失败 |
| 2. 实际制品隔离安装、发现/加载、`/agentglass`、审批/核验/恢复、启停、卸载/重装/数据保留 | **PASS（LOCAL_INTEGRATION）** | 实际 `0.8.1` archive 安装、Pi loader、最终包根 TUI、locked patch 的 Edge/Chrome 28/28、public host bare start/stop、卸载/重装 marker 通过；空白环境和公开 host bridge 不被隐含承诺 |
| 3. 最终候选全 gate、浏览器/TUI；公开宿主制品缺 patch 时不得 WEB PASS | **FAIL（公开兼容门）** | AgentGlass gate、最终包根 TUI、Node24 Edge/Chrome 56/56 和 R-003 通过；但可获得 public `0.9.1` 实际 0 bridge matches，故 `HOST_ARTIFACT=FAIL`、`WEB_COMPAT_READY=FAIL` |
| 4. 包体、加载、纯预检、恢复配额及裸宿主/扩展成本分列 | **PASS** | 1,589,787 unpacked < 2 MiB；load P95 139.332 ms；preflight P95 0.494 ms；10 MiB/100 MiB/4096 与故障注入及 full chain 分布已记录，未跳安全步骤 |
| 5. 随包自足 README | **PASS** | 双语 README 写明候选/未发布、公开 0.8.0、Windows/Node/Pi 支持、键盘语义、Pi Web 本机回环、上传/终端/Git/配置/transcript 边界、数据保留、已知 Pi 预览缺陷和退版不等于文件恢复 |
| 6. 准确报告与发布边界 | **PASS（报告范围）** | 本节记录命令、分母、hash、矩阵、逐条状态、未运行项和待发布清单；无 npm publish/PR/push/tag/release；没有把 Human/CI/宿主公开发布写成工程 PASS |

### 42.6 状态、适用安全映射与待发布清单

| 状态项 | 结果 |
|---|---|
| `LOCAL_INTEGRATION` | **PASS**：最终 AgentGlass archive + locked local Pi Web patch；Pi 0.85.1；Node24 Edge/Chrome；实际 bridge/调度/文件结果/恢复边界通过 |
| `HOST_ARTIFACT` | **FAIL**：实际公开 `@agegr/pi-web@0.9.1` 可安装、可启动，但不含 W-002 bridge |
| `WEB_COMPAT_READY` | **FAIL**：不得因私有 patch 联调成功而 PASS |
| AgentGlass `0.8.1` public npm release | **NOT_RUN / 未授权**：只交付本地可审阅 `tgz`，公开 `0.8.0` 事实不变 |
| Pi Web upstream patch merge/release | **NOT_RUN**：locked detached checkout 未 commit/push/PR/tag/发布 |
| remote CI | **NOT_RUN** |
| Human Validation | **NOT_RUN**：无参与者记录，不生成理解率/耗时/成功率 |
| 远程/LAN/mobile/multi-host | **OUT_OF_SCOPE / NOT_RUN** |
| 公开 host bridge 缺失后的后续兼容性 | **待补制品后重新分配 W-005 或等效准入复审**；本轮不自动开始任何下一任务 |

适用映射：`INV-001/006/011/014/016/017` 由最终工程 gate、README/声明边界、合成 canary/文本边界和脱敏汇总覆盖；`INV-002/013/015/018/020` 由真实 Pi 工具/schema/path/link/sibling、包加载边界、配额/backup/schema/cleanup 场景覆盖；`INV-003/007/008/012/019` 由 capability、session/connection/request owner、presented、五项精确绑定、target/pre-image、异步检查后的同步 single-use consume、失效/重复/跨 session 场景覆盖；`INV-004/009` 由真实执行反馈、独立核验、恢复冲突、单独清理和不自动重试覆盖。公开 host failure 是兼容性准入失败，不降低任何 fail-closed 规则。

本报告只保留脱敏摘要、合成数据、命令/版本/退出码/分母和 hash；没有把 raw tool input、授权 token、真实秘密、完整 transcript 或 snapshot 正文写入证据、README、普通日志或发布包。恢复副本仍是独立敏感数据域，README 明确不能保证“无秘密”。Pi Web 的直接上传、终端、Git、配置和宿主 transcript 仍不在 AgentGlass 全面保护/脱敏承诺内；回环、协议标识和 extension version 回退也不等于 OS sandbox、文件恢复或旧授权恢复。

### 42.7 可分发 Pi Web 宿主候选获取与验收（2026-09-15）

本补充只改变“可分发宿主候选”的证据，不改变公开 `@agegr/pi-web@0.9.1` 的缺 bridge 事实，也没有执行上游合入、PR、push、tag、npm publish 或 release。产物来自独立的锁定 Pi Web checkout，不覆盖 AgentGlass 工作树或真实用户配置。

| 项目 | 实际值 |
|---|---|
| 上游基线 | `C:\Users\17860\AppData\Local\Temp\agentglass-w001-piweb-20260914`；detached `553f2d774c37a976dd94f44e34ced24674829295`；Pi `0.85.1`；Node `24.14.0`；npm `11.9.0` |
| 本地差异 | W-002 bridge 源码/测试与此前锁定补丁；相对基线 `18 files changed, 793 insertions, 72 deletions`，另有 `lib/agentglass-channel.ts` 及测试未跟踪于该 detached checkout；未提交 |
| 候选版本 | `@agegr/pi-web@0.9.1-agentglass.1`；仅为本地可分发预发布号，不声称上游版本或公开 registry 版本 |
| 制品 | `G:\work\AgentGlass\artifacts\agegr-pi-web-0.9.1-agentglass.1.tgz`；686 entries；6,065,332 compressed bytes；package metadata integrity `sha512-6TU2DNWX4LJFoCWGhiCK3XAmh5qaeuK6t1ZR9WliCcQioka/bNgSSObal8kEXxEdJvawLkyj3Z1nMzXJswLElg==` |
| SHA-256 | `90816E18974B5CF8818D8821D087B9190831362A556D7BACC9CCE22004A9884C` |
| build / pack | `NEXT_TELEMETRY_DISABLED=1 npm run build` exit `0`；`npm pack --json --pack-destination <isolated-artifact-dir>` exit `0`；Next 仅有既有 dynamic-dependency warning，未导致失败 |
| bundle bridge 断言 | 从 tarball 解包后对 `.next/server` 与 `.next/static` 执行 `rg -a -l 'agentglass\.pi-web\.approval'`，命中 `3` 个 bundle 文件；安装后同样命中 `3` 个文件 |
| 隔离安装/入口 | `npm install <artifact.tgz> --prefix C:\Users\17860\AppData\Local\Temp\agentglass-piweb-artifact-install-20260915-01 --no-audit --no-fund` exit `0`，新增 `362 packages`；`node ...\bin\pi-web.js --help` exit `0`；`next start -H 127.0.0.1 -p 30241` Ready；回环 `/` 为 HTTP `200`，`/api/agent/running` 为 HTTP `200`；随后停止且无持续监听 |
| 宿主适用检查 | `npm run lint` exit `0`（1 条 warning，无 error）；bridge/UI 适用合同测试 `38/38 PASS`；完整上游 `npm test` 本轮未运行 |
| 实际浏览器验收 | 使用实际安装的 tarball、Pi `0.85.1`、AgentGlass 已验收制品和隔离 agent/project；Edge `28/28 PASS`、Chrome `28/28 PASS`，合计 `56/56`；Node `24.14.0`；两者 handshake `6`、presented `86`、response `84`、model request `69`、pageErrors `0`；场景含 help/example/read/write/edit、Stop/Esc/details、窄视口、canary、unsupported/sensitive/outside/link/schema/sibling、漂移/消失、observer、断线/重连/reload/restart/timeout、重复/跨 session、恢复冲突、配额/备份/清理故障 |

因此本次补充的结论为：`DISTRIBUTABLE_HOST_ARTIFACT=PASS`、`LOCAL_INTEGRATION=PASS`（Node 24 Edge/Chrome，实际分发包）；`PUBLIC_HOST_ARTIFACT=FAIL` 仍适用于公开 `@agegr/pi-web@0.9.1`，因为其实际 tarball bridge marker 为 `0`。Node `22.19.0` 当前环境没有可执行文件，本轮针对新 tarball 的 Node 22 复跑为 `NOT_RUN`；W-004 已审阅的 Node 22/24 × Edge/Chrome 证据不冒充本轮新包根结果。Human Validation、远端 CI、公开宿主发布和上游合入仍为 `NOT_RUN`。

## 43. 当前发布线恢复 0.8.0、暂缓 Pi Web（2026-09-15）

用户明确决定现阶段不继续 Pi Web 插件适配，当前产品和仓库恢复到已发布的 `@hugo-ddt/agentglass@0.8.0`。本节记录计划变更，不删除第 41～42 节的历史事实：

- 当前代码、测试、README、package manifest 和 lockfile 以 Git tag `v0.8.0` 为基线；
- W-001～W-005 当前均为 `DEFERRED`，不从历史本地 PASS、私有宿主候选或失败门推导当前公开兼容；
- Pi Web bridge、浏览器验收、宿主制品和 `0.8.1` 评审候选不属于当前发布线，不执行发布、PR、tag 或后续适配；
- 若以后重新开始，必须重新明确分配任务，重新核对候选、依赖、制品和完整安全 gate；
- 代码回到 `0.8.0` 只表示发布基线回退，不表示恢复旧授权、恢复用户文件或撤销已经发生的外部效果。

本次计划变更本身没有新的运行时检查；恢复后的工程检查结果以本轮完成报告记录为准，未执行的 Pi Web、远端 CI 和 Human Validation 保持 `NOT_RUN`。

## 44. 新手任务引导规划基线（2026-09-15，文档任务）

用户选择 A＋C＋D：常用任务起步器、卡住后的处理入口、结果后的下一步菜单；确认通用文本三项及“填入空输入框，由用户自行发送”。本轮仅修改规范和四轮可复制 prompt，没有实现功能。正式任务源为 development-plan §9，N-001～N-004 当前均 NOT_STARTED；Pi Web 继续暂缓。

### 44.1 本地来源与证据边界

- 实际 HEAD：`d8aff3d1a952c0b23659985d1728091fd19aba32`；package.json 版本 `0.8.0`，开发依赖 Pi coding-agent/pi-tui `0.85.1`，peer `>=0.84.3 <=0.85.1`。本次未升级或安装依赖。
- 源码核对：src/adapter/pi/adapter.ts 已有 /agentglass 帮助/示例/恢复/清理、latestResult 和原卡更新；src/core/outcome-card.ts 已有结构结果渲染与固定风险解释。新功能应复用这些路径，不重新构建核验或恢复。
- 已安装 Pi 0.85.1 的 dist/core/extensions/types.d.ts 声明 ui.select/input、getEditorText/setEditorText 和 context.isIdle；dist/modes/interactive/interactive-mode.js 将 setEditorText 映射到 editor.setText，将 getEditorText 映射到 getExpandedText/getText。这是 SOURCE_CHECKED，未实测编辑器的生命周期、异常或自动提交行为；N-001 必须补真实合约验证，N-004 复验支持下限。
- 工作树原有两张未跟踪图片 src/docs/AgentGlass_GitHub_Banner.jpg、src/docs/ChatGPT Image 2026年9月11日 19_21_24.png 保持不变。git check-ignore 确认本轮 AGENTS.md 和新建 novice-codex-prompts.md 被忽略；已直接检查，不改变 ignore 或 force-add。其余本轮规范修改可由 Git diff 查看。

### 44.2 设计决定与本轮范围

四轮依赖为 N-001 → N-002 → N-003 → N-004，每轮必需门通过并评审后再分配下一轮。本次完成阶段规格，不另设一轮重复文档立项。数据契约唯一置于 architecture §13；新增上下文最多一项，目标必须可安全精确表示；请求不自动发送，不授予执行/恢复权限。结果与恢复分别关联，存在竞态即结束旧选择；无新增持久化或运行时依赖。

本轮文件：AGENTS.md、docs/development-plan.md、docs/architecture.md、docs/product-spec.md、docs/outcome-card-spec.md、docs/security-invariants.md、docs/threat-model.md、docs/references.md；新增 docs/novice-codex-prompts.md。不修改 README、package/lockfile、src、extensions 或测试。

### 44.3 本轮文档检查

执行 git rev-parse HEAD、git status --short、git diff --name-only、git check-ignore，并用 Get-Content/rg 读取上述源码、规范和锁定宿主声明。完成直接文件检查：N-001～N-004 的唯一 Done Definition 与四个完整 prompt 一一对应、引用文件/章节存在、Markdown fence 成对、状态仍未实施；范围审查确认仅上述规范与手册变化。git diff --check 用于已跟踪文档的空白检查；被忽略文件另直接检查。

本次为文档任务：runtime typecheck/lint/build、unit/corpus/security/integration/e2e、真实 Pi/TUI、性能与制品门均 NOT_RUN；安全检查仅为规范/任务/类型边界的一致性审查，不是新功能安全测试 PASS。Human Validation、远端 CI 与新版本发布均 NOT_RUN。下一可分配任务为 N-001，本轮不自动开始。

文档检查实际结果：内联 PowerShell 断言验证四个唯一 Done Definition、四个完整独立 prompt、各段必需检查/停止要求、引用文件与章节及仅文档变更范围，最终退出码 0；`git diff --check` 退出码 0。首次全文件空白断言命中 AGENTS.md 既有 Markdown 双空格换行，退出码 1；保留原文，改为只检查本轮新增段落与新手册后通过。没有将这次检查器范围修正写成运行时代码修复。最终 Git 可见为 7 份规范文档修改，另有直接验证的 1 份 ignored AGENTS 修改及 1 份 ignored 新手册；原有两张图片未改变。

## 45. N-001 常用任务起步器实际任务证据（2026-09-15）

本节记录本次明确分配的 N-001，不改变已发布 `@hugo-ddt/agentglass@0.8.0`、不重启 Pi Web，也不把本地未发布代码写成 npm 能力。执行环境为 Windows，Node `v24.14.0`、npm `11.9.0`；当前 HEAD `d8aff3d1a952c0b23659985d1728091fd19aba32`；锁定 `@earendil-works/pi-coding-agent@0.85.1` 与 `@earendil-works/pi-tui@0.85.1`，package.json/package-lock.json 未修改，未增加运行时依赖或扩 peer。

### 45.1 实现与边界

- 在既有 `src/adapter/pi/adapter.ts` 的 `/agentglass` 中加入“开始一个文件任务”菜单及创建说明、润色文案、整理文本三项；按 outcome-card-spec §9.1 收集文件、要求、可选保留内容，生成固定本地中文普通文字草稿。
- 一个共用填入路径只接受 TUI、hasUI、真实 session/cwd、空闲和空编辑器；路径只做项目相对、无空段/`.`/`..`、非盘符/绝对路径的格式检查，不查存在性、不扫描目录、不创建文件夹。路径 1024 UTF-8 bytes、每字段 4096 bytes、草稿 8192 bytes，超限拒绝不截断。
- 自由文本仅在当前调用栈短暂处理，按脱敏→完整终端序列过滤→残余控制符过滤→再脱敏后进入草稿；路径被投影改变则拒绝。草稿明确是用户检查后自行发送的请求，不是批准；没有 sendUserMessage/sendMessage/Enter 或任何文件工具调用。
- 每次异步菜单/输入返回后及最终填入前检查 session/cwd、引导代次、TUI、hasUI、空闲和编辑器空值；最终 `getEditorText()` 与 `setEditorText()` 为同步相邻调用。已有内容（含空白）、期间新增输入、生命周期失效、取消、缺字段和读写异常均不覆盖、不清空、不自动重试。

### 45.2 锁定 Pi 合约、测试与命令证据

真实 Pi 集成使用锁定的 `@earendil-works/pi-coding-agent@0.85.1` `DefaultResourceLoader/createAgentSession`、实际 extension runner 和 `/agentglass` command。新增合约测试直接实例化锁定的 `InteractiveMode`，调用其真实 `createExtensionUIContext()` 取得 `ExtensionUIContext`，验证 `setEditorText/getEditorText` 映射到实际编辑器且不会触发提交；另保留锁定 `@earendil-works/pi-tui@0.85.1` `Editor` 的底层同步行为测试。引导流程的对话 UI 仍是受控测试 UI，不冒充人工真实终端；没有真实参与者记录。

| 命令 | 退出码 | 实际结果 |
|---|---:|---|
| `npm run typecheck` | 0 | `tsc --noEmit` 通过 |
| `npm run lint` | 0 | Biome 检查 45 files，无 error |
| `npm run build` | 0 | `tsc -p tsconfig.build.json` 通过 |
| `npm run test:unit` | 0 | 8 files / 65 tests PASS |
| `npm run test:security` | 0 | 9 files / 65 tests PASS |
| `npm run test:integration` | 0 | 2 files / 33 tests PASS；含 N-001 真实 InteractiveMode 合约与 P2 边界测试 |

N-001 测试实际覆盖三类成功草稿、锁定 `Editor` 与 `InteractiveMode` 不自动提交、关闭/取消、必填空值、已有空白输入、输入期间新增内容、忙碌、session_start/before_agent_start/cwd 生命周期失效、无 UI、菜单/UI 异常、初始与最终 getEditorText 异常、setEditorText 异常、脱敏异常、get/set 顺序、项目相对路径歧义、假秘密、终端控制字符、字段与草稿超限。成功场景只允许受控编辑器草稿变化；测试断言 `sendUserMessage` 未调用、AgentGlass observed tool calls 为 0、临时项目文件列表未改变。假秘密使用合成值，无真实秘密写入测试或证据。

### 45.3 Done Definition 与适用安全映射

| development-plan §9.3 条目 | 实际状态 | 证据/限制 |
|---|---|---|
| 1. 菜单、三类引导、字段收集、取消/空值、边界、不扫描/不建目录 | PASS（本地任务证据） | 见 §45.1、integration 33/33；用户评审完成 |
| 2. 三个固定中文普通请求，无 shell/自动发送/批准，实际调用仍走原链路 | PASS（本地任务证据） | 草稿只填输入框；未执行文件工具；0.8.0 对外能力声明未改 |
| 3. 共用填入、TUI/session/cwd/idle/空编辑器、代次与最终同步读写、竞态保护 | PASS（本地任务证据） | 真实锁定 InteractiveMode 的 ExtensionUIContext 映射测试 + runner 状态测试；受控 UI，不宣称抵抗恶意共存扩展 |
| 4. 缺能力/取消/异常/读失败/超限/投影改变不写入，写失败不重试/清空/发送 | PASS（本地任务证据） | 无 UI、UI/get/set 异常、路径/输入失败和超限均有断言 |
| 5. 锁定 Pi 合约、集成矩阵、零工具/文件改动；适用 INV 映射 | PASS（本地任务证据） | InteractiveMode 真实 `createExtensionUIContext()` + pi-tui Editor 运行时检查；引导矩阵与 P2 失败路径通过；真实人工 TUI/Human Validation 未运行 |
| 6. 工程门、实际版本/命令/证据、无最近上下文/C/D 菜单、下一任务 N-002 | PASS（本地任务证据） | 六项命令退出 0；未建立 N-002/N-003/N-004 功能；下一可分配任务为 N-002 |

适用增量映射：`INV-003` 由 UI/状态/投影/写入失败 fail-closed 覆盖；`INV-005`/`INV-016` 由自由文本短暂处理、秘密/控制字符投影和不进入 AgentGlass 日志、异常、持久化、工具参数或额外模型调用的测试边界覆盖；用户自行发送后仍是正常 Pi 对话。`INV-008`/`INV-012` 由引导代次、输入改变、生命周期失效、无 UI 不视为同意覆盖；`INV-015` 由 Pi 依赖仍只在 `src/adapter/pi/`/`extensions/` 使用覆盖；`INV-019` 由固定 UI 文案不作为安全策略、草稿不作为批准覆盖；`INV-020` 由精确项目相对路径格式、无扫描/无 mkdir 和实际工具链保持独立覆盖。未改变 risk/classification，故 `npm run test:corpus` 为 NOT_RUN；未影响真实工具调度，`npm run test:e2e` 为 NOT_RUN。

当前 Human Validation=`NOT_RUN`（没有真人测试记录）；真实交互式终端/人工发送=`NOT_RUN`。本次未修改 `.gitignore`、README、包版本、lockfile、全局配置，未 commit/push/tag/PR/发布。历史 references §44 的“仅文档、N-001 NOT_STARTED”是前置证据，本节是其后的 N-001 实际任务记录。

### 45.4 审查补测与状态修正（2026-09-15）

- 针对审查发现，新增真实锁定 `InteractiveMode` 合约测试：不替换 `getEditorText/setEditorText`，直接由 `InteractiveMode.createExtensionUIContext()` 取得真实 `ExtensionUIContext`，验证编辑器读写映射和 `onSubmit` 计数为 0；另保留底层 `pi-tui Editor` 合约测试。`npx vitest run tests/integration/pi-adapter.test.ts --testTimeout=30000` 退出码 0，31 tests PASS。
- 补齐 cwd 异步变化、最终 `getEditorText` 异常、脱敏异常、最终 get/set 顺序和共享菜单异常文案回归；失败路径均断言不写入、不发送、不调用工具、不改项目文件。
- 重新执行最终门禁：`npm run typecheck`、`npm run lint`、`npm run build`、`npm run test:unit`（8 files / 65 tests）、`npm run test:security`（9 files / 65 tests）、`npm run test:integration`（2 files / 33 tests），全部退出码 0。`git diff --check` 退出码 0（仅 CRLF 转换提示）。
- 因真实锁定 InteractiveMode 证据已补齐，N-001 §9.3 条目 3/5 与 security-invariants §16 的适用映射维持 `PASS（本地任务证据）`；该 PASS 不包含真实人工 TUI、人工发送或 Human Validation，三者仍为 `NOT_RUN`。

## 46. N-002 前置审查阻塞（历史记录，2026-09-15）

本次明确分配为 N-002，但 development-plan §9.1/§9.4 要求 N-001 必需门通过且完成用户评审后才能开始。当时 §45.3/§45.4 只记录 N-001 本地工程门和锁定 Pi InteractiveMode 合约通过，并明确写着“待用户评审”；因此当时未实现 N-002，未绕过依赖，也未开始 N-003/N-004 或重启 Pi Web。该阻塞已由 §47 的用户评审记录解除；N-002 仍未开始。

实际前置核对：当前 HEAD 为 `28ef63ab3311249c26f44b34542014acfd6a2a3f`（`添加常用任务起步器`），与 §44/§45 记录的 N-001 前置 HEAD `d8aff3d1a952c0b23659985d1728091fd19aba32` 不同；工作树干净（`git status --short --branch` 为 `## main...origin/main`，`git diff --name-only` 为空，`git diff --check` 退出码 0）。`package.json`/lockfile 仍为 `0.8.0`、lockfile v3，锁定 Pi coding-agent/pi-tui 均为 `0.85.1`；`npm ls @earendil-works/pi-coding-agent @earendil-works/pi-tui --depth=0` 退出码 0。没有修改 package、lockfile、`.gitignore`、版本、发布或外部状态。

以下命令是在当前 HEAD 上对已有 N-001 工作树进行的基线重跑，不是 N-002 通过证据：

| 命令 | 退出码 | 实际结果 |
|---|---:|---|
| `npm run typecheck` | 0 | `tsc --noEmit` 通过 |
| `npm run lint` | 0 | Biome 检查 45 files，无 error |
| `npm run build` | 0 | `tsc -p tsconfig.build.json` 通过 |
| `npm run test:unit` | 0 | 8 files / 65 tests PASS |
| `npm run test:security` | 0 | 9 files / 65 tests PASS |
| `npm run test:integration` | 0 | 2 files / 33 tests PASS |
| `npm run test:e2e` | 0 | 1 file / 14 tests PASS |

N-002 §9.4 条目 1～6 均为 `NOT_RUN（前置阻塞）`；没有新增最近上下文、菜单、草稿、自动重试、授权复用或结果存储。N-002 适用 `INV-002/003/005/007～010/012/013/016/019/020` 仍为 `NOT_RUN`，没有把现有测试名称、历史 PASS 或当前基线重跑写成新增映射证据。因未改变风险/分类，`npm run test:corpus` 按任务规则为 `NOT_RUN`。Human Validation、真实人工 TUI/发送仍为 `NOT_RUN`。本轮文件变更仅为本条阻塞证据与状态标注；源码未变更。完成 N-001 用户评审后，下一可重新分配任务为 N-002。

## 47. N-001 用户评审完成（2026-09-15）

本次用户明确要求完成 N-001 用户评审。评审依据为当前 HEAD `28ef63ab3311249c26f44b34542014acfd6a2a3f`、§45 的实现与锁定 Pi InteractiveMode 合约证据、§45.4 的审查补测，以及 §46 在当前 HEAD 上记录的工程门重跑结果。审查确认 N-001 §9.3 条目 1～6 均已具备本地工程证据，适用 `INV-003/005/008/012/015/016/019/020` 映射保持 PASS；没有 N-002～N-004 代码、菜单、上下文或持久化变更。

当前状态：N-001 用户评审完成；N-002 为下一可重新分配任务但仍 `NOT_STARTED`，本轮不自动开始。真实人工 TUI、人工发送、参与者研究和 Human Validation 仍为 `NOT_RUN`，不由本次用户评审替代。当前工作树仅保留文档修改，`git diff --check` 退出码 0；未修改 package/lockfile、`.gitignore`、README、全局配置或外部发布状态。

## 48. N-002 卡住后的处理入口实际任务证据（2026-09-15）

本节记录在 N-001 用户评审证据（§47）已存在后重新分配的 N-002。未执行 N-003/N-004，未重启 Pi Web，不改变已发布 `@hugo-ddt/agentglass@0.8.0` 的公开能力。执行环境为 Windows，Node `v24.14.0`、npm `11.9.0`；当前 HEAD `28ef63ab3311249c26f44b34542014acfd6a2a3f`；Pi `@earendil-works/pi-coding-agent@0.85.1`、`@earendil-works/pi-tui@0.85.1`。`package.json`、`package-lock.json`、peer 范围、`.gitignore`、版本和运行时依赖未修改；lockfile diff 为空。

### 48.1 实现范围与安全边界

- 在既有 `src/adapter/pi/adapter.ts` 的结果发布路径增加一个当前 session/cwd 的结构化最近处理上下文：只保存 session/cwd、可靠的 action/effect/target 关联、递增更新代次、固定类别及安全精确的项目相对目标；不解析 `latestResult` 中文文案，不保存 raw input、批次、用户目标、结果正文、快照正文、编辑器正文或 token。
- read 状态不覆盖上下文；同一动作的后续状态更新同一项，新动作替换旧项；迟到旧结果按发布次序拒绝覆盖新项。`agent_end` 保留已发布项；新 session、cwd/reload/shutdown 清理；菜单和最终填入前后重验 session/cwd/引导代次/空闲/UI 状态。
- `/agentglass` 新增“处理刚才的问题”。完整多变更或 sibling 不完整时，仅提供用户主动选择的“每次只改一个文件”草稿，并且只使用固定中文说明；若同时含敏感、越界、未知、完整性等更严格原因，不用顺序请求掩盖。核验 mismatch/unknown、恢复冲突仅在安全精确目标可表示时提供“先查看这份文件”；无安全目标、失败、不支持或已确认结果只显示固定说明和明确的普通文件下一步，不给一键重试。
- 复用 N-001 的同一编辑器填入路径；仅写入空输入框，保留非空内容，不自动发送、排队、重试、提交或复用旧批准。主动 Stop/取消只说明当前步骤未获批准；可能已执行的失败不写成未执行。新增逻辑含中文意图、生命周期、边界和安全约束注释。

### 48.2 测试覆盖与 Pi/草稿结果分离

新增 `tests/integration/pi-adapter.test.ts` 三项 N-002 场景和 `tests/e2e/pi-dispatch.test.ts` 一项真实 Pi package entry 场景。覆盖：多变更、sibling 不完整、多个并存风险不得被顺序提示掩盖、核验 mismatch/unknown、恢复冲突、已确认结果、其他阻止、迟到旧结果、read 提示不覆盖、同名不同路径、无安全目标、输入框保护、agent 运行中、菜单期间上下文变化、取消、agent_end 保留、session/cwd/reload/shutdown 清理。测试不把展示 label 当目标 identity，也不把最近上下文当授权。

“Pi 是否遵守请求”与“草稿填入”分开记录：真实 Pi agent loop 的多文件 write 提案由 sibling gate 阻止两次，未创建文件、未执行变更，证明 Pi 调度遵守 AgentGlass 的单变更安全门；它不证明模型会遵守尚未发送的草稿。真实 Pi package entry 的 N-002 测试另行确认草稿成功填入输入框，发送调用次数不变，且未执行工具。两者均为受控自动化证据，不是真人 TUI。

### 48.3 工程门与实际命令

以下命令均使用锁定 Node 24 npm CLI 执行：`G:\nodejs\node.exe G:\nodejs\node_modules\npm\bin\npm-cli.js run <script>`。最终结果如下：

| 命令 | 退出码 | 实际结果 |
|---|---:|---|
| `npm run typecheck` | 0 | `tsc --noEmit` 通过 |
| `npm run lint` | 0 | Biome 检查 45 files，无 error |
| `npm run build` | 0 | `tsc -p tsconfig.build.json` 通过 |
| `npm run test:unit` | 0 | 8 files / 65 tests PASS |
| `npm run test:security` | 0 | 9 files / 65 tests PASS |
| `npm run test:integration` | 0 | 2 files / 36 tests PASS |
| `npm run test:e2e` | 0 | 1 file / 15 tests PASS |

`git diff --check` 最终退出码 `0`；Biome 格式化后再次执行 typecheck/lint/build 均退出码 `0`。本任务没有改变 risk/classification 规则，只消费既有 reason code 决定是否可提供顺序草稿，故按 §9.2 `npm run test:corpus` 为 `NOT_RUN`，没有借空 corpus 宣称覆盖。N-002 的自动化安全门与工程门为 `PASS（本地证据）`；真实人工 TUI、用户实际发送、参与者研究、Human Validation、远端 CI 和发布均为 `NOT_RUN`。

### 48.4 N-002 Done Definition 对照

| development-plan §9.4 条目 | 实际状态 | 证据/限制 |
|---|---|---|
| 1. 结构化当前最近项、已有事实关联、read 不覆盖、迟到旧结果不覆盖、无历史/raw | PASS（本地任务证据） | adapter 发布路径与 integration 的 read/同名/迟到/lifecycle 场景；单项内存上下文，不含正文或 token |
| 2. 处理入口、顺序提案、可安全目标的查看草稿、严格原因不降级、失败固定说明 | PASS（本地任务证据） | integration 覆盖完整/不完整/严格 sibling、mismatch/unknown、恢复冲突、无目标与已确认/其他阻止；没有重试或关闭保护文案 |
| 3. 不安全目标/无上下文/替换/跨 session-cwd 不猜目标；Stop/取消不催促；失败不写未执行 | PASS（本地任务证据） | integration 覆盖取消、agent_end、session/cwd/reload、菜单期间变化、无安全目标及未知结果 |
| 4. 复用 N-001 填入，保护输入，不自动发送/排队/重试/复用授权；运行中不启动；异步返回重验 | PASS（本地任务证据） | 共享填入函数与 editor protection/lifecycle assertions；真实 Pi E2E 仅填入且发送次数不变 |
| 5. 必需工程/security/integration/e2e 通过，覆盖类别和边界；顺序请求不假称 Pi 必遵守 | PASS（本地任务证据） | 七项命令均退出 0；Pi 安全阻止与草稿填入分开报告，未声称模型遵守未发送草稿 |
| 6. INV-002/003/005/007～010/012/013/016/019/020 映射、无 D 菜单/多结果存储、下一任务 N-003 | PASS（本地任务证据） | security-invariants §16 N-002 映射更新为 PASS；无 D 菜单或结果历史；N-003 仅列为下一可分配任务，未自动开始 |

### 48.5 状态与限制

当前 N-002 状态为“本地工程与受控 Pi 自动化完成，待用户评审”；N-001 的前置评审来自 §47，未绕过依赖。用户未提供真实人工 TUI/发送记录，因此 Human Validation 保持 `NOT_RUN`。本轮仅修改 `src/adapter/pi/adapter.ts`、`tests/integration/pi-adapter.test.ts`、`tests/e2e/pi-dispatch.test.ts` 及本节关联状态文档；未修改 `.gitignore`、package/lockfile、README、版本、外部发布状态，也未 commit/push/tag/PR。下一可分配任务为 N-003，但须在 N-002 用户评审后由用户明确分配。

## 49. N-002 用户评审完成（2026-09-15）

用户明确要求完成 N-002 用户评审。评审依据为当前 HEAD `28ef63ab3311249c26f44b34542014acfd6a2a3f`、§48 的实际实现说明、覆盖矩阵、锁定 Pi 自动化证据和最终七项工程门结果。评审确认 development-plan §9.4 条目 1～6 均已具备本地证据：结构化最近上下文、处理入口与安全精确目标、失败/取消/生命周期边界、N-001 填入保护与不自动发送、必需自动化门及 INV 映射均满足；没有增加 N-003 菜单、结果历史或恢复系统。

N-002 用户评审状态更新为 `COMPLETED`。security-invariants §16 的 N-002 映射保持 `PASS`，适用 `INV-002/003/005/007～010/012/013/016/019/020`；该 PASS 仅表示本地工程与受控锁定 Pi 自动化证据，不扩大为真人理解或宿主全局防护证明。Human Validation、真实人工 TUI、用户实际发送、参与者研究、远端 CI 和发布仍为 `NOT_RUN`。

本次评审未执行 N-003/N-004，未重启 Pi Web，未修改源码、测试、package、lockfile、版本或外部状态；保留当前工作树中的 N-002 实现与测试修改。下一可分配任务为 N-003，但不自动开始，须由用户另行明确分配。

## 50. N-002 代次绑定修复与回归复测（2026-09-15）

本节记录用户在 N-002 用户评审后要求修复的代次绑定问题。修复仍只属于 N-002，不启动 N-003/N-004，不重启 Pi Web，不改变已发布 `@hugo-ddt/agentglass@0.8.0` 的公开能力。

### 50.1 修复范围

- 在 `src/adapter/pi/adapter.ts` 增加共用的内部操作启动代次入口。安全示例、恢复和清理命令均在第一个 `await` 前取得代次，完成时沿用该代次发布最近上下文。
- 内部结果只有在 session/cwd 和代次校验接受后才更新 `latestResult`、操作卡或欢迎面板；迟到结果不会把自身重新编号成新结果，也不会无条件覆盖当前 UI。
- 工具调用原有的启动代次、结果关联和生命周期保护保持不变；没有新增存储、重试、授权复用或恢复系统。

### 50.2 回归证据

新增 `tests/integration/pi-adapter.test.ts` 的 `N-002 rejects late internal example, restore, and cleanup results` 场景。测试在示例、恢复、清理审批等待期间分别发布一个更新的安全阻止结果，然后确认：实际已批准操作的文件事实仍如实保留；旧内部结果不覆盖操作卡/欢迎面板；`/agentglass process` 仍处理更新后的安全阻止结果；没有自动重试或自动发送。

环境仍为 Windows、Node `v24.14.0`、npm `11.9.0`、锁定 Pi `0.85.1`；HEAD 仍为 `28ef63ab3311249c26f44b34542014acfd6a2a3f`。package/lockfile、`.gitignore`、版本、运行时依赖和外部发布状态未修改。

| 命令 | 退出码 | 实际结果 |
|---|---:|---|
| `npm run typecheck` | 0 | `tsc --noEmit` 通过 |
| `npm run lint` | 0 | Biome 检查 45 files，无 error |
| `npm run build` | 0 | `tsc -p tsconfig.build.json` 通过 |
| `npm run test:unit` | 0 | 8 files / 65 tests PASS |
| `npm run test:security` | 0 | 9 files / 65 tests PASS |
| `npm run test:integration` | 0 | 2 files / 37 tests PASS |
| `npm run test:e2e` | 0 | 1 file / 15 tests PASS |
| `git diff --check` | 0 | 通过；仅有文档 CRLF 转换提示 |

本次只修复结果代次与 UI 发布边界，未改变 risk/classification 规则，故 `npm run test:corpus` 为 `NOT_RUN`。Human Validation、真实人工 TUI、用户实际发送、参与者研究、远端 CI 和发布仍为 `NOT_RUN`。Pi 遵守请求与草稿填入仍分开报告：本次新增回归只验证 Pi/adapter 的安全阻止和本地 UI 状态，不证明模型会遵守未发送草稿。

### 50.3 Done Definition 与状态

N-002 §9.4 的代次相关要求经补丁和回归测试重新核验：内部操作在开始时绑定代次，迟到示例/恢复/清理结果不能覆盖新结果；现有 session/cwd、read 不覆盖、无自动重试/发送、输入框保护和安全门保持通过。N-002 状态维持 `COMPLETED（本地工程门、用户评审及修复复测完成）`；适用 `INV-002/003/005/007～010/012/013/016/019/020` 映射维持 `PASS（本地工程与受控锁定 Pi 自动化证据）`，其中真人理解、宿主全局防护和 Human Validation 不在该 PASS 内。

下一可分配任务仍为 N-003，但本次不自动开始。未执行 commit、push、tag、PR、发布或 Pi Web 操作。
