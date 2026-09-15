# AgentGlass 开发计划

> 版本：3.3 · 2026-09-15 · 正式任务源 · 当前发布基线仍为 `@hugo-ddt/agentglass@0.8.0`；N-001 已完成本地实现并待用户评审，N-002～N-004 未分配；Pi Web W-001～W-005 继续暂缓

## 当前状态与下一步

**2026-09-15 当前阶段修订（v3.3）：** 在恢复 `0.8.0`、暂缓 Pi Web 的决定上，用户选定 A＋C＋D：常用任务起步器、卡住后的处理入口、结果后的下一步菜单。N-001 已按第 9.3 节完成本地实现、锁定 Pi 合约测试与工程门，待用户评审；N-002～N-004 不自动开始。W-001～W-005 的历史记录不作为当前能力或下一任务授权，重启仍须新分配与新证据。

R-001 已按明确分配执行至历史证据边界。历史候选 HEAD 不代表当前工作树；本次 N 阶段文档规划核对的 HEAD 为 `d8aff3d1a952c0b23659985d1728091fd19aba32`。已直接读取相关文档及被忽略的 AGENTS.md；历史验收是依赖证据，不是本次重跑结果。见 references §44。

| 项目 | 已有证据 / 当前状态 | 下一步 |
|---|---|---|
| Beta 文件闭环 | B-001～B-004 已完成；references §26：24 files / 193 tests，Windows 真实 Pi/PTY 代理场景 PASS | 沿用实现，Release 改动按影响重验 |
| 工程版本 | 当前发布基线为已发布的 `@hugo-ddt/agentglass@0.8.0`、MIT；Pi coding-agent/pi-tui peer 为 `>=0.84.3 <=0.85.1` | 当前只承诺 Windows；测试区间外不作兼容承诺 |
| 兼容与宿主缺陷 | Windows 与 Debian Node 22.19/24.14 工程 gate、权限/恢复及真实 TUI 子项通过；超限 edit 仍在 AgentGlass 回调前触发 Pi 预览栈溢出 | 已登记为外部 Pi 宿主缺陷，延期到后续版本；按用户决定作为当前版本已知限制，不阻断 R-004 |
| 安装与分发 | 已发布 `0.8.0` 已从官方 registry 安装验证；未将 `0.8.1` 评审候选作为当前产品 | 沿用 `0.8.0` Quick start；不改变全局配置 |
| 性能与资源 | 当前发布线沿用 `0.8.0` 的 R-003/R-004 证据；W-005 的 `0.8.1` 测量仅作历史记录 | N-004 复验新手阶段候选预算，不执行 Pi Web 门 |
| 发布 | `RELEASE_READY=PASS` 仅对应已发布的 `0.8.0`；Pi Web 阶段不发布 | 暂缓，无下一发布候选 |

R-001～R-004 是已完成首发的历史任务；N-001 已完成本地实现并待用户评审，下一可分配任务为 N-002，当前不进入 Pi Web。Pi 超限预览等外部限制继续按 `0.8.0` 已知限制处理；详见第 6 节与 references §40。各轮可复制[新手阶段 Codex Prompt 手册](novice-codex-prompts.md)，完成一轮并评审后再明确分配下一轮。

历史 Release 分配示例保留在 [Release Codex Prompt 手册](release-codex-prompts.md)；本阶段使用上述新手阶段手册。两者均只展开对应计划，不构成新的任务规范或自动执行授权。

版本 1.1 修订时仅优化最终产品设计，尚未实施 A-002；A-002 后续已按本表 Done Definition 完成。历史总纲中的相同编号不代表当前任务含义；以本表交付和 Done Definition 为准。[历史执行手册](AgentGlass%20codex执行步骤.md)保留 Alpha/Beta 分配示例；Release 直接使用本计划第 6 节，不另立任务规范。保留四个 Alpha Batch 及评审顺序，文档设计不自动授权实现。

## 1. 工作规则

- 一次只实现明确分配的 Task；整批被明确分配时才顺序完成整批。
- 先读当前任务、[安全不变量](security-invariants.md)和相关规范，再检查实现与测试。
- 不提前建立未来目录、类型、配置、存储或兼容层。
- 必需 gate 失败时任务未完成；真人测试未实际执行时写 `NOT_RUN`。
- 风险规则变更必须包含命中、相邻反例和故障用例，不以 fixture 总数代替覆盖质量。

```text
Batch 1：A-001 → A-002 → A-003 → A-004
Batch 2：A-005 → A-006 → A-007 → A-008
Batch 3：A-009 → A-010 → A-011 → A-012
Batch 4：A-013 → A-014 → A-015 → A-016
```

## 2. 工程基线

| 项目 | 当前工程基线 |
|---|---|
| Runtime | Node >=22.19.0、TypeScript strict、ESM |
| Package | npm + lockfile |
| Pi | 开发与集成测试固定 `@earendil-works/pi-coding-agent@0.85.1` |
| UI | Pi TUI、本地 zh-CN 模板、无需 LLM |
| 工具范围 | 已验证内置 `read/write/edit` |
| 状态 | 审批仅内存；Beta/R-001 已有单文件核验、schema v3 敏感恢复证据和当前会话最近入口；无普通事件存储、历史/redo 或 profile |
| 网络 | AgentGlass 自身不主动联网 |

每次实现任务至少运行 `npm run typecheck`、`npm run lint`、`npm run build` 和任务指定测试。尚未建立的 suite 不运行，也不创建空测试。

## 3. Alpha 任务

### Batch 1：最小安全入口

| Task | 交付 | 必需检查 |
|---|---|---|
| A-001 | 已完成：package、TS/Biome/Vitest、真实 Pi 加载 smoke | typecheck、lint、build、integration |
| A-002 | 已完成：实现 Alpha 最小领域类型和 Pi import 边界；保留 action/effect/target 与执行绑定关联，不创建 Beta 类型 | unit、security；Core 无 Pi import、展示标签不作身份键 |
| A-003 | 已完成：Canonicalization v1、SHA-256、投影脱敏和资源限制 | unit、security；顺序、非法值、循环、超限、假秘密 |
| A-004 | 已完成：映射 Pi tool_call、真实 cwd/session/toolCallId、TUI 能力和当前 sibling | integration、security；身份缺失、模式差异、生命周期清理 |

### Batch 2：窄而确定的策略

| Task | 交付 | 必需检查 |
|---|---|---|
| A-005 | 已完成：只分类已验证内置 `read/write/edit`，完成真实路径、敏感与范围预检 | corpus、security；项目内外、链接、malformed、敏感文件 |
| A-006 | 已完成：纯函数实现保守 Bash classifier；仅有明确运行环境、解析和具体实现语义证据的静态简单只读命令成为 fast-path 候选；合法但不支持语法 ask，破坏性证据和必需预检失败 block；PowerShell 不进 fast path，不写通用 interpreter | corpus、security；累计至少 80 个 shell fixtures，覆盖参数位置、Git/config、动态语法、PATH/alias/function 不确定性，危险样本只分析不执行 |
| A-007 | 已完成：最小确定性决策；普通 read 自动继续，普通 write/edit 询问，其余阻止 | unit、corpus、security；规则错误失败关闭、无 LLM 决策 |
| A-008 | 已完成：sibling 中两个及以上 state-changing/unknown 动作阻止并要求顺序重试 | integration、security；read+read、read+write、write+write、信息缺失 |

### Batch 3：一屏结果审批闭环

| Task | 交付 | 必需检查 |
|---|---|---|
| A-009 | 已完成：从标准化动作、风险和可选 shell 分类事实生成稳定 PredictedEffect；区分已知/未知、完整/有限范围并固定应用结果不可核验 | unit、corpus、security；新建/修改/覆盖、安装/网络/进程、不支持 shell、未知命令/目标，未知或越界目标保持阻止 |
| A-010 | 已完成：只为规范支持的普通单文件 `write/edit` 保存有界、版本化的敏感 pre-image evidence；记录存在状态与权限，manifest 最后原子发布；任何成功/失败均固定 `canRestoreNow=false`、恢复等级 unknown | typecheck、lint、build、unit、security；既有/新文件、权限、链接、特殊文件、单文件/总量限制、权限/磁盘故障注入、中断发布、合成秘密、失败降级 |
| A-011 | 已完成：TUI Continue/Stop/查看详情；普通读取合并提示；取消与阻止给 Pi 明确原因；Continue 非默认焦点，无 UI 阻止 | integration、security；Esc、关闭、异常、重复点击、批次重试/取消不循环催促 |
| A-012 | 已完成：五项绑定重校验、单次消费和完整 `read/write/edit` 垂直链路 | integration、security；逐项变化、重放、取消、输入变化 |

### Batch 4：证明产品而非扩范围

A-015 前基线：既有四类测试合并运行，22 files / 126 tests PASS，命令与边界见 references 第 15 节。当时 Pi 集成以真实 SDK、手动事件和受控 UI 为主，部分测试直接调用内置工具，且尚无 `test:e2e` 或 CI 工作流；这不是 Batch 4 验收结果。A-015 已新增最小 Windows CI，实测见 references 第 16 节；`test:e2e` 仍由 A-016 建立。

| Task | 依赖 | 交付 | 必需检查 |
|---|---|---|---|
| A-013 规则覆盖补齐 | A-012 与 Batch 3 review | 已完成：现有分类、11 条风险规则及 sibling 策略的命中/相邻反例/适用故障映射，补齐缺口并报告分布 | typecheck、lint、build、corpus、security；修改影响其他链路时追加对应 suite |
| A-014 安全证据映射 | A-013 PASS | 已完成：INV-001～020 到具体断言、测试名称、人工审查及阶段限制的可追溯表；补充 Pi-only adapter 结构断言 | typecheck、lint、build、security、corpus；适用 integration/unit |
| A-015 Pi 合约与最小 CI | A-014 PASS | 已完成：锁定 Pi 模式/身份/生命周期合约，模块边界、本地文档一致性审查及单个 Windows CI 工作流 | npm ci、typecheck、lint、build、unit、corpus、security、integration；CI 配置检查与实际运行状态分开报告 |
| A-016 真实调度 E2E 与 Alpha 总验收 | A-015 PASS | 已完成：新会话加载实际扩展，由 Pi 执行循环调度文件工具；建立 test:e2e 并接入已有 CI；最终 Batch 4 review 与适用自动化门槛通过。Human Validation 仍为 `NOT_RUN`；A-016 完成时 Beta 准入关闭，当前代理准入规则见第 3～4 节 | npm ci、typecheck、lint、build、unit、corpus、security、integration、e2e、package dry-run |

#### A-013 Done Definition

- 复用现有 tests/corpus、tests/security 和 fixtures；按规则列出命中、只改变关键条件的相邻反例、适用故障的具体测试名称。故障不适用时写原因，不能用空测试占位。
- 覆盖文件身份/schema/路径/敏感性、shell 分析、11 条风险规则、优先级聚合及 sibling 完整性/变更计数；不把只有 rule ID 的映射当作断言证据。
- 记录实际样本数与统计口径，区分 Vitest test 数和循环中的 fixture 数。shell 的 candidate_fast_path/ask/block 与产品 auto_allow/ask/hard_block 分开统计；unknown 自动放行为 0，Critical 全部 hard-block，明确变更不得 auto-allow。
- 保留 A-006 至少 80 个 shell fixtures 的既有要求，不新增历史 150 总量门槛，不复制样本凑数，不接通 shell 执行。

#### A-014 Done Definition

- 在 security-invariants 第 5 节维护 INV-001～020 映射；每项列阶段、实际测试文件与名称、所证明的断言、未覆盖部分和本次检查结果。缺少自动化断言的适用项必须补齐；真人理解和产品声明审查单列。
- 补齐审批五项绑定及 hostExecutionId、单次消费、异常撤销、会话清理、秘密展示边界和前像敏感域的适用检查；saved/unavailable 均不得产生恢复承诺。
- 未来核验/恢复部分标为 Beta/Release 阶段不适用，不能因此略过同一不变量当前 Alpha 部分。未执行写 NOT_RUN，不把映射存在、测试名称或历史 PASS 当本轮通过。
- 映射使用现有 Markdown 表和测试，不建立运行时 registry、报告服务或新持久化层。

#### A-015 Done Definition

- 使用 Pi 0.85.1 真实包验证内置工具来源和 schema、同名覆盖/未知、TUI/RPC/print/json 与 hasUI 不一致、session/cwd 切换、关闭/重载、重复调用、输入变化及 sibling 上下文。缺失能力失败关闭，不更换依赖来迁就测试。
- 复用现有模块边界检查，覆盖 Pi coding-agent 与 pi-tui 的值/类型/动态导入等实际入口，并提供会被拒绝的反例；Core 不能携带 Pi 事件结构。审查中文阻止理由、目标标签、危险信息可见性及可行下一步，缺陷只作必要 Alpha 修复。
- 新增一个 Windows GitHub Actions 工作流：pull_request、push、workflow_dispatch 触发；一个 Windows job，Node 24.14.0、npm 11.9.0，依次运行 npm ci、typecheck、lint、build 和四个既有 suite。只读仓库权限，无密钥、无发布、无 continue-on-error 或空 suite；不建立跨平台矩阵。升级 Actions 时使用官方来源核验版本。
- CI 只依赖已跟踪代码、测试和 lockfile。docs/AGENTS 等当前被忽略的规范在本地直接检查，不强制加入 Git，也不让远端 job 因缺失本地规范而失败。实际远端执行未发生时写 NOT_RUN；本地必需 gate 和配置审查须通过，不能伪称远端 PASS，也不擅自推送来触发 CI。
- 本地核对任务、阶段、领域类型、文案和 references 的证据范围。test:e2e 在本任务尚未建立时为 NOT_RUN；首次引入由 A-016 负责。

#### A-016 Done Definition

- 隔离 cwd、Pi agentDir、会话及 snapshot 数据，加载包声明的实际扩展入口。测试侧提供确定性模型输出和受控 UI 输入，走 Pi 自身执行循环及阻止机制；不能用手动 emitToolCall 后直接 tool.execute 代替完整 E2E。故障注入仅在测试侧，不增加产品测试开关或生产模型调用。
- 示例为“读取并修改活动说明”。成功分支覆盖 read、新建 write、覆盖 write、edit 和 Continue；交互覆盖 Stop 默认焦点、详情后继续/停止、Esc/取消、无 UI 和 RPC。安全分支覆盖多变更、sibling 缺失、输入/目标变化、重放、会话切换、snapshot unavailable、未知及同名覆盖工具、Critical 合成输入阻止。
- 允许分支由测试程序独立读取目标并断言预期字节；阻止分支证明该动作未执行、目标未被该动作改变。目标漂移测试保留故障注入或外部写入，不能把它误算作 AgentGlass 放行效果。危险输入仅分析；安装/运行项目只验证拒绝，不真实执行危险 shell。
- 测试侧观察结果不写入产品状态或 UI。Alpha 不增加 tool_result verifier、结果卡执行后更新、恢复入口、事件存储、欢迎命令或产品随包示例；这些仍留在 Beta。
- 新建非空 `test:e2e`，在 A-015 工作流追加该 suite 和 `npm pack --dry-run --json`。完整运行表中全部 gate；真实 Pi smoke/contract 已包含在 integration，不复制运行冒充新增证据。包清单检查不替代 R-003 性能/包体预算验收。
- 输出环境、版本、命令、退出码、测试/样本数、场景矩阵、脱敏摘要、文件断言及限制。分别报告自动化 Pi 调度、真实终端操作、真人研究；后两者未实际执行保持 NOT_RUN。原始 transcript、秘密和 snapshot 内容不作为普通报告或 CI 附件上传。

各任务只修当前 Alpha 的必要缺陷并补回归，不弱化安全规则、不扩充 Beta。不新增运行时依赖、普通事件存储、通用 shell、恢复或核验框架。

Alpha automated gate PASS：支持范围内的执行前审批闭环经过真实 Pi 调度，全部适用自动化门槛通过且最终 Batch 4 review 完成；必需自动化失败不能称 Done。真实终端与真人研究状态独立列出，不能用模拟输入替代。

Beta 工程及收口采用第 4 节代理验证门槛：Alpha 自动化验收及最终 review 通过，当前阶段全部必需自动化、真实 Pi 调度、声明边界和关键误解代理场景通过，且用户明确分配具体任务。代理证据不得填写真人回答、选择、耗时或成功率；`Human Validation` 在无真实记录时始终为 `NOT_RUN`。研究包 §16 已完成 Alpha 代理准入闭环，结论为 `PROXY_ADMISSION_PASS`；这是当时的 B-001 准入记录；B-001～B-004 当前完成状态以第 5 节及 references §26 为准。跨平台、安装和性能预算仍按 Release 任务验收。

## 4. 代理验证门槛与真人研究状态

正式 Beta 准入与收口使用 `NON_HUMAN_PROXY`。代理验证复用现有 unit、corpus、security、integration、e2e、真实 Pi 包与声明审查，不新增模拟用户、评分模型或产品运行时框架。每个当前能力必须覆盖成功、拒绝/相邻反例和适用故障；任何必需 gate 失败均不得通过。

代理误解矩阵必须覆盖：

- 不看技术详情，能否说出将改变什么；
- 能否找到停止并理解 Continue 的含义；
- 能否理解“不能自动恢复”不等于“操作失败”；
- 不把工具成功当作文件、目标或应用功能已核验；
- 连续多次读取是否造成干扰，拒绝后是否仍反复被催促；
- 对无法运行项目的限制能否理解，是否知道返回对话，而不是猜测命令。

代理记录必须包含版本/HEAD、本地差异、环境、准确命令、退出码、测试与场景分母、失败原因和脱敏证据位置。固定文案检查只证明声明存在；受控 TUI 只证明交互路径；真实 Pi 调度只证明宿主执行链，三者不得互相冒充。

真人研究不再是 Beta 或 Release 的必需 gate；若以后执行，仍按研究包保存真实匿名记录。没有真实记录时 `Human Validation` 必须是 `NOT_RUN`，不得从代理结果推导“零基础可理解”、30 秒读卡、4/5 成功或其他真人指标。代理验证通过只允许声明相应工程和安全路径通过。

## 5. Beta：四项任务完成文件闭环

B-001～B-004 已按顺序交付并完成 Beta 代理收口。以下保留任务 Done Definition 与当时状态，便于追溯；单项完成时的“后续未运行”不覆盖 B-004 最终结果。真实终端为 Beta 代理范围 PASS，真人研究仍为 NOT_RUN。

### 当前代码基线与复用点

| 已有能力 | 代码/证据 | Release 工作边界 |
|---|---|---|
| 精确审批、路径/工具/sibling 检查 | adapter.ts、approval.ts、execution-input.ts、file-classification.ts | 沿用完整信任链；版本变化重验合约，不开放 shell 或并行恢复 |
| 文件结果核验与原卡更新 | file-verification.ts、stable-file.ts、outcome-card.ts、Pi tool_result 关联 | matched/mismatch/unknown 仅针对明确文件；不重新搭建 verifier |
| 单文件恢复与有界清理 | pre-image-snapshot.ts，schema v3；10 MiB / 100 MiB / 4096 条目 | 验证平台权限、故障和安装后的数据去留；v1/v2 旧前像不能恢复授权 |
| 同一入口与固定示例 | adapter.ts 的 /agentglass、欢迎/帮助/示例/恢复/清理 | 验证安装后能用、80×24 可读；不增加安装器或设置系统 |
| 五类测试与一个 Windows CI | unit 65、corpus 23、security 65、integration 26、e2e 14；references §26 | 复用现有 suite；R-001 按实际支持平台扩展现有 workflow，不建第二套框架 |

以上是 B-004 的历史实测：24 files / 193 tests；不是文档任务重跑。当前 package 的 Alpha 版本标签与 Beta 能力状态分开记录；对齐版本属于 R-002。

### 顺序与交付

每项是一个可评审的完整任务，不再拆成模块级 Task 或新增 Beta Batch。B-001 → B-002 → B-003 → B-004，逐项满足 Done Definition 后停止，等待下一项明确分配。

| Task | 依赖 | 完整交付 | 重点验收 |
|---|---|---|---|
| B-001 文件核验与原卡反馈 | Alpha 最终评审 + §4 Alpha 代理验证 PASS + 明确分配 | **已完成（2026-09-11，本地工作树）**：从执行前依据到真实结果关联、独立文件核验和同一卡片反馈；同时启用 Beta 必需备份及已有父目录限制，恢复暂不可用 | 成功/不符/未知、工具失败但文件已变、错序/重复/缺失结果、edit 语义、生命周期、无恢复误报；证据见 references §23 |
| B-002 最近一次单文件恢复 | B-001 PASS | **已完成（2026-09-12，本地工作树）**：版本化敏感证据、单独批准、冲突保护、恢复后核验、旧入口替代及有界清理；证据见 references §24 | 覆盖/编辑/新建逆操作、权限/配额/损坏/版本、竞争/中断、拒绝保留旧入口、重启不恢复授权 |
| B-003 一个入口与安全示例 | B-002 PASS | **工程与自动化已完成（2026-09-12，本地工作树）**：同一 /agentglass 欢迎/帮助、脱敏 cwd、最近结果、恢复/清理说明、固定无秘密示例和普通文件链路；真实终端人工走查仍为 NOT_RUN | 真实 Pi 入口、首次/再次启动、路径冲突、取消、换目录、无 UI、失败/不支持任务 |
| B-004 代理验收与 Beta 收口 | B-003 PASS | **PASS（2026-09-12，本地工作树）**：完整 Beta 代理矩阵、全部门禁、INV-001～020 回填和真实 Pi 支持/恢复/阻止路径已记录；隔离真实 PTY 补齐 mismatch、unknown 与秘密 snapshot 持久化边界 | 入门、修改、拒绝、结果未知、恢复、冲突、不支持任务；最终自动化回归、真实 Pi 调度与真实终端记录 |

编号映射仅用于理解旧引用：旧 B-001/B-002 合并为新 B-001；旧 B-003 → 新 B-002；旧 B-004 → 新 B-003；旧 B-005 → 新 B-004。它不是新增任务列表；历史记录保留当时含义。

### B-001 Done Definition

状态：**PASS（2026-09-11，本地工作树）**。仅表示本任务工程与安全门槛通过；B-002～B-004、完整 Beta、真实终端、跨平台与 Human Validation 均未据此完成。

- 先以锁定 Pi 0.85.1 真实包检查 tool_result、tool_execution_end 的次序、身份、失败/取消及结果修改语义和原卡更新能力，再接入当前 Adapter；契约证据写入 references。不保留完整事件、raw input 或原始 tool result，不把返回文本当核验依据。
- 沿用 action/effect/target 与执行绑定；在 raw input 的本次必要分析中形成最小预期后置摘要。write 核对预期字节；edit 对照锁定实现的匹配、换行/BOM、歧义和失败语义，不能从“替换成功”文本推断最终内容。无法可靠推导时保留 unknown。
- 修改前取得有效前像/不存在证据，继续后复核；备份失败、超限、目标不确定或会隐式创建父目录时 hard-block，不保留 Alpha 的“备份失败仍可批准”路径。更新对应正例、相邻反例、故障和旧 Alpha 测试预期，并明确阶段变化。
- 只观察明确目标；工具成功或失败都尝试独立核对。状态为 matched / mismatch / unknown，分别列已确认、未确认、检查范围；应用功能始终不可据此确认。重复/错序/跨会话/缺失结果不得错配或自动重跑。
- 同一动作卡承载待批准、执行中和核验反馈，不重复弹审批；普通 read 继续只更新一条状态。按 architecture §8 明确临时核验依据、超限与清理边界，退出/切换/迟到回调不会更新新会话卡片。
- 本项不提供恢复按钮，仍明确当前不能自动恢复。通过后才进入 B-002，不能称完整 Beta 已交付。

### B-002 Done Definition

状态：**PASS（2026-09-12，本地工作树）**。只表示 B-002 工程与安全门槛通过；B-003、B-004、完整 Beta、真实人工终端、macOS/Linux 和 Human Validation 未因此完成。

- 复用 A-010 敏感存储及 B-001 观察；只为当前会话最近一次有完整依据的单文件变更提供恢复。现有文件恢复必要原字节及受支持权限；新建文件只允许删除该项被证明创建的文件，不开放普通删除工具或目录恢复。
- 在 architecture 先定义本项实际需要的版本化恢复证据；Alpha schema v1 不含后置基线，不能就地补字段后当作可恢复。旧数据保留为待清理敏感数据；损坏、缺失、未来版本和不完整发布拒绝使用，不建通用迁移框架。
- 恢复卡、独立批准、五项绑定及唯一内部调用身份、批准后重检、单次消费、实际恢复、独立恢复后核验一起交付。冲突/路径漂移停止且保留后续修改；失败或中断报告实际确认内容，不自动重试或承诺事务性 Undo。
- 变更卡披露替代旧入口；拒绝、输入漂移、必要准备失败保留旧入口。按 architecture §8 与现有实现：新变更经独立核验、`ready` 发布成功且旧项 `superseded` 安全记录后才替换内存入口；准备、执行或发布未形成该条件时保留旧项，使用旧项仍须重新检查冲突，不重建已消费授权。恢复开始消费记录，失败不重建 token 或 redo；普通 agent_end 不清掉会话恢复入口，session/cwd 切换、reload、shutdown 使入口失效。
- 沿用 10 MiB 单文件、100 MiB 总逻辑字节（含临时发布）及 4096 条目；配额/权限/锁失败阻止新变更，不静默删备份。Windows 的恢复写入及目标权限必须在本项实际验证，不能等 R-001 才验证当前平台恢复。
- 在 /agentglass 提供最小当前恢复/数据清理入口；B-003 再补欢迎和示例，不另建命令。清理单独批准，仅处理已验证私有数据；展示数量、空间、能力损失，拒绝不删，部分失败如实报告，无法验证归属的数据保留。
- 自动化支持集覆盖覆盖写、edit、新建逆操作、外部改写、身份/权限漂移、重复批准、旧入口替代、重启、锁/磁盘/配额边界、损坏/future schema、恢复中断和清理拒绝/失败；真实 Pi 调度证明原变更及恢复入口相连。只保存备份不能称本项完成。

### B-003 Done Definition

状态：**工程与自动化 PASS（2026-09-12，本地工作树）；真实终端人工走查 NOT_RUN**。本状态不把受控 TUI 按键写成人工证据，也不把 B-004 完整 Beta 收口提前完成。

- 复用 B-002 的 /agentglass，不增加第二入口或必填设置/密钥；展示脱敏当前目录、支持范围、最近结果、可用恢复及清理说明。首次提示一次，随后按主动帮助或目录变化更新。
- 随包交付无秘密文本示例，示例准备单独说明位置并批准，冲突不覆盖；不能通过欢迎功能绕过普通文件审批。目录准备边界按 product-spec §6，不把安装/运行项目包装为文本任务。
- 欢迎、命令注册、目录切换/文件查看使用锁定 Pi 已验证能力；不具备时给具体下一步，不用 shell 补齐。示例正文与自然语言目标可用且实际包含在 package dry-run 清单。
- 真实 Pi integration/e2e 覆盖首次/再次使用、已有目标冲突、创建取消、当前目录变化、无 UI、拒绝后的下一步及不支持任务；记录宿主不能保证的后续模型行为。当前平台真实终端走查，不能以受控按键冒充人工操作。

### B-004 Done Definition 与统一门槛

- 按 §4、product-spec §7 和研究包 §15，对完整 Beta 运行代理矩阵；不得复用 Alpha 的执行前结果冒充核验、恢复或欢迎入口证据。记录受测版本、HEAD/差异、环境、场景、准确命令、分母、失败和修复后重跑。
- 代理场景包含 Pi 已就绪后的入门、成功修改、停止、结果不符/未知、恢复成功/冲突、不支持安装或运行任务；每项分别验证固定文案、受控交互、真实 Pi 调度和文件断言适用层级，不生成虚构参与者或理解结论。
- B-001～B-003 每项运行 npm run typecheck、npm run lint、npm run build 及现有五类 suite；分类/风险变化补命中、相邻反例和适用故障。涉及包内容的 B-003 追加 npm pack --dry-run --json。
- B-004 最终运行 npm ci、上述全部工程/五类 suite 及 package dry-run，回填 INV-001～020 的 Beta 断言、场景与限制。代理验证任一必需项失败都不能以历史 PASS、人工判断或较弱证据抵消。
- 最终结论区分 Beta 代理验证、真实终端、真人研究和 Release 未运行项。Human Validation 无记录时保持 NOT_RUN，但不阻止 Beta 工程收口；跨平台兼容、空白环境安装、性能预算和发布继续留给 R-001～R-004，不提前扩范围。

## 6. Release：可安装、可用、运行有界

Release 收紧交付证据，不扩展产品范围。每项依赖前项 Done Definition 实际通过并另行明确分配；本次明确决定允许 R-001 对已验证、无 AgentGlass 责任归属的 Pi 外部预览缺陷作“延期准入”，并将其作为当前版本已知限制与后续版本修复目标，不阻断 R-004。R-002～R-004 仍需分别完成，不因准入状态自动通过。Beta 历史 PASS 不能替代候选版本重验。

| Task | 依赖 | 交付与评审边界 |
|---|---|---|
| R-001 宿主与平台兼容收口 | B-004 PASS + 明确分配 | **PASS_WITH_DEFERRED_EXTERNAL_DEFECT**：矩阵、Windows/POSIX gate 与真实 TUI 子项通过；Pi tool_call 前超限预览缺陷登记为当前版本已知限制和后续版本目标，不作为 R-004 发布阻断项 |
| R-002 安装制品与分发准备 | R-001 `PASS_WITH_DEFERRED_EXTERNAL_DEFECT` + 明确分配 | **可进入**：测试实际打包制品的安装/启用/禁用/卸载；对齐版本、peer 支持声明、包名、许可证和数据说明；不发布，并持续披露 R-001 外部缺陷 |
| R-003 性能与资源预算 | R-002 PASS + 明确分配 | 在 R-002 候选制品上取得加载、预检、完整 I/O 路径、包体和长会话数据；仅修测量证实的问题 |
| R-004 最终候选验收 | R-003 PASS + 明确分配 | 完整回归、代理矩阵、安全/声明复审、候选制品及发布/撤回步骤；给出 RELEASE_READY，实际发布另行授权 |

### 统一证据与检查

- 每项代码变更运行 `npm run typecheck`、`npm run lint`、`npm run build` 及受影响的现有 `test:unit`、`test:corpus`、`test:security`、`test:integration`、`test:e2e`。风险变更包含命中、相邻反例和适用故障；不得放宽规则、跳过失败用例或依赖空 suite。
- R-001 的每个候选支持环境和 R-004 最终候选运行 `npm ci`、上述工程命令及全部五类 suite；真实 Pi 使用对应锁定包。R-002/R-003 涉及打包或优化时追加受影响检查及 `npm pack --dry-run --json`。真实 TUI 与独立文件断言不能仅由手动事件测试替代。
- 将证据继续追加到 references，更新 security-invariants 的适用映射。记录日期、HEAD/差异、OS/文件系统/终端、Node/npm/Pi、准确命令/退出码、分母、失败与复测、候选制品 hash。历史 PASS、本地 PASS、远端 CI、真实终端、Human Validation 分开报告；不上传 raw transcript、认证信息或 snapshot 正文。
- 复用已有 Windows workflow；增加平台 job 仅服务实际支持声明。配置正确不等于远端执行 PASS，未授权不推送触发 CI。被忽略文档本地直查，不能 force-add 或让远端测试依赖未跟踪规范。
- 代理场景缺测或关键误解未关闭不得发布。Human Validation 无真实记录保持 NOT_RUN，不是必需工程 gate；不得据代理结果宣传零基础理解率、耗时、成功率或“一键从零使用”。

### R-001 Done Definition：宿主与平台兼容收口（含本次受限准入决定）

2026-09-12 用户明确决定：不修改 AgentGlass 之外的组件；已确认无法在 AgentGlass 回调前安全拦截的 Pi 预览崩溃登记为外部宿主缺陷，延期到后续版本。由此允许 R-001 使用 `PASS_WITH_DEFERRED_EXTERNAL_DEFECT` 进入 R-002，但不允许将缺陷描述为已修复或 AgentGlass 已阻止；R-004 仍须重新检查并披露该缺陷。2026-09-13 用户进一步决定：该已披露的外部缺陷不阻断当前 R-004，作为后续版本修复目标保留。

1. 从 Pi 0.85.1、Node 24.14.0/npm 11.9.0 和 references §26 的 Windows 基线开始。复用既有真实包合约/E2E，确认内置来源/schema、edit 匹配/BOM/CRLF、事件顺序/结果改写、加载顺序/覆盖工具、sibling、生命周期、TUI 与 RPC/print/json 无批准路径。Node 的 engines 下限 22.19.0 与实测 24.14.0 分开列明；在最低拟支持版本和主测版本实测，不能将 `>=` 或 peer `*` 当兼容证据。
2. **超限 edit 是首要兼容性已知限制。** 在隔离环境重现 Pi 内置预览、AgentGlass tool_call 前的栈溢出，记录输入规模、终端状态和目标文件未变；普通输入、边界输入和超限行为均须有回归。用户/模型仍能产生此输入，单写“不支持超限”不能关闭风险，也不能将其写成 AgentGlass 已成功阻止。本项以“外部缺陷已复现、无 AgentGlass 安全修复点、延期到后续版本”记录；按 2026-09-13 发布决定不阻断当前 R-004。
3. 如需升级 Pi，先核验候选官方源码/修复，再同步 coding-agent/pi-tui、lockfile、相关测试与 references，并重跑完整安全/合约/调度和实际预览路径；不得仅改一个版本断言、覆盖内置工具、修改模型参数或绕过预览来伪装修复。候选版本变更时必须重新收口；当前延期决定不授权外部组件修复。
4. 至少实测 Windows 与一个 macOS/Linux 环境，逐个记录路径分段/realpath、链接/特殊文件拒绝、大小写与 Unicode 路径、权限失败、前像私有权限、恢复字节及目标权限复核、冲突/中断/清理。Windows 必须实际核对 ACL；POSIX 必须实际核对 mode，不能用另一平台结果代替。未测/未通过平台明确排除，但不能借排除跳过“Windows + 至少一个 POSIX 环境”的本项门槛；缺环境保持 NOT_RUN。
5. 在候选环境走实际 Pi TUI 的帮助/示例、read/create/edit、拒绝、matched/mismatch/unknown、恢复成功/冲突和清理；检查 80×24 普通卡与必要危险信息可见性、中文/窄窗口/错误退出反馈。不把终端驱动记录当真人研究，也不把无 UI 的安全阻止当交互支持。
6. 完成支持矩阵、失败与解决记录、适用安全映射和候选版本决定；错误放行、恢复覆盖、权限缺口或 AgentGlass 自身的预览/审批安全缺口仍不得 PASS。已证明发生在 AgentGlass 回调前且无产品侧安全修复点的外部 Pi 预览崩溃，可标为 `PASS_WITH_DEFERRED_EXTERNAL_DEFECT`，作为已知限制和后续版本目标；按当前发布决定不阻断 R-004。不顺带开发安装器、通用兼容层或第二宿主。

### R-002 Done Definition：从制品证明可安装

1. 使用 R-001 已验证的宿主组合与 Pi 官方已有安装/包管理渠道；先核对该版本本地文档/实现，必要时查官方来源，不凭历史命令猜测。用隔离用户目录与无秘密项目构建实际 tarball，再从该制品安装；不能只用源码 `pi -e` 或 dry-run 证明安装成功。
2. 分开记录“Node/npm 与 Pi/模型已就绪”及“空白环境补齐前置条件”的完整步骤、外部账号/网络/终端需求和失败下一步。在本版本拟支持的 Windows 环境验证安装后加载、重启、唯一入口、安全示例、普通审批/核验/恢复链路；POSIX 不在本版本支持声明内，不作兼容承诺；空白环境缺失保持 NOT_RUN，不推导一键安装。
3. 验证启用/禁用/卸载及重新安装的实际宿主行为；说明禁用后 AgentGlass 不再保护后续调用，不把禁用作为被阻止任务的下一步。区分扩展卸载与敏感数据清理：优先在卸载前从 /agentglass 单独批准清理；未清理数据的真实位置、权限、保留和重新安装后不恢复旧授权均须实测。不能用卸载脚本静默删除副本或项目文件。
4. 核实候选包名/分发渠道；许可证由用户明确授权，不擅自把 UNLICENSED 改为开源许可。准备可审阅的选择和影响再取得必要决定。依据支持矩阵对齐 package 版本、lockfile 与 peer 声明，测试区间之外不作兼容承诺；当前候选为 `0.8.0`，不宣称已发布 v1。
5. 检查真实制品入口、所需 src/dist、固定示例和用户说明，不含 tests、研究材料、秘密或私有恢复数据；构建/安装不依赖本地 node_modules 或未随包规范。README 当前链接指向被忽略的 docs，须提供随包自足说明或已实际可访问的正式资料，不能交付死链接。不修改 .gitignore 或强制跟踪文档来替代分发决定。
6. 记录制品 hash、清单/大小、安装/卸载命令和文件断言，补真实制品安装回归；不在此项上传包、创建发布标签或发布页面。

### R-003 Done Definition：测量完整成本

1. 复用 Node 标准库与已有测试侧工具，增加最小可重复测量入口，不引入产品埋点、后台服务或基准框架。在 R-002 安装后的候选上记录机器、负载、版本、输入集、冷/热条件和测量命令；按 architecture §10 的 100 次预热与 1000 次固定样本报告纯预检 P50/P95。
2. 同机裸 Pi/加载扩展对照，记录多次运行分母与分布，加载增量目标 ≤350 ms；普通输入 ≤64 KiB 时纯预检 P95 ≤50 ms。明确纯预检所含函数与排除项，不能把异步路径检查、快照或安全步骤从整体成本中隐去。
3. 分列 realpath/文件 I/O、前像保存、Windows 短时 PowerShell ACL 子进程、预期 edit 推导、核验、恢复及清理耗时；用户等待和 Pi 模型耗时另计。现有实现存在按需 ACL 子进程，不声称零子进程；禁止的是额外常驻服务。完整变更延迟即使不受纯预检预算约束也必须披露。
4. 按 product-spec §7 验收 ≤2 MiB 制品增量，同时报告压缩和解包字节，采用解包字节作预算判定；不含 Pi、开发依赖和用户恢复数据。B-004 dry-run 的 113,473/454,616 bytes 仅作历史参考，不能抵扣本轮测量。
5. 验证 10 MiB 单文件、100 MiB 总逻辑字节（含临时发布）与 4096 条目在边界/超限、遗留数据、锁竞争和失败下的行为：新变更阻止，旧数据不静默删除。记录长会话重复读取/修改/取消、agent_end、session/cwd 切换、reload/shutdown 后的关联释放与内存趋势；达到配额是预期停止，不为跑基准自动清理用户副本。
6. 源码审查结合隔离运行观察确认无 AgentGlass 主动网络、监听端口、常驻服务或新增必填配置；Pi 模型联网和 ACL 子进程单列。超预算先定位、最小修复并重验；不能跳安全检查或测完后默默改阈值。确需预算变更，说明证据并同步正式规格、另行评审后再判定。

### R-004 Done Definition：候选可发布，不等于已发布

1. 固定最终候选 HEAD/本地差异、包版本、Pi/Node/平台矩阵与实际 tarball hash；确认 R-001～R-003 必需证据已收集，且除已明确接受的外部宿主已知限制外无 FAIL/NOT_RUN 被历史记录抵消。候选或依赖变化后重新执行受影响 gate，制品变化重测包体、安装和相关预算。
2. 在支持矩阵上完成统一全量工程/五类 suite、制品安装 smoke 和实际终端关键路径；在最终候选重跑 B-004 完整代理矩阵，含停止、不符/未知、冲突、备份失败、敏感/越界/未知工具、无 UI、不支持安装/运行目标和宿主超限预览回归。外部宿主缺陷须准确记录并在随包说明中披露；按当前决定不阻断 R-004。分别报告本地与实际远端 CI 状态，不伪称未发生的 CI。
3. 复审 INV-001～020、威胁模型、秘密展示/敏感持久化边界及发布依赖风险；发现项列可达路径、处理与回归证据，未关闭的严重安全/数据丢失问题阻止发布。不为了消除告警盲目升级锁定宿主或引入运行时网络检查。
4. 准备随包可读的使用/安装/卸载、恢复与数据说明、版本限制和已知问题；宣传限定 Pi 普通文本文件任务。明确无 sandbox、无跨会话 Undo、无应用功能保证、无恶意共存扩展隔离；Human Validation 按真实状态列为 NOT_RUN，不生成真人数据。
5. 给出发布清单与分发渠道所支持的撤回/弃用/退回已知版本步骤；扩展版本退回不是用户文件恢复，不承诺恢复新 schema 数据或旧批准。最终报告逐项给出 RELEASE_READY=PASS/FAIL/NOT_RUN，包含待用户决定的事项与准确拟发布制品。
6. R-004 工程 PASS 只代表候选可发布；上传、tag、release、推送仍须用户明确授权，针对已审阅制品执行。未经授权不发布，也不将“准备完毕”写成“已上线”。

通用命令、安装/运行项目、跨会话恢复栈、学习系统、时间线及 Web UI 均不属于首发任务；只有出现具体用户阻碍才另行评估。不得为它们预建扩展点。

## 7. 完成报告

每次任务或批次报告：Scope completed、Files changed、Automated checks、Security/corpus results、Done Definition、Known limitations/NOT_RUN、Next eligible task。不得把计划状态写成实际完成。
本轮 B-004 状态：**PASS / BETA_PROXY_ACCEPTANCE=PASS**。自动化代理矩阵与所有工程、安全、corpus、package gate 均通过；真实 PTY 已覆盖 Pi 0.85.1 的主要支持/恢复/阻止路径，并用仅存在于隔离测试目录、随后删除的先加载故障扩展，在真实模型 `write` 完成与 AgentGlass 观察之间分别制造明确字节矛盾和不受支持目标，实际得到 mismatch 与 unknown 卡片且无恢复入口。另一隔离真实 PTY 让普通文件前像含合成 canary、写入输入不含 canary，扫描确认 canary 只存在于一个 `.preimage` 敏感正文，manifest 与覆盖后项目文件均无命中。Pi 0.85.1 的超限 `edit` 仍会在 AgentGlass `tool_call` 前由宿主内置预览触发 `ToolExecutionComponent.render` 栈溢出；目标未变，且覆盖内置工具或改写模型参数会破坏 INV-007/020，因此不伪装修复，作为不受支持输入的宿主兼容性问题移交 R-001。证据见 `references.md` §26 与 `security-invariants.md` 的 B-004 回填。

本轮 R-004 最终候选验收记录见 `references.md` §36（含本次受影响 gate 重跑）与 `security-invariants.md` 的 R-004 修补候选复审：上一轮 Pi 诊断包的随包 manifest 入口已通过根入口修复，并在新鲜隔离组合中以 `.1` 制品重测安装、preview 和实际 TUI read/edit；官方 Pi 0.85.1 的 8 MiB `edit` 预览仍在 AgentGlass 回调前以 `RangeError` 退出。2026-09-13 用户决定不在 AgentGlass 中修复该外部缺陷，将其记录为后续版本目标，不阻断当前 R-004。README 同步后的新 AgentGlass tarball 已重新打包并完成隔离安装 smoke；准确制品、hash 与命令见 `references.md` §36.6。远端 CI 和 Human Validation 保持 `NOT_RUN`；本轮没有 commit、push、tag、上传或发布。

## 8. Pi Web 适配：W-001～W-005（当前暂缓，历史证据保留）

本节是未来阶段的正式任务源，但当前不执行。2026-09-15 用户决定先维持已发布的 `0.8.0` 与 TUI-only 产品边界，暂不做 Pi Web 插件适配；此前 W-001～W-005 的实际记录仍保留，作为历史证据而非当前发布能力。恢复本阶段必须重新明确分配，并重新核对依赖、候选和制品。任务提示词见 [Pi Web Codex Prompt 手册](pi-web-codex-prompts.md)。

### 8.1 目标、基线与边界

- 在同机 Edge/Chrome 完成读取、单文件创建/覆盖/编辑、明确审批、独立核验、最近一次恢复，以及同一 `/agentglass` 的帮助/示例/清理；保留 TUI 功能。优先复用现有卡片与键盘，不建设原生网页卡片系统。
- 调研基线是 AgentGlass 0.8.0、Pi Web 0.9.1（提交 `553f2d774c37a976dd94f44e34ced24674829295`）、Pi 0.85.1；来源与证据等级见 references §41。W-001 核对包与源码，冻结实际组合；不能使用漂移的 latest。依赖变化重新验证，不盲目扩大 peer。
- 平台矩阵为 Windows、Node 22.19.0/24.14.0、Edge/Chrome；记录实际 OS、文件系统、npm 与浏览器版本。仅本机回环访问；跨平台、LAN、手机、远程审批不在本阶段范围。
- 不新增 AgentGlass 服务、端口、主动网络、运行时依赖、账户、配置模式、持久化事件、恢复历史或多宿主抽象。复用 Pi Web 已有进程与传输，其服务成本另计。
- 只保护进入现有检查链且身份已验证的 Pi 内置 read/write/edit。Pi Web 自带上传、终端、Git、设置及其他直接操作不纳入保护；宿主 transcript/工具显示不承诺全面脱敏；不支持子代理并行变更。
- 当前 RPC 拒绝策略仅对锁定 W-002 checkout 暴露的、版本化且动态可用的 `agentglass.pi-web.approval` v1 bridge 放行；不以 hasUI、环境变量或方法存在代替资格验证，普通 `rpc+hasUI`、print/json 和未知客户端仍拒绝。安全行为与连接契约以 architecture §12、security-invariants §15 为准。

### 8.2 任务顺序与状态

| Task | 依赖 | 交付 | 当前状态 |
|---|---|---|---|
| W-001 规范与真实宿主合约 | 首版发布证据 + 明确分配 | 锁定组合、真实调用链、版本化通道契约及最小上游补丁范围 | DEFERRED（历史记录保留） |
| W-002 Pi Web 审批通道补齐 | W-001 PASS + 评审 + 明确分配 | 在 Pi Web 现有桥接内完成安全通道及合约验证 | DEFERRED（历史本地补丁记录保留） |
| W-003 AgentGlass 完整接入 | W-002 PASS + 评审 + 明确分配 | 浏览器完整文件闭环及 TUI 回归 | DEFERRED（历史联调记录保留） |
| W-004 安全与浏览器验收 | W-003 PASS + 评审 + 明确分配 | 实际浏览器、真实 Pi 调度、安全/故障代理矩阵 | DEFERRED（历史验收记录保留） |
| W-005 制品与交付准入 | W-004 PASS + 评审 + 明确分配 | 准确制品、安装/成本/支持说明、WEB_COMPAT_READY | DEFERRED（历史未完成记录保留） |

W-002 可以针对锁定本地上游补丁验收，但该证据只允许后续开发联调；不代表公开发布版本已兼容。没有可获得的合格宿主制品时 W-005 不能 PASS。实际提交 PR、push、tag、上传、发布都不包含在这些任务中。

### 8.3 W-001 Done Definition：锁定真实合约

历史状态：PASS（证据与精确契约见 architecture §12、references §41；不代表当前 `0.8.0` 启用 Pi Web）。

2026-09-14 状态修正：用户确认 Edge、Node 22、远端 CI、公开上游补丁/发布及 Human Validation 均已完成；当前统一记为 `USER_CONFIRMED_COMPLETE`。对应可审计制品、CI run、上游发布链接和真人记录尚未在本节或 references §41 回填，因此不将其自动改写为工程 `PASS` 或真人指标。

2026-09-14 W-002 入口审查补充已完成：在 architecture §12 补齐了现有两个路由内的 `connected`→`extension_ui_handshake` 顺序、first-valid-handshake owner 规则、observer/断线不晋升、generation/revision/expiry 语义、与 Pi session liveness lease 的隔离、固定 JSON 错误 body 及 Origin/Host/Fetch Metadata 回归要求。该行记录的是实现前入口审查；后续本次明确分配已在锁定 Pi Web checkout 完成 W-002，实际结果见 8.4 与 references §41.5。

1. 核对首版代码、实际测试与 references §40；在隔离环境核对 Pi Web 包版本、完整源码提交、Pi 依赖、加载顺序、项目信任设置与扩展装载。记录 tarball/hash 或源码/lockfile，不以 main 或缓存网页代替实际制品。
2. 用真实 Pi Web/锁定 Pi 验证内置工具来源/schema、sibling 完整性、事件顺序、阻止结果、工具结果、slash 命令与 session/cwd 生命周期。可用测试侧确定性模型驱动，不调用真实收费模型、不改生产工具身份；不得以手动 emit 后直接 execute 代替真实调度。
3. 验证现有 custom/select/widget/status、默认焦点、取消、Stop、重载、渲染错误、重连请求重发和多客户端路由。只记录实际观察；当前失败关闭、无法审批是基线行为，不作为已完成兼容。
4. 在 architecture §12 收敛实现级契约：能力标识与版本、服务端会话/连接代次、请求归属、渲染有效性、输入接收、取消/超时/断线、同步有效性复核和有界内存。具体 API/字段/错误和测试映射必须在本项完成，不能将协议设计留给 W-002 猜测；优先现有接口，不创建通用框架。
5. 明确本地 Pi Web checkout、准确补丁范围及独立测试命令；若无现成检出，使用隔离开发目录，不触碰全局安装与真实用户会话。同步所有受影响规范和适用 INV 映射，给出可复现合约证据。可增加必要测试，禁止产品实现、打开 RPC 许可、提前实施 W-002。
6. W-001 PASS 指基线与契约完备，包括已确认的宿主缺口及 W-002 修补标准；不要求未开发的通道已可用。未取得必需真实合约证据、协议仍未收敛时保持未完成。

### 8.4 W-002 Done Definition：安全浏览器通道

1. 在 W-001 锁定 Pi Web 源码与现有连接/UI 桥接中实现最小配套改动，不新增服务器、端点体系或 AgentGlass 专用网页。需要超出已冻结契约时先同步规范，不降低安全门槛。
2. 实现架构规定的能力和审批请求关联；只有当前合格本地连接拥有待审批输入权，多标签页不得混合按键或转移请求。关闭、取消、Stop、断线、切换、超时、reload/shutdown 使相关请求失效；重连不重发可用的旧审批。
3. 渲染失败立即撤销请求并使用固定安全文案，不输出原始异常。渲染有效性与输入处理不能让“看不到卡片但还能继续”成立；必要危险信息不能在可提交审批时被隐藏。
4. 实现服务端有效性复核，拒绝迟到、重复、跨会话/连接和未来版本响应；状态及时释放、无持久化审批或日志正文。断线失效只撤销尚未执行授权，不能自动重试或假装撤销已执行效果。
5. 跑 Pi Web 实际类型、lint、适用测试与真实桥接用例；可用测试扩展验证通道，不提前改 AgentGlass 产品入口。记录上游补丁 diff/提交基线及全部命令。不要在普通开发阶段运行干扰现有服务的发布构建。
6. 没有上游合入/发布也可记本地锁定补丁合约 PASS，但必须明确其可用范围；不自动提交 PR、推送或发布。

历史状态：**PASS（2026-09-14，锁定本地 checkout；未合入、未发布）**。逐条结果与可复现命令见 references §41.5；该记录不改变当前暂缓决定。

1. **PASS**：仅修改锁定 Pi Web checkout 的现有 SSE/POST/UI 桥接、类型和适用测试；未新增 AgentGlass 服务、端口、网页、运行时依赖或配置开关。
2. **PASS**：实现版本化 capability、session/connection/generation/request/revision 绑定、first-valid owner 与 observer 不晋升；同请求只由 owner 接收。close/cancel/Stop/切换/reload/shutdown/timeout/断线都会使 pending 失效，重连不恢复旧批准。
3. **PASS**：呈现确认在 mounted/visible/危险信息可读/Stop 初始焦点后发送；未 presented、不可见、卸载、render failure、超限事件均不能批准，渲染故障只发固定安全事件，不带异常正文。
4. **PASS**：服务端同步拒绝迟到、重复、跨 session/connection、旧代次、未来版本、未呈现和错误 revision；单 pending、八连接、64 KiB 事件上限有界，状态只保存在内存，未持久化审批/日志正文；不自动重试或假称撤回已执行效果。
5. **PASS（适用范围）**：锁定 checkout 的 `tsc --noEmit`、`npm run lint`、112 项适用 Node 合约/回归测试和真实 Chrome loopback E2E 通过；补丁复审后的合同还覆盖连接租约主动失效、折叠/卸载撤销、Stop 初始焦点和不完整卡片。完整上游 `npm test` 的 15 个既有环境/源码断言失败单独记录；发布 `build` 按本任务边界未运行。
6. **PASS（本地范围）**：补丁仍停留在 `C:\Users\17860\AppData\Local\Temp\agentglass-w001-piweb-20260914` 的 detached checkout，未 commit、push、PR、tag、合入或发布；不声称原版 0.9.1 兼容。

### 8.5 W-003 Done Definition：接通完整功能

1. 搜索全部模式/UI 判断与调用者，统一为最小合格通道检查；仅在 Pi adapter 中接通 W-002 契约。Core 接收宿主无关的结构事实，不导入 Pi/Web API，不通过用户可选开关解锁普通 RPC。
2. 接通现有审批、读状态、同 actionId 结果卡、欢迎帮助、固定安全示例、最近结果、单文件恢复及独立清理。保留 Stop 默认焦点、详情不授权、所有危险可见和中文模板；不重写风险/恢复系统。
3. 保留原有五项绑定、target/pre-image 复核、所有异步检查后的同步单次消费；连接/request 失效作为附加约束。支持只读仍逐次安全检查，非合格 RPC/print/json 不能批准写入、示例、恢复或清理。
4. 浏览器重连不重建旧授权；同一服务端 session 未失效时，可重新查询当前安全结果与仍合格的恢复入口，操作需新审批。session/cwd/reload/shutdown 继续按原规则清除入口，普通 agent_end 保留入口。
5. 新代码附中文意图/流程/边界注释；补 positive、邻近 negative 和适用故障回归。完整运行 typecheck/lint/build 与五类 suite，验证锁定真实 Pi 和 Pi Web 补丁组合；TUI 继续可用。
6. 浏览器入口、示例或恢复任一必需功能缺失不得称完整接入；不通过 shell 或绕过审批弥补宿主能力缺口。

历史状态：**PASS（2026-09-14；锁定 Pi Web 补丁组合、真实 Edge 回环文件闭环和 TUI/工程门均通过；不属于当前 `0.8.0` 发布线）**。

1. **PASS（代码/自动化范围）**：已搜索 adapter 内全部 mode/hasUI/UI 判断及调用者，统一使用版本化动态合格通道检查；Core 未增加 Pi/Web 类型或导入，普通 RPC/print/json 仍拒绝。
2. **PASS（代码/确定性 Pi 调度范围）**：既有审批、读取状态、同 actionId 结果卡、欢迎/帮助/示例/最近结果/恢复/独立清理均保留并接入；Stop 默认、详情不授权、中文危险提示和 TUI 回归均有自动化覆盖。
3. **PASS（绑定与失效范围）**：原五项 binding、target/pre-image、异步后同步单次消费保留；连接/request 动态失效、输入/目标漂移、未来能力版本和普通 RPC 负例均 fail closed。
4. **PASS（重连策略范围）**：上游 bridge 只允许重连后读取当前安全结果；旧授权不重建，当前会话的恢复入口仍需新审批，session/cwd/reload/shutdown 清除规则和 agent_end 保留规则未绕过。
5. **PASS（工程与联调范围）**：AgentGlass 完整工程 gate、锁定 Pi 的确定性完整路径、上游 bridge 适用测试和真实 Edge 回环组合均通过，新增代码带中文意图/边界注释；上游完整 `npm test` 的既有基线失败单独记录，不掩盖也不混入本项。
6. **PASS（必需真实浏览器范围）**：隔离 Windows Edge 回环会话完成 7/7 场景：`/agentglass help`、`example`、真实 Pi `write`、`read`、`edit`、`restore`、`cleanup`；文件结果由隔离目录独立读取核对，恢复目录清理后剩余文件为 0。每张审批卡均显示 Stop 初始焦点，Continue 才执行，浏览器路径未使用 shell 兜底、全局配置、秘密或自动重试。

真实浏览器闭环首次尝试发现 Pi Web custom 面板把正常 Enter 完成误报为卸载失败；锁定 checkout 的 `components/ChatWindow.tsx` 增加 Enter 正常完成边界标记后，重新加载同一隔离会话并重跑 7/7 均成功。该上游工作树差异未提交、未发布；累计浏览器日志仍保留早期失效输入记录，不能作为清洁日志使用，最终判定以修正后的可见 UI、Pi tool dispatch 和独立文件断言为准。

W-004 前审查又发现 `example`、`restore`、`cleanup` 在审批返回后的异步窗口缺少动态 bridge 的最终复核；本轮在 adapter 共用最终消费 gate，并为三条命令增加连接失效回归。修复后 AgentGlass integration 为 32/32，完整工程 gate 通过；该前置修补仍由 references §41.6.5 保留，W-004 的最终验收见 references §41.8。

### 8.6 W-004 Done Definition：真实浏览器与安全验收

1. 在 Windows 的 Node 22.19.0/24.14.0、Edge/Chrome 组合记录实际版本；用真实浏览器操作已锁定 Pi Web，真实 Pi 调度扩展，并独立读取隔离项目文件断言结果。
2. 覆盖 read、新建/覆盖 write、edit、Stop/默认 Enter/Esc/关闭/详情、中文长标签与窄视口、连续读、示例、核验 matched/mismatch/unknown、恢复、清理及拒绝。卡片截图只作布局证据，不代替文件或授权断言。
3. 覆盖断线重连、审批页卸载、同会话多标签输入竞争、跨会话响应、迟到/重复请求、超时、reload/重启及执行前后断线。失效请求不能消费授权；可能已执行不自动重试。
4. 覆盖漂移、未知/覆盖工具、敏感/越界/link、sibling 缺失/多变更、备份与配额失败、恢复冲突、旧入口替换拒绝、清理部分失败和旧/损坏/未来 schema；沿用全部 INV，不减少既有门。
5. 用合成 canary 检查 AgentGlass 卡片、桥接错误和普通日志；HTML/脚本/控制字符当文本处理。宿主原有 transcript 暴露与 AgentGlass 新增路径分开归因，不上传完整 transcript、秘密、token 或 snapshot 正文。
6. 完整工程/五类 suite、Pi Web 适用检查和真实浏览器代理矩阵通过；补必要最小修复并重跑受影响检查。保留 Pi 0.85.1 超限预览缺陷回归，TUI 历史延期不自动豁免新 Web 故障。Human Validation 无真实记录始终 NOT_RUN。

历史状态：**PASS（2026-09-15；四个 Node/浏览器组合均完成 28/28 真实场景，完整工程、Pi Web 适用检查和安全/故障矩阵均通过；不属于当前 `0.8.0` 发布线）**。完整上游 `npm test` 的既有环境/源码断言失败与 bundled Chromium 缺失仍单列；Human Validation 保持 `NOT_RUN`。

### 8.7 W-005 Done Definition：制品、成本与可交付性

1. 固定候选版本、工作区差异、AgentGlass 制品/hash 与 Pi Web 实际发布版本或可分发制品。新版本号按实际变更收敛，不在文档规划时修改 0.8.0 包；不自动扩大 peer 范围。
2. 从实际制品隔离安装，验证 Pi Web 发现/加载扩展、/agentglass、普通审批/核验/恢复，及启停、卸载、重装的数据保留。区分 Pi/模型已配置与空白环境前置条件；不使用真实用户配置做试验，不宣称一键从零安装。
3. 复验最终候选全量 gate、浏览器关键路径与 TUI 回归。Pi Web 补丁未进入可获得且经过验收的宿主制品时，WEB_COMPAT_READY 不得 PASS；本地联调 PASS 与公开可用状态分开报告，不编造发布日期。
4. 沿用 product-spec §7 的 ≤2 MiB 解包增量、加载增量 P95 ≤350 ms、普通输入纯预检 P95 ≤50 ms 和恢复配额。分别测裸 Pi/TUI 与裸 Pi Web/加载扩展；不将整个 Web 服务成本归给扩展或隐去传输、ACL、文件 I/O、备份、核验、恢复成本。Pi Web 本体单列；不额外引入 AgentGlass 心跳服务。
5. 更新随包自足说明：精确支持版本、Windows 本机访问、键盘操作、无 shell/上传/Git 全面保护、无宿主 transcript 脱敏承诺、数据保留、已知限制、扩展退版不是文件恢复。被忽略 docs 不能充当随包唯一指南。
6. 按 §7 报告准确命令、矩阵、制品、每项 Done Definition 和 WEB_COMPAT_READY=PASS/FAIL/NOT_RUN；远端 CI、Human Validation、宿主补丁发布与 AgentGlass 发布分别记录。发布候选可以审阅，不执行上传/PR/push/tag；完成后不自动进入新阶段。

历史状态：**NOT_DONE（2026-09-15）**。`0.8.1` 归档、锁定 Pi Web patch 及公开 `@agegr/pi-web@0.9.1` 缺 bridge 的结果均保留在 references §42；这些结果不改变当前恢复 `0.8.0`、暂缓 Pi Web 的决定。

历史补充：2026-09-15 从 W-002 锁定 detached checkout 生成的 `@agegr/pi-web@0.9.1-agentglass.1` 可分发候选及其 56/56 证据见 references §42.7；该候选不属于当前 `0.8.0` 发布线，也不改变暂缓决定。

### 8.8 当前阶段决策：恢复 0.8.0、暂缓 Pi Web

2026-09-15 用户明确决定：当前只维护和发布已验证的 `@hugo-ddt/agentglass@0.8.0`，暂不继续 Pi Web 插件适配、宿主 bridge、浏览器准入或相关候选发布。当前状态如下：

- AgentGlass 工作树恢复到 `v0.8.0` 的产品代码、测试、README 和包版本；
- W-001～W-005 不自动执行、不自动重开，也不从历史 PASS 推导当前兼容；
- 未来重新开始时，必须重新明确分配任务，重新锁定宿主制品并重跑适用安全、工程和浏览器 gate；
- 版本回退只表示代码/发布基线回到 `0.8.0`，不表示恢复旧授权、恢复用户文件或撤销已经发生的外部效果。

## 9. 新手文件任务引导（N 阶段；N-001 已完成，N-002～N-004 待分配）

### 9.1 目标、范围与执行顺序

用户已选择 A＋C＋D，并确认首批为创建说明、润色文案、整理单个文本文件；生成请求填入 Pi 输入框，由用户编辑并自行发送。本阶段增强当前 TUI 的使用路径，不改变文件工具、风险策略或恢复范围。B 修改影响摘要、E 集中状态页、正文对照预览、文件浏览器、多步撤销、批量批准、自动安装运行和 Pi Web 不属于本阶段。

本节是唯一任务与 Done Definition 来源；architecture §13 是新增契约来源，product-spec §10、outcome-card-spec §9 和 security-invariants §16 分别定义体验与安全要求。Prompt 手册只展开执行指令，不另立规范。

| 轮次 / Task | 依赖 | 交付 | 当前状态 |
|---|---|---|---|
| 第一轮 N-001 常用任务起步器 | 本阶段规格；核对实际 0.8.0 基线与锁定 Pi | 三类引导、统一草稿填入、输入框保护与宿主合约测试 | COMPLETED（2026-09-15，本地，真实 InteractiveMode 合约已补测，待用户评审） |
| 第二轮 N-002 卡住后的处理入口 | N-001 必需门通过且完成评审 | 最近问题结构事实、适用处理菜单与不重试边界 | NOT_STARTED |
| 第三轮 N-003 结果后的下一步菜单 | N-002 必需门通过且完成评审 | 查看、继续调整与复用独立恢复审批 | NOT_STARTED |
| 第四轮 N-004 阶段验收与交付说明 | N-003 必需门通过且完成评审 | 全链路、真实 TUI、制品与预算证据、随包说明 | NOT_STARTED |

每轮是一个 Task，不自动串行执行全部四轮。分配整阶段时才按上述依赖顺序执行，逐项验收；失败先修当前范围必要问题，不降低 gate。没有预估工期承诺，以每轮可审阅结果为边界。文档规划不更改包版本；N-004 只制作本地审阅制品，不出版新版本。

### 9.2 共同执行与完成要求

- 直接读被忽略的 AGENTS/docs，核对 HEAD、工作树、lockfile、实际代码与前置证据；历史 PASS 不是本轮结果。复用 adapter 的 /agentglass、既有投影、结果关联和恢复流程；Core 不导入 Pi API。
- 新引导只允许 TUI；Pi getEditorText/setEditorText 的源码存在是 SOURCE_CHECKED，不是已经验证。N-001 用真实锁定包测试其读写与不自动提交行为；不自动升级依赖、扩 peer 或改宿主。
- 每轮运行 npm run typecheck、npm run lint、npm run build、npm run test:unit、npm run test:security、npm run test:integration。N-002/N-003 另跑 npm run test:e2e；N-004 跑全部五类 suite。风险/分类变动须额外跑 corpus 并补命中、相邻反例、适用故障；本阶段默认无需变更风险规则。
- 不新建通用框架、草稿存储、配置系统、扫描器或额外运行时依赖。每项新逻辑有必要的中文意图、流程、边界和安全注释及可运行回归；复用现有测试框架。
- 按 AGENTS 完成报告列 Scope、文件、准确命令与结果、安全门、每条 Done Definition、限制/NOT_RUN、下一可分配任务。证据写入 references 的实际任务记录，安全断言映射到 INV-001～020；无真人记录始终 Human Validation=NOT_RUN。
- 不改 .gitignore、不 force-add、不 commit/push/tag/PR/发布；随包 README 仅在 N-004 功能有实际证据后更新，不把本地未发布功能宣传为 npm 0.8.0 已具备。

### 9.3 N-001 Done Definition：常用任务起步器

1. /agentglass 增加“开始一个文件任务”，子项为创建说明、润色文案、整理文本；按 outcome-card-spec §9.1 收集字段，取消或必填为空时结束且不修改文件/编辑器。用户输入边界和上限按 architecture §13；不截断后默默提交，不扫描项目或隐式创建目录。
2. 三个固定中文模板输出普通自然语言请求，不提供 shell、自动发送或批准语句。路径格式检查不宣称存在/安全；所有实际调用仍走完整 read/write/edit 信任链。
3. 复用一个最小草稿填入函数；进入流程及最终写入前检查输入框、TUI、会话、cwd 和空闲状态。最终同步读取与写入之间无 await；已有内容（包括空白）原样保留，提示用户自行处理后重新打开。期间发生的新输入、会话/目录变更或新的 agent run 使引导失效，不尝试恢复旧草稿。
4. UI 缺能力、取消、异常、读取编辑器失败、草稿超限或脱敏失败时不写入、不发送，使用固定说明。写入异常不声称成功，不盲目再写或清空编辑器。不会调用 sendUserMessage、sendMessage 或模拟 Enter 提交。
5. 真实锁定 Pi 合约与集成覆盖三类成功、已有输入、取消/空值、忙碌、生命周期变化、控制字符/假秘密、歧义路径与写入异常；断言仅草稿发生预期变化、工具调用与项目文件变更为零。适用 INV-003/005/008/012/015/016/019/020 增量检查通过；源码存在不能代替合约结果。
6. 共同工程门通过，记录实际宿主版本、命令与证据。N-001 不建立最近问题/结果上下文、不提前增加 C/D 菜单；下一可分配任务为 N-002。

### 9.4 N-002 Done Definition：卡住后的处理入口

1. 在现有动作结果发布位置维护 architecture §13 的当前会话最近一项结构化上下文；与 actionId/targetId 等已有事实关联，不解析 latestResult 中文字符串。read 提示不覆盖它；后续状态变化更新同项，新结果替换旧项，不保存历史或 raw payload。
2. /agentglass 增加“处理刚才的问题”。多变更/不完整 sibling 仅提供由用户主动选择的顺序提案草稿，不引用原批次 raw 参数；核验 mismatch/unknown 与恢复冲突仅在有可用精确安全目标时提供先查看草稿。其他失败和不支持工具给固定解释与可行下一步，不提供重试按钮、不建议关闭保护或把安装改写为编辑。
3. 目标不可安全表示、无上下文、上下文被替换或跨会话/cwd 失效时不猜文件，不生成定向请求；提示重新明确普通文件。主动 Stop/取消只反馈当前步骤未获批准，不出现继续催促。可能已执行的失败不写成未执行。
4. 请求使用 N-001 统一填入路径；没有自动排队、自动重试、sendUserMessage 或旧授权复用。agent_end 保留已发布上下文；新会话、目录变化、reload/shutdown 清理；agent 正在执行时不启动引导。异步菜单返回后重查上下文仍为当前项。
5. 必需工程/security/integration/e2e 通过，覆盖类别映射、多个风险并存、迟到结果不能覆盖新项、读提示不覆盖、相同显示名不同路径、无安全目标、取消和生命周期。顺序请求只断言草稿，不假称 Pi 必定遵守；发送后仍由 sibling gate 检查。
6. 更新 INV-002/003/005/007～010/012/013/016/019/020 适用映射与证据；不增加 D 菜单或多项结果存储。下一可分配任务为 N-003。

### 9.5 N-003 Done Definition：结果后的下一步菜单

1. 现有原卡更新后提示可从 /agentglass “接着处理这份文件”。matched 的支持文件结果提供查看、继续调整；mismatch/unknown 只提供先查看和已有处理入口，不直接提供继续修改。没有可用安全精确目标时不显示定向操作。
2. 查看草稿明确只读、不修改；继续调整只收集本轮调整要求，不回放原工具参数或文件正文。全部复用 N-001 的输入、投影、保护与填入路径；用户发送新请求后仍需新的完整工具检查及审批。
3. 恢复复用现有 recoveryEntryIsCurrent 和独立审批/执行/独立核验路径，不另建恢复引擎。该菜单内恢复仅在 recovery 与所选结果的精确目标及原动作关联一致时提供；否则现有顶层恢复入口可按其自身证据保留，并显示它实际对应的文件。不能仅按标签或“最近”判等。
4. 菜单展示及选中恢复时重新检查上下文和恢复证据；期间替换、冲突或失效不转而恢复另一项、不自动刷新后执行。恢复新建文件明确说明删除该文件；Stop 默认、拒绝保留入口、清理独立批准保持原行为。
5. 恢复成功/失败更新同一结果语义；删除新文件后不继续显示“查看这份文件”或“继续调整”。保留失败/unknown 的诚实反馈。展开菜单不弹额外审批，只有实际恢复进入原审批。
6. 必需工程/security/integration/e2e 通过；覆盖 matched/mismatch/unknown、新建后恢复删除、恢复冲突/拒绝/损坏、结果与恢复不同文件/不同动作、同名文件、菜单期间新结果、会话/cwd 切换、无 UI 与编辑器内容保护。记录 INV-004/007～010/012/019/020 增量证据。下一可分配任务为 N-004。

### 9.6 N-004 Done Definition：阶段验收与交付说明

1. 从实际工作树锁定候选 HEAD/差异、Node/npm/Pi 版本和制品 hash；保留 0.8.0 发布身份说明。运行 npm ci、typecheck、lint、build 及 unit/corpus/security/integration/e2e 全部 suite，不用历史计数或空测试证明通过。
2. 用真实锁定 Pi 调度及独立文件断言覆盖创建说明、润色、整理的完整链路；覆盖用户 Stop、再次编辑草稿、问题处理、查看、继续调整、单独恢复/拒绝/冲突和清理回归。确定性模型仅在测试侧使用，不新增产品模型调用或测试开关。
3. Windows Node 22.19.0 与 24.14.0 分别验证实际 TUI 的菜单→填入→用户发送→审批→核验→下一步→恢复。标准 80×24 和窄窗口覆盖中文/长标签、键盘取消、非空编辑器和危险信息可达；真实终端证据与测试 UI/mocks 分开，截图不代替文件断言。无法完成必需真实 TUI 门时任务未完成，不用浏览器或声明审查替代。
4. 在隔离目录从实际本地 tarball 安装，验证扩展发现、菜单和完整文件关键路径；不得使用用户全局模型/配置做破坏性试验。支持区间最低 Pi 0.84.3 复验新增编辑器/菜单合约及关键路径；与 0.85.1 差异不能悄悄扩缩 peer，未解决兼容失败时本任务未完成。
5. 复用 R-003 测量流程，复验解包增量 ≤2 MiB、相对裸 Pi 加载增量 P95 ≤350 ms、≤64 KiB 普通输入纯预检 P95 ≤50 ms 与原恢复配额；第一次打开引导和填入成本单列，模型/用户等待不计入扩展处理成本。持续使用后新增上下文仍至多一项，生命周期清理生效；不删安全检查满足预算。
6. 更新中英文随包 README：描述已验收的本地候选功能及菜单、输入框保留、用户自行发送、仍需审批、核验与恢复限制。显著区分未发布候选与公开 npm 0.8.0；不更改 Quick start 指向不存在的发布版本，不进行版本递增或发布。
7. 全部适用 INV 与新手代理场景逐项记录，必需门无未解决失败才写 N_STAGE_READY=PASS（本地工程交付）。远端 CI、Human Validation 与发布分别列实际状态，未执行为 NOT_RUN。本阶段结束，不自动开新阶段；发布需另行明确分配。
