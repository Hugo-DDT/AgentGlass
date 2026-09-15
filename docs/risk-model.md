# AgentGlass 风险模型

> 状态：确定性规则规范 · 目标：少支持、可证明、默认阻止

## 1. 输入与决策

风险引擎只接收经过边界校验的结构化事实，不读取 UI 文案、用户熟悉度、历史批准或 LLM 判断。

```text
hard_block > ask > auto_allow
```

| 决策 | 当前普通文件路径含义 |
|---|---|
| `auto_allow` | 仅限已验证内置 read，目标是普通、项目内、非敏感文件，全部必要事实确定 |
| `ask` | 仅限已验证内置 write/edit，目标是普通、项目内、非敏感文件，且只有一个变更动作；Beta 起还须有效前像与已有父目录，备份失败/超限阻止 |
| `hard_block` | 输入无效、检查失败、未知/不支持工具、敏感/越界/不确定目标、多变更、无 UI 或批准失效 |

`unknown` 是事实值，不是风险等级。当前版本不要求零基础用户批准产品自己无法解释的动作。Alpha 的 snapshot unavailable 行为仅是历史基线；Beta/Release 的必需备份门槛见第 6 节。Release 不开放 shell 或多变更 sibling。

## 2. 最小规则集

按表中顺序取最严格决策和最高风险级别；原因去重并稳定排序。

| reasonCode | 条件 | 结果 |
|---|---|---|
| `INPUT_INVALID` | 工具字段类型错误、缺少必要参数或 canonical input 非法 | critical / hard_block |
| `INTEGRITY_FAILURE` | 五项绑定变化、指纹不一致、重复消费或重放 | critical / hard_block |
| `PREFLIGHT_FAILED` | 必需路径、批次、脱敏或规则检查异常/超限 | critical / hard_block |
| `SAFETY_CONTROL_MUTATION` | 明确修改 AgentGlass 当前安全控制或宿主认证数据 | critical / hard_block |
| `BATCH_MUTATION_BLOCKED` | 当前 sibling 中至少两个 yes/unknown 变更成员 | high / hard_block |
| `BATCH_CONTEXT_UNKNOWN` | 当前变更缺少完整 sibling 信息 | high / hard_block |
| `UNSUPPORTED_TOOL` | shell、Git、网络、进程、自定义、同名覆盖或其他未验证工具 | high / hard_block |
| `SENSITIVE_TARGET` | 凭据、秘密候选、AgentGlass 私有数据或敏感目标 | high / hard_block |
| `OUTSIDE_WORKSPACE` | 目标在项目外或无法证明在项目内 | high / hard_block |
| `PATH_UNCERTAIN` | 链接、特殊文件、父目录或解析结果不确定 | high / hard_block |
| `FILE_MODIFY` | 已验证 edit 或覆盖已有普通项目文件 | high / ask |
| `FILE_CREATE` | 已验证 write 创建普通项目文件 | info / ask |
| `KNOWN_READ_ONLY` | 满足全部只读快路径条件 | info / auto_allow |
| `APPROVAL_UNAVAILABLE` | ask 但经过验证的审批通道不可用或交互失败；已发布 0.8.0 仅 TUI，W 阶段资格见 architecture §12 | 保留 level / hard_block |

已知 Critical 证据不能被其他规则降级。风险级别只用于确定危险说明是否始终显示，不作为新手主界面的分数或颜色。

## 3. 文件和路径

内置工具身份与输入结构以锁定 Pi 版本的真实集成测试为准；仅凭工具名称不得判定为受支持实现。

路径检查：

- 从真实 cwd 解析绝对路径；
- 已存在目标使用 `realpath`；不存在目标检查最近存在父目录；
- 使用路径分段/relative 关系判断是否位于工作区，禁止字符串前缀判断；
- 符号链接、硬链接歧义、目录、设备、特殊文件、Windows 驱动器/UNC 异常或检查竞态统一阻止；
- 路径分析使用 raw 值，展示使用脱敏标签。

敏感候选至少包括 `.env` 变体、私钥/证书、SSH/云凭据、认证文件，以及 password、token、Authorization、连接串等结构化字段。`.env.example` 不能只凭文件名自动认定安全。

## 4. Shell 分类边界

A-006 提供纯函数、非执行的保守 Bash classifier，不是通用 shell interpreter，也不直接产生 A-007 的最终 `RiskAssessment`。下列 `candidate_fast_path` / `ask` / `block` 是分类处置，不是本规范第 1 节的 `RiskDecision`：

- 只有已证明为非交互 Bash、环境与 PATH 查找已验证、命令解析及受支持实现语义已验证，且没有 alias/function 遮蔽的静态简单命令，才可能成为 `candidate_fast_path`；Git 证据还须排除 optional lock、pager、external diff 等环境副作用；
- fast-path 候选只限受支持命令及选项：`pwd`、`ls`、`cat`、`head`、`tail`、`wc`、`grep`，以及窄范围只读 Git 子命令；候选不等于 `auto_allow`，仍需后续路径、敏感性和风险决策；
- 合法但不支持的 option、pipeline、redirect、compound、动态构造、替换、eval-like、安装、网络、进程和其他命令返回 `ask` 事实；
- 缺少必需 shell/环境/PATH/解析/alias/function 证据或输入无法可靠分词时返回 `block` + `PREFLIGHT_FAILED`；
- `rm` 等明确破坏性命令以及 `find -delete`、`dd of=...`、原地改写参数和破坏性 Git 参数按真实命令/参数位置返回稳定危险证据，不使用字符串包含判断；
- PowerShell 和其他 shell 不进入 Alpha fast-path，A-006 不尝试解释其语法。

本阶段 classifier 不接入 Pi 执行，也不提供批准或放行；A-007 的最终风险决策仍只支持已验证内置 `read/write/edit`。自定义与覆盖工具继续使用 `UNSUPPORTED_TOOL` 阻止。

## 5. 测试要求

每条规则至少包含：

1. 一个命中用例；
2. 一个容易混淆但不应命中的相邻反例；
3. 适用时一个异常或资源失败用例。

Corpus 覆盖普通读/新建/覆盖/编辑、敏感、项目外、路径穿越、链接、malformed、同名覆盖、自定义工具、批次、无 UI、绑定变化和资源上限。

报告按规则与决策分布说明覆盖，不把历史 80/150/250 数量目标当作跨任务通用门槛。当前 A-006 明确要求的至少 80 个 shell fixtures 仍必须满足，但数量本身不替代正例、相邻反例、故障和安全语义覆盖。任何新增 auto-allow 都必须提供新的确定性只读证明和安全审查。

### A-013 覆盖报告

以当前 classifier、11 条风险规则与 sibling 策略为基线，在本节维护最小证据索引。每行列规则/关键条件、命中测试文件与名称、相邻反例、适用故障、断言含义及未覆盖部分；故障不适用必须说明原因。复用 tests/corpus、tests/security 及既有 fixtures，不为映射公开内部运行时规则或增加新 registry。

报告必须区分三个口径：Vitest 测试文件/测试数、实际 fixture 数、规则覆盖。一个 test 中循环多个 fixtures 不能只用 test 数描述样本；同一输入搭配不同环境证据是不同场景，改名复制相同输入和条件不能算新增覆盖。

shell 的 `candidate_fast_path / ask / block` 单独统计，不能并入产品 `auto_allow / ask / hard_block`。产品风险统计列出 unknown 自动放行数（必须 0）、Critical hard-block 的分子和分母、明确变更自动放行数（必须 0）；分母为 0 不能宣称 100% 覆盖。与任务开始前基线比较时使用同一口径，只输出必要的脱敏统计。

故障覆盖包括输入/身份/schema 不完整、路径/资源检查失败、规则求值异常、矛盾事实和 sibling 信息缺失。组合命中验证 `hard_block > ask > auto_allow`，不能只检查某个 reasonCode 出现。snapshot unavailable 不改变风险决定，其不可恢复文案与审批边界由现有 security/integration 测试及 A-014 映射共同证明。

A-013 不改变产品支持范围，不连接 shell 执行，不新增总量门槛。本节索引与结果需在任务实际执行后填入，不因本次设计更新预先标记 PASS。

#### 分类与边界证据

| 范围 | 命中与相邻反例 | 适用故障 | 断言含义 / 未覆盖部分 |
|---|---|---|---|
| 文件工具身份 | `tests/corpus/file-classification.test.ts` — `A-005 file corpus covers supported classifications and neighboring blocks`：verified builtin 为已知文件动作；overridden、external、unknown 为 `unknown`。`tests/corpus/risk-engine.test.ts` — `A-007 consumes real file-classifier facts without widening support`：external/unknown 最终均为 `hard_block` | `tests/security/risk-engine.test.ts` — `INV-003/020: missing verified identity or schema evidence cannot ask or auto-allow` | 同名或自称工具不能替代来源证据；A-015 才扩展真实 Pi 合约矩阵，本任务不预做该任务 |
| 文件 schema | `tests/corpus/file-classification.test.ts` — `A-005 validates the locked Pi read/write/edit schemas`：合法 read/write/edit 与缺字段、错类型、空 edits 相邻比较 | 同一测试的 4 个 malformed fixture；`tests/security/secret-boundary.test.ts` — `INV-005: validation errors discard hostile raw exception messages` | 非法 schema 保持 `unknown` 且带 `INPUT_INVALID`，错误不回显 raw 异常 |
| 路径与范围 | `tests/corpus/file-classification.test.ts` — `A-005 file corpus covers supported classifications and neighboring blocks`、`A-005 handles drive and UNC syntax deterministically`：项目内、前缀邻居、`..`、链接、目录、drive/UNC | `tests/security/file-preflight.test.ts` — `INV-003/020: missing workspace and malformed target remain unknown`、`INV-020: prefix neighbors, symlinks, hard links, and non-files cannot enter the ordinary path` | 只使用路径分段和真实路径证据；缺失、链接、特殊、越界或不确定均不能进入普通路径 |
| 敏感性 | `tests/corpus/file-classification.test.ts` — `A-005 file corpus covers supported classifications and neighboring blocks`：普通文件、`.env.example`、合成 secret content | `tests/security/secret-boundary.test.ts` — `INV-005: secret candidates only cross the boundary as redacted values`；`INV-005: validation errors discard hostile raw exception messages` | 路径和内容任一命中都不能成为普通放行；只保存脱敏断言，不记录秘密值 |
| shell 分析 | `tests/corpus/shell-classification.test.ts` — `A-006 conservative shell corpus`：静态只读候选、不支持语法/命令、破坏性证据与相邻参数位置 | `tests/security/shell-classification.test.ts` — `INV-003/020: every missing fast-path runtime fact fails closed`、`INV-001/003: dangerous fixtures are pure analysis and never execute` | classifier 仅分析，不接 Pi 执行；其 `ask` 不是产品 `ask`，PowerShell 不进 fast path |

#### 11 条风险规则证据索引

以下每个参数化生成的 `A-013 '<reasonCode>' has a hit and neighboring non-hit` 都直接断言命中样本包含该 reason、只改变关键条件的 neighbor 不包含该 reason，并断言命中样本的最终产品决策；单引号来自 Vitest 对字符串参数的实际名称格式。

| 规则 | 命中 / 相邻反例的具体测试名 | 适用故障测试或不适用原因 | 断言含义 / 未覆盖部分 |
|---|---|---|---|
| `INPUT_INVALID` | `tests/corpus/risk-engine.test.ts` — `A-013 'INPUT_INVALID' has a hit and neighboring non-hit` | `tests/corpus/file-classification.test.ts` — `A-005 validates the locked Pi read/write/edit schemas`；`tests/security/secret-boundary.test.ts` — `INV-005: validation errors discard hostile raw exception messages` | malformed 结构为 critical / `hard_block`；普通 read 不误命中 |
| `INTEGRITY_FAILURE` | 同文件 — `A-013 'INTEGRITY_FAILURE' has a hit and neighboring non-hit` | `tests/security/approval.test.ts` — `INV-007/008: changed fingerprint invalidates the exact approval`、其余 binding 参数化用例及 `INV-007/008: exact current action consumes once and cannot replay` | 完整性 evidence 为 critical / `hard_block`；绑定故障与重放不能恢复授权 |
| `PREFLIGHT_FAILED` | 同文件 — `A-013 'PREFLIGHT_FAILED' has a hit and neighboring non-hit` | `tests/security/risk-engine.test.ts` — `INV-003: an internal property failure fails closed without exposing the exception`；shell 缺失运行证据测试 | 必需检查或规则求值异常为 critical / `hard_block`；不泄漏异常文本 |
| `SAFETY_CONTROL_MUTATION` | 同文件 — `A-013 'SAFETY_CONTROL_MUTATION' has a hit and neighboring non-hit` | 不适用独立 I/O 故障：本规则只消费确定性 evidence；通用规则异常由 `INV-003: an internal property failure fails closed without exposing the exception` 覆盖 | 明确安全控制变更为 critical / `hard_block`；A-013 不新增上游分类器或扩大工具面 |
| `UNSUPPORTED_TOOL` | 同文件 — `A-013 'UNSUPPORTED_TOOL' has a hit and neighboring non-hit` | `tests/security/risk-engine.test.ts` — `INV-003/020: missing verified identity or schema evidence cannot ask or auto-allow` | unsupported/unknown/身份缺失为 high / `hard_block`；verified 普通 read 不误命中 |
| `SENSITIVE_TARGET` | 同文件 — `A-013 'SENSITIVE_TARGET' has a hit and neighboring non-hit` | 不适用独立规则 I/O 故障；敏感检测由 `A-005 file corpus covers supported classifications and neighboring blocks` 覆盖，脱敏失败由 `INV-005: validation errors discard hostile raw exception messages` 覆盖 | 敏感 read 也为 high / `hard_block`；普通非敏感 read 不误命中 |
| `OUTSIDE_WORKSPACE` | 同文件 — `A-013 'OUTSIDE_WORKSPACE' has a hit and neighboring non-hit` | `tests/security/file-preflight.test.ts` — `INV-020: prefix neighbors, symlinks, hard links, and non-files cannot enter the ordinary path` | 明确越界为 high / `hard_block`；前缀相似路径不冒充项目内 |
| `PATH_UNCERTAIN` | 同文件 — `A-013 'PATH_UNCERTAIN' has a hit and neighboring non-hit` | `tests/security/file-preflight.test.ts` — `INV-003/020: missing workspace and malformed target remain unknown` | linked/unknown/特殊或缺失事实为 high / `hard_block`；完整普通路径不误命中 |
| `FILE_MODIFY` | 同文件 — `A-013 'FILE_MODIFY' has a hit and neighboring non-hit` | 无独立规则故障分支；上游故障由 `A-005 validates the locked Pi read/write/edit schemas`、`INV-020: prefix neighbors, symlinks, hard links, and non-files cannot enter the ordinary path`、`INV-003/020: missing verified identity or schema evidence cannot ask or auto-allow` 证明不会落入普通 `ask` | edit/overwrite 为 high / `ask`；create 不误命中；明确变更不 auto-allow |
| `FILE_CREATE` | 同文件 — `A-013 'FILE_CREATE' has a hit and neighboring non-hit` | 无独立规则故障分支；最近存在父目录无法证明时由 `INV-003/020: missing workspace and malformed target remain unknown` 阻止，非法 schema 由 `A-005 validates the locked Pi read/write/edit schemas` 阻止 | 普通 create 为 info / `ask`；modify 不误命中；明确变更不 auto-allow |
| `KNOWN_READ_ONLY` | 同文件 — `A-013 'KNOWN_READ_ONLY' has a hit and neighboring non-hit` | `tests/security/risk-engine.test.ts` — `INV-003/020: missing verified identity or schema evidence cannot ask or auto-allow`；`tests/security/file-preflight.test.ts` — `INV-003/020: missing workspace and malformed target remain unknown` | 只有证据完整的普通 read 为 info / `auto_allow`；敏感、未知、越界、链接或身份不确定均不能命中 |

#### 聚合与 sibling 证据

| 策略 | 命中 / 相邻反例 | 故障 | 关键断言 |
|---|---|---|---|
| `hard_block > ask > auto_allow`、`critical > high > info` | `tests/security/risk-engine.test.ts` — `INV-003: critical evidence is hard-blocked in every conflict`、`INV-002/020: known danger plus unknown, and read-only secret choose the stricter result` | `INV-003: an internal property failure fails closed without exposing the exception` | 组合命中最终取最严格决策和最高级别，而非只检查 reason 出现 |
| `BATCH_MUTATION_BLOCKED` | `tests/corpus/risk-engine.test.ts` — `A-008 batch rules each have a hit and neighboring non-hit`；`tests/security/risk-engine.test.ts` — `INV-013/020: sibling mutation guard treats yes and unknown as changes without attribution exceptions` | 不适用资源故障；未知成员本身就是保守计数输入 | read+write 保留单变更策略；write+write、write+unknown 和两个 unknown 阻止变更成员，不按目标归因 |
| `BATCH_CONTEXT_UNKNOWN` | `tests/corpus/risk-engine.test.ts` — `A-008 batch rules each have a hit and neighboring non-hit` | `tests/security/risk-engine.test.ts` — `INV-003/013/020: incomplete, duplicate, stale, and invalid sibling facts fail closed for a mutation` | undefined、空、重复、旧/current 不匹配、无效 facts 均按 critical / `hard_block`，不猜成单动作 |

#### 本轮统计与结果

本表只在本轮命令实际完成后填写；`test` 数是 Vitest case 数，fixture 是循环中实际分类样本，两者不互换。最终 gate 结果见下表；A-014 后续完成的 INV-001～020 映射见 `security-invariants.md` 第 5 节。

| 口径 | A-013 开始前基线 | A-013 本轮结果 | 变化 |
|---|---|---|---|
| corpus | 4 files / 11 tests | 4 files / 22 tests PASS | +11 tests；原单一循环拆成 11 个可追溯规则 case，并保留 1 个分布 case，规则 hit/neighbor fixture 仍为 22，未复制样本 |
| security | 9 files / 57 tests | 9 files / 57 tests PASS | 0 |
| 文件 classifier 主 corpus fixture | Windows 22（14 分类 + 4 schema + 4 drive/UNC） | Windows 24（16 分类 + 4 schema + 4 drive/UNC） | +2：external 同名工具、unknown 自定义工具；另有 8 个 classifier→risk 链路场景，不重复计入主 corpus |
| shell fixture | 127；`candidate_fast_path=40`、`ask=50`、`block=37` | 127；`candidate_fast_path=40`、`ask=50`、`block=37` | 0；继续满足 A-006 至少 80 个 fixture |
| 11 条规则的 hit fixture 产品决策 | `auto_allow=1`、`ask=2`、`hard_block=8` | `auto_allow=1`、`ask=2`、`hard_block=8` | 0；shell disposition 未混入产品决策 |

2026-09-10 本轮实际断言：4 个 unknown 场景中 `auto_allow=0` 且 4 个均 `hard_block`；4 个 Critical 场景全部 `hard_block`；3 个明确变更场景中 `auto_allow=0` 且 3 个均为 `ask`。上述分母均非零。`npm run typecheck`、`npm run lint`、`npm run build`、`npm run test:corpus`、`npm run test:security` 均退出码 0；unit/integration 未受本轮测试与文档修改影响，未追加运行；e2e 尚未建立，`NOT_RUN`。

## 6. Beta/v1 的有限增加

A-010 的 Alpha snapshot failure 不是新的动作风险放行理由：它只把 snapshot evidence 降级为 unavailable，并固定 `canRestoreNow=false`、恢复等级 `unknown`；原动作仍按本风险模型的既有决定处理。它不能把 hard-block 降成 ask，也不能把 ask 升成 auto-allow。

普通工具仍沿用上述规则，unknown、shell、敏感和越界继续 hard-block。新增 `BACKUP_UNAVAILABLE`（必需备份失败/超限）和 `RESTORE_CONFLICT`（恢复依据或当前状态不符）均为 high / hard_block；输入/完整性失败仍优先 critical。内部恢复/数据清理在无其他阻止条件、目标与必要证据明确时 high / ask；从不 auto_allow。

`BACKUP_UNAVAILABLE` 已在 B-001 通过 `requireMutationBackup` 落地：变更缺少 saved 前像/不存在证据、配额/权限/发布失败，或会隐式创建父目录时均为 high / hard_block；普通 read 与已有父目录且证据有效的单文件变更是相邻反例。命中、相邻反例和配额故障见 `tests/corpus/risk-engine.test.ts` 的 B-001 backup gate。`RESTORE_CONFLICT` 已由 B-002 以内部恢复动作的确定性 hard-block 路径落地：当前存在状态、路径摘要、文件身份、后置字节或权限任一不匹配都不打开恢复执行，保留当前文件。该内部动作不进入普通工具 `ActionFacts` 或自动放行面。

内部恢复只允许架构规定的前像写回或有证据的新建文件逆操作；清理只允许 AgentGlass 私有恢复数据，经路径验证与独立批准，不能泛化为普通 rm/delete 工具许可。

测试必须覆盖备份失败/正常备份、恢复冲突/未变化基线、拒绝恢复/明确批准、清理越界/合法私有目标，以及普通工具请求相同删除仍被阻止。少一次弹窗不能以少一次安全检查或一揽子批准实现。

B-003 未改变普通工具的 `RiskAssessment` 或 `hard_block > ask > auto_allow` 规则；固定示例是独立的内部目录准备动作，仍需自己的路径/身份预检、明确批准和同步单次绑定消费。其失败不会降低普通工具风险，也不会把示例准备或目录创建泛化为普通 write/delete 权限。

## 7. Pi Web 未来交互资格（当前暂缓，历史规则保留）

本节是未来阶段的规则草案与历史证据。W-001 曾根据真实 Pi Web 0.9.1 / Pi 0.85.1 证据冻结 architecture §12 的 `agentglass.pi-web.approval` v1 能力、SSE connection lease、request/render generation 和固定错误边界；没有改变文件分类、`hard_block > ask > auto_allow`、未知值、sibling、备份及精确批准规则。恢复阶段时，adapter 只能根据宿主提供的精确版本化动态生命周期事实提供资格，Core 不识别 Pi Web 品牌、RPC 文案或浏览器字段。缺失、矛盾、未来版本、断线或失效请求不得变成 `canPromptForApproval=yes`；普通 `rpc+hasUI`、print/json、环境变量和方法存在仍不构成资格。当前已发布 `0.8.0` 只支持合格 TUI 交互，历史浏览器证据不改变这一点。
