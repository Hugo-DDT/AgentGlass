# AgentGlass 安全不变量

> 状态：最高优先级仓库安全规范 · 自动化与真人验证按实际结果报告

## 1. 权威与范围

仓库文档冲突时按以下顺序处理：本文件 → 当前明确任务 → 根目录 `AGENTS.md` → 架构/风险/结果卡 → 开发计划 → 产品规格 → 背景研究。

Alpha 只支持已验证 Pi 内置 `read/write/edit`。缩小能力不能用来缩小安全检查；A-010 已增加仅用于受支持普通 `write/edit` 的敏感 pre-image evidence，B-001/B-002 后续增加核验与受限 restore 时相关不变量已同步生效；未来若增加普通持久化或 shell 执行，仍须在设计开始时启用对应不变量。

A-006 的纯函数 shell classifier 是执行前分析数据，不扩大上述支持范围。其 `candidate_fast_path`、`ask`、`block` 是本地分类处置，不是 `RiskDecision`、批准或执行授权；A-007 仍必须把 shell/unknown/unsupported 工具 hard-block。只有运行环境、命令解析和受支持实现语义均有确定证据时才可标记候选，任一必需证据缺失均为 `PREFLIGHT_FAILED`。

本次规范修订保持 Alpha 规则不变。Beta/v1 在相同普通文件范围补齐核验和受限恢复，不开放未知 shell。恢复与本地清理是明确内部变更：同样需要必要预检、独立结果审批、精确绑定和单次消费，不属于任意删除权限。B-001～B-004 已有本地自动化与完整 Beta 代理证据；真实 Pi/PTY 已覆盖主要 read/write/edit、恢复、冲突、重启、清理、不支持任务、mismatch、unknown 与敏感 snapshot 边界。Human Validation 仍为 `NOT_RUN`。

## 2. 不变量

| ID | 必须满足的规则 |
|---|---|
| INV-001 | LLM 只能帮助表达，不能决定、降低、覆盖或弱化确定性风险。 |
| INV-002 | `unknown` 必须保留为显式值，绝不视为安全；Alpha 直接阻止未知动作。A-006 的分类 `ask` 只表示语法可识别但不支持，不得转换成产品批准。 |
| INV-003 | 关键规则、完整性或必需预检失败必须失败关闭。 |
| INV-004 | 没有针对具体 effect 的快照、恢复实现和恢复后验证，不得声称可恢复、可撤销或 Undo；A-010 即使保存 pre-image，Alpha 仍固定 `canRestoreNow=false`、恢复等级 `unknown`。 |
| INV-005 | 原始工具输入和秘密值不得进入 UI、普通日志、审批记录、分析、遥测、学习档案、时间线或 LLM 上下文。A-010 pre-image 如必须保存原文件字节，只能进入独立敏感域，不能复制到上述位置。 |
| INV-006 | 审批 fingerprint 必须从脱敏前 canonical raw input 计算，算法与规范版本固定。 |
| INV-007 | 批准至少绑定 fingerprint、toolName、cwd、sessionId、toolCallId，并与当前卡片一致。 |
| INV-008 | 批准只能使用一次；可检测的输入或绑定变化必须使旧批准失效。 |
| INV-009 | `unknown`、`not observed`、`unverifiable` 不得表述为安全、没有发生或已经完全验证。 |
| INV-010 | High/Critical 后果始终可见，不得被详情折叠、截断、颜色或熟悉度隐藏；“一屏/一条提醒”不能删去其他影响批准的危险原因或未知项。 |
| INV-011 | 不得声称 OS sandbox、完整 shell containment 或能阻止恶意共存 Pi 扩展。 |
| INV-012 | ask 动作必须获得经过验证的交互通道中针对当前动作的明确批准；缺少合格通道、取消、关闭、超时或 UI 错误都不是同意。已发布 0.8.0 仅 TUI 合格；W 阶段 Pi Web 通道须满足第 15 节，未实现/未验收不自动获得资格。 |
| INV-013 | Alpha sibling batch 中两个及以上 state-changing/unknown 动作必须阻止这些成员并要求顺序重试；不得加入归因例外。 |
| INV-014 | 真人指标只能来自真实参与记录；没有实际研究时必须为 `NOT_RUN`。 |
| INV-015 | 只有 `extensions/` 与 `src/adapter/pi/` 可以 import Pi API、Pi 类型或依赖 Pi event/context 结构。 |
| INV-016 | raw input 只可在进程内短暂用于 canonicalization、fingerprint、validation、classification 和必要风险分析；不得先脱敏再做会丢失语义的判断。 |
| INV-017 | 不暴露、推测、重建、保存或声称展示隐藏 chain-of-thought。 |
| INV-018 | v1 只支持 Pi，不创建 Hermes/DeepSeek Adapter、host registry 或通用多宿主框架。 |
| INV-019 | UI 文案、历史批准、学习记录和持久化数据不得成为安全策略输入或恢复执行授权。 |
| INV-020 | 路径、作用域、工具身份和 sibling 信息必须在信任边界验证；缺失信息不得被猜成项目内、内置工具或单一变更。 |

“只读”只说明不修改状态，不代表不涉及秘密、项目外数据或外发。只有所有必要维度均有确定证据时才可 auto-allow。

## 3. Alpha 失败处理

| 失败 | 处理 |
|---|---|
| 输入非法、canonicalization/绑定失败、规则异常、必需 preflight 资源超限 | hard-block |
| A-010 snapshot 保存失败、超限或发布中断 | snapshot evidence 降级为 unavailable；固定不可恢复，不把失败隐藏为 recoverable |
| 工具未知、不支持或身份被覆盖 | hard-block |
| 敏感、越界、链接、特殊文件或路径不确定 | hard-block |
| 变更动作缺少完整 sibling 信息，或 batch 有多个变更/未知成员 | hard-block，要求顺序重试 |
| ask 但无可用 TUI、取消、关闭、超时、异常 | 不批准并阻止 |
| Continue 后输入或绑定变化 | 旧批准失效；重新生成当前事实与结果卡并要求新的明确批准，无法完整重建时阻止 |

失败反馈使用固定、脱敏、面向行动的说明；异常时不得回退展示原始 message、event 或 payload。

## 4. 已实现 Beta 敏感能力与后续边界

A-010 仅增加前像，B-001～B-004 已完成下述核验和受限恢复。以下安全约束继续用于 Release；普通事件持久化与扩大恢复范围仍未授权：

- **恢复：**只使用恢复特定文件所需字节和必要元数据；敏感域使用不透明 ID，不进入普通展示。A-010 snapshot 失败降低为 unavailable；当前恢复前必须防止覆盖用户后续修改，恢复后独立验证。
- **持久化：**采用明确 schemaVersion；审批 token 和 raw input 永不写盘；损坏、未来版本或写入失败不能恢复授权。
- **核验：**工具成功不是现实证据；读取失败是 unknown；观察范围不全不得声称没有额外影响。

这些能力必须作为完整用户价值交付，不能为了“以后可能需要”在 Alpha 预建空类型或存储层。

Beta 修改前备份不可用则阻止新变更，并降低恢复文案；不能用用户同意替代所需备份。恢复仅针对有完整证据的单文件效果，恢复前复核执行后基线，冲突保留现有内容，恢复后独立核验。无可靠执行后依据不展示恢复入口。恢复新建文件的删除必须明确展示并单独批准。

有限保留不能静默剥夺用户看到的恢复能力：新批准需说明旧入口失效，拒绝不消费旧入口；过期副本只可在说明影响并获得单独清理批准后删除。重启不恢复授权，数据损坏/未来 schema 不自动默认解释。配额包含所有会话遗留与临时数据；竞争/配额/权限无法确定时阻止备份，不绕过限制。

只读展示可以合并，每次风险检查不能合并省略。模型给出的顺序重试只是新提案，不能自动排队、重排原工具或沿用旧批准。不得为了新手方便建议关闭保护、忽略未知或降低 Critical 决策。


### Beta 任务验收映射

沿用 INV-001～020，不新增编号或改变已有规则。正式任务源为 development-plan §5；下表定位已有 Beta 证据，不能替代本文件第 5 节的具体断言。

| 任务 | 必需增量证据 | 当前状态 |
|---|---|---|
| B-001 | INV-003/004/009/016/020：必需备份失败阻止、已有父目录、独立有界观察、结果关联/未知、临时输入与同卡反馈；保持其余 Alpha 回归 | **PASS**：unit/corpus/security/integration/e2e 与真实 Pi 0.85.1 调度；见本文件“B-001 增量证据” |
| B-002 | INV-003～009/012/019/020：版本化敏感恢复数据、权限/配额、独立绑定/批准、冲突保护、恢复后核验、替代/清理/中断/生命周期；不从 Alpha v1 数据恢复入口或授权 | **PASS（2026-09-12）**：unit/security/integration/e2e 与 Windows 目标 ACL 恢复；证据见“B-002 增量证据” |
| B-003 | INV-005/010/012/018/020：同一入口、安全标签、明确批准的固定示例准备、无覆盖/无 shell 兜底、真实宿主与终端证据 | 工程与自动化 PASS（2026-09-12）；B-003 当时终端 NOT_RUN，已由 B-004 的 Beta 代理范围真实 PTY 补齐（references §26），不等于真人研究 |
| B-004 | 完整 Beta 的关键误解代理矩阵、全部适用 INV 最终回归与声明审查；INV-014 确保代理结果不被写成真人指标 | **PASS（2026-09-12）**：自动化代理、声明审查与全部 gate 通过；真实 Pi/PTY 已补主要支持/恢复/阻止、mismatch、unknown 与敏感 snapshot 边界；Human Validation 保持 NOT_RUN |

Beta 继续沿用 Alpha 的多变更/未知 sibling 阻止策略，不增加归因例外。B-001 启用必需备份阻止后，历史 Alpha 的 snapshot unavailable 仍可审批断言只能作为历史证据；当前测试必须随阶段更新，不能为保留旧测试弱化 Beta 规则。正式 Beta/Release gate 使用代理验证；INV-014 仍禁止把代理结果写成真人指标，没有真实记录时 Human Validation 必须为 NOT_RUN。
## 5. 测试证据

每条可自动化不变量应进入适用安全测试；分类规则同时进入 corpus。每条规则需要命中、相邻反例和适用故障用例。测试报告区分 PASS、FAIL、NOT_RUN，并给出真实命令和结果。

模板、mock 或模型模拟本身不能证明 Pi 兼容或真人理解。测试侧确定性模型输出可以驱动真实 Pi 执行循环，但只能证明经过的宿主路径，不能证明真实模型会如何提案或新手能够理解。未来功能没有实现时不得创建空测试记 PASS。

### A-014：INV-001～020 证据映射

本表映射的是 2026-09-11 当前 Alpha 实现及本轮实际检查，不把测试名称、表格存在或历史结果当作通过。自动化证据列中的名称均可在所列文件中反查到真实 `test`；A-013 的规则命中、相邻反例和故障索引继续由 `risk-model.md` 第 5 节维护，本表引用其实际测试而不复制 fixture。阶段不适用表示对应能力尚未进入 Alpha，不计 PASS。

结果代号：`S`=`npm run test:security`（退出码 0，9 files / 64 tests）；`C`=`npm run test:corpus`（退出码 0，4 / 23）；`U`=`npm run test:unit`（退出码 0，8 / 57）；`I`=`npm run test:integration`（退出码 0，2 / 21）；`E2E`=`npm run test:e2e`（退出码 0，1 / 12）；`T/L/B`=`npm run typecheck/lint/build`（最终均退出码 0）。这些是 B-001 最终工作树的当前结果；后文 A-015/A-016 段落保留各历史轮次的原始分母。`D1` 为直接读取根 `AGENTS.md`、本任务及依赖和本文件、architecture、risk-model、outcome-card-spec、references 后的规范一致性审查；`D2` 为 Git HEAD/diff、忽略文件和源码/import/产品声明的人工审查。`H` 为真实参与者记录，本轮未提供也未运行。

| INV 与阶段 / 适用部分 | 自动化证据（文件 — 完整测试名称） | 关键断言 | 人工审查要求 | 未覆盖部分 | 本次结果和证据 |
|---|---|---|---|---|---|
| **INV-001 · Alpha**：确定性风险与 shell 分析 | `tests/security/risk-engine.test.ts` — `INV-001/019: UI, learning, LLM, and prior approval fields cannot lower current risk`；`tests/security/predicted-effects.test.ts` — `INV-001/002: classifier-local install facts cannot widen a non-blocking product decision`；`tests/security/shell-classification.test.ts` — `INV-001/003: dangerous fixtures are pure analysis and never execute` | 注入 `llmDecision/uiDecision/learningDecision/previousApproval=auto_allow` 后敏感动作仍 `hard_block`；shell classifier 的局部事实不能把未知产品动作变成可批准效果；危险命令只进纯函数且哨兵文件不变 | `D1/D2` 核对 Risk Engine 没有 LLM/文案输入，shell classifier 未接执行面；任何未来 LLM 只能改表达 | Alpha 没有可选 LLM 表达路径，真实模型提案行为不属于本断言；后续引入时须新增边界测试 | **PASS**（S、C、D1/D2）；未来 LLM 表达路径阶段不适用 |
| **INV-002 · Alpha**：unknown、unsupported 与 mutation | `tests/security/risk-engine.test.ts` — `INV-002/003: unknown mutation or effect has zero auto-allow`、`INV-002: every explicit mutation has zero auto-allow`；`tests/corpus/risk-engine.test.ts` — `A-013 'UNSUPPORTED_TOOL' has a hit and neighboring non-hit`、`A-013 product decisions stay separate from shell dispositions`；`tests/security/shell-classification.test.ts` — `INV-002/016: unsupported and PowerShell inputs cannot become fast-path candidates or leak arguments` | 四类 unknown 的 `auto_allow=0` 且全为 `hard_block`；write/edit/create 只为 `ask`；unsupported 产品动作 hard-block；shell `ask` 不转换为产品批准，PowerShell 不进 fast path | `D1` 核对 classifier-local `ask` 与 `RiskDecision.ask` 的文档区分 | shell 执行未支持，故没有执行授权测试；这是 Alpha 支持边界而非缺失 PASS | **PASS**（S、C、D1） |
| **INV-003 · Alpha**：关键失败关闭、Critical 不降级 | `tests/security/risk-engine.test.ts` — `INV-003: critical evidence is hard-blocked in every conflict`、`INV-003: an internal property failure fails closed without exposing the exception`；`tests/security/file-preflight.test.ts` — `INV-003/020: missing workspace and malformed target remain unknown`；`tests/security/shell-classification.test.ts` — `INV-003/020: every missing fast-path runtime fact fails closed`；`tests/corpus/risk-engine.test.ts` — `A-013 'INPUT_INVALID' has a hit and neighboring non-hit`、`A-013 'INTEGRITY_FAILURE' has a hit and neighboring non-hit`、`A-013 'PREFLIGHT_FAILED' has a hit and neighboring non-hit`、`A-013 'SAFETY_CONTROL_MUTATION' has a hit and neighboring non-hit` | 四种 Critical evidence 在冲突组合中均为 `critical/hard_block`；规则属性异常返回固定 `PREFLIGHT_FAILED` 且不泄漏异常；路径或 shell 必需事实缺失不获放行 | `D1/D2` 核对优先级固定为 `hard_block > ask > auto_allow`，没有“allow anyway”入口 | OS 在最终检查后发生竞态无法被完全消除；Pi 返回后的恶意共存扩展见 INV-011 | **PASS**（S、C、D1/D2） |
| **INV-004 · Alpha/B-001**：snapshot 不构成恢复能力；**B-002**：真实 restore/恢复后核验 | `tests/security/pre-image-snapshot.test.ts` — Alpha evidence 不可冒充恢复及 B-002 秘密/冲突边界；`tests/unit/pre-image-snapshot.test.ts` — 覆盖写、新建逆操作、权限恢复及后验；`tests/integration/pi-adapter.test.ts` — 最近入口、漂移、替代和单次消费；`tests/e2e/pi-dispatch.test.ts` — 真实 Pi edit→restore→cleanup | Alpha evidence 仍固定不可恢复；只有 v3 ready 后置基线完整时显示入口。恢复前重检存在/身份/字节/权限，冲突立即丢弃会话入口并保留文件；执行后独立复核，失败不重试或重建许可 | `D1/D2` 审查 architecture、outcome-card-spec、references 与敏感域声明一致；不把前像称为 secret-free、事务性 Undo 或通用删除授权 | 真实人工终端、macOS/Linux 与无法穷尽的掉电时序未验证 | **B-001/B-002 PASS**（S、U、I、E2E、D1/D2）；列明边界 **NOT_RUN** |
| **INV-005 · Alpha**：UI、普通输出/日志与 snapshot 敏感域 | `tests/security/secret-boundary.test.ts` — `INV-005: secret candidates only cross the boundary as redacted values`、参数化 `INV-005: detects and redacts a synthetic %s candidate`（field/private key/authorization/connection URI/cloud assignment）、`INV-005: validation errors discard hostile raw exception messages`；`tests/security/outcome-card.test.ts` — `INV-005/011/017: every card avoids secrets, protection claims, and hidden-reasoning claims`；`tests/security/pre-image-snapshot.test.ts` — `INV-005: secret-bearing pre-image bytes stay only in the sensitive snapshot domain`；`tests/integration/pi-adapter.test.ts` — `raw tool and goal secrets never enter observable or blocked adapter output` | 合成秘密只在脱敏投影中成为 `[REDACTED]`，console spy、错误、全部卡片、observer 与阻止结果不含原值；需要恢复既有文件时 snapshot 私有正文保留必要原字节，但返回 evidence/日志不含秘密或真实路径 | `D2` 审查源码无普通 logger、报告器、遥测或 LLM context 管线；测试摘要只记合成值是否泄漏，不保存正文 | Pi 自身日志和联网不在 AgentGlass 可证明边界；POSIX/跨平台敏感目录权限不是本轮环境证明；未来普通报告/LLM context 尚不存在 | **PASS**（S、I、D2）；外部 Pi 日志/联网 **NOT_RUN/边界外** |
| **INV-006 · Alpha**：脱敏前、版本化指纹 | `tests/security/secret-boundary.test.ts` — `INV-006: different raw secrets cannot share approval fingerprints`；`tests/unit/input-boundary.test.ts` — `the fingerprint pins the complete action and Canonicalization v1 bytes`、`Canonicalization v1 sorts object keys but preserves array order` | 两个 raw secret 得到相同脱敏投影但不同 SHA-256，证明指纹不是对 redacted 值计算；固定字节向量、toolName、版本和排序/数组语义均有断言 | `D1/D2` 核对调用顺序为 fingerprint → raw preflight/classification → redaction | 不声称指纹是签名或能约束 AgentGlass 返回后的宿主改写 | **PASS**（S、U、D1/D2） |
| **INV-007 · Alpha**：五项批准绑定及 `hostExecutionId` | `tests/security/approval.test.ts` — 参数化 `INV-007/008: changed %s invalidates the exact approval`（fingerprint、toolName、cwd、sessionId、hostExecutionId、toolCallId）；`tests/integration/pi-adapter.test.ts` — `Pi 0.85.1 exposes every required binding dimension and each changed value invalidates approval`、`Pi 0.85.1 binds the real cwd so approval cannot cross project sessions`；`tests/e2e/pi-dispatch.test.ts` — `input, target, and pre-image drift invalidate the old card and require a fresh decision`、`replay and a new session never inherit an earlier Continue` | fingerprint、toolName、cwd、sessionId、toolCallId 五项及额外 `hostExecutionId` 任一变化时消费失败并 invalidated；真实 Pi facts 映射出相同维度，完整调度中的输入/目标变化、重放和新会话不能沿用旧批准 | `D2` 核对卡片 actionId 与 token actionId 仍同一动作，不使用展示 label 作 identity | Pi 返回后被后加载恶意扩展改写仍不在本产品保证；E2E 不把测试读取升级为产品核验 | **PASS**（S、I、E2E、D2） |
| **INV-008 · Alpha**：单次消费、变化失效、异常撤销、生命周期清理 | `tests/security/approval.test.ts` — `INV-007/008: exact current action consumes once and cannot replay`、`INV-008/019: cancel and reconstructed token cannot restore authorization`；`tests/integration/pi-adapter.test.ts` — `Pi 0.85.1 regenerates the card after input change and executes only the exact current action`、`Pi 0.85.1 invalidates a saved pre-image after target drift and requires a fresh card`、`Pi 0.85.1 abort, missing custom result, UI error, RPC hasUI, and no UI cannot approve`、`active execution and goal state are cleaned up by Pi lifecycle events`；`tests/e2e/pi-dispatch.test.ts` — `input, target, and pre-image drift invalidate the old card and require a fresh decision`、`replay and a new session never inherit an earlier Continue` | 并发消费结果恰有一次 true，replay/伪造/取消失败；输入或目标变化产生第二张卡和新证据；abort/UI error 均阻止；tool end/agent end/shutdown/reload 清掉 active、goal 与待批准状态；Pi 完整调度中的旧卡、重放和会话替换均不能执行新动作 | `D2` 核对最后一次异步检查后同步重读 envelope 并消费，catch 立即 invalidates 当前 token | 最终返回 Pi 后被后加载恶意扩展改写不在本产品保证；真实人工 TUI 未运行 | **PASS**（S、I、E2E、D2）；真实终端 **NOT_RUN** |
| **INV-009 · Alpha/B-001**：未知/未观察/不可核验措辞与文件核验 | `tests/security/outcome-card.test.ts` — `INV-009: unknown and not-observed facts stay explicit`、`INV-005/009: B-001 result feedback redacts labels and never exposes result bodies or recovery claims`；`tests/unit/file-verification.test.ts`；`tests/integration/pi-adapter.test.ts` — `B-001 correlates one result to one card and rejects duplicate, wrong-order, drifted, missing, and late results`；`tests/e2e/pi-dispatch.test.ts` — B-001 三个真实调度核验场景 | matched 只来自全部列明后置条件独立匹配；明确矛盾为 mismatch；语义不足、读取不稳、身份/结果错配为 unknown；工具返回文本不进入结论，应用功能固定 unverifiable | `D1/D2` 审查结果卡分别列已知、未知、单文件范围与下一步；没有“没有执行”或自动重试声明 | 恶意后加载扩展仍可在 AgentGlass 返回后改写输入/结果；应用功能不在文件核验范围 | **B-001 PASS**（S、U、I、E2E、D1/D2） |
| **INV-010 · Alpha**：High/Critical 与多原因可见 | `tests/security/outcome-card.test.ts` — `INV-010: every High/Critical explanation remains on the main card`、`INV-003/010/019: weaker supplied risk cannot hide deterministic safety facts`、`INV-010/013: batch block keeps sequential-retry and other danger explanations` | 八类 High/Critical 说明全部在主卡 `attention`；伪造较弱 risk 仍停止并显示敏感/矛盾事实；batch 原因不遮蔽文件丢失或 preflight 危险 | `D1` 审查 outcome-card-spec 的“一屏”只是目标、不是截断安全信息授权；颜色和详情不承担唯一警示 | 真人能否理解这些说明属于 INV-014，当前不能由 snapshot 或 UI mock 证明 | **PASS**（S、D1）；真人理解 **NOT_RUN** |
| **INV-011 · Alpha/Release 声明边界**：无 sandbox、shell containment、恶意共存扩展防护承诺 | `tests/security/outcome-card.test.ts` — `INV-005/011/017: every card avoids secrets, protection claims, and hidden-reasoning claims` | 全部当前卡片 fixture 均不出现 OS sandbox、完整 shell containment 或阻止恶意扩展的正向承诺；相邻反例“不能阻止恶意共存 Pi 扩展”不误拦，正向“可以阻止……”必须命中；不把该测试扩大解释为实际防护能力 | `D1/D2` 必须审查 AGENTS、architecture §5/§11、references §11/§15 和所有当前 UI 固定文案；它们明确保留“Pi 返回后仍可能被后加载扩展改写”的限制，未声称 sandbox | 恶意共存扩展对抗测试、OS sandbox 和完整 shell containment 均未实现且不是 v1 承诺；不能标 PASS 为防护能力 | **声明审查 PASS**（S、D1/D2）；防护能力 **NOT_RUN/不承诺** |
| **INV-012 · Alpha**：只有实际交互 Continue 可批准 | `tests/integration/pi-adapter.test.ts` — `Pi 0.85.1 capability modes do not equate hasUI with safe approval`、`Pi 0.85.1 TUI Continue is single-shot, Explain is not approval, Stop/Esc fail closed, and resize rerenders`、`Pi 0.85.1 abort, missing custom result, UI error, RPC hasUI, and no UI cannot approve`；`tests/security/outcome-card.test.ts` — `INV-012/019: missing UI blocks copy and UI strings cannot feed Risk Engine` | 初始 Stop；详情只展开且不批准；Stop/Esc/abort/undefined/error 全返回 block；RPC 即使有 UI、print/json 即使有 UI、TUI 无 UI 均不能批准，只有本地 TUI + 实际 UI 的明确 Continue 可进入重校验 | `D1` 审查无 UI 的下一步说明可行且不暗示已执行 | 真实人工终端按键未运行；受控 TUI 不能证明真人理解 | **自动化 PASS**（S、I、D1）；真实终端与真人 **NOT_RUN** |
| **INV-013 · Alpha**：sibling unknown 计变更、缺失上下文关闭 | `tests/security/risk-engine.test.ts` — `INV-013/020: sibling mutation guard treats yes and unknown as changes without attribution exceptions`、`INV-003/013/020: incomplete, duplicate, stale, and invalid sibling facts fail closed for a mutation`；`tests/corpus/risk-engine.test.ts` — `A-008 batch rules each have a hit and neighboring non-hit`；`tests/integration/pi-adapter.test.ts` — `Pi 0.85.1 sibling guard blocks only mutation/unknown members when a batch has at least two`、`missing, duplicate, changed-session, and incomplete sibling identities fail closed`；`tests/e2e/pi-dispatch.test.ts` — `multiple mutations and missing sibling context are blocked without reordering` | read+read 可并行；read+write 保留单变更决策；write+write、write+unknown、两个 unknown 阻止变更成员；undefined/空/重复/旧 turn/无当前调用/无效 facts 为 `critical/hard_block`；Pi 完整调度中的 write+write、write+unknown 与缺失 leaf 均未执行变更 | `D1/D2` 核对无自动重排、归因例外、BatchSnapshot/BatchOutcome | 未证明恶意后加载扩展；不把模型后续文本当自动顺序重试 | **PASS**（S、C、I、E2E、D1/D2） |
| **INV-014 · 真人指标与代理声明边界** | 无自动化测试可以证明真人理解；受控 UI、snapshot 和固定 fixture 明确不作为参与者记录 | 自动化结果只证明代码路径，不产生匿名参与编号、回答、选择、耗时、求助或失败原因 | 单独审查 product-spec、development-plan §4、outcome-card-spec §5 与 references 的研究状态；代理 PASS 不得发布成功率、30 秒可读或“零基础可理解”等已验证声明 | 真实参与者研究未进行；完整 Beta 代理验收已在 B-003 后运行 | **H=NOT_RUN**；Alpha `PROXY_ADMISSION_PASS`（S01～S11 11/11、M-01～M-07 7/7）；Beta `BETA_PROXY_ACCEPTANCE=PASS` |
| **INV-015 · Alpha**：Pi import/类型边界 | `tests/security/host-boundary.test.ts` — `host-neutral source contains no Pi imports or semantics`、参数化 `boundary rejects %s (%s)`（11 个 Pi import/event/TUI/domain 反例）、`boundary accepts host-neutral execution identity` | 递归扫描 `src/`（排除允许的 `src/adapter/pi/`）无 Pi import/event/context 语义；pi-coding-agent 与 pi-tui 的值/类型/副作用/动态导入及 Pi event/context/TUI/domain 结构反例均失败；普通 execution identity 可保留 | `D2` 用 `rg` 核对实际 Pi 包 import 只在 `extensions/` 与 `src/adapter/pi/` | A-016 的真实调度不改变该结构边界；多宿主仍不在 v1 范围 | **PASS**（S、D2） |
| **INV-016 · Alpha**：raw 短生命周期且先做必要语义判断 | `tests/security/file-preflight.test.ts` — `INV-016/020: real-path evidence uses raw path before redaction`；`tests/security/secret-boundary.test.ts` — `INV-016: the persistable result exposes no raw or canonical payload`；`tests/unit/execution-input.test.ts` — `host execution projection removes raw input and keeps only the redacted observable goal`；`tests/integration/pi-adapter.test.ts` — `raw tool and goal secrets never enter observable or blocked adapter output`、`active execution and goal state are cleaned up by Pi lifecycle events` | raw secret path 在 real-path 预检后正确识别真实文件，而展示 label 已脱敏；persistable/facts 无 raw/canonical；adapter observer、block 输出和生命周期状态不持有 raw | `D2` 审查 raw 只存在于当前事件/preflight 调用栈，active map 只保存身份字符串 | JS 引擎瞬时内存无法由测试证明物理擦除；Pi 自身 event 生命周期不由 AgentGlass 控制 | **PASS**（S、U、I、D2）；物理内存擦除不承诺 |
| **INV-017 · Alpha/产品声明**：不暴露或声称展示隐藏推理 | `tests/security/outcome-card.test.ts` — `INV-005/011/017: every card avoids secrets, protection claims, and hidden-reasoning claims` | 全部当前卡片 fixture 不含 fingerprint、session、`chain-of-thought` 或“隐藏思维/推理”声明；产品只使用可观察 goal/tool/result/state | `D1/D2` 审查源码与规范没有推测、重建、存储或展示隐藏推理的入口/声明 | 无法也不应检查模型内部隐藏状态；这里只验证产品边界，不把不可观察内部标成安全证明 | **PASS**（S、D1/D2） |
| **INV-018 · Alpha/v1**：仅 Pi、无通用多宿主框架 | `tests/security/host-boundary.test.ts` — `INV-018: Alpha exposes only the Pi adapter`、`host-neutral source contains no Pi imports or semantics` | `src/adapter/` 的唯一条目精确为目录 `pi`；Core 保持 host-neutral，未出现第二宿主依赖 | `D2` 核对源码树无 Hermes/DeepSeek adapter、host registry、factory 或空壳 | 多宿主兼容不在 v1 范围，没有也不需要兼容测试 | **PASS**（S、D2） |
| **INV-019 · Alpha/Beta**：文案、历史与持久化不能授权 | `tests/security/risk-engine.test.ts` — UI/学习/旧批准不能降低风险；`tests/security/approval.test.ts` — 重建 token 不授权；`tests/unit/pre-image-snapshot.test.ts` — v1/v2/损坏/future/prepared 数据不能恢复；`tests/integration/pi-adapter.test.ts` — 新会话、漂移、拒绝和重复调用不能继承许可 | UI 字符串不进入 Risk Engine；token 只在内存并单次消费；磁盘 v3 ready 也不能在重启、新 session/cwd 恢复入口，旧 schema 仅在验证归属后进入单独清理 | `D1/D2` 核对 manifest 不含 token/raw 输入，当前入口只保留会话内存中的不透明关联，清理重新绑定确切集合 | 真实进程崩溃/掉电组合与跨平台未穷尽 | **Alpha/B-002 PASS**（S、U、I、E2E、D1/D2）；列明边界 **NOT_RUN** |
| **INV-020 · Alpha**：路径、范围、工具身份、schema 与 sibling 信任边界 | `tests/security/file-preflight.test.ts` — `INV-020: prefix neighbors, symlinks, hard links, and non-files cannot enter the ordinary path`、`INV-003/020: missing workspace and malformed target remain unknown`；`tests/corpus/file-classification.test.ts` — `A-005 file corpus covers supported classifications and neighboring blocks`、`A-005 validates the locked Pi read/write/edit schemas`；`tests/security/risk-engine.test.ts` — `INV-003/020: missing verified identity or schema evidence cannot ask or auto-allow`；`tests/integration/pi-adapter.test.ts` — `Pi 0.85.1 verified read/write/edit sources and schemas stay locked`、`unknown and same-name overridden tools retain degraded identity`、`missing, duplicate, changed-session, and incomplete sibling identities fail closed` | 前缀邻居/越界/link/hard-link/目录/malformed 全不能进普通路径；真实 Pi source/schema 精确匹配才支持；同名覆盖/未知工具不冒充 builtin；sibling 缺失不冒充单动作 | `D1/D2` 核对只使用路径分段与 realpath/最近存在父目录；展示 label 不作为 identity | Windows 本轮已覆盖；POSIX/macOS 未运行 | **当前环境 PASS**（S、C、I、D1/D2）；跨平台 **NOT_RUN** |

#### INV-014 真人研究与产品声明审查（单列）

本轮没有真实参与者记录，`Human Validation = NOT_RUN`。正式 Beta/Release gate 改用代理验证，但受控 TUI、固定文案 fixture、自动化通过和本表仍不能证明真人理解。直接审查的当前产品声明包括：`outcome-card-spec.md` 头部保持“真人验证：NOT_RUN”；`development-plan.md` 明确代理验证只证明工程与安全路径；`references.md` 未把历史 mock/SDK 测试写成真人理解；未发现已验证成功率、“30 秒内可读已通过”、一键安装、sandbox、Undo、完整核验或恶意共存扩展防护承诺。该声明审查为 PASS，只证明当前文字没有越界。

#### A-015 本轮命令与文档证据

| 检查 | 2026-09-10 实际结果 |
|---|---|
| `npm run typecheck` | PASS，退出码 0 |
| `npm run lint` | PASS，退出码 0；40 files，无修复 |
| `npm run build` | PASS，退出码 0 |
| `npm run test:security` | PASS，退出码 0；9 files / 63 tests；新增 Pi coding-agent/pi-tui 值、类型、动态 import 与 event 结构反例 |
| `npm run test:corpus` | PASS，退出码 0；4 files / 22 tests；A-013 shell 仍为 127 fixtures（40 candidate / 50 ask / 37 block），未把 fixture 数冒充 test 数 |
| `npm run test:unit` | PASS，退出码 0；7 files / 42 tests |
| `npm run test:integration` | PASS，退出码 0；2 files / 18 tests；真实 Pi 0.85.1 SDK + 手动事件/受控 UI，覆盖来源/schema、模式矛盾、reload、session/cwd、重入、输入变化及 sibling，不冒充 A-016 完整调度 |
| Git/忽略文件 | 任务起点 HEAD `a6bcf066659c9c2e08d2184ee04b2f272b9f6330`；已跟踪工作区无改动；docs 被忽略，已逐文件直接读取，未修改 `.gitignore`、未 force-add/commit/push/publish |
| 源码与声明人工审查 | PASS：Pi import 边界、Pi-only、无普通存储/verifier/restore 类型、文案不参与策略、无 sandbox/隐藏推理/恶意共存扩展防护承诺；测试摘要不含 raw input、token、真实秘密、完整 transcript 或 snapshot 正文 |
| Windows CI 配置 | 本地 PASS：单个只读 Windows job，锁定官方 checkout v7.0.1/setup-node v7.0.0 完整 SHA、Node 24.14.0/npm 11.9.0，并按序连接四类已有 suite。远端 run `93381269632` 在 lint 因 Windows checkout CRLF 失败；已用仓库级 `.gitattributes` 固定 LF 并补回归，修复版本远端重跑 **NOT_RUN** |
| `test:e2e`、真实终端、真人研究、跨平台 | **NOT_RUN**；`test:e2e` 仍由 A-016 首次建立，其余不以本轮自动化替代 |

A-015 的扩展模块边界反例、真实 Pi 模式/生命周期合约和最小 Windows CI 已按实际检查回填；A-016 的真实调度 E2E 建立后继续更新本表，不复制第二套 INV 编号或硬编码通过报告。CI 只运行已跟踪代码测试；被忽略的本地规范继续直接读取验收。

#### A-016 本轮真实调度增量证据

`tests/e2e/pi-dispatch.test.ts` 通过真实 `AgentSession.prompt()` 和 Pi agent loop 加载 package 声明的 AgentGlass 入口，1 file / 8 tests 全部 PASS。其场景分别补强 INV-004/012（snapshot unavailable、Stop/详情/Esc/cancel、无 UI/RPC）、INV-007/008（输入/目标/pre-image 漂移、重放、会话替换）、INV-013（write+write、write+unknown、缺失 sibling）和 INV-002/003/020（unknown、同名覆盖、shell、敏感、越界、junction 与合成 Critical 输入）。允许分支由测试读取目标字节，阻止分支确认目标未被该动作改变；这些断言不是产品 verifier，也没有读取或报告 snapshot 正文。

本轮 `npm ci`、typecheck、lint、build、unit 7/42、corpus 4/22、security 9/63、integration 2/18、e2e 1/8 和 package dry-run 均退出码 0。2026-09-11 最终 Batch 4 review 在同一 `HEAD 0d720571cb8f1db3316f97f4716f48ace0c3c90d` 重新取得相同本地结果；公开远端 Windows CI #3（run `34507840141`）为 Success。真实人工终端、真人研究和跨平台仍为 `NOT_RUN`，因此结论仅为 Alpha automated gate PASS。2026-09-11 的代理验证例外另行开放 B-001 工程准入，不改变本段历史验收结果。

### 证据层级与准入

- 真实 SDK 加手动事件/受控组件输入属于宿主合约证据；直接调用内置工具不能单独证明 Pi 调度尊重阻止结果。
- A-016 已由 Pi 自身执行循环调度实际扩展和内置文件工具；测试侧读取目标只是断言，不是产品 verifier，也不授予产品恢复能力。
- 自动化 Pi 调度、真实终端操作、真人研究分别报告。INV-014 只能引用真实参与记录；没有记录保持 NOT_RUN，不能由模拟 UI 输入替代。
- Alpha 代理验证 PASS 允许 B-001 在明确分配后开始，但不能直接作为完整 Beta 的 B-004 证据；B-004 必须针对 B-001～B-003 的实际能力重跑代理矩阵。Human Validation 独立保持 NOT_RUN，不是工程 gate，也不能由代理结果补写。

### B-001 增量证据（2026-09-11）

锁定 `@earendil-works/pi-coding-agent@0.85.1` 的真实执行链由 `tests/e2e/pi-dispatch.test.ts` 验证：事件顺序为 `tool_execution_start → tool_call → tool_result → tool_execution_end`；`tool_result` 可修改 content/details/isError/usage，`tool_execution_end` 不可修改结果。AgentGlass 不读取或保存 result 正文，只在匹配完整执行绑定后触发明确目标的独立有界读取；缺失结果时结束事件只生成 unknown 并清理。

`tests/corpus/risk-engine.test.ts` 的 `B-001 backup gate covers hit, neighboring read, quota fault, and implicit parents` 覆盖必需备份命中、普通 read 相邻反例、配额故障和隐式父目录；真实 Adapter/E2E 覆盖存储不可用和隐式目录均不打开审批。`tests/unit/file-verification.test.ts` 覆盖 write 新建/覆盖所需的精确字节、edit 语义不足、成功但不符、失败但匹配、缺失、身份变化、读取失败、10 MiB 超限及读取中增长错误。integration 覆盖重复/错序/缺失/漂移/跨生命周期结果和单一 read status；真实 Pi E2E 覆盖 write/create/overwrite/edit、BOM/CRLF/模糊匹配/歧义失败、结果改写、成功后字节不符与同一 widget 更新。

Human Validation 仍为 **NOT_RUN**；恢复/清理与 B-003 欢迎/示例已由本地自动化与锁定 Pi E2E 验证，但真实人工终端、macOS/Linux 和完整 Beta B-004 代理验收仍未运行。上述要求不改变 INV-001～020，也不把 B-001～B-003 写成完整 Beta。

B-001 最终工程命令均退出码 0：`npm run typecheck`、`npm run lint`（44 files，无修复）、`npm run build`、`npm run test:unit`（8 files / 57 tests）、`npm run test:corpus`（4 / 23）、`npm run test:security`（9 / 64）、`npm run test:integration`（2 / 21）和 `npm run test:e2e`（1 / 12），合计 24 个 Vitest 文件 / 177 个测试。integration 首轮曾因测试断言被误放而 20/21，修正测试后先定向 1/1，再完整 21/21；最终状态以上述完整重跑为准，不以定向运行中的 18 个 skipped 计入验收。

### B-002 增量证据（2026-09-12）

`pre-image-snapshot.ts` 在 B-002 历史证据中以新的 `schemaVersion=2` / `agentglass-single-file-recovery` 契约发布 `prepared → ready → consumed/superseded`；R-001 为 POSIX inode 复用防护将当前契约版本化为 `schemaVersion=3`，旧 v2 不再作为恢复授权。敏感 manifest/前像正文不进入卡片、普通日志或 token；当前 session 内存入口只保留不透明 ID、关联、路径 hash 和脱敏标签。

`tests/unit/pre-image-snapshot.test.ts` 覆盖覆盖写、新建逆操作、内容/身份/硬链接/权限漂移、Windows 前像字节与 ACL 恢复后复核、schema v1/损坏/future/prepared-only、恢复执行失败、清理集合漂移与部分失败。既有 10 MiB / 100 MiB / 4096 条目、权限/磁盘/锁/中断发布回归仍通过。`tests/security/pre-image-snapshot.test.ts` 证明合成秘密只进入敏感正文域且冲突保留后续修改。

`tests/integration/pi-adapter.test.ts` 覆盖单独卡片、Stop 初始聚焦、替代拒绝保留旧入口、`agent_end` 保留、换 session 失效、审批中漂移、重复调用、清理拒绝/批准。`tests/e2e/pi-dispatch.test.ts` 通过锁定 Pi 0.85.1 真实 agent loop 走通 edit 原变更 → `tool_result` 后置观察 → `/agentglass restore` → 独立文件断言 → 单独清理。

本轮最终完整门槛均退出码 0：`npm run typecheck`、`npm run lint`（44 files）、`npm run build`、unit 8 files / 65 tests、corpus 4 / 23、security 9 / 65、integration 2 / 24、e2e 1 / 13，合计 24 个 Vitest 文件 / 190 tests。真实人工终端、Human Validation、macOS/Linux、OS 掉电时序和完整 Beta B-004 代理验收仍为 **NOT_RUN**。

### B-003 增量证据（2026-09-12）

B-003 在同一个 `registerCommand("agentglass")` 下增加欢迎/帮助、固定无秘密示例和最近结果面板，没有新增入口、设置、密钥或运行时依赖。欢迎只显示经边界处理的当前目录名；帮助明确普通 read/write/edit 范围、恢复与私有清理能力、冲突/未知/不支持边界，以及 Pi 0.85.1 没有可靠目录切换和文件打开 API 时的具体下一步。

示例预检只接受真实、非链接的当前 cwd 和固定直接子路径 `agentglass-example/活动说明.txt`；审批卡明确预期位置、无秘密固定内容、不覆盖、目录不可恢复。批准后再次核对 cwd 的 realpath、设备/索引身份和目标不存在状态，再同步消费内部一次性 token；mkdir/write 使用标准库，部分失败保留并报告已知事实，不自动删除。示例文件随后通过普通锁定 Pi `edit` 进入 B-002 的观察、恢复和独立清理路径。

`tests/integration/pi-adapter.test.ts` 的 B-003 用例验证首次欢迎一次、同 cwd reload 不重复、主动帮助不弹审批、脱敏 cwd、最近结果、冲突、取消和无 UI；`tests/e2e/pi-dispatch.test.ts` 的 B-003 用例用锁定 Pi 0.85.1 实际扩展入口和 agent loop 完成示例准备 → 普通 edit → restore → cleanup。当前运行结果为 integration 2 files / 26 tests、e2e 1 file / 14 tests，均退出码 0；其他全量门槛及 package dry-run 同样在当前工作树通过。受控 UI 只证明调度和组件路径，不证明真人理解。

真实终端人工走查仍为 **NOT_RUN**。可执行清单：从已配置模型的 Pi TUI 打开扩展；确认首次欢迎只出现一次；输入 `/agentglass help` 检查脱敏 cwd、支持/不支持范围、恢复/清理说明和目录切换下一步；输入 `/agentglass example` 逐项检查 Stop/详情/继续、取消、已有目录冲突；在示例文件上用普通 `edit` 修改、核对结果卡、执行 `/agentglass restore` 后再核对 `/agentglass cleanup`；切换到另一 Pi 项目/会话后确认入口失效；分别观察无 UI、停止、失败、未知和不支持任务的固定反馈。此清单不能替代真人记录。
### B-004 最终 Beta 回填：INV-001～020（2026-09-12）

本表是本轮最终代码的增量回归，不复用旧 Alpha 分母。`AUTO` 指本轮自动化 gate/真实 Pi
测试，`TERM` 指本轮真实 PTY 走查；`TERM=NOT_RUN` 不由 `AUTO` 抵消。

| INV | 本轮 Beta 断言、真实 Pi 场景与能力限制 | 当前结果 |
|---|---|---|
| 001 | 风险只由确定性事实决定；真实 Pi PTY 使用已配置模型但不让 LLM 决定风险；未执行 shell/安装/运行 | `AUTO PASS`；`TERM PASS`（能力边界仍不含恶意共存扩展） |
| 002 | unknown/unsupported/覆盖工具不自动放行；真实 Node.js 安装和运行请求探索目录时被固定阻止；不开放 shell | `AUTO PASS`；`TERM PASS`，会话 `9411` 的受控执行后故障实际生成 mismatch/unknown，不改变动作放行规则 |
| 003 | 规则、身份、备份、读取和 UI 失败均关闭；E2E/integration 覆盖缺 UI、备份不可用和 Critical；真实 `46658` 的只读目标以 EPERM 失败并保持原文件，`19130` 的隐式父目录要求明确允许；`14227` 的超限 write 无前像证据即阻止 | `AUTO PASS`；上述真实故障及会话 `9411` unknown 路径 `TERM PASS`；Pi 超限 edit 宿主故障移交 R-001，不算 AgentGlass PASS |
| 004 | 真实 Pi edit→restore、新建文件逆操作、恢复冲突保留后续编辑、cleanup 与独立存在/字节断言；失败不重试；`46658` 失败后无恢复入口；`14227` 超限 write 保持原文件 | `AUTO PASS`；支持、EPERM 与超限 write 路径 `TERM PASS`；配额损坏/宿主栈溢出故障单列 |
| 005 | security/integration 检查秘密不进普通输出；`51028` 的敏感 `.env` write 与 `39459` 的敏感 `.env` read 均被阻止；会话 `45859` 的覆盖输入不含合成 canary，扫描 6 个隔离文件时 canary 仅命中一个 `.preimage`，manifest 与覆盖后项目文件均 0 命中 | `AUTO PASS`；敏感持久化边界 `TERM PASS`；物理内存擦除不验证 |
| 006 | canonical raw 先于 redaction 计算版本化 fingerprint；E2E 漂移重卡；不声称签名或抵御后加载扩展 | `AUTO PASS` |
| 007 | fingerprint/tool/cwd/session/hostExecutionId/toolCallId 绑定；真实 Pi session/cwd 测试覆盖；不以显示 label 作身份 | `AUTO PASS` |
| 008 | 单次消费、输入/目标/pre-image 漂移与 replay/new session 失效；真实恢复入口单次消费，重启后无入口；`93523` 的目标外部漂移未被旧卡直接覆盖并重新呈现审批；会话 `9411` 的故障只发生在授权工具完成后 | `AUTO PASS`；支持、目标漂移与结果故障路径 `TERM PASS` |
| 009 | matched/mismatch/unknown/not observed 保持显式；真实成功卡明确写实际目标/程序功能未知；`46658` 的 EPERM 卡和会话 `9411` 的字节矛盾显示“不符”，不受支持目标显示“无法确认” | `AUTO PASS`；matched/mismatch/unknown `TERM PASS` |
| 010 | High/Critical 在主卡可见；真实 PTY 的 example 卡观察到 Stop/详情/继续及危险说明；不以折叠隐藏 | `AUTO PASS`；真人理解 `NOT_RUN` |
| 011 | 文案/测试审查不声称 sandbox、shell containment 或防恶意共存扩展；没有对抗实测 | 声明 `PASS`；防护能力 `NOT_RUN/不承诺` |
| 012 | 受控 Pi TUI 仅 Continue 批准；真实普通 read 无卡，write/edit 只有 Continue 执行，Stop/详情/拒绝不执行；非交互 `--mode json --print` 和真实 RPC write 均因无本地审批 UI 停止 | `AUTO PASS`；支持、无 UI、RPC 路径 `TERM PASS`；Esc `NOT_RUN` |
| 013 | read/read 可并行，多个 mutation/unknown 与缺 sibling 顺序阻止；无自动重排或归因例外 | `AUTO PASS`；真实模型批次 `TERM NOT_RUN` |
| 014 | 不生成参与者、选择、耗时、理解率或成功率；Human Validation 保持 `NOT_RUN` | `NOT_RUN`（强制声明边界） |
| 015 | `src/` Pi import 边界扫描仍只允许 `extensions/`、`src/adapter/pi/`；无第二宿主 | `AUTO PASS` |
| 016 | raw 只短暂用于 canonicalization/preflight/classification；普通结果只保留脱敏事实；不承诺物理内存擦除 | `AUTO PASS`；物理擦除不验证 |
| 017 | 不展示/重建/保存 hidden chain-of-thought；结果卡只使用可观察 goal/tool/result/state | `AUTO PASS` |
| 018 | 真实 Pi 0.85.1 入口与 agent loop 通过；无 Hermes/DeepSeek/host registry；跨宿主不在 v1 | `AUTO PASS`；跨平台 `NOT_RUN` |
| 019 | UI/旧批准/持久化数据不能授权；真实 restore 单次消费，重启和 cleanup 后均无入口，cleanup 独立批准；无 UI 与 RPC 不转成批准 | `AUTO PASS`；重启/cleanup/无 UI/RPC `TERM PASS`；跨项目仍 `NOT_RUN` |
| 020 | 路径分段/realpath、工具 source/schema、link/special/sensitive/outside、sibling 均验证；真实 PTY 实测隐式父目录、链接路径阻止、只读 EPERM、敏感 `.env` write 阻止、超限 write 阻止和隔离 cwd 文件断言 | `AUTO PASS`；普通支持、link/parent/permission/sensitive-block/quota-preflight 与秘密持久化边界 `TERM PASS` |

最终结论为 `BETA_PROXY_ACCEPTANCE=PASS`：真实终端与自动化共同覆盖 Pi 已就绪入口、普通 read/write/edit、审批分支、恢复/冲突/清理、不支持任务、目标漂移、权限/路径/UI/RPC 故障、matched/mismatch/unknown 和敏感 snapshot 边界。会话 `9411` 的先加载临时故障扩展只在受批准工具完成后改变隔离目标，用于验证观察结果，不构成恶意共存扩展防护声明；会话 `45859` 使用实际 Adapter 与隔离 snapshot 根，临时数据随后删除。Human Validation 仍为 `NOT_RUN`。超限 edit 的 Pi 0.85.1 预览栈溢出发生在 AgentGlass `tool_call` 前、目标未变，作为宿主兼容性问题移交 R-001，不伪造产品修复或 quota PASS。

### Release 证据衔接（2026-09-12，尚未执行）

INV-001～020 的规则和编号不变；development-plan §6 是 R-001～R-004 的任务与 Done Definition。本次仅核对文档/代码，不产生新的安全测试 PASS。

| 任务 | 重点证据 | 当前状态 |
|---|---|---|
| R-001 | INV-003/007/008/010/012/015/020：预览缺陷、锁定工具/事件合约、平台权限/恢复、终端与无 UI 阻止；保留全部其他安全回归 | **PASS_WITH_DEFERRED_EXTERNAL_DEFECT（仅准入）**：Windows 与 Debian Node 22/24 全部工程 gate、平台权限/恢复及两平台真实 TUI 子项通过；Pi tool_call 前超限预览仍崩溃，已登记为当前版本已知限制和后续版本目标，不作为当前 R-004 发布阻断 |
| R-002 | INV-004/005/008/012/019/020：实际制品安装、独立清理、卸载保留数据、重装不恢复授权、支持声明 | **PASS（Windows-only，候选未发布）**：实际 tarball 安装、启用/禁用/卸载/重装与 0.84.3～0.85.1 矩阵证据见 references §30～31 |
| R-003 | INV-003/005/009/016/019：有界输入/存储/内存、失败关闭、不以性能跳安全检查、无敏感测量日志 | **PASS**：用户于 2026-09-14 明确将加载增量门调整为 P95 `≤350 ms`；当前候选两轮 20 对冷启动为 `321.142/188.968 ms`，纯预检 P95 `0.516 ms`，输入/配额/资源释放与敏感数据边界证据通过。安全检查未因预算变更而跳过，见 references §37 |
| R-004 | INV-001～020：最终候选全量回归、完整 Beta 代理矩阵及声明审查；INV-014 真人指标独立 | **PASS / RELEASE_READY=PASS**：最终候选工程与代理证据通过；外部 Pi 预览缺陷按用户决定作为已知限制和后续版本目标，不阻断当前候选；远端 CI/Human Validation 仍为 NOT_RUN；详见 `references.md` §36.6 |

根目录 AGENTS.md 的旧“必需真人研究”表述已与本文件既有代理 gate 对齐：真人研究没有真实记录保持 NOT_RUN，不阻止工程 gate，也不能被代理证据伪装为 PASS。宿主 tool_call 前崩溃不能算 AgentGlass 安全拒绝。本次明确准线允许该已归属外部且已延期的缺陷开放 R-002；2026-09-13 用户进一步决定将其作为当前版本已知限制和后续版本目标，不阻断当前 R-004。

### R-001 实测安全映射（2026-09-12）

本轮先核对 §26.5 的 `BETA_PROXY_ACCEPTANCE=PASS`，再在 HEAD
`556c90e1ef36cb558d2f7496ecbec6208e568828` 上执行 Windows 与 Debian 12 Linux
候选环境。历史 Beta PASS、自动化 PASS、真实 Pi TUI、远端 CI 和 Human Validation
分开记录；本节不把任何失败写成安全拒绝。

| 不变量 | 本轮证据 | 当前判断 |
|---|---|---|
| INV-003 关键失败关闭 | Windows/Linux 的 security、integration、e2e；未知/unsupported/link/sibling/no-UI 仍阻止 | **局部 PASS**；宿主预览在 AgentGlass 之前崩溃，不能算 AgentGlass 阻止 |
| INV-007/008 精确批准与单次消费 | Windows 与两套 Linux 的现有 contract/E2E 回归通过，Node 22/24 的 input/target/pre-image drift 与 replay 用例通过 | **自动化 PASS**；不能覆盖 Pi 预览未进入回调的故障 |
| INV-010 危险信息可见 | Windows §26 TUI/卡片证据；Debian native PTY 80×24 的 help 与普通卡实际显示必要危险信息，Pi 只截断 help 非关键尾部 | **两平台终端子项 PASS；真人理解 NOT_RUN** |
| INV-012 只有真实 Continue 批准 | Windows real Pi/受控 TUI 与 RPC/print/json/no-UI 证据；Debian actual Pi TUI 实测默认 Stop、详情不批准、拒绝不变更、Continue 后才执行，cleanup 也独立批准 | **两平台终端与自动化 PASS；Human Validation NOT_RUN** |
| INV-015 Pi import 边界 | 两套环境 `security`/host-boundary 实测通过，未加第二宿主 | **PASS** |
| INV-020 工具/source/schema/path/link/sibling | 两套环境 contract/corpus/security/integration 回归通过；v3 unit/security 覆盖 inode-reuse、link、special、sibling 与锁定 source/schema | **普通路径 PASS；Release 映射仍 INCOMPLETE** |

发布阻碍不是“超限输入不支持”：Pi 0.85.1 的真实 preview 在 `tool_call` 前以
`RangeError: Maximum call stack size exceeded` 退出；目标未变的直接 preview 断言为
64 KiB、4 MiB、8 MiB 三档，其中 8 MiB 仍崩溃。Linux 两个 exact Node/npm 组合的
unit/security/integration/e2e 均通过；v3 以
post-image `changeTimeMs` 绑定 unlink/recreate 后的替换冲突，不能把复用 inode 误认成
原文件。因此 INV-003/008/020 的平台证据已补齐；按本次明确准线，R-001 为 `PASS_WITH_DEFERRED_EXTERNAL_DEFECT` 以开放 R-002，Release 收口仍被该缺陷阻断。
官方 Pi PR 修复未进入 0.85.1 发布包，未修改依赖或覆盖
内置工具。按本次决定，该外部宿主缺陷延期到后续版本；延期不等于安全 gate PASS，
R-001 的准入状态为 `PASS_WITH_DEFERRED_EXTERNAL_DEFECT`，R-002 可在明确分配后启动；该状态不代表 Release PASS。Human Validation=NOT_RUN，不能产生真人理解率、耗时或成功率。

### R-004 最终候选安全复审（2026-09-13）

本节对应当前明确分配的 R-004，不改变 INV-001～020 的规则。最终候选固定为
`HEAD=533131e218c7b620bdaddd856b25fa179242ebb6`、Windows x64/NTFS、Node
24.14.0、npm 11.9.0、Pi 0.85.1、`@ddt/agentglass@0.8.0`；候选 tarball
SHA-256 为
`28D07ADE6514510F08DE368B93AB945E333C514E6CD9AA5B5118000C7B22C809`。
本地已有的三项源文件修改和未跟踪的性能脚本均保留，package/lockfile 未变；忽略的
规范文档由本地直接读取。完整命令、数量、制品和场景索引见 `references.md` §33。

| 不变量 | R-004 最终候选证据 | 状态 |
|---|---|---|
| INV-001 | `test:security`、`test:corpus`、E2E 与源码/文案审查；没有把模型或自然语言作为风险决定器 | **PASS** |
| INV-002 | unknown/unsupported/敏感/越界/覆盖工具与不完整 sibling 的 corpus、安全和 E2E 负例均保持 hard block | **PASS** |
| INV-003 | 关键预检、无 UI、备份失败、工具/路径/sibling 故障的安全与集成用例失败关闭；Pi 预览故障另列为外部已知限制 | **PASS（产品路径）**；外部限制已披露，不阻断当前 R-004 |
| INV-004 | 实际候选 E2E/集成覆盖 restore、冲突、最近入口、拒绝保留和 cleanup；只显示有证据的恢复能力 | **PASS（支持范围内）** |
| INV-005 | secret-boundary、敏感 snapshot、敏感/越界 E2E 与 tarball 清单审查；snapshot 正文未进入报告、UI 或模型上下文 | **PASS** |
| INV-006 | canonical raw input 在 redaction 前 fingerprint 的 security/integration 回归 | **PASS** |
| INV-007 | tool、cwd、session、tool call identity、fingerprint 的精确绑定回归；真实卡片只对当前动作批准 | **PASS** |
| INV-008 | 输入/目标/pre-image 漂移、拒绝、replay、新 session 和单次消费回归；真实模型写入和 edit 均重新出卡 | **PASS** |
| INV-009 | outcome card 与验证文案区分已确认、工具报告、仍未知；真实 PTY 观察到该分层 | **PASS** |
| INV-010 | High/Critical 和多原因信息在主卡；真实 PTY 的 Stop/详情/Continue 卡保留风险和恢复信息 | **PASS（代理/终端证据）**；真人理解不推导 |
| INV-011 | README、威胁模型、卡片和 package 说明明确无 OS sandbox、完整 shell containment、恶意共存扩展隔离承诺 | **PASS（声明审查）**；防护能力不承诺 |
| INV-012 | 初始 Stop；详情不批准；Stop/取消/无 UI 不执行；真实 TUI 只有 Continue 进入执行 | **PASS** |
| INV-013 | read/read 可并行；多个 mutation/unknown、缺失/不完整 sibling 顺序阻止；无自动重排 | **PASS** |
| INV-014 | 无真实参与者记录；没有生成理解率、耗时、成功率或匿名研究结果 | **NOT_RUN（强制声明）** |
| INV-015 | Pi API/类型仍仅在 `extensions/` 与 `src/adapter/pi/`；host-boundary/corpus/security 回归通过 | **PASS** |
| INV-016 | raw input 只为 canonicalization、分类和必要风险分析短暂使用；性能与安全输出未含 raw/snapshot 正文 | **PASS（边界审查）** |
| INV-017 | 没有输出或伪造 hidden chain-of-thought；卡片只展示可审阅事实和固定说明 | **PASS** |
| INV-018 | 仅 Pi 内置 read/write/edit，package peer 为 `>=0.84.3 <=0.85.1`；Windows-only 诚实声明 | **PASS（支持矩阵内）** |
| INV-019 | 重启/新 session 不恢复授权；cleanup/restore 独立批准；旧 schema 与重建 token 不能授权 | **PASS** |
| INV-020 | realpath/路径分段、真实工具 source/schema、链接/特殊文件、敏感/越界和 sibling 信任边界回归通过 | **PASS（AgentGlass 路径）**；Pi 预览阻断另行记录 |

安全风险结论：本轮没有发现可归因于 AgentGlass 且尚未关闭的严重安全或数据丢失缺陷。
但是 Pi 0.85.1 的锁定宿主 `ToolExecutionComponent.render` 在 8 MiB `edit` 预览中重现
`RangeError: Maximum call stack size exceeded`，退出码 1，发生在 AgentGlass
`tool_call` 前且目标文件保持原状；这不是 AgentGlass 的安全拒绝，不能当作“不支持输入已被
阻止”。按 2026-09-13 用户决定，该外部缺陷作为当前版本已知限制和后续版本修复目标，
不阻断当前 RELEASE_READY。未盲目升级宿主、未覆盖内置工具、未引入运行时联网检查。

## 9. R-004 新候选复验（2026-09-13）

本次复验继续以 INV-001～020 为权威安全编号。当前有效 AgentGlass 候选为
`@ddt/agentglass@0.8.0`，HEAD `533131e218c7b620bdaddd856b25fa179242ebb6`，Windows
x64/NTFS、Node `24.14.0`、npm `11.9.0`，tarball SHA-256
`5C4106F2E5D11617DAFBD0DD04DEF4DA881D4855CBC71A6936EEBCFCB882448C`。工作树用户差异保留，
本次没有净新增运行时代码修改；`package.json`/lockfile 与 HEAD 一致。

当前候选的工程、corpus/security/integration/e2e、实际 tarball 安装、真实官方 Pi
`extensions/agentglass.ts` TUI 启动和性能复验均通过；B-004 M-01～M-07 的 AgentGlass
路径继续为 PASS。INV-001～020 逐项结果沿用本节既有映射，R-004 复验中未发现新的
AgentGlass 严重安全或数据丢失缺陷；INV-014 仍强制为 `NOT_RUN`，因为没有真实参与者记录。
安全含义不因代理或模型场景扩大：不声称 sandbox、shell containment、恶意共存扩展隔离、
应用功能正确或真人理解率。

新宿主候选 `0.85.2-agentglass.0` 的直接 `ToolExecutionComponent.render` 对 200,000 行和
8 MiB old/new preview 均通过，但实际加载 AgentGlass 随包 `extensions/agentglass.ts` 时因
候选包根缺少 `index.js` 退出码 `1`。直接加载编译后的 AgentGlass JS 绕过了该 manifest
入口，不能作为用户安装路径证据；该包也不是官方 Pi 版本、不在 peer 支持范围内。官方
Pi 0.85.1 的 8 MiB edit preview 仍在 AgentGlass `tool_call` 前以
`RangeError: Maximum call stack size exceeded` 退出。两项均继续作为兼容/发布阻断，不得
伪装成 AgentGlass 的安全拒绝。

本次没有升级锁定宿主、覆盖内置工具、引入运行时联网检查、shell、后台服务或额外 LLM 调用。
完整候选、命令、分母、hash、故障和 Done Definition 见 `docs/references.md` §35；
`RELEASE_READY=FAIL`，未发布、未上传、未 push、未 tag、未创建 release。

## 10. R-004 修补 Pi 诊断候选复验（2026-09-13）

上一节记录的 `0.85.2-agentglass.0` manifest 入口失败已定位并最小修复：Pi 诊断候选包根
新增 `index.js`，只重新导出 `./dist/index.js`，并随包纳入该文件；版本递增为
`@earendil-works/pi-coding-agent@0.85.2-agentglass.1`。修复只存在于隔离的非官方宿主
诊断制品，未修改 AgentGlass 源码、官方 Pi、peer 支持范围、工具参数或运行时联网边界。
最终制品 SHA-256 为 `3121727F46AED4D33DC800477ECEEC6B58FE215BF0A00E2330E441BA6081A2B4`。

该 `.1` 制品从实际 tarball 安装后，随包 `extensions/agentglass.ts` 能加载并显示
`AgentGlass 已启用`；200,000 行 preview 与 8 MiB old/new preview 均无栈溢出；真实已配置
模型 TUI 走过 read→write→edit，write/edit 卡片初始均为 Stop，只有 Continue 执行，独立
读取确认隔离文件为预期内容。由此关闭的是 `.0` 诊断包的入口缺陷，不是官方支持宿主缺陷。

安全映射更新如下：

| 不变量 | 修复后证据 | 状态 |
|---|---|---|
| INV-003 | AgentGlass 产品路径的故障仍失败关闭；`.1` preview/manifest 路径回归通过；官方 0.85.1 8 MiB preview 仍在回调前失败 | **PASS（产品路径）**；**发布阻断仍在** |
| INV-005/006/016 | 修复只增加宿主包根入口；真实终端与独立断言未输出 raw input、秘密、snapshot 正文或模型认证信息 | **PASS** |
| INV-008/012 | `.1` TUI 的实际审批仍精确绑定当前动作，初始 Stop，Continue 后才执行；独立文件断言与卡片事实分层 | **PASS** |
| INV-011/018 | 未宣称 sandbox、shell containment 或恶意共存扩展隔离；`.1` 明确为非官方、非支持矩阵诊断包 | **PASS** |
| INV-014 | 没有真实参与者记录 | **NOT_RUN** |
| INV-015/020 | 未新增第二宿主抽象；工具身份、路径、schema、link/special/sibling 边界未放宽 | **PASS** |

其余 INV-001～020 继续沿用 `docs/references.md` §35 的逐项复审；没有发现 AgentGlass
未关闭的严重安全或数据丢失缺陷。官方 Pi 0.85.1 的 `ToolExecutionComponent.render` 在
8 MiB `edit` preview 中仍以 `RangeError: Maximum call stack size exceeded` 退出，且发生在
AgentGlass `tool_call` 前；它仍是外部兼容性发布阻断，不能冒充 AgentGlass 的安全拒绝，
也不能用非官方 `.1` 诊断包关闭。完整命令、分母、候选清单和最终判定见
`docs/references.md` §36；`RELEASE_READY=FAIL`，Human Validation 仍为 `NOT_RUN`。

### 10.1 受影响 R-004 gate 重跑（2026-09-13）

用户要求的受影响 gate 已在新鲜隔离目录重跑。Pi `.1` 实际 tarball 安装新增 `127`
packages，AgentGlass `0.8.0` 实际 tarball 安装新增 `169` packages；固定 `.1` 与固定
AgentGlass manifest 启动显示 `AgentGlass 已启用`。同一 `131,072` 行 old/new preview
在 `.1` 中完成，在官方 Pi `0.85.1` 中仍于 `ToolExecutionComponent.render` 的
`lines.push(...contentLines)` 触发 `RangeError` 并以退出码 `1` 结束。

实际模型 TUI 使用已配置的 `deepseek-v4-pro` 进行 read→edit；审批卡初始聚焦 Stop，
只有 Continue 后执行，独立读取隔离文件确认预期字节和 hash。该重跑没有输出 raw tool
input、秘密、snapshot 正文或认证信息。由此 INV-003/008/012 的 AgentGlass 路径继续
通过，INV-014 仍为 `NOT_RUN`；官方宿主兼容性阻断仍存在，不能被非官方 `.1` 候选覆盖。
`RELEASE_READY=FAIL`。

## 11. README 同步后的最终制品复验（2026-09-13）

本次仅同步随包 README，并按制品变化重新执行实际打包和隔离安装 smoke。当前候选为
`@ddt/agentglass@0.8.0`，制品
`G:\\work\\AgentGlass\\artifacts\\ddt-agentglass-0.8.0-r004-final.tgz`，SHA-256 为
`7FF5D1086E857070553D3528921DC22C91C11D669C0529B1415B719DD7A8AC57`。安装后
`extensions/agentglass.ts` 和英文 Pi 已知限制说明均存在，实际安装新增 `169 packages`，
退出码 `0`；完整命令和包体数据见 `docs/references.md` §36.6。

2026-09-13 用户决定不在 AgentGlass 中修复官方 Pi `0.85.1` 的 8 MiB `edit` preview
栈溢出；该故障继续明确为 AgentGlass 回调前的外部宿主已知限制和后续版本修复目标，
不写成安全拒绝，不阻断当前 R-004。该决定不改变 INV-001～020 的任何安全规则：
AgentGlass 自身的错误放行、恢复覆盖、权限缺口、秘密泄露和未知/越界绕过仍必须失败关闭。
当前 R-004 的工程结论为 **`RELEASE_READY=PASS`**；Human Validation 与远端 CI 的实际
状态仍分别准确保持 `NOT_RUN`，没有生成真人指标，也没有上传、push、tag、release 或实际发布。

## 12. 账号 scope 改名后的候选复验（2026-09-14）

用户要求将未发布的候选包从 `@ddt/agentglass` 改为账号 scope
`@hugo-ddt/agentglass`，以匹配已认证的 npm 用户 `hugo-ddt`。本节只记录包身份、文档和
制品变化，不修改 INV-001～020，不放宽任何工具、路径、审批、恢复、秘密或宿主边界；此前
`@ddt` 候选记录保留为历史证据。

`package.json`、`package-lock.json`、Pi 集成断言以及中英文 README 已同步。干净隔离目录
实际执行 `npm ci`、`npm run typecheck`、`npm run lint`、`npm run build`、`npm run test:unit`
（65）、`npm run test:corpus`（23）、`npm run test:security`（65）、`npm run test:integration`
（27）和 `npm run test:e2e`（14），均退出码 `0`。新准确制品为
`G:\\work\\AgentGlass\\artifacts\\hugo-ddt-agentglass-0.8.0.tgz`，SHA-256 为
`5A6A46A195ED14E2C8FF6F7F86EC55D28C8BB4DC9B028B438E2DBC510EE2E924`，压缩包
`289,415` bytes、解包 `666,972` bytes、49 entries。

从该 tarball 的新隔离目录安装新增 `169 packages`；安装后的包名/版本为
`@hugo-ddt/agentglass@0.8.0`，`extensions/agentglass.ts` 存在，README 不再含旧包名，
且 `tests` 未进入制品。上述结果只证明准确制品和包身份一致，不代表已上传；npm registry
发布仍需用户明确授权并在该账号 scope 可写后执行。Human Validation 与远端 CI 仍为
`NOT_RUN`。

## 13. Pi 原生安装说明复验（2026-09-14）

用户要求简化 Quick start，并参考 Pi 官方包管理方式将中英文 README 的手动 npm 安装、
临时 prefix 和二次路径传递流程改为单条
`pi install npm:@hugo-ddt/agentglass@0.8.0`。这只是用户文档与随包 README 变化，不改变
INV-001～020、包运行时代码或 Pi 支持边界。

README 更新后重新生成准确制品并完成隔离安装断言：包名/版本仍为
`@hugo-ddt/agentglass@0.8.0`，入口存在，`tests` 未进入制品，英文和中文 Quick start 均含
Pi 原生安装命令。新制品 hash 与完整命令记录在 `docs/references.md` §39；该复验不等于
npm 已上传。Human Validation 与远端 CI 仍为 `NOT_RUN`。

## 14. 官方 npm 发布与 registry 安装复验（2026-09-14）

用户确认后，使用已审核的准确制品发布到官方 npm registry，命令返回成功：
`+ @hugo-ddt/agentglass@0.8.0`。发布制品 SHA-256 为
`4A1F82A62F4F20236960B41C5CDAF1EB98B240CA9BA35E8780DDB2FD3F017902`；包名、版本和
公开发布属性与审批的候选一致。本次没有修改 INV-001～020，也没有新增运行时网络逻辑。

随后从 `https://registry.npmjs.org` 新建隔离目录安装
`@hugo-ddt/agentglass@0.8.0`，新增 `169 packages`；包名/版本、
`extensions/agentglass.ts`、双语 Pi 原生 Quick start 均存在，`tests` 未进入安装包，断言
退出码 `0`。该证据证明制品已可从官方 registry 安装；Human Validation 与远端 CI 仍为
`NOT_RUN`。

## 15. Pi Web 未来阶段增量约束（当前暂缓，历史证据保留）

本节是未来阶段的安全约束与历史证据。W-001 曾基于锁定 Pi Web 0.9.1 / Pi 0.85.1 的真实源码、宿主测试、确定性回环模型驱动的真实 agent loop 和 loopback 浏览器 E2E 冻结 architecture §12 的能力、连接、请求代次、呈现确认、错误、超时和内存契约。W-002 在同一 detached checkout 实现并验证了该桥接补丁；W-003 曾在 AgentGlass Pi adapter 中接入精确的动态 bridge，并通过本地/确定性自动化门和真实 Edge 7/7 文件闭环，没有把普通 RPC、print/json 或未知客户端变成合格通道。W-004 曾在同一锁定组合完成 Node 22/24 × Edge/Chrome 的真实安全矩阵；当前已发布 `0.8.0` 的公开兼容声明仍不包含 Pi Web。

| 不变量 | W 阶段必需增量证据 | 负责任务 / 当前状态 |
|---|---|---|
| INV-003/007/008/012/019 | 能力版本/会话/连接/请求归属；取消、渲染失败、断线、超时、旧请求、重复及跨标签响应失败关闭；所有异步检查后同步消费，仍复核五项绑定与前像 | W-002/W-003 合约、adapter 故障自动化及 W-004 四组合真实 28/28 矩阵 PASS |
| INV-005/010/016/017 | 卡片/桥接错误仅含安全投影，危险信息在批准时可见；HTML/控制字符不可执行，异常不回退正文；浏览器不接收 raw、秘密、token 或 snapshot 正文 | W-002/W-003 卡片/负例自动化及 W-004 canary/文本边界/脱敏摘要 PASS；宿主 transcript 外部边界保留 |
| INV-004/009/019 | 执行后断线不假称未执行、不自动重试；核验/恢复证据不依赖浏览器成功响应；恢复冲突与单独清理保留，重连不恢复授权 | W-003 确定性与 W-004 真实断线、冲突、restore/cleanup、reload/restart 矩阵 PASS |
| INV-002/013/015/018/020 | 真实 Pi 工具身份/schema/sibling、路径检查及同权限扩展限制不变；Core 无 Pi/Web 类型，无通用多宿主框架 | W-001/W-002 边界、W-003 Core/adapter 检查及 W-004 工具/path/link/sibling/backup/schema/cleanup 矩阵 PASS |
| INV-001/006/011/014 | 无额外 LLM 决策、指纹仍在脱敏前、无 sandbox/全站保护承诺；真实浏览器自动化不冒充真人易用性 | W-003/W-004 工程与文本边界 PASS；W-005 候选工程/文本边界 PASS，公开宿主兼容 FAIL；INV-014 Human Validation **NOT_RUN** |

W-004 前审查增量：`tests/integration/pi-adapter.test.ts` 的 `qualified Pi Web example fails closed when its connection invalidates before consume`、`qualified Pi Web restore fails closed when its connection invalidates before consume` 和 `qualified Pi Web cleanup fails closed when its connection invalidates before consume` 分别覆盖 `example`、`restore`、`cleanup` 的最后异步检查到同步消费窗口。三条路径在 bridge 失效时均使 token 失效且不执行文件/清理动作；`src/adapter/pi/adapter.ts` 同时在帮助面板和命令菜单真正发送 UI 前复核通道。该增量映射 `INV-003/007/008/012/019`，AgentGlass integration 32/32 PASS；W-004 更宽浏览器故障矩阵的最终 112/112 结果见 `docs/references.md` §41.8。

W-001 已确认的 pending replay、无连接归属和 raw custom render 缺口已由 W-002 本地补丁关闭并以合约/真实 loopback 场景验证；W-002 没有声称覆盖 AgentGlass 文件闭环、核验、恢复或真人易用性。W-003 的真实 Edge 证据只覆盖当前锁定 checkout、Windows 本机回环和 7 个指定闭环场景；W-004 现已在同一边界补齐四组合、112 个真实浏览器安全场景。连接标识只是对受信宿主实现的协议约束，不能证明抵抗恶意共存扩展、浏览器恶意脚本或本机同权限攻击。网络断开的检测有时间边界，不宣传瞬时感知。既有 TUI 外部缺陷延期不自动接受 Web 新增安全缺口；未关闭的错误批准、秘密泄露、恢复覆盖或权限缺口均阻止后续适配通过。

W-005 增量：最终 `0.8.1` 实际归档的工程 gate、Pi loader、TUI、R-003 配额/生命周期和锁定 patch 的 Edge/Chrome 真实场景通过；公开 `@agegr/pi-web@0.9.1` 制品实际安装可启动，但不含 W-002 bridge，故 `HOST_ARTIFACT=FAIL`、`WEB_COMPAT_READY=FAIL`。该失败不降低 `INV-003/007/008/012/019` 的 fail-closed 要求，也不把本地 patch 证据写成公开兼容；Pi Web 直接上传/终端/Git/配置/宿主 transcript、恶意共存扩展隔离及 Human Validation 仍在边界外或 `NOT_RUN`。

## 16. 新手任务引导增量约束（N 阶段；N-001/N-002 已完成，N-003～N-004 待分配）

N-001～N-004 以 development-plan §9 为任务源，不改变 INV-001～020。新增入口是请求草稿辅助，不是第二批准通道，不扩大 read/write/edit、恢复或清理范围。当前公开 0.8.0 不因此获得新能力；N-001/N-002 的实际验收记录见 references §45、§48、§49，N-003～N-004 仍待执行。

| 任务 | 必需增量断言 | 当前证据 |
|---|---|---|
| N-001 | INV-003/005/008/012/015/016/019/020：输入与投影限额、无原始/秘密输出、非空编辑器保留、异步后同步检查填入、会话失效、无自动发送/批准、真实 Pi InteractiveMode 合约 | PASS（references §45/§47；锁定包本地实现与测试，用户评审完成；真实人工 TUI/Human Validation 仍 NOT_RUN） |
| N-002 | INV-002/003/005/007～010/012/013/016/019/020：结构事实生成建议、未知/多原因不降级、不重放原批次、可能已执行不重试、目标身份与生命周期、无旧结果覆盖 | PASS（references §48～§50；本地工程/受控锁定 Pi 自动化及迟到内部结果复测通过，用户评审完成；真实人工 TUI/Human Validation 仍 NOT_RUN） |
| N-003 | INV-004/007～010/012/019/020：结果与恢复独立关联、同名/旧目标不混淆、恢复证据重验、独立单次批准、拒绝与冲突保护、删除后入口更新 | NOT_RUN |
| N-004 | 全部适用 INV 与非真人代理矩阵；真实 Pi/TUI、制品、兼容与预算；INV-014 的真人证据独立记录 | NOT_RUN |

- 展示或填入草稿前，外来文字须投影脱敏、过滤终端控制、再脱敏并有界。不得复制原始工具参数、原批次、结果正文、快照正文、秘密或编辑器已有正文进入新增上下文、UI、日志或模型输入。用户当前自由文本仅在本次引导短暂处理，其安全投影可供本人审阅后自行发送。
- 自动携带的文件引用只能来自经过审查的精确、安全相对目标；标签不是身份。路径脱敏或截断导致身份变化时不给定向草稿，不输出敏感域路径补齐。此检查不取代实际工具路径与身份检查。
- 非空编辑器一律保留；无法读取视为不可写。菜单期间状态变化使旧引导失效；写入失败或状态不明不得自动重试、清空、回填旧草稿或声称已发送。同步填入不是 OS 原子性或对恶意扩展的隔离承诺。
- 用户主动选择顺序请求只产生新提案草稿；不自动排队/重排/消费批准。任何额外敏感、越界、未知或完整性阻止原因仍优先，不能被“每次一个”掩盖。可能已执行的工具失败只提供检查现状，不自动重做。
- 最近上下文没有授权能力；清理/恢复继续沿用原敏感证据与新批准。普通 read 不跳过检查；草稿内容和固定边界不能让模型决定风险，也不能证明模型必然遵从。

具体接口与状态生命周期唯一来源为 architecture §13。本节只追加要求；N-001 的实际 PASS 记录见 references §45，不更改已发布能力、Pi Web 暂缓或既有威胁模型限制。
