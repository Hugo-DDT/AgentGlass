# AgentGlass 技术架构

> 状态：Alpha 与 B-001～B-004 已验收（2026-09-12）；完整 Beta 代理验收通过，R-001 的 Windows/POSIX 工程、权限/恢复及真实 TUI 子项已实测；R-002 Windows-only 候选已通过；R-003 当前候选按用户确认的加载增量预算复测通过；R-004 最终候选工程验收通过，Pi 外部预览缺陷记录为后续版本目标且不阻断当前候选；用户确认 Edge、Node 22、远端 CI、公开上游补丁/发布及 Human Validation 为 `USER_CONFIRMED_COMPLETE`，未回填附件/参与者记录时不写工程 PASS 或真人指标 · 安全要求以[安全不变量](security-invariants.md)为准

当前实现定位：下图保留 Alpha 执行前链路；Beta 已实现第 8～9 节的独立文件观察、schema v3 恢复及清理。Release 按 development-plan §6 验证这些现有能力，不新建核验/恢复架构。

## 1. Alpha 数据流（历史基线）

```text
Pi tool_call
→ 临时 raw input
   ├→ canonicalize → fingerprint
   ├→ validate / classify
   └→ redact → 可展示事实
→ RiskAssessment
→ 受支持普通 write/edit 的敏感 pre-image evidence
→ PredictedEffect
→ 简明 OutcomeCard
→ 明确批准
→ 再次核对完整绑定并单次消费
→ Pi 执行
```

raw input 只在本次预检的内存中存在。指纹必须在脱敏前计算；脱敏结果不能代替真实路径和输入参与安全判断。

Alpha 不保存事件、不观察执行结果。A-010 只为通过完整分类、sibling 与风险检查的普通 `write/edit` 建立敏感 pre-image evidence；成功保存也固定 `canRestoreNow=false`、恢复等级 `unknown`，不构成 restore 或独立核验。

## 2. 最小模块边界

| 位置 | 职责 |
|---|---|
| `extensions/` | 装配 Pi 扩展 |
| `src/adapter/pi/` | Pi 事件、TUI、cwd/session/toolCallId 映射与阻止结果 |
| `src/core/` | 类型、指纹、脱敏、分类、风险、预测、卡片、审批、独立文件核验与敏感恢复存储 |
| `tests/` | 单元、安全、Pi 集成和端到端检查 |

只有 `extensions/` 和 `src/adapter/pi/` 可以 import Pi API 或 Pi 类型。其余代码保持宿主无关，但不建立 Adapter registry、IoC、事件总线、Plugin SDK 或第二宿主空壳。

按任务需要创建文件。一个普通函数足够时不增加类、接口层或目录。

## 3. Alpha 与 B-001 领域契约

以下是语义要求，不强制每个类型单独占一个文件：

```ts
export type TriState = "yes" | "no" | "unknown";
export type RiskLevel = "info" | "high" | "critical";
export type RiskDecision = "auto_allow" | "ask" | "hard_block";
export type RiskReasonCode =
  | "INPUT_INVALID"
  | "INTEGRITY_FAILURE"
  | "PREFLIGHT_FAILED"
  | "SAFETY_CONTROL_MUTATION"
  | "BATCH_MUTATION_BLOCKED"
  | "BATCH_CONTEXT_UNKNOWN"
  | "BACKUP_UNAVAILABLE"
  | "UNSUPPORTED_TOOL"
  | "SENSITIVE_TARGET"
  | "OUTSIDE_WORKSPACE"
  | "PATH_UNCERTAIN"
  | "FILE_MODIFY"
  | "FILE_CREATE"
  | "KNOWN_READ_ONLY";

export interface ActionFingerprint {
  algorithm: "sha256";
  canonicalizationVersion: 1;
  value: string;
}

// 只在当前执行周期内存中使用。
export interface ExecutionBinding {
  fingerprint: ActionFingerprint;
  toolName: string;
  cwd: string;
  sessionId: string;
  hostExecutionId: string;
  toolCallId: string;
}

export interface HostCapabilities {
  interaction:
    | "local_interactive"
    | "remote_interactive"
    | "event_stream"
    | "one_shot"
    | "unknown";
  canPromptForApproval: TriState;
}

export interface HostToolIdentity {
  name: string;
  status: "verified_builtin" | "external" | "overridden" | "unknown";
}

export interface SiblingExecutionReference {
  hostExecutionId: string;
  toolCallId: string;
  tool: HostToolIdentity;
}

// 仅在一次 preflight 调用栈中存在，不得进入 pending、日志或持久化。
export interface TransientHostExecutionInput {
  hostExecutionId: string;
  toolCallId: string;
  sessionId: string;
  cwd: string;
  tool: HostToolIdentity;
  capabilities: HostCapabilities;
  siblings: readonly SiblingExecutionReference[];
  userGoal:
    | { status: "observed"; redactedText: RedactedPersistableInput }
    | { status: "unknown" };
  rawInput: unknown;
}

// Adapter 交给后续阶段的可观察事实已经完成 fingerprint-first 投影与脱敏。
export interface HostExecutionFacts {
  hostExecutionId: string;
  toolCallId: string;
  sessionId: string;
  cwd: string;
  tool: HostToolIdentity;
  capabilities: HostCapabilities;
  siblings: readonly SiblingExecutionReference[];
  userGoal:
    | { status: "observed"; redactedText: RedactedPersistableInput }
    | { status: "unknown" };
  input: ProjectedActionInput;
  action: ActionFacts;
  preImage: PreImageSnapshotEvidence;
  evidenceCodes: readonly string[];
}

export type WorkspaceScope = "inside" | "outside" | "unknown";
export type FileTargetState =
  | "existing_file"
  | "new_file"
  | "missing"
  | "directory"
  | "special"
  | "unknown";

export interface FileTargetFacts {
  targetId: string;
  label: string;
  workspaceScope: WorkspaceScope;
  state: FileTargetState;
  linked: TriState;
  supportedPath: TriState;
  evidenceCodes: readonly string[];
}

export interface FileImpactFacts {
  effect: "read" | "create" | "overwrite" | "edit" | "unknown";
  createsParentDirectories: TriState;
}

export interface ActionFacts {
  actionId: string;
  kind: "read" | "write" | "edit" | "unsupported" | "unknown";
  targetLabel: string;
  mutatesState: TriState;
  outsideWorkspace: TriState;
  sensitive: TriState;
  targets: readonly FileTargetFacts[];
  impactFacts: FileImpactFacts;
  evidenceCodes: readonly string[];
  fingerprint: ActionFingerprint;
}

export interface RiskAssessment {
  level: RiskLevel;
  decision: RiskDecision;
  reasonCodes: readonly RiskReasonCode[];
}

export interface PredictedEffect {
  effectId: string;
  targetId: string;
  kind:
    | "read"
    | "create"
    | "modify"
    | "overwrite"
    | "install"
    | "network"
    | "process"
    | "unsupported_shell"
    | "unknown_command"
    | "unknown";
  targetLabel: string;
  certainty: "known" | "unknown";
  scope: "bounded" | "limited" | "unknown";
  purpose: "unknown";
  applicationOutcome: "unverifiable";
  evidenceCodes: readonly string[];
  descriptionKey: string;
}

export interface OutcomeCard {
  actionId: string;
  title: string;
  expectedOutcome: string;
  attention: string;
  recovery: string;
  details: string[];
}

export interface ApprovalToken {
  actionId: string;
  binding: ExecutionBinding;
  state: "issued" | "consumed" | "invalidated";
}

export type SnapshotFailureCode =
  | "SNAPSHOT_STORAGE_UNAVAILABLE"
  | "SNAPSHOT_STORAGE_UNSAFE"
  | "SNAPSHOT_STORAGE_BUSY"
  | "SNAPSHOT_TARGET_UNSUPPORTED"
  | "SNAPSHOT_TARGET_CHANGED"
  | "SNAPSHOT_FILE_TOO_LARGE"
  | "SNAPSHOT_RESOURCE_LIMIT"
  | "SNAPSHOT_PERMISSION_DENIED"
  | "SNAPSHOT_PUBLISH_FAILED";

export interface PreImageSnapshotEvidence {
  status: "not_applicable" | "saved" | "unavailable";
  snapshotId: string | null;
  targetExisted: TriState;
  permissionMetadata: "captured" | "not_applicable" | "unknown";
  failureCode: SnapshotFailureCode | null;
  canRestoreNow: false;
  recoveryGrade: "unknown";
}

export interface ExpectedFilePostcondition {
  actionId: string;
  effectId: string;
  targetId: string;
  kind: "exact_bytes" | "content_changed";
  expectedSha256: string | null;
  expectedByteLength: number | null;
  beforeSha256: string | null;
  beforeIdentity: { device: string; inode: string } | null;
  targetExisted: boolean;
}

export type VerificationReasonCode =
  | "POSTCONDITION_MATCHED"
  | "POSTCONDITION_MISMATCH"
  | "POSTCONDITION_INSUFFICIENT"
  | "RESULT_MISSING"
  | "RESULT_IDENTITY_MISMATCH"
  | "TARGET_IDENTITY_CHANGED"
  | "TARGET_MISSING"
  | "TARGET_UNSUPPORTED"
  | "TARGET_TOO_LARGE"
  | "TARGET_GREW_OVER_LIMIT"
  | "TARGET_CHANGED_DURING_READ"
  | "TARGET_READ_FAILED";

export interface VerificationReport {
  actionId: string;
  effectId: string;
  targetId: string;
  status: "matched" | "mismatch" | "unknown";
  toolOutcome: "succeeded" | "failed" | "unknown";
  reasonCodes: readonly VerificationReasonCode[];
  checkScope: "single_file";
  applicationOutcome: "unverifiable";
}

export interface OutcomeCardUpdate {
  actionId: string;
  state: "executing" | "matched" | "mismatch" | "unknown";
  lines: readonly string[];
}
```

B-001 已实现以上最小执行后契约。`ExpectedFilePostcondition` 只保存 hash、长度、执行前
身份和 action/effect/target 关联；明确路径只留在当前 Adapter 的临时核验状态，正文、
raw input、完整 Pi 事件和完整 tool result 不进入这些领域对象。`exact_bytes` 用于 write
及能由锁定 Pi edit 语义可靠推导的结果；`content_changed` 只在 edit 语义无法可靠推导
时用于证明“未发生列明变化”或保留 unknown，不能据任意不同字节判 matched。

A-006 的 shell 类型是分类处置，不进入上述 `RiskAssessment`：

```ts
export interface ShellRuntimeEvidence {
  shell: "bash" | "powershell" | "other" | "unknown";
  nonInteractive: TriState;
  environment: "verified" | "unknown";
  pathLookup: "verified" | "unknown";
  alias: "absent" | "present" | "unknown";
  function: "absent" | "present" | "unknown";
  commandResolution:
    | {
        status: "verified";
        name: string;
        kind: "builtin" | "executable";
        resolvedPath: string | null;
        supportedSemantics: "verified" | "unknown";
      }
    | { status: "unknown" };
}

export interface ShellClassification {
  decision: "candidate_fast_path" | "ask" | "block";
  family: ShellCommandFamily;
  mutatesState: TriState;
  reasonCodes: readonly string[];
  evidenceCodes: readonly string[];
  shellAssumption:
    | "bash_non_interactive_simple_command_v1"
    | "bash_syntax_only_v1"
    | "none";
}

export type ShellCommandFamily =
  | "shell_builtin"
  | "filesystem_read"
  | "text_search"
  | "git_read"
  | "git_state_change"
  | "install"
  | "network"
  | "process"
  | "destructive"
  | "unsupported"
  | "unknown";
```

这里的 `decision` 是 classifier-local disposition：`candidate_fast_path` 不等于
`auto_allow`，`ask` 不等于产品批准。`supportedSemantics=verified` 必须代表
“已解析的具体实现 + 当前环境”具有受支持的只读语义，不能只凭同名文件或 PATH 命中生成。对 Git，这份证据还必须排除 optional lock、pager、external diff 等环境副作用；无法排除时保持 `unknown` 并失败关闭。

`supportedPath=yes` 只表示该动作的目标已证明是普通、非敏感且形态受支持的文件路径：`read/edit` 还要求目标是现有普通文件，`write` 可指向现有普通文件或经最近存在父目录证明的新文件。内容中的秘密候选单独由动作级 `sensitive` 表达，不能因为路径本身普通而进入快速路径。

`targetLabel` 是通过投影与脱敏审查的用户可读标签，不是审批所用的真实路径。真实路径只在瞬时预检中使用。

actionId、effectId、targetId 与精确执行绑定在当前动作内关联；不能用可能重名的展示标签作核验或审批键。Alpha 保留这些关联元数据，但不预建 Beta 存储或观察模块。Core 中的 toolCallId 是普通调用标识，由 Adapter 映射，不要求 Core 理解 Pi event 结构。

`reasonCodes` 和 `evidenceCodes` 是确定性标识，不是自由文本推理。UI 文案只能翻译事实，不能降低决策。

`PredictedEffect` 只表达工具在执行前准备产生的效果。普通单文件操作在目标与路径证据完整时可为 `known/bounded`；安装、网络和进程分类最多为 `known/limited`；不支持 shell、未知命令、未知或越界目标保持 `unknown`。Alpha 没有结果观察或功能验证，因此 `applicationOutcome` 固定为 `unverifiable`，`purpose` 固定为 `unknown`；文件名（包括 `package.json`）不得作为应用可运行或用户目标已完成的证据。

## 4. 支持边界

只有锁定 Pi 版本中已验证身份与输入结构的内置 `read`、`write`、`edit` 可以进入分类流程。

- 普通项目内 `read` 可以 auto-allow。
- 普通项目内 `write`、`edit` 必须 ask。
- A-006 的纯 shell classifier 可产出 `candidate_fast_path` / `ask` / `block` 分析事实，但不连接执行；A-007 的最终风险决策仍阻止 shell、Git、网络、进程、自定义或被覆盖的同名工具。
- 敏感、项目外、符号链接、非普通文件或范围无法确认的目标统一 hard-block。
- sibling batch 中两个及以上 `yes/unknown` 变更成员统一 hard-block，并要求顺序重试。

本策略故意缩小 Alpha 能力，避免让零基础用户批准产品自己也无法解释的影响。

## 5. 指纹与批准

Canonicalization v1：

- 指纹输入是完整 `{ toolName, input }`，对象键确定性排序，数组顺序保留。
- 字符串和有限 JSON 数值保持原义；不 trim、不改 Unicode、不调用 `toJSON`。
- 拒绝 undefined、函数、symbol、BigInt、非有限数、负零、循环、稀疏数组、访问器和非普通 JSON 对象。
- 最大 canonical 字节数 1 MiB、最大深度 64；超限立即阻止。
- 使用 Node `crypto.createHash("sha256")` 计算 UTF-8 字节。

批准顺序：

1. 校验完整执行绑定，计算指纹、脱敏事实、分类和 sibling 状态。
2. hard-block 直接返回；ask 且没有实际 TUI 时阻止。
3. 展示卡片，只接受当前卡片的明确 Continue。
4. Continue 后重新计算指纹，并比较 fingerprint、toolName、cwd、sessionId、hostExecutionId、toolCallId；同时复核卡片依赖的目标身份、存在状态和前像。可重新建立完整当前事实时，旧批准失效并重新生成卡片，只有新的明确批准才可继续；无法完整重建时阻止。
5. 同步把 token 从 `issued` 改为 `consumed`，然后才返回 Pi。
6. 输入变化、取消、关闭、错误、session/cwd 改变、reload 或重复消费都使批准失效。
7. 清理 AgentGlass 持有的 raw input 引用。

指纹只是批准关联，不是签名、加密或最终执行参数证明。后加载扩展仍可能在 AgentGlass 返回后修改输入，此限制必须保留在对外说明中。

## 6. 路径与展示

路径预检使用绝对路径、`realpath` 或最近存在父目录，以及路径分段关系；禁止用字符串前缀判断是否在工作区内。目标解析变化、链接、特殊文件、越界或读取异常均阻止。

展示内容先投影、再脱敏、最后限长并移除终端控制字符。脱敏失败时显示固定错误原因，不回退原文。命令、原始 payload、秘密值、精确绑定和审批 token 不进入 UI 或普通日志。

## 7. 最终产品的最小运行结构

Beta 在相同进程、相同 Pi TUI 中为单文件动作补充 `执行前文件依据 → 执行 → 观察该目标 → 更新原卡 → 可选恢复`。快照与核验可使用普通函数和 Node 文件/crypto API；不增加消息总线、文件监听器、任务服务或独立进程。Beta 类型在对应任务才建立，Alpha 的关联 ID 沿用。

欢迎、帮助、当前结果与恢复都复用 Adapter 的同一入口 `/agentglass`。启动提示不读取全部历史；当前动作状态只保留脱敏事实与关联，完成后释放 raw、token 和预检缓存。只读提示可合并展示，但每次动作的风险检查仍单独进行。

## 8. Beta 单文件观察与恢复契约

- 范围限已验证内置 write/edit 的普通项目内文件。只读取明确目标，不递归扫描工作区；既有目录内单文件创建可恢复，隐式创建新目录暂不进入 Beta 变更支持集，避免承诺遗漏目录副作用。
- 观察依据为 actionId、effectId、targetId、目标身份、执行前状态及可可靠推导的预期后置状态。write 可计算预期字节 hash；edit 必须先证明锁定 Pi 的编辑语义与前像匹配，无法推导时只能核对较弱事实并显示内容无法确认。
- 结果状态固定为 `matched / mismatch / unknown`：只有列出的所有后置条件都被独立证明时为 matched；发现明确矛盾为 mismatch；其余为 unknown。UI 分列具体已确认项和未确认项，文件存在不能升级为内容正确。工具成功或失败均触发目标观察；缺失结果时保留“执行状态无法确认”，不自动重试。
- 恢复依据包含原文件字节/不存在状态、必要权限、动作身份及可靠执行后基线。预像存在不等于可恢复；执行后基线缺失、归属不清、路径变化或内容冲突时不提供恢复。前后检查不消除外部进程在检查后修改文件的竞态。
- A-010 的 Alpha snapshot 只证明保存了前像或不存在事实，不包含执行后基线与 restore；失败/超限降级为 unavailable，所有分支固定 `canRestoreNow=false`、恢复等级 `unknown`。Beta 已要求修改前取得可用备份；备份失败/超限阻止变更且无“仍然继续”入口。
- 恢复是新的受支持内部动作，仍经过路径/范围/当前状态检查、结果卡、五项绑定与单次批准；Adapter 为其生成唯一调用身份。普通删除工具仍不支持；只允许有完整证据的新建文件逆操作。不得复用原变更 token。
- 恢复前比较当前字节、存在状态和文件身份与该动作执行后基线；不符即停止，保留用户后续修改。恢复后独立核对字节、存在状态及受支持权限；失败或中断报告实际确认部分，不承诺事务性 Undo。批准后完成必要复核，在实际恢复前同步消费授权并使该恢复记录不再可重用；失败/中断不重建授权或自动重试，不建 redo/history 栈。


### B-002 版本化恢复证据契约

B-002 不改写 Alpha `schemaVersion=1` manifest。新变更在执行前发布
`schemaVersion=3` / `kind="agentglass-single-file-recovery"` manifest；它仅在
同一 session 内的匹配 `tool_result` 完成独立文件观察后，以同目录
临时文件、flush 和原子 rename 发布为 `ready`。最小 schema 为：

```ts
interface RecoveryManifestV3 {
  schemaVersion: 3;
  kind: "agentglass-single-file-recovery";
  state: "prepared" | "ready" | "consumed" | "superseded";
  snapshotId: string;
  actionId: string;
  effectId: string | null;
  targetId: string;
  targetPath: string;
  targetExisted: boolean;
  preImage: null | { file: string; byteLength: number; sha256: string };
  preIdentity: null | { device: string; inode: string };
  prePermissions: null | SupportedFilePermissions;
  postImage: null | {
    byteLength: number;
    sha256: string;
    identity: {
      device: string;
      inode: string;
      changeTimeMs: string;
    };
    permissions: SupportedFilePermissions;
  };
}
```

`prepared` 不是恢复入口；`ready` 必须同时有完整前像/不存在事实、
可靠后置字节、文件身份（含 POSIX inode 复用防护的 changeTimeMs）和当前平台支持的权限证据。`consumed`
和 `superseded` 只是敏感数据清理状态，不恢复授权。版本 1、旧 v2、未知/
未来版本、损坏、字段不完整、临时或只有 `prepared` 的发布物均不能
进入恢复入口，原数据保留待单独清理；不建设通用迁移器。

当前 session 内存只保留一个 `ready` 的不透明 snapshot ID、关联 ID、
脱敏标签和 session/cwd。磁盘 manifest 不能重建该入口、token 或许可。
普通 `agent_end` 只清理单轮核验状态；换 session/cwd、reload 或 shutdown
使内存入口失效。

恢复是 `agentglass.restore` 内部单文件变更：Adapter 为本次命令生成
唯一 hostExecutionId/toolCallId，以 fingerprint、toolName、cwd、sessionId 和
调用身份签发新 token。卡片初始聚焦停止；详情不授权。继续后先重读
`ready` manifest，再核对当前存在状态、真实路径、身份、字节和权限；
任一冲突均保留当前文件并阻止。所有异步检查后同步单次消费 token，
并在实际写回/删除前把 manifest 发布为 `consumed`。旧 token 、原变更
token 或失败后重建的 token 均不可用。既有文件写回前像字节并恢复
当前平台已验证的权限；新建文件只删除后置基线仍精确匹配的那一份
普通文件。恢复后再独立核对字节/不存在事实与受支持权限；失败只报告
已确认事实，不重试、不恢复入口、不建 redo。

新变更完成 `ready` 发布前，旧入口不变。只有新变更已明确批准且
新 `ready` 状态已安全发布后，才将旧 manifest 发布为 `superseded`并
替换内存入口。拒绝、输入漂移、准备或执行失败均保留旧入口。

`/agentglass` 的清理动作只列举通过私有根目录、受控名称、普通文件、
manifest schema/引用关系校验的 AgentGlass 数据，展示确切文件数、逻辑字节与
当前恢复能力损失。它使用独立 `agentglass.cleanup` 绑定和 token；批准后
重列集合，集合变化则阻止。删除逐项进行，部分失败保留未删项并如实报告；
未知归属、损坏后无法验证引用或未来 schema 数据保留。

### Beta 实施衔接（B-001～B-003 已实现）

- B-001 已把观察与原卡反馈一起交付，并把备份不可用、超限及隐式创建父目录的变更改为 hard-block；没有恢复实现时仍为不可恢复。B-002 才交付完整恢复，不能简单将 Alpha 的 canRestoreNow 常量改为 true。
- 复用现有 action/effect/target 和 ExecutionBinding。Pi 结果事件只在 Adapter 映射；锁定 0.85.1 的真实顺序为 `tool_execution_start → tool_call → tool_result → tool_execution_end`。核验由 `tool_result` 触发独立文件读取，`tool_execution_end` 仅在结果缺失时更新 unknown 并清理，不能把结束回调或返回文本当作观察。
- 在执行前的必要瞬时分析中计算预期后置摘要，不为稍后重放保存 raw input、编辑原文或完整 Pi 事件。write 使用 UTF-8 预期字节；edit 通过锁定包的实际匹配、歧义、BOM 与换行实现以内存文件操作推导预期。仅保留明确目标的敏感定位依据、存在/身份、预期 hash、关联 ID 和有界结构事实；正文仅按需瞬时读取，恢复原字节只在敏感存储域。
- 文件读取必须有界：Beta 观察和恢复后核对沿用 10 MiB 单文件读取上限，实际读取中也检查增长；超限、无法稳定读取或身份不确定为 unknown 且不可恢复。Canonicalization 的 1 MiB 输入上限保持不变，两者不是同一个预算。
- 核验待处理状态在完成或失效后释放；丢失结果、agent_end、取消时显示无法确认并终止旧回调，不把它标为未执行。异步读取完成前还会复核当前 run generation，迟到回调不能更新新会话卡片。B-002 的最近恢复入口另有 session 生命周期：普通 agent_end 保留，session/cwd 切换、reload 与 shutdown 失效，不能从 B-001 的单轮状态推断。
- B-002 已在同一 `/agentglass` 入口提供恢复与清理；B-003 已补欢迎、帮助、最近结果、有效恢复说明和固定安全示例。当前实现复用 `pre-image-snapshot.ts`、`approval.ts`、`stable-file.ts` 和 Pi Adapter，仅用 Node 标准库检查固定示例目录，没有增加运行时依赖、历史/redo 或通用删除工具。
## 9. 有界本地状态

Alpha 的审批、绑定与普通动作状态仅在内存。A-010 只在独立敏感目录建立 `schemaVersion=1` 的最小 pre-image manifest；存储根由 Pi Adapter 注入，Core 不知道 Pi 默认路径。manifest 不保存 raw tool input、token、用户目标原文或完整结果；仅保存目标路径、原字节引用、hash、身份、权限、存在状态以及固定的不可恢复结论。路径与原字节属于敏感域，不进入 UI、普通日志或 LLM。

单文件前像上限为 10 MiB，snapshot 文件逻辑内容总预算 100 MiB（包含本次临时发布内容），私有目录最多 4096 个持久条目；条目上限单独约束文件系统 metadata 消耗，不能把不可移植的 metadata 大小伪装成已精确计量。A-010 达到任一限制时将 snapshot evidence 降级为 unavailable，不显示可恢复。B-002 已建立“当前会话最近一次恢复入口”及其替代/清理审批。多进程用互斥创建的短期文件锁保护配额与发布；锁无法安全取得则 snapshot unavailable，不创建常驻协调服务。

新变更卡必须明确提示“继续后，上一项将不再提供恢复入口”；批准并安全记录这次替代状态后才撤销旧入口。拒绝保留旧入口；可检测输入变化不消费旧入口。为避免误删，旧副本进入待清理状态而不静默销毁。重启不恢复任何执行授权；旧副本只作为待清理敏感数据，不自动恢复旧会话入口。清理前显示数量、空间与恢复能力损失，单独确认；失败保留记录并报告实际结果。

manifest 使用同目录临时文件、完整写入/flush 后原子 rename 发布；原字节先写完验证，manifest 最后发布。损坏、缺失、未来版本或不完整备份不能标记可用。POSIX 使用目录 0700、文件 0600；Windows 必须验证相应 ACL 才能发布恢复支持。已有 Alpha schemaVersion=1 前像数据，不能声称没有旧 schema。B-002 为恢复证据定义独立版本化契约；v1 前像不能升级为当前会话恢复入口，只能在验证归属后作为待清理数据。保留旧数据，测试旧版、损坏及未来版本的拒绝/清理边界；无需通用迁移框架。

## 10. 上手与轻量化测量

复用 Pi 加载、TUI 和帮助能力；不建设 Pi/模型安装器。示例仅包含无秘密文本，复制目标必须新建且用户明确同意，不覆盖现有路径。欢迎页/创建示例/查看文件/切换目录的具体宿主 API 必须先通过锁定 Pi 集成检查，缺能力时说明限制，不用 shell 猜测性补齐。

按[产品预算](product-spec.md#7-轻量化验收预算)测量：同机加载对照、纯预检 100 次预热和 1000 次固定样本的 P50/P95、恢复配额、制品增量、持续动作后的内存释放。用户于 2026-09-14 确认将同机扩展加载增量门从 `≤200 ms` 调整为 `≤350 ms`；当前候选两轮各 20 对冷启动的加载增量 P95 为 `321.142/188.968 ms`，纯预检 P95 `0.516 ms`，制品 unpacked `666,917` bytes，配额、阶段成本和长会话证据通过。安全监听和注册保持同步；分类路径与快照/恢复实现按首次相关动作加载，首次操作成本单列披露。运行时只为当前动作工作，不在空闲时轮询、索引或上传。

## 11. Batch 4 测试边界（Alpha 自动化及最终审查已完成）

Batch 4 不改变第 1～9 节的产品数据流、领域类型、存储 schema 或公共接口。A-013/A-014 复用现有测试补齐规则和不变量证据；A-015 已增加最小 Windows CI 并验证 Pi 合约；A-016 已只新增测试侧真实调度 E2E。唯一新增命令接口是 A-016 的开发用 `test:e2e`，不是产品入口。

当前 integration 使用真实 Pi SDK，手动构造事件和受控 TUI 输入，部分场景直接执行工具；加载 smoke 与该合约测试不等于完整调度。A-016 在独立 cwd/agentDir/会话/snapshot 数据中加载实际扩展入口，由测试侧确定性模型输出驱动 Pi 执行循环，受控 UI 输入只替代人工按键。真实工具身份、Adapter、风险/审批和 Pi 阻止机制不能替换成 mock。

测试可以在执行后读取目标字节、比较前后状态或检查调用是否发生，这些只在 tests 中生成断言。不得将测试观察接入产品 tool_result verifier、普通事件存储、结果卡执行后更新或恢复入口。Pi 的 tool_execution_end 在 Alpha 仅用于清理关联，不代表已观察或核验用户目标。

真实终端操作和真人研究单独记录；受控 UI 或固定模型输出不能证明这两项。共存扩展在 AgentGlass 返回后改写输入的限制仍保留，E2E 通过不能扩大防护承诺。

CI 只消费已跟踪代码和测试；被忽略的本地规范由文档验收直接检查。工作流、测试模型替身和临时项目均为开发设施，不加入发布包或引入产品后台服务。package dry-run 只检查制品清单，性能与跨平台发布预算仍属于 Release。

## 12. Pi Web 未来交互通道（当前暂缓，历史契约保留）

正式任务见 development-plan §8。公开 `0.8.0` 当前仅承诺 TUI；本节保留 W-001 对真实 Pi Web 0.9.1 的观察、W-002 的本地补丁契约、W-003 的 adapter bridge 和浏览器闭环作为未来阶段历史设计，不表示当前公开 Pi Web 已兼容或当前版本已获得 RPC 审批资格。Pi Web 仍运行 Pi，因此未来阶段继续使用 `extensions/` 与 `src/adapter/pi/` 边界；不新增 Core 的 Pi/Web 依赖或第二 Adapter 宿主。

### 12.1 锁定宿主与已观察接口

W-001 锁定 `@agegr/pi-web@0.9.1` registry 制品（registry `gitHead=553f2d774c37a976dd94f44e34ced24674829295`）与 Pi `0.85.1`。该 registry 制品的 `package.json` 为 `0.9.1`，同提交源码 checkout 的 `package.json` 仍为 `0.9.0`；这是可复现制品差异，不能写成两个已兼容版本。真实源码的 `npm run dev` 绑定 `127.0.0.1:30141`，Pi Web 使用 Pi SDK 的 `bindExtensions({ uiContext, mode: "rpc", ... })`，项目资源在 `projectTrustReloadOptions` 允许时才装载，未信任项目的 `.pi/extensions` 保持休眠。

已观察的现有传输和字段如下，均不是 AgentGlass 审批资格：

- `GET /api/agent/{sessionId}/events` 返回 SSE；首个数据事件为 `{ type: "connected", sessionId, isStreaming }`。服务端 heartbeat 为 30,000 ms；浏览器 ready 超时为 60,000 ms，普通重连延迟为 1,000 ms。Pi Web 默认空闲回收为 600,000 ms，`PI_WEB_IDLE_TIMEOUT_MS` 只控制宿主 session 生命周期，不能证明审批能力。
- `POST /api/agent/{sessionId}` 接收 `prompt`、`abort` 及 `extension_ui_response`、`extension_ui_input` 等命令。现有阻塞 UI 为 `select`、`confirm`、`input`、`editor`、`custom`；状态/非阻塞 UI 为 `notify`、`setStatus`、`setWidget`、`setTitle`、`set_editor_text`。现有 response 只有 `id` 加 `value`/`confirmed`/`cancelled`，没有能力版本、连接拥有者、请求代次或呈现确认。
- `AgentSessionWrapper.onEvent()` 会把 pending UI 请求立即重放给每一个新 listener；当前 SSE 路由没有连接 ID，`extension_ui_response` 也不校验 SSE 连接归属。现有 custom 渲染失败会把异常消息拼入 `lines`，没有可提交前的 render-validity 证明。这些是 W-002 必须补齐的宿主缺口，不是 W-001 放行理由。

W-001 的真实证据包括锁定 checkout 的源码/lockfile、Pi Web 定向测试、确定性回环模型驱动的真实 agent loop 和实际 loopback 浏览器 E2E；测试环境不调用收费模型。确定性驱动实际加载隔离扩展并触发 `setStatus`、`setWidget`、`select`、`custom`，同时打开两个 SSE listener，实测当前宿主把同一 pending 请求广播给两个 listener 且接受非 owner 响应。它证明宿主现有行为，不证明 AgentGlass 审批通道合格。

### 12.2 W-002 必须实现的版本化能力与消息

复用现有两个路由，不新增 AgentGlass 服务、端口或网页。服务端在每条 SSE 连接建立时生成内存中的 `connectionId`（UUID 字符串）和递增 `connectionGeneration`，并在 `connected` 事件加入：

```text
agentglass: {
  capabilityId: "agentglass.pi-web.approval",
  capabilityVersion: 1,
  sessionId: string,
  connectionId: string,
  connectionGeneration: uint64,
  expiresAt: epochMilliseconds
}
```

`connected.agentglass` 是服务端发出的能力握手，不是审批同意。浏览器收到它后，必须先通过同一 `/api/agent/{sessionId}` POST 路由发送一次：

```text
extension_ui_handshake:
  {
    type: "extension_ui_handshake",
    agentglass: {
      capabilityId,
      capabilityVersion,
      sessionId,
      connectionId,
      connectionGeneration,
      expiresAt
    }
  }
```

服务端只在该 envelope 与当前 SSE lease 完全匹配、未过期且请求 URL 的 session ID 一致时接受握手；成功响应固定为 `{ success: true, data: { accepted: true, owner: boolean, agentglass } }`，不含 raw input、token、transcript 或 snapshot。握手前，服务端不得向该连接发送 AgentGlass 阻塞请求，也不得接受 `presented`、`response` 或 `input`。能力缺失、版本大于 1、session 不同、generation 不一致或字段矛盾均拒绝。

`connectionId` 是只用于关联当前 SSE lease 的不透明句柄，不是 AgentGlass approval token；浏览器不得得到 raw tool input、fingerprint、cwd、目标前像、Pi transcript、snapshot 正文或 approval token。服务端只接受自己创建且仍在当前 session 映射中的句柄，客户端不能靠改写 body 建立、续期或转移拥有权。这里的连接归属是 Pi Web 同源桥接内的应用层 lease 关联，不是 TLS/HTTP 底层连接证明；不能宣称隔离同源恶意脚本、同权限本机攻击或恶意共存扩展。

每个 AgentGlass 阻塞请求沿用 Pi 的 `extension_ui_request.id`，并附加 `agentglass`：

```text
agentglass: {
  capabilityId: "agentglass.pi-web.approval",
  capabilityVersion: 1,
  sessionId: string,
  connectionId: string,
  connectionGeneration: uint64,
  requestGeneration: uint64,
  renderRevision: uint32,
  expiresAt: epochMilliseconds
}
```

`id`、`sessionId`、`connectionId`、`connectionGeneration`、`requestGeneration` 和 `renderRevision` 都由服务端产生或核对；URL 中的 session ID 必须与 envelope 一致。`extension_ui_request` 只发送给该请求的 owner connection；同一 session 的其他标签页可以继续收到安全的非阻塞宿主事件，但不能看到、呈现或提交该 AgentGlass 请求。

owner 采用确定性的 first-valid-handshake 规则：一个 Pi session 没有 owner 时，第一个通过握手的连接成为 owner；后续连接只能作为 observer，响应固定返回 `AGENTGLASS_NOT_OWNER`。owner 保持到该 SSE 的 `Request.signal` abort、主动关闭、硬过期或 session 销毁。owner 失效会立即使当前 pending 请求失效；observer 不自动晋升，旧请求不转移、不重建、不重放。未来请求只能由新的 SSE 连接重新握手后取得 owner。该规则只处理合格 Pi Web 桥接之间的意外多标签竞态，不扩大对同源恶意客户端的隔离承诺。

沿用 `POST /api/agent/{sessionId}`，新增并严格校验以下消息：

```text
extension_ui_presented:
  { type, id, agentglass }
extension_ui_response:
  { type, id, agentglass, value?: string, confirmed?: boolean, cancelled?: true }
extension_ui_input:
  { type, id, agentglass, data: string }
extension_ui_render_failed:
  { type, id, agentglass, reason: "not_visible" | "unmounted" | "invalid_layout" }
```

浏览器只有在当前安全卡片已经挂载、可见、必要危险信息完整可读且 Stop 仍为初始焦点时才发送 `extension_ui_presented`；服务器把它作为受信 Pi Web 桥接的呈现确认，只证明该桥接已提交当前 revision，不把它宣传为对 DOM、恶意脚本或同权限客户端的独立证明。服务器未收到当前 `renderRevision` 的确认，不接受 response 或 custom input。custom 每次更新只保留最新 revision，必须重新 presented；渲染失败、卸载和呈现超时都关闭请求。浏览器不上传异常正文，服务端只返回固定安全错误。

固定错误响应的 JSON body 为 `{ "error": { "code": "<固定机器码>" } }`，使用 `application/json` 与 `Cache-Control: no-store`，不包含底层异常、原始输入、HTML、路径、secret、transcript 或 snapshot。生命周期错误使用 HTTP 409 和以下机器码：`AGENTGLASS_CAPABILITY_REQUIRED`、`AGENTGLASS_CAPABILITY_UNSUPPORTED`、`AGENTGLASS_NOT_OWNER`、`AGENTGLASS_STALE_CONNECTION`、`AGENTGLASS_STALE_REQUEST`、`AGENTGLASS_DUPLICATE_RESPONSE`、`AGENTGLASS_RENDER_REQUIRED`、`AGENTGLASS_RENDER_FAILED`、`AGENTGLASS_EXPIRED`、`AGENTGLASS_CANCELLED`、`AGENTGLASS_CONNECTION_LIMIT`。格式错误使用 400 与 `AGENTGLASS_MALFORMED`；宿主暂时无合格能力使用 503 与 `AGENTGLASS_UNAVAILABLE`。浏览器只按固定 code 映射安全文案；普通 Pi/Web 错误不得被包装成 AgentGlass 已执行或安全。

### 12.3 生命周期、时间上限和内存上限

- `connectionGeneration` 是当前 Pi Web 进程内、按 session 递增的 `uint64`，首个 SSE 为 `1`；服务重启后旧 connection ID 和旧 generation 全部失效，不能以数值重置或恢复旧 lease。`requestGeneration` 也是按 session 递增、从 `1` 开始且每个新阻塞请求只分配一次；不因重连、重放或重复响应递增，达到可表示上限时 fail closed，不回绕复用。`renderRevision` 从 `1` 开始；每次产生新的阻塞 payload 或 custom 内容更新就递增，旧 revision 的 presented/response/input 全部失效。
- connected envelope 的 `expiresAt` 是 SSE AgentGlass lease 的硬截止时间，固定为连接建立后最多 `600,000 ms`，不由 Pi Web 的 `/api/agent/{sessionId}/lease` 续期。该宿主 lease 只维持 Pi session liveness；它没有 connection ID，不能续期、转移或恢复 AgentGlass owner。连接到期前后由浏览器重新建立 SSE 并重新握手；重连不重放旧审批。
- 一条请求只有一个 owner。Stop、取消、页面切换 session、reload、shutdown、请求超时、owner SSE 的可观察 abort 都使该请求和其 approval token 失效；失效后不转移、不重建、不重放。重连会拿到新的 `connectionId`/generation，只能查询安全结果，不能恢复旧 pending approval。
- 复用当前 Pi Web 的可观察失联机制：服务端 `Request.signal` abort、SSE 30 s heartbeat、浏览器 `EventSource.onerror`；浏览器首次 ready 上限为 60 s，重连间隔为 1 s。网络黑洞可能晚于 heartbeat 才被操作系统发现，不能宣传即时撤销；为此 AgentGlass approval request 的服务端 `expiresAt` 固定为创建后最多 600,000 ms，render presented 的等待最多 10,000 ms。Pi Web idle 环境变量不得延长这两个上限。
- 每个 Pi session 最多一个 AgentGlass pending approval、一个 owner 和最多八条 AgentGlass 连接 lease；每个请求只保留一份最新 card payload（单事件 UTF-8 不超过 64 KiB）和一个最新 custom revision，不保存历史/事件日志。完成、取消、超时、断线和 session 销毁都释放 map 项；超过上限固定失败关闭。通用 Pi Web 自身的状态/终端内存不计入 AgentGlass 额度。
- Pi adapter 在所有异步预检完成后，同步复核能力 envelope、五项精确 binding、target/pre-image、请求代次和 owner，再同步单次消费现有 token；Web 字段永远不能替代现有 fingerprint/toolName/cwd/sessionId/hostExecutionId/toolCallId 或目标证据。

### 12.4 真实证据映射和 W-002 验收

W-001 已实际运行：`rpc-manager-extension-ui.test.mjs`（8）、`rpc-manager-widgets.test.mjs`（11）、`rpc-manager.test.mjs`（42）、`agent-event-connection.test.mjs`/`agent-event-stream.test.mjs`/`agent-event-wire.test.mjs`（22）、`rpc-manager-shutdown.test.mjs`/`project-trust.test.mjs`/`browser-notifications.test.mjs`（合计 33）及 Pi Web loopback Playwright E2E（7 个 PASS 场景，1280px 与 390px）。另用隔离的 `agentglass-w001-deterministic-driver-20260914.mjs` 以本机回环 OpenAI-compatible 假模型驱动真实 agent loop，命令退出码 0；实际触发 `select`/`custom`，并验证两个 SSE listener 收到相同 request ID、非 owner response 在当前宿主被接受。上述测试覆盖真实 Pi SDK wrapper 的 extension binding、工具/项目可信加载、select/confirm/input/editor/custom、widget/status、Stop/cancel、render error、SSE ready/reconnect、session/cwd fixture 和 slash command；没有覆盖 AgentGlass 所需的 owner/能力/presented 语义。

W-002 已在同一锁定 checkout 增加并通过非空正例、邻近反例和故障用例：有效 `connected`→handshake→owner 认领；第二连接 observer；owner 在首渲染前或已渲染后断开均不晋升；缺失/未来/矛盾能力；旧/重复/跨 session/跨 connection/request generation；未 presented、render failure、渲染超限；Stop、取消、reload、shutdown、timeout、SSE abort；重连不重放旧审批；连接八条、单 pending、64 KiB 事件上限；固定 JSON 错误 body 与 raw 异常边界。真实 Chrome loopback 继续验证真实 SSE/POST/UI dispatch，不以手动 emit 后直接 execute 代替。

W-002 实际证据（2026-09-14）见 references §41.5：补丁停留在 `C:\Users\17860\AppData\Local\Temp\agentglass-w001-piweb-20260914` 的 detached `553f2d774c37a976dd94f44e34ced24674829295`，复用现有 SSE/POST 路由和 UI bridge；没有 AgentGlass 服务、端口、网页、运行时依赖或产品入口改动。锁定 checkout 的 `node_modules\.bin\tsc --noEmit`、`npm run lint` 和 112 项适用 Node 测试均退出 `0`；Chrome `npm run test:e2e` 退出 `0`，7 个 1280px/390px 场景通过并断言 capability handshake、presented gate、Stop 初始焦点、折叠撤销与 request binding。完整上游 `npm test` 的 15 个既有环境/源码断言失败仍单独记录，不能被 W-002 适用 gate 隐藏；`npm run build` 按普通开发边界未运行。该本地补丁未合入、未发布，不声称原版 0.9.1 兼容。

### 12.5 断线、执行、恢复和边界

断线只撤销未执行许可，不等于撤回文件效果。实际执行已交还 Pi 或是否执行不确定时，继续以原有可靠结果与独立观察报告；不自动重试，不显示“没有修改”或伪造恢复。连接恢复只查询安全结果，不恢复待审批请求。原服务端 session/cwd 未失效且恢复证据完整时，可显示现有最近入口，但恢复/清理必须使用新请求和新批准；服务重启、session/cwd 切换与 reload 按现有规则使入口失效，磁盘数据不重建授权。

不新增 AgentGlass 服务、监听端口、主动网络、账户或运行时依赖；使用 Pi Web 已有服务与传输，其本体资源另计。本阶段保持 schema v3、10 MiB/100 MiB/4096 配额与单会话最近入口，不预建历史系统。Pi Web 的直接上传、文件、终端、Git、设置操作及原有 transcript 不受本通道全面保护；浏览器输入、HTML、控制字符、宿主异常和同权限恶意共存扩展仍是边界，不宣称 sandbox 或全站保护。

### 12.6 W-003 Pi adapter 接入边界

W-003 在 AgentGlass 的 `src/adapter/pi/` 接入锁定 W-002 checkout 提供的同进程动态 bridge。Pi Web 的 extension UI context 可额外暴露精确的 `agentglassApproval` 结构：`capabilityId` 必须为 `agentglass.pi-web.approval`、`capabilityVersion` 必须为 `1`，并提供 `isAvailable(): boolean`。adapter 只有在自身仍处于 `rpc`、`hasUI` 为真、未取消且三项 bridge 字段精确匹配并动态返回 `true` 时才将该 RPC 映射为合格交互通道。

`hasUI`、RPC/print/json 模式、环境变量、方法名或协议字符串单独存在都不是资格证据；普通 `rpc+hasUI` 和未知客户端仍为不可审批。bridge 的 `isAvailable()` 只在当前服务端 session 中存在未过期、已握手且仍为 owner 的连接时为真，断线、连接租约到期、reload/shutdown 或 owner 失效立即返回 false。该动态事实只是原有安全链的附加门，不替代 action fingerprint、tool name、cwd、session、tool call identity、target/pre-image、请求代次、呈现确认、所有异步步骤后的最终同步复核或单次消费。

W-004 前审查发现，`example`、`restore`、`cleanup` 在审批返回后仍各自包含异步文件/恢复检查；本轮统一在最后一个 `await` 后再次检查动态 bridge，失效即令 token 失效并停止，随后才同步复核 binding 并消费单次授权。帮助面板和命令菜单也在真正发出 UI 前保留失效连接保护；这不扩大 UI 或文件操作范围。

该 bridge 是受信 Pi Web 实现与 adapter 的本机契约，不是 OS sandbox、浏览器 DOM/脚本隔离或恶意共存 Pi extension 防护。W-003 已在锁定宿主 checkout 的真实 Edge 回环会话完成 7/7 个 help/example/read/write/edit/restore/cleanup 场景，其中 edit 后含独立核验反馈，结果由隔离目录独立读取核对；W-004 仍负责更宽的断线、多标签、窄视口、故障和安全代理矩阵。上游 `components/ChatWindow.tsx` 的 Enter 正常完成边界修正仍未合入或发布，真实证据和未覆盖项见 references §41.6。

## 13. 新手任务引导契约（N 阶段，待实施）

本节仅由 development-plan §9 的明确任务启用。当前公开 0.8.0 不具备这些入口；不新增公共包 API、持久化 schema 或 Pi/Web 通道。沿用单一 Pi adapter、本地模板和既有文件执行链。

### 13.1 草稿输入与展示边界（N-001）

- 起步器只收集任务类别、项目相对文件路径和本轮要求。路径 UTF-8 上限 1024 bytes；每个自由文本字段上限 4096 bytes；最终投影后的草稿上限 8192 bytes。超限拒绝本次填入并提示缩短，不静默截断。菜单固定，不持久化表单或保留历史草稿。
- 路径拒绝绝对路径、盘符/UNC、空段歧义、`.`/`..` 路径段、换行/终端控制和超限；Windows 分隔符仅作无歧义的相对路径规范化。不查文件存在、不枚举目录，格式接受不等于执行许可。操作时仍按第 6 节真实路径、身份、敏感性和作用域检查。
- 自由文本在当前交互内短暂读取，复用投影脱敏→终端控制过滤→再脱敏→限长检查，不拼入异常 message、原工具 input 或 snapshot 内容。仅安全投影进入生成的编辑器草稿；有内容被隐藏时提示检查草稿，不宣称其与原要求语义完全相同。
- 文件引用必须保留精确且可安全展示的相对身份。若脱敏/控制过滤会改变路径，或无法与原目标无歧义对应，则不生成该定向草稿，固定提示重新指定普通文件；绝不能拿截断标签、掩码路径或安全显示名称当作执行目标。不得为了填入草稿把敏感恢复域的原路径输出。
- 草稿是用户可审阅请求，不是 RiskAssessment、批准、调用参数缓存或原动作重放。用户发送后会进入 Pi 正常模型对话；AgentGlass 不自动调用模型，不能保证模型遵循草稿，不能宣称能阻止一切提示注入。工具阶段的确定性检查继续独立生效。

### 13.2 编辑器交互与竞态（N-001，N-002/N-003 复用）

只用锁定 Pi 的 ui.select/input、getEditorText/setEditorText 与现有通知能力；不使用 sendUserMessage/sendMessage、模拟按键或 shell 提交请求。一个最小共用填入函数足够，不增加 editor adapter/策略注册表。

进入引导前检查 TUI、hasUI、真实 session/cwd、宿主空闲和编辑器恰好为空字符串；非空白也算已有内容。一个引导在内存捕获当前 session/cwd 与失效代次；任一异步对话返回后和最终填入前复核，期间出现新的 agent run、目录/会话切换、reload/shutdown 或另一次引导则使旧流程失效。结束的旧 run 不能复活旧流程。

最终先完成所需异步检查，再同步读取编辑器并检查仍为空，紧接着 setEditorText，两者之间无 await。不清空、不合并、不覆盖已有输入。getEditorText 缺失/异常时不写入；setEditorText 异常时提示无法确认填入结果、请查看输入框，不自动重试或恢复旧值。成功只说“已填入请求，请检查后自行发送”，不说“任务已开始”。

已有正文留在宿主输入框，本功能不复制、投影或记录该正文；只瞬时判断是否为空。用户若在填入后切换项目，已成为用户草稿的文字不由本功能主动清空或重写，实际工具调用仍重新验证当前项目。不能声称该同步检查抵抗恶意共存扩展。

### 13.3 最近引导上下文（N-002）

仅保留当前会话最近一项；语义字段为 session/cwd 绑定、现有 actionId/effectId/targetId（有可靠值才使用）、更新代次、固定结果/阻止类别，以及可选的安全精确项目相对目标。复用现有类型和值，不建立第二套文件事实或授权类型；新增宿主无关类型仅在确有跨模块使用时置于 Core，Pi 状态留 adapter。

类别来源为现有风险/核验/恢复结构事实：多变更或 sibling 不完整、核验 matched/mismatch/unknown、恢复冲突/完成/失败、用户取消、其他阻止。未知类别只提供固定说明。可能没有目标的阻止不得生成虚构 targetId。多个原因并存时，任何敏感/越界/不支持/完整性等阻止都不得被“顺序重试”建议遮盖；仅在不存在这些额外原因时提供顺序草稿。

在现有关联校验后的发布位置更新上下文，不解析中文 UI 或 tool_result 文本；同动作后续核验/恢复更新同项，新动作结果替代旧项。迟到旧结果不能覆盖后发布的新项；普通 read 状态不覆盖。agent_end 保留已经发布的最近结果，但不把未完成动作标为成功。观察到 session/cwd 变化、reload/shutdown 清除，不因切回原目录恢复；打开菜单/填入前再次核对身份和更新代次。

不保存原始工具输入、原用户目标、文件正文、snapshot 正文、编辑器已有正文或 token。安全相对目标与事实只服务请求引导；既有恢复入口独立管理，不能从最近上下文构造或复活恢复授权。尚无可靠精确目标或安全投影失败时，只给通用说明并要求用户重新明确文件。

### 13.4 恢复与后续菜单（N-003）

结果菜单只引用当前上下文。matched 提供查看与继续调整；mismatch/unknown 提供查看；失效/取消/不支持不提供直接修改。恢复项同时要求当前恢复入口通过已有检查，并与该结果的原动作及精确目标关联一致；两个“最近”或同名标签不是证据。

菜单返回后复核原上下文代次；恢复选中时再检查同一恢复入口，并进入原流程的前像/后置基线、精确单次批准、冲突与独立验证。任何变化都结束本次选择，不静默改为另一恢复项。顶层 restore 仍按自己的证据可用，明确实际文件，不能误标为当前结果的恢复。恢复删除新文件后去掉该文件的查看/继续调整入口。
