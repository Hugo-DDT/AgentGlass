import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  EditToolInput,
  ExtensionAPI,
  ExtensionContext,
  ToolCallEvent,
  ToolInfo,
} from "@earendil-works/pi-coding-agent";
import { createEditToolDefinition } from "@earendil-works/pi-coding-agent";
import {
  truncateToWidth,
  visibleWidth,
  wrapTextWithAnsi,
} from "@earendil-works/pi-tui";
import {
  consumeApprovalToken,
  executionBinding,
  invalidateApprovalToken,
  issueApprovalToken,
  sameExecutionBinding,
} from "../../core/approval.js";
import type {
  ApprovalToken,
  ExecutionBinding,
  ExpectedFilePostcondition,
  HostCapabilities,
  HostExecutionFacts,
  HostToolIdentity,
  ObservableUserGoal,
  OutcomeCard,
  PredictedEffect,
  PreImageSnapshotEvidence,
  RiskAssessment,
  SiblingExecutionReference,
  SnapshotFailureCode,
  TransientHostExecutionInput,
} from "../../core/domain.js";
import {
  FILE_OBSERVATION_LIMIT_BYTES,
  hashFileBytes,
  unverifiableResult,
  verifyFilePostcondition,
} from "../../core/file-verification.js";
import {
  fingerprintTransientActionInput,
  projectTransientActionInput,
  redactDisplayString,
} from "../../core/input-boundary.js";
import {
  renderOutcomeCard,
  renderOutcomeCardUpdate,
  renderReadNotice,
} from "../../core/outcome-card.js";
import type { RecoveryEntry } from "../../core/pre-image-snapshot.js";
import { predictEffects } from "../../core/predicted-effects.js";
import {
  assessRisk,
  assessSiblingMutationRisk,
  requireMutationBackup,
} from "../../core/risk-engine.js";
import { readStableFile } from "../../core/stable-file.js";

type AdapterObserver = (facts: HostExecutionFacts) => Promise<void> | void;
type SnapshotModule = typeof import("../../core/pre-image-snapshot.js");
type ExecutionInputModule = typeof import("../../core/execution-input.js");
type FileClassificationModule =
  typeof import("../../core/file-classification.js");

// 快照实现包含文件持久化、ACL 子进程和恢复逻辑；监听器仍同步注册，只有实际需要时才加载。
// 使用原生 ESM 缓存，不维护第二套全局生命周期或后台预加载状态。
const loadSnapshotModule = async (): Promise<SnapshotModule | undefined> => {
  try {
    return await import("../../core/pre-image-snapshot.js");
  } catch {
    return undefined;
  }
};

// 文件分类依赖较大的路径检查模块；只在第一笔工具调用进入预检时加载，
// 但 Pi 事件监听仍在本函数内同步完成注册。加载失败由调用方统一失败关闭。
const loadExecutionInputModule = async (): Promise<
  ExecutionInputModule | undefined
> => {
  try {
    return await import("../../core/execution-input.js");
  } catch {
    return undefined;
  }
};

type SnapshotTargetOptions = Parameters<
  FileClassificationModule["resolveSensitiveSnapshotTarget"]
>[0];
type SnapshotTarget = Awaited<
  ReturnType<FileClassificationModule["resolveSensitiveSnapshotTarget"]>
>;

async function resolveSensitiveSnapshotTarget(
  options: SnapshotTargetOptions,
): Promise<SnapshotTarget> {
  const module = await import("../../core/file-classification.js").catch(
    () => undefined,
  );
  return module
    ? await module.resolveSensitiveSnapshotTarget(options)
    : undefined;
}

// 快照模块加载失败时仍返回固定、脱敏的失败证据；调用方据此阻止变更，不回显异常文本。
function unavailablePreImageSnapshot(
  failureCode: SnapshotFailureCode,
  targetExisted: PreImageSnapshotEvidence["targetExisted"] = "unknown",
): PreImageSnapshotEvidence {
  return Object.freeze({
    status: "unavailable",
    snapshotId: null,
    targetExisted,
    permissionMetadata: "unknown",
    failureCode,
    canRestoreNow: false,
    recoveryGrade: "unknown",
  });
}

const BLOCK_REASON =
  "AgentGlass could not verify this tool call's runtime identity, so it was stopped.";
const MULTIPLE_MUTATIONS_REASON =
  "已停止：这次包含多个会改变内容或影响未知的操作。请让 Pi 一次只提出一个变更。";
const BATCH_CONTEXT_REASON =
  "已停止：无法确认这次同时提出的操作是否完整。请让 Pi 一次只提出一个变更后重试。";
const APPROVAL_UNAVAILABLE_REASON =
  "已停止：这一步需要你的明确确认，但当前模式没有可用的本地审批界面。请回到 Pi 交互窗口再试。";
const APPROVAL_STOPPED_REASON =
  "已停止：你没有批准这一步，因此这次修改没有获得执行许可。";
const APPROVAL_CHANGED_REASON =
  "已停止：审批期间动作或运行环境发生变化。旧批准已失效，请重新提出当前这一步。";
const SAFETY_BLOCK_REASON =
  "已停止：当前版本无法可靠说明或支持这一步。请改为普通项目文件的查看或单个修改。";
const BACKUP_BLOCK_REASON =
  "已停止：未能取得这次修改所需的修改前证据，或这一步会创建缺少的上级文件夹。请明确选择已有文件夹中的一份普通文件后重试。";
const SNAPSHOT_MODULE_UNAVAILABLE_REASON =
  "已停止：当前恢复数据模块不可用，未执行恢复或清理。请稍后在同一会话重试。";
const READ_STATUS_KEY = "agentglass-read";
const ACTION_CARD_KEY = "agentglass-action";
const WELCOME_WIDGET_KEY = "agentglass-welcome";
const EXAMPLE_DIRECTORY_NAME = "agentglass-example";
const EXAMPLE_FILE_NAME = "活动说明.txt";
const EXAMPLE_RELATIVE_FILE = `${EXAMPLE_DIRECTORY_NAME}/${EXAMPLE_FILE_NAME}`;
const EXAMPLE_GOAL = "帮我修改这份活动说明";
// 这段内容是随扩展发布的固定无秘密示例；只用于明确的示例准备，不从用户输入读取，也不覆盖已有路径。
const EXAMPLE_ACTIVITY_TEXT =
  "活动说明\n\n活动名称：社区旧物交换日\n时间：周六 10:00—15:00\n地点：社区活动室\n安排：带来闲置物品，现场登记后交换。\n报名：现场登记。\n";

// 仅区分“批次无法证明”和其他宿主身份失败，以选择真实且脱敏的固定原因；异常文本从不返回 Pi。
class SiblingContextError extends Error {}

interface PendingVerification {
  binding: Readonly<ExecutionBinding>;
  action: HostExecutionFacts["action"];
  effect: PredictedEffect;
  targetPath: string;
  expected: ExpectedFilePostcondition;
  preImage: PreImageSnapshotEvidence;
  relativeTarget?: string;
  guidanceOrder: number;
  inFlight: boolean;
}

interface SessionRecoveryEntry extends RecoveryEntry {
  sessionId: string;
  cwd: string;
  targetLabel: string;
  relativeTarget?: string;
}

interface ExamplePlan {
  cwd: string;
  realCwd: string;
  cwdIdentity: { dev: string; ino: string };
  directory: string;
  file: string;
}

const knownBuiltinNames = new Set([
  "read",
  "write",
  "edit",
  "bash",
  "powershell",
  "grep",
  "find",
  "ls",
]);
const protectedBuiltinNames = new Set(["read", "write", "edit"]);

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function hostExecutionId(sessionId: string, toolCallId: string): string {
  // JSON tuple keeps the two identity fields unambiguous; the digest is only a correlation ID, not a signature.
  return createHash("sha256")
    .update(JSON.stringify([sessionId, toolCallId]), "utf8")
    .digest("hex");
}

function wrapLine(line: string, width: number): string[] {
  return line ? wrapTextWithAnsi(line, Math.max(1, width)) : [""];
}

type PiTheme = ExtensionContext["ui"]["theme"];

type HelpTone = "accent" | "success" | "warning" | "error" | "text";

interface HelpItem {
  marker: string;
  text: string;
  tone: HelpTone;
}

interface HelpSection {
  title: string;
  items: readonly HelpItem[];
}

const plainPiTheme = {
  fg: (_color: string, text: string) => text,
  bg: (_color: string, text: string) => text,
  bold: (text: string) => text,
} as PiTheme;

function usablePiTheme(theme: PiTheme | undefined): PiTheme {
  // 测试/无主题宿主可能提供空的 theme 占位；主题缺失只降级为纯文本，不能让审批失败。
  try {
    return theme &&
      typeof (theme as { fg?: unknown }).fg === "function" &&
      typeof (theme as { bg?: unknown }).bg === "function" &&
      typeof (theme as { bold?: unknown }).bold === "function"
      ? theme
      : plainPiTheme;
  } catch {
    return plainPiTheme;
  }
}

function currentPiTheme(ctx: ExtensionContext): PiTheme {
  try {
    return usablePiTheme(ctx.ui.theme);
  } catch {
    return plainPiTheme;
  }
}

function styleWidgetLine(line: string, theme: PiTheme | undefined): string {
  // 状态行只把已有事实映射为视觉标记；颜色不参与风险判断或审批。
  const activeTheme = usablePiTheme(theme);
  if (line.startsWith("已确认：") || line.startsWith("安全示例已准备"))
    return `${line} ${activeTheme.fg("success", "✓")}`;
  if (line.startsWith("执行中："))
    return `${line} ${activeTheme.fg("accent", "…")}`;
  if (
    line.startsWith("不符：") ||
    line.startsWith("无法确认：") ||
    line.startsWith("已停止：") ||
    line.includes("未完成")
  )
    return `${line} ${activeTheme.fg("warning", "!")}`;
  if (line.startsWith("✓ ")) return activeTheme.fg("success", line);
  if (line.startsWith("? ") || line.startsWith("! "))
    return activeTheme.fg("warning", line);
  if (line.startsWith("› ") || line.startsWith("↶ ") || line.startsWith("… "))
    return activeTheme.fg("accent", line);
  if (line.startsWith("• ")) return activeTheme.fg("muted", line);
  if (line.startsWith("× ")) return activeTheme.fg("error", line);
  if (line.startsWith("AgentGlass "))
    return `${activeTheme.fg("accent", "🛡")} ${activeTheme.bold(line)}`;
  if (line.startsWith("需要注意：")) return activeTheme.fg("warning", line);
  return line;
}

function alignedInfoLine(marker: string, label: string, text: string): string {
  // 固定可见宽度的标签列，避免中英文混排时依赖冒号对齐；内容只来自已脱敏的本地模板。
  const prefix = `${marker} ${label}`;
  const gap = " ".repeat(Math.max(2, 10 - visibleWidth(prefix)));
  return `${prefix}${gap}${text}`;
}

function formatOutcomeCardLines(
  lines: readonly string[],
  theme: PiTheme | undefined,
): string[] {
  const rows = lines.map((line, index) => {
    // 结论行保持原始开头，便于用户第一眼确认结果，也保留现有安全断言的语义锚点。
    if (index === 0) return styleWidgetLine(line, theme);

    const known = (prefix: string, marker: string, label: string): string =>
      alignedInfoLine(marker, label, line.slice(prefix.length).trim());

    if (line.startsWith("执行中：")) return known("执行中：", "…", "处理中");
    if (line.startsWith("已确认：")) return known("已确认：", "✓", "已核对");
    if (line.startsWith("还不能确认："))
      return known("还不能确认：", "?", "尚未确认");
    if (line.startsWith("已知："))
      return known("已知：", "✓", index === 1 ? "工具状态" : "文件核对");
    if (line.startsWith("未确认：")) return known("未确认：", "?", "工具状态");
    if (line.startsWith("仍未知：")) return known("仍未知：", "?", "仍未知");
    if (line.startsWith("检查范围："))
      return known("检查范围：", "•", "核对范围");
    if (line.startsWith("恢复：")) return known("恢复：", "↶", "恢复");
    if (line.startsWith("下一步：")) return known("下一步：", "›", "下一步");
    return styleWidgetLine(line, theme);
  });
  return rows;
}

function styleWidgetLines(
  lines: readonly string[],
  theme: PiTheme | undefined,
): string[] {
  return lines.map((line) => styleWidgetLine(line, theme));
}

function samePath(left: string, right: string): boolean {
  const normalizedLeft = path.resolve(left);
  const normalizedRight = path.resolve(right);
  return process.platform === "win32"
    ? normalizedLeft.toLowerCase() === normalizedRight.toLowerCase()
    : normalizedLeft === normalizedRight;
}

function safeDirectoryLabel(cwd: string): string {
  try {
    const base = path.basename(path.resolve(cwd));
    const visible = redactDisplayString(base)
      .replace(/\p{Cc}/gu, "")
      .trim();
    const bounded = [...(visible || "当前工作文件夹")];
    return bounded.length > 80
      ? `${bounded.slice(0, 79).join("")}…`
      : bounded.join("");
  } catch {
    return "当前工作文件夹（位置无法确认）";
  }
}

function setWelcomePanel(
  ctx: ExtensionContext,
  lines: readonly string[],
): void {
  if (ctx.mode !== "tui" || !ctx.hasUI) return;
  try {
    // 欢迎/帮助是同一入口的非审批信息面板；不创建第二套 UI，也不把面板文字送回风险层。
    ctx.ui.setWidget(
      WELCOME_WIDGET_KEY,
      styleWidgetLines(lines, currentPiTheme(ctx)),
    );
  } catch {
    // UI 失败只影响说明展示，不改变文件或恢复状态。
  }
}

function welcomeLines(cwd: string): readonly string[] {
  return Object.freeze([
    "AgentGlass 已启用",
    alignedInfoLine(
      "•",
      "当前项目",
      `${safeDirectoryLabel(cwd)}（完整路径不显示）`,
    ),
    alignedInfoLine("✓", "支持", "查看、创建或修改当前项目内的普通文本文件。"),
    alignedInfoLine("•", "变更", "先说明预期影响，再逐步取得明确同意。"),
    alignedInfoLine(
      "›",
      "命令",
      "输入 /agentglass 查看帮助、处理刚才的问题、开始文件任务或准备安全示例。",
    ),
    alignedInfoLine(
      "!",
      "前提",
      "Pi 已配置模型；AgentGlass 不提供安装器、账号或密钥。",
    ),
  ]);
}

function projectObservableUserGoal(prompt: string): ObservableUserGoal {
  // 目标原文只在事件到达时投影；原文不进入持久状态或风险判断。
  return Object.freeze({
    status: "observed",
    redactedText: projectTransientActionInput("observable-user-goal", prompt)
      .redactedInput,
  });
}

function helpSections(
  latestResult: readonly string[] | undefined,
  recovery: SessionRecoveryEntry | undefined,
): readonly HelpSection[] {
  const sections: HelpSection[] = [
    {
      title: "能力",
      items: [
        {
          marker: "✓",
          tone: "success",
          text: "查看、创建和修改已验证的普通项目文本文件；只核对卡片列出的文件。",
        },
        {
          marker: "×",
          tone: "error",
          text: "Shell、安装/部署、联网、批量删除、自定义或覆盖工具。",
        },
      ],
    },
    {
      title: "安全",
      items: [
        {
          marker: "•",
          tone: "text",
          text: "初始选择始终是“停止这一步”；“查看详情”不会同意。",
        },
        {
          marker: "•",
          tone: "text",
          text: "只有明确选择“继续这次修改”才会执行。",
        },
        {
          marker: "•",
          tone: "warning",
          text: "冲突、损坏、未知或切换会话后会停止；当前文件会被保留。",
        },
      ],
    },
    {
      title: "恢复",
      items: [
        {
          marker: "↶",
          tone: "accent",
          text: recovery
            ? `当前会话可恢复最近一次“${recovery.targetLabel}”；输入 /agentglass restore。`
            : "当前没有可用的最近恢复入口。",
        },
        {
          marker: "•",
          tone: "text",
          text: "清理只处理已验证归属的 AgentGlass 私有恢复数据；会单独说明影响并再次征求同意。",
        },
      ],
    },
    {
      title: "操作",
      items: [
        {
          marker: "›",
          tone: "accent",
          text: "/agentglass start  开始一个文件任务，生成可检查的中文请求草稿。",
        },
        {
          marker: "›",
          tone: "accent",
          text: "/agentglass process  处理刚才的阻止、核对或恢复冲突。",
        },
        {
          marker: "›",
          tone: "accent",
          text: "/agentglass example  准备安全示例，不覆盖已有同名目录或文件。",
        },
        {
          marker: "›",
          tone: "accent",
          text: "/agentglass restore  恢复最近一次支持的单文件修改。",
        },
        {
          marker: "›",
          tone: "accent",
          text: "/agentglass cleanup  清理已验证归属的恢复数据。",
        },
        {
          marker: "•",
          tone: "text",
          text: "让 Pi 直接查看当前项目文件；本入口不会启动 shell 或额外程序。",
        },
        {
          marker: "•",
          tone: "text",
          text: "切换目录后确认当前项目，再输入 /agentglass。",
        },
      ],
    },
    {
      title: "示例与前提",
      items: [
        {
          marker: "•",
          tone: "text",
          text: `示例目标 · ${EXAMPLE_GOAL}。示例目录本身不提供目录恢复；部分失败会保留已创建内容并如实说明。`,
        },
        {
          marker: "•",
          tone: "text",
          text: "Pi 需要已经配置模型；空白电脑安装、模型账号和安装器不属于 AgentGlass。",
        },
      ],
    },
    {
      title: "最近结果",
      items: latestResult
        ? formatOutcomeCardLines(latestResult, plainPiTheme).map((text) => ({
            marker: "",
            tone: "text" as const,
            text,
          }))
        : [
            {
              marker: "•",
              tone: "text",
              text: "本次会话还没有 AgentGlass 文件结果。",
            },
          ],
    },
  ];
  return Object.freeze(
    sections.map((section) =>
      Object.freeze({ ...section, items: Object.freeze([...section.items]) }),
    ),
  );
}

function renderHelpItem(
  item: HelpItem,
  width: number,
  theme: PiTheme,
): string[] {
  const prefix = item.marker ? `  ${item.marker} ` : "  ";
  const prefixWidth = visibleWidth(prefix);
  const wrapped = wrapTextWithAnsi(item.text, Math.max(1, width - prefixWidth));
  return wrapped.map((line, index) => {
    const indent = index === 0 ? prefix : " ".repeat(prefixWidth);
    return `${indent}${theme.fg(item.tone, line)}`;
  });
}

function renderHelpBody(
  sections: readonly HelpSection[],
  width: number,
  theme: PiTheme,
): string[] {
  const lines: string[] = [];
  sections.forEach((section, index) => {
    if (index > 0) lines.push("");
    lines.push(theme.bold(theme.fg("accent", section.title)));
    for (const item of section.items)
      lines.push(...renderHelpItem(item, width, theme));
  });
  return lines;
}

function compactHelpLines(
  cwd: string,
  recovery: SessionRecoveryEntry | undefined,
): readonly string[] {
  return Object.freeze([
    "AgentGlass 帮助",
    alignedInfoLine("•", "当前项目", safeDirectoryLabel(cwd)),
    alignedInfoLine("✓", "能力", "查看、创建和修改普通项目文本文件。"),
    alignedInfoLine(
      "×",
      "限制",
      "Shell、安装/部署、联网、批量删除、自定义工具。",
    ),
    alignedInfoLine("!", "安全", "默认停止；查看详情不等于同意。"),
    recovery
      ? alignedInfoLine(
          "↶",
          "恢复",
          `可恢复“${recovery.targetLabel}”；输入 /agentglass restore。`,
        )
      : alignedInfoLine("↶", "恢复", "当前没有可用的最近恢复入口。"),
    alignedInfoLine(
      "›",
      "操作",
      "/agentglass process / example / restore / cleanup",
    ),
    alignedInfoLine("·", "关闭", "Enter 或 Esc。"),
  ]);
}

const STARTER_PATH_LIMIT_BYTES = 1024;
const STARTER_FIELD_LIMIT_BYTES = 4096;
const STARTER_DRAFT_LIMIT_BYTES = 8192;
const STARTER_CANCELLED = "已取消：没有修改文件或输入框。";
const STARTER_INVALIDATED =
  "当前任务或文件夹已变化，这次引导已结束。请重新打开入口。";
const STARTER_INPUT_CHANGED =
  "输入框在引导期间发生变化，这次引导已结束。请先处理现有内容后重新打开入口。";
const MENU_UNAVAILABLE =
  "暂时无法打开 AgentGlass 菜单。请在 Pi TUI 中重新打开 /agentglass。";
const STARTER_UNAVAILABLE =
  "暂时无法打开任务引导。请在 Pi TUI 中重新打开 /agentglass。";
const STARTER_BUSY =
  "Pi 正在处理任务，暂时不能开始引导。请等它空闲后重新打开入口。";
const STARTER_EDITOR_UNAVAILABLE = "无法确认请求是否填入，请先查看输入框。";
const STARTER_ESCAPE = String.fromCharCode(27);
const STARTER_BELL = String.fromCharCode(7);
const STARTER_CONTROL_SEQUENCE = new RegExp(
  `(?:${STARTER_ESCAPE}\\[|${String.fromCharCode(155)})[0-?]*[ -/]*[@-~]`,
  "gu",
);
const STARTER_OPERATING_SYSTEM_COMMAND = new RegExp(
  `${STARTER_ESCAPE}\\][^${STARTER_BELL}]*(?:${STARTER_BELL}|${STARTER_ESCAPE}\\\\)`,
  "gu",
);

type StarterTask = "create" | "polish" | "organize";

interface StarterIdentity {
  sessionId: string;
  cwd: string;
}

interface StarterContext extends StarterIdentity {
  generation: number;
}

interface StarterProjection {
  text: string;
  changed: boolean;
}

interface GuidanceDraft {
  text: string;
  projectedTextChanged: boolean;
}

interface StarterDraftFields {
  path: string;
  request: string;
  preserve: string;
}

type RecentGuidanceCategory =
  | "batch_mutation"
  | "batch_context_unknown"
  | "verification_matched"
  | "verification_mismatch"
  | "verification_unknown"
  | "recovery_complete"
  | "recovery_conflict"
  | "recovery_failed"
  | "user_cancellation"
  | "other_result"
  | "other_blocked";

interface RecentGuidanceSeed {
  sessionId: string;
  cwd: string;
  category: RecentGuidanceCategory;
  actionId?: string;
  effectId?: string;
  targetId?: string;
  relativeTarget?: string;
}

interface RecentGuidanceContext extends RecentGuidanceSeed {
  revision: number;
}

function starterUiIsAvailable(ctx: ExtensionContext): boolean {
  try {
    const ui = ctx.ui as unknown as Record<string, unknown>;
    return (
      typeof ui.select === "function" &&
      typeof ui.input === "function" &&
      typeof ui.getEditorText === "function" &&
      typeof ui.setEditorText === "function"
    );
  } catch {
    return false;
  }
}

function starterInitialState(
  ctx: ExtensionContext,
): "ok" | "busy" | "unavailable" {
  try {
    if (
      ctx.mode !== "tui" ||
      !ctx.hasUI ||
      !starterUiIsAvailable(ctx) ||
      !nonEmptyString(ctx.sessionManager.getSessionId()) ||
      !nonEmptyString(ctx.cwd)
    )
      return "unavailable";
    return ctx.isIdle() ? "ok" : "busy";
  } catch {
    return "unavailable";
  }
}

function starterIdentity(ctx: ExtensionContext): StarterIdentity | undefined {
  try {
    const sessionId = ctx.sessionManager.getSessionId();
    if (!nonEmptyString(sessionId) || !nonEmptyString(ctx.cwd))
      return undefined;
    return Object.freeze({ sessionId, cwd: ctx.cwd });
  } catch {
    return undefined;
  }
}

function starterStateIsCurrent(
  ctx: ExtensionContext,
  expected: StarterContext,
  currentGeneration: number,
): "ok" | "busy" | "stale" | "unavailable" {
  try {
    if (ctx.mode !== "tui" || !ctx.hasUI || !starterUiIsAvailable(ctx))
      return "unavailable";
    const currentSession = ctx.sessionManager.getSessionId();
    if (
      !nonEmptyString(currentSession) ||
      currentSession !== expected.sessionId ||
      ctx.cwd !== expected.cwd ||
      currentGeneration !== expected.generation
    )
      return "stale";
    return ctx.isIdle() ? "ok" : "busy";
  } catch {
    return "unavailable";
  }
}

function starterEditorState(
  ctx: ExtensionContext,
): "empty" | "non_empty" | "unavailable" {
  try {
    const text = ctx.ui.getEditorText();
    if (typeof text !== "string") return "unavailable";
    return text.length === 0 ? "empty" : "non_empty";
  } catch {
    return "unavailable";
  }
}

function starterSafeText(value: string): string {
  // 草稿是给用户检查的普通文字：先隐藏确定的秘密，再移除完整终端序列和残余控制符，
  // 最后再次脱敏，防止控制序列拆开凭据形状。异常由调用者处理，绝不回退到 raw 文本。
  return redactDisplayString(
    redactDisplayString(value)
      .replace(STARTER_OPERATING_SYSTEM_COMMAND, "")
      .replace(STARTER_CONTROL_SEQUENCE, "")
      .replace(/\p{Cc}/gu, ""),
  );
}

function starterProjection(value: string): StarterProjection | undefined {
  // 自由文本只在本次表单调用栈中短暂存在：先脱敏、再移除终端控制、再脱敏，
  // 最后才检查字节上限。任何处理异常都返回 undefined，避免把 raw 文本带入草稿。
  if (Buffer.byteLength(value, "utf8") > STARTER_FIELD_LIMIT_BYTES)
    return undefined;
  try {
    const text = starterSafeText(value);
    if (Buffer.byteLength(text, "utf8") > STARTER_FIELD_LIMIT_BYTES)
      return undefined;
    return Object.freeze({ text, changed: text !== value });
  } catch {
    return undefined;
  }
}

function starterPath(value: string): string | undefined {
  // 路径只做无歧义的相对格式检查，不查存在性、不枚举目录；真实文件身份和安全性
  // 仍由用户发送后的 read/write/edit 完整信任链决定。脱敏或控制过滤改变路径时拒绝定向草稿。
  if (
    Buffer.byteLength(value, "utf8") > STARTER_PATH_LIMIT_BYTES ||
    value.trim().length === 0
  )
    return undefined;
  const normalized = value.replaceAll("\\", "/");
  if (
    normalized.startsWith("/") ||
    /^[A-Za-z]:/.test(normalized) ||
    (process.platform === "win32" && normalized.includes(":"))
  )
    return undefined;
  const segments = normalized.split("/");
  if (
    segments.some(
      (segment) => segment.length === 0 || segment === "." || segment === "..",
    )
  )
    return undefined;
  try {
    const safe = starterSafeText(normalized);
    return safe === normalized &&
      Buffer.byteLength(safe, "utf8") <= STARTER_PATH_LIMIT_BYTES
      ? safe
      : undefined;
  } catch {
    return undefined;
  }
}

function safeRelativeGuidanceTarget(
  input: HostExecutionFacts["input"],
): string | undefined {
  try {
    const redactedPath = (input.redactedInput as { path?: unknown }).path;
    // 只保存分类阶段已脱敏、且 supportedPath/sensitive 已通过的原始相对路径投影；
    // 它与同一 action 的 targetId/前像绑定，不再在结果回调里从 canonical 绝对路径
    // 反推，避免 Windows 宿主 cwd、大小写或短路径表示差异把安全目标误判为未知。
    return typeof redactedPath === "string"
      ? starterPath(redactedPath)
      : undefined;
  } catch {
    return undefined;
  }
}

const sequentialGuidanceReasons = new Set([
  "BATCH_MUTATION_BLOCKED",
  "BATCH_CONTEXT_UNKNOWN",
  "PREFLIGHT_FAILED",
  "FILE_MODIFY",
  "FILE_CREATE",
  "KNOWN_READ_ONLY",
]);

function canOfferSequentialDraft(risk: RiskAssessment): boolean {
  // 顺序草稿只解释 Alpha 的 sibling 门；敏感、越界、未知、完整性或不支持等
  // 任何额外原因都不能被“每次一个文件”掩盖，必须保留更严格的固定阻止说明。
  return risk.reasonCodes.every((code) => sequentialGuidanceReasons.has(code));
}

function starterTask(choice: string | undefined): StarterTask | undefined {
  if (choice === "创建说明") return "create";
  if (choice === "润色文案") return "polish";
  if (choice === "整理文本") return "organize";
  return undefined;
}

function starterDraft(
  task: StarterTask,
  fields: StarterDraftFields,
): GuidanceDraft | undefined {
  const path = starterPath(fields.path);
  const request = starterProjection(fields.request);
  const preserve = starterProjection(fields.preserve);
  if (!path || !request || !preserve) return undefined;
  const preserveLine = preserve.text.trim().length
    ? preserve.text
    : "无特别指定。";
  const taskLine =
    task === "create"
      ? "请为这个文件创建一份说明。"
      : task === "polish"
        ? "请先查看这个文件，再按要求润色文案。"
        : "请先查看这个文件，再按要求整理文本结构。";
  const missingLine =
    task === "create"
      ? "如果文件已经存在，请先查看并说明，不要直接覆盖；每次只提出一个文件变更。"
      : "如果文件不存在或无法安全确认，请先说明，不要自行创建替代文件。";
  const text = [
    taskLine,
    `文件：${path}`,
    `要求：${request.text}`,
    `保留内容：${preserveLine}`,
    missingLine,
    "不安装、不运行程序；任何文件修改仍需逐次确认。",
  ].join("\n");
  return Buffer.byteLength(text, "utf8") <= STARTER_DRAFT_LIMIT_BYTES
    ? Object.freeze({
        text,
        projectedTextChanged: request.changed || preserve.changed,
      })
    : undefined;
}

async function showHelpOverlay(
  ctx: ExtensionContext,
  cwd: string,
  sections: readonly HelpSection[],
): Promise<void> {
  await ctx.ui.custom<void>(
    (tui, rawTheme, keybindings, done) => {
      const theme = usablePiTheme(rawTheme);
      let scrollOffset = 0;
      let bodyHeight = 1;
      let bodyLineCount = 0;

      const requestScroll = (delta: number): void => {
        const maxOffset = Math.max(0, bodyLineCount - bodyHeight);
        const next = Math.max(0, Math.min(maxOffset, scrollOffset + delta));
        if (next === scrollOffset) return;
        scrollOffset = next;
        tui.requestRender();
      };

      const row = (content: string, width: number): string => {
        const innerWidth = Math.max(1, width - 2);
        const contentWidth = Math.max(1, innerWidth - 2);
        const safe = truncateToWidth(content, contentWidth, "");
        const padded = ` ${safe}${" ".repeat(Math.max(0, contentWidth - visibleWidth(safe)))} `;
        return `${theme.fg("border", "│")}${theme.bg("customMessageBg", padded)}${theme.fg("border", "│")}`;
      };

      return {
        render(width: number): string[] {
          // 浮层高度与终端同步，固定边框/标题/页脚后把剩余空间交给正文滚动；
          // 极小终端仍返回可渲染的最小面板，不会把帮助文本写入文件或状态。
          const terminalRows = Number.isFinite(tui.terminal.rows)
            ? tui.terminal.rows
            : 24;
          const panelHeight = Math.max(
            1,
            Math.min(
              22,
              Math.floor(terminalRows * 0.88),
              Math.max(1, terminalRows - 2),
            ),
          );
          bodyHeight = Math.max(1, panelHeight - 7);
          const panelWidth = Math.max(8, width);
          const contentWidth = Math.max(1, panelWidth - 4);
          const body = renderHelpBody(sections, contentWidth, theme);
          bodyLineCount = body.length;
          const maxOffset = Math.max(0, bodyLineCount - bodyHeight);
          scrollOffset = Math.min(scrollOffset, maxOffset);
          const visible = body.slice(scrollOffset, scrollOffset + bodyHeight);
          const first = bodyLineCount === 0 ? 0 : scrollOffset + 1;
          const last = Math.min(bodyLineCount, scrollOffset + visible.length);
          const footer =
            panelWidth >= 58
              ? `↑↓ 滚动 · PgUp/PgDn 翻页 · Enter/Esc 关闭   ${first}–${last} / ${bodyLineCount}`
              : `↑↓/PgUp/PgDn 滚动 · Esc 关闭   ${first}–${last}/${bodyLineCount}`;
          const horizontal = (left: string, right: string): string =>
            theme.fg(
              "border",
              `${left}${"─".repeat(Math.max(1, panelWidth - 2))}${right}`,
            );

          return [
            horizontal("╭", "╮"),
            row(
              theme.bold(theme.fg("accent", "🛡 AgentGlass 帮助")),
              panelWidth,
            ),
            row(
              theme.fg("muted", `当前项目 · ${safeDirectoryLabel(cwd)}`),
              panelWidth,
            ),
            horizontal("├", "┤"),
            ...visible.map((line) => row(line, panelWidth)),
            horizontal("├", "┤"),
            row(theme.fg("muted", footer), panelWidth),
            horizontal("╰", "╯"),
          ];
        },
        invalidate(): void {},
        handleInput(data: string): void {
          if (
            keybindings.matches(data, "tui.select.cancel") ||
            keybindings.matches(data, "tui.select.confirm")
          ) {
            done();
            return;
          }
          if (keybindings.matches(data, "tui.select.up")) {
            requestScroll(-1);
            return;
          }
          if (keybindings.matches(data, "tui.select.down")) {
            requestScroll(1);
            return;
          }
          if (keybindings.matches(data, "tui.select.pageUp")) {
            requestScroll(-Math.max(1, bodyHeight - 1));
            return;
          }
          if (keybindings.matches(data, "tui.select.pageDown"))
            requestScroll(Math.max(1, bodyHeight - 1));
        },
        dispose(): void {},
      };
    },
    {
      overlay: true,
      overlayOptions: {
        anchor: "center",
        width: 92,
        maxHeight: "88%",
        margin: 1,
      },
    },
  );
}

async function inspectExamplePlan(
  cwd: string,
): Promise<ExamplePlan | "conflict" | undefined> {
  // 示例是唯一允许 AgentGlass 自己准备目录的固定路径：先确认当前 cwd 是真实普通目录，
  // 再确认直接子目录不存在。这里不复用普通 write 的隐式父目录逻辑，也不接受用户路径。
  try {
    if (!nonEmptyString(cwd) || !path.isAbsolute(cwd)) return;
    const cwdStats = await lstat(cwd);
    if (cwdStats.isSymbolicLink() || !cwdStats.isDirectory()) return;
    const realCwd = await realpath(cwd);
    const realCwdStats = await lstat(realCwd);
    // Windows runner 可能用 8.3 短路径传入 cwd；文字不同不代表越界，
    // 用真实目录身份确认它仍是同一个普通目录，同时保留直接符号链接拒绝。
    if (
      realCwdStats.isSymbolicLink() ||
      !realCwdStats.isDirectory() ||
      String(realCwdStats.dev) !== String(cwdStats.dev) ||
      String(realCwdStats.ino) !== String(cwdStats.ino)
    )
      return;
    const directory = path.join(realCwd, EXAMPLE_DIRECTORY_NAME);
    const file = path.join(directory, EXAMPLE_FILE_NAME);
    if (!samePath(path.dirname(directory), realCwd)) return;
    try {
      await lstat(directory);
      return "conflict";
    } catch (error) {
      if (
        !error ||
        typeof error !== "object" ||
        !("code" in error) ||
        error.code !== "ENOENT"
      )
        return;
    }
    return {
      cwd,
      realCwd,
      cwdIdentity: { dev: String(cwdStats.dev), ino: String(cwdStats.ino) },
      directory,
      file,
    };
  } catch {
    return;
  }
}

async function examplePlanIsCurrent(
  plan: ExamplePlan,
  ctx: ExtensionContext,
): Promise<boolean> {
  // 审批等待期间重新核对 cwd 身份和固定目标，避免把批准带到切换后的目录或竞态创建的目录。
  try {
    if (
      !samePath(ctx.cwd, plan.cwd) ||
      !samePath(await realpath(ctx.cwd), plan.realCwd)
    )
      return false;
    const cwdStats = await lstat(ctx.cwd);
    if (
      cwdStats.isSymbolicLink() ||
      !cwdStats.isDirectory() ||
      String(cwdStats.dev) !== plan.cwdIdentity.dev ||
      String(cwdStats.ino) !== plan.cwdIdentity.ino
    )
      return false;
  } catch {
    return false;
  }
  try {
    await lstat(plan.directory);
    return false;
  } catch (error) {
    return Boolean(
      error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "ENOENT",
    );
  }
}

async function requestOutcomeApproval(
  ctx: ExtensionContext,
  card: OutcomeCard,
  pendingCancels: Set<() => void>,
): Promise<"continue" | "stop"> {
  const signal = ctx.signal;
  if (ctx.mode !== "tui" || !ctx.hasUI || signal?.aborted) return "stop";

  let cancelPrompt = (): void => {};
  let submitted: "continue" | "stop" | undefined;
  try {
    const result = await ctx.ui.custom<"continue" | "stop" | undefined>(
      (tui, _theme, keybindings, done) => {
        const labels = ["停止这一步", "查看详情", "继续这次修改"] as const;
        let selected = 0;
        let expanded = false;
        let settled = false;
        const settle = (choice: "continue" | "stop"): void => {
          if (settled) return;
          settled = true;
          submitted = choice;
          pendingCancels.delete(cancel);
          signal?.removeEventListener("abort", cancel);
          done(choice);
        };
        const cancel = (): void => settle("stop");
        cancelPrompt = cancel;
        pendingCancels.add(cancel);
        signal?.addEventListener("abort", cancel, { once: true });

        return {
          render(width: number): string[] {
            const theme = usablePiTheme(_theme);
            const button = (label: string, index: number): string => {
              const marker = selected === index ? theme.fg("accent", "›") : " ";
              const text = `${marker} ${selected === index ? theme.bold(`[当前] ${label}`) : `[ ] ${label}`}`;
              return selected === index
                ? theme.bg("selectedBg", text)
                : theme.fg("muted", text);
            };
            const buttons = labels.map(button);
            const content = [
              theme.fg(
                card.title.startsWith("已停止") ? "error" : "accent",
                theme.bold(`🛡 ${card.title}`),
              ),
              theme.fg("text", `› ${card.expectedOutcome}`),
              theme.fg("warning", `! ${card.attention}`),
              theme.fg("accent", `↶ ${card.recovery}`),
              ...(expanded ? ["详情：", ...card.details] : []),
              "",
              // 操作始终逐行显示，避免横向排列时把“继续”误读成默认动作。
              ...buttons,
              "方向键选择，Enter 确认，Esc 停止。查看详情不会批准修改。",
            ];
            return content.flatMap((line) => wrapLine(line, width));
          },
          invalidate(): void {},
          handleInput(data: string): void {
            if (settled) return;
            if (keybindings.matches(data, "tui.select.cancel")) {
              cancel();
              return;
            }
            if (keybindings.matches(data, "tui.select.up")) {
              selected = (selected + labels.length - 1) % labels.length;
              tui.requestRender();
              return;
            }
            if (
              keybindings.matches(data, "tui.select.down") ||
              keybindings.matches(data, "tui.input.tab")
            ) {
              selected = (selected + 1) % labels.length;
              tui.requestRender();
              return;
            }
            if (!keybindings.matches(data, "tui.select.confirm")) return;
            if (selected === 0) cancel();
            if (selected === 1) {
              expanded = !expanded;
              tui.requestRender();
            }
            if (selected === 2) settle("continue");
          },
          dispose(): void {
            pendingCancels.delete(cancel);
            signal?.removeEventListener("abort", cancel);
            cancel();
          },
        };
      },
    );
    return result === "continue" && submitted === "continue" && !signal?.aborted
      ? result
      : "stop";
  } catch {
    return "stop";
  } finally {
    cancelPrompt();
  }
}

function sameApprovalFacts(
  left: HostExecutionFacts,
  leftRisk: RiskAssessment,
  right: HostExecutionFacts,
  rightRisk: RiskAssessment,
): boolean {
  // 这些对象已脱敏且由 Core 以固定字段顺序生成；比较完整事实避免只盯路径标签或指纹。
  return (
    JSON.stringify(left.action) === JSON.stringify(right.action) &&
    JSON.stringify(leftRisk) === JSON.stringify(rightRisk) &&
    left.tool.status === right.tool.status &&
    left.capabilities.interaction === right.capabilities.interaction &&
    left.capabilities.canPromptForApproval ===
      right.capabilities.canPromptForApproval
  );
}

function transientExecutionBinding(
  transient: TransientHostExecutionInput,
): Readonly<ExecutionBinding> {
  return Object.freeze({
    fingerprint: fingerprintTransientActionInput(
      transient.tool.name,
      transient.rawInput,
    ),
    toolName: transient.tool.name,
    cwd: transient.cwd,
    sessionId: transient.sessionId,
    hostExecutionId: transient.hostExecutionId,
    toolCallId: transient.toolCallId,
  });
}

function sameRuntimeEnvelope(
  transient: TransientHostExecutionInput,
  facts: HostExecutionFacts,
): boolean {
  return (
    transient.tool.status === facts.tool.status &&
    transient.capabilities.interaction === facts.capabilities.interaction &&
    transient.capabilities.canPromptForApproval ===
      facts.capabilities.canPromptForApproval &&
    JSON.stringify(transient.siblings) === JSON.stringify(facts.siblings)
  );
}

function ownDataValue(input: unknown, key: string): unknown {
  if (!input || typeof input !== "object" || Array.isArray(input)) return;
  const descriptor = Object.getOwnPropertyDescriptor(input, key);
  return descriptor && "value" in descriptor ? descriptor.value : undefined;
}

async function prepareExpectedPostcondition(
  event: ToolCallEvent,
  ctx: ExtensionContext,
  facts: HostExecutionFacts,
  effect: PredictedEffect,
  target: NonNullable<
    Awaited<ReturnType<typeof resolveSensitiveSnapshotTarget>>
  >,
): Promise<ExpectedFilePostcondition> {
  const before = target.targetExisted
    ? await readStableFile(target.targetPath, FILE_OBSERVATION_LIMIT_BYTES)
    : undefined;
  const base = {
    actionId: facts.action.actionId,
    effectId: effect.effectId,
    targetId: effect.targetId,
    beforeSha256: before ? hashFileBytes(before.bytes) : null,
    beforeIdentity: before?.identity ?? null,
    targetExisted: target.targetExisted,
  } as const;

  if (facts.action.kind === "write") {
    const content = ownDataValue(event.input, "content");
    if (typeof content !== "string") throw new Error();
    const bytes = Buffer.from(content, "utf8");
    return Object.freeze({
      ...base,
      kind: "exact_bytes",
      expectedSha256: hashFileBytes(bytes),
      expectedByteLength: bytes.length,
    });
  }

  if (facts.action.kind !== "edit" || !before) throw new Error();
  let finalContent: string | undefined;
  try {
    // 直接调用锁定 Pi 0.85.1 的 edit 实现，只把文件操作替换为内存读写；这样匹配、
    // 歧义、NFKC、BOM 与换行语义和真正执行保持一致，又不保存编辑正文用于稍后重放。
    const definition = createEditToolDefinition(ctx.cwd, {
      operations: {
        access: async () => {},
        readFile: async () => before.bytes,
        writeFile: async (_path, content) => {
          finalContent = content;
        },
      },
    });
    await definition.execute(
      "agentglass-expected-postcondition",
      event.input as EditToolInput,
      undefined,
      undefined,
      ctx,
    );
  } catch {
    return Object.freeze({
      ...base,
      kind: "content_changed",
      expectedSha256: null,
      expectedByteLength: null,
    });
  }
  if (finalContent === undefined) throw new Error();
  const bytes = Buffer.from(finalContent, "utf8");
  return Object.freeze({
    ...base,
    kind: "exact_bytes",
    expectedSha256: hashFileBytes(bytes),
    expectedByteLength: bytes.length,
  });
}

function resultBindingMatches(
  pi: ExtensionAPI,
  pending: Pick<PendingVerification, "binding">,
  toolCallId: string,
  toolName: string,
  input: unknown,
  ctx: ExtensionContext,
): boolean {
  try {
    const currentSession = ctx.sessionManager.getSessionId();
    return (
      nonEmptyString(currentSession) &&
      pending.binding.sessionId === currentSession &&
      pending.binding.cwd === ctx.cwd &&
      pending.binding.toolCallId === toolCallId &&
      pending.binding.hostExecutionId ===
        hostExecutionId(currentSession, toolCallId) &&
      pending.binding.toolName === toolName &&
      mapToolIdentity(toolName, configuredTools(pi)).status ===
        "verified_builtin" &&
      fingerprintTransientActionInput(toolName, input).value ===
        pending.binding.fingerprint.value
    );
  } catch {
    return false;
  }
}

function setActionCard(
  ctx: ExtensionContext,
  update: ReturnType<typeof renderOutcomeCardUpdate>,
): void {
  if (ctx.mode !== "tui" || !ctx.hasUI) return;
  try {
    // modal 在 Continue 后由 Pi 关闭；稳定 key 让同一逻辑动作卡在原位置区域进入执行/结果态。
    ctx.ui.setWidget(
      ACTION_CARD_KEY,
      formatOutcomeCardLines(update.lines, currentPiTheme(ctx)),
    );
  } catch {
    // 展示失败不能改写已经完成的文件事实，也不能泄漏宿主异常文本。
  }
}

function setReadStatus(ctx: ExtensionContext, text: string): void {
  if (ctx.mode !== "tui" || !ctx.hasUI) return;
  try {
    ctx.ui.setStatus(READ_STATUS_KEY, text);
  } catch {
    // 结果提示失败不能反过来篡改工具结果或泄漏 UI 异常。
  }
}

export function mapPiCapabilities(
  mode: ExtensionContext["mode"],
  hasUI: boolean,
): HostCapabilities {
  if (mode === "tui" && hasUI) {
    return Object.freeze({
      interaction: "local_interactive",
      canPromptForApproval: "yes",
    });
  }
  if (mode === "rpc" && hasUI) {
    // Pi RPC 有 dialog transport，但 Alpha 的安全审批只接受本地 TUI 卡片。
    return Object.freeze({
      interaction: "remote_interactive",
      canPromptForApproval: "no",
    });
  }
  if (mode === "json" && !hasUI) {
    return Object.freeze({
      interaction: "event_stream",
      canPromptForApproval: "no",
    });
  }
  if (mode === "print" && !hasUI) {
    return Object.freeze({
      interaction: "one_shot",
      canPromptForApproval: "no",
    });
  }
  return Object.freeze({
    interaction: "unknown",
    canPromptForApproval: "unknown",
  });
}

function mapToolIdentity(
  name: string,
  tools: readonly ToolInfo[],
): HostToolIdentity {
  const matches = tools.filter((tool) => tool.name === name);
  if (matches.length !== 1) {
    return Object.freeze({ name, status: "unknown" });
  }
  const source = matches[0]?.sourceInfo;
  if (
    !source ||
    !nonEmptyString(source.path) ||
    !nonEmptyString(source.source) ||
    !nonEmptyString(source.scope) ||
    !nonEmptyString(source.origin)
  ) {
    return Object.freeze({ name, status: "unknown" });
  }
  const isLockedBuiltin =
    knownBuiltinNames.has(name) &&
    source?.source === "builtin" &&
    source.path === `<builtin:${name}>` &&
    source.scope === "temporary" &&
    source.origin === "top-level";
  if (isLockedBuiltin) {
    return Object.freeze({ name, status: "verified_builtin" });
  }
  return Object.freeze({
    name,
    status: protectedBuiltinNames.has(name) ? "overridden" : "external",
  });
}

function currentSiblingCalls(ctx: ExtensionContext): Array<{
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}> {
  const leaf = ctx.sessionManager.getLeafEntry();
  if (
    leaf?.type !== "message" ||
    leaf.message.role !== "assistant" ||
    !Array.isArray(leaf.message.content)
  ) {
    throw new SiblingContextError();
  }

  const calls: Array<{
    id: string;
    name: string;
    arguments: Record<string, unknown>;
  }> = [];
  for (const item of leaf.message.content) {
    if (!item || typeof item !== "object" || item.type !== "toolCall") continue;
    if (
      !nonEmptyString(item.id) ||
      !nonEmptyString(item.name) ||
      !item.arguments ||
      typeof item.arguments !== "object" ||
      Array.isArray(item.arguments)
    ) {
      throw new SiblingContextError();
    }
    calls.push({
      id: item.id,
      name: item.name,
      arguments: item.arguments as Record<string, unknown>,
    });
  }
  if (
    calls.length === 0 ||
    new Set(calls.map((call) => call.id)).size !== calls.length
  ) {
    throw new SiblingContextError();
  }
  return calls;
}

function configuredTools(pi: ExtensionAPI): readonly ToolInfo[] {
  try {
    const tools = pi.getAllTools();
    return Array.isArray(tools) ? tools : [];
  } catch {
    // 工具注册表不可读时保留 unknown，不能靠事件名字猜成内置实现。
    return [];
  }
}

function mapToolCall(
  pi: ExtensionAPI,
  event: ToolCallEvent,
  ctx: ExtensionContext,
  expectedSessionId: string | undefined,
  userGoal: ObservableUserGoal,
): readonly TransientHostExecutionInput[] {
  if (!nonEmptyString(event.toolCallId)) {
    throw new Error();
  }
  if (!nonEmptyString(event.toolName)) {
    throw new Error();
  }

  let sessionId: string;
  try {
    sessionId = ctx.sessionManager.getSessionId();
  } catch {
    throw new Error();
  }
  if (!nonEmptyString(sessionId) || !expectedSessionId) {
    throw new Error();
  }
  if (sessionId !== expectedSessionId) {
    throw new Error();
  }
  if (!nonEmptyString(ctx.cwd)) {
    throw new Error();
  }

  const tools = configuredTools(pi);
  const siblings = currentSiblingCalls(ctx);
  const currentMatches = siblings.filter(
    (call) => call.id === event.toolCallId && call.name === event.toolName,
  );
  if (currentMatches.length !== 1) {
    throw new SiblingContextError();
  }

  const references = Object.freeze(
    siblings.map(
      (call): SiblingExecutionReference =>
        Object.freeze({
          hostExecutionId: hostExecutionId(sessionId, call.id),
          toolCallId: call.id,
          tool: mapToolIdentity(call.name, tools),
        }),
    ),
  );

  // sibling raw input 仅供本次 preflight 分类；当前调用采用事件里的有效 input，避免使用旧消息副本。
  return Object.freeze(
    siblings.map((call) => ({
      hostExecutionId: hostExecutionId(sessionId, call.id),
      toolCallId: call.id,
      sessionId,
      cwd: ctx.cwd,
      tool: mapToolIdentity(call.name, tools),
      capabilities: mapPiCapabilities(ctx.mode, ctx.hasUI),
      siblings: references,
      userGoal,
      rawInput: call.id === event.toolCallId ? event.input : call.arguments,
    })),
  );
}

async function assessMappedBatch(
  batch: readonly TransientHostExecutionInput[],
  toolCallId: string,
): Promise<{
  facts: HostExecutionFacts;
  risk: RiskAssessment;
  hasStrictSiblingReason: boolean;
}> {
  const executionInput = await loadExecutionInputModule();
  if (!executionInput) throw new Error();
  const facts = await Promise.all(
    batch.map(executionInput.projectHostExecutionInput),
  );
  const current = facts.find((item) => item.toolCallId === toolCallId);
  if (!current) throw new Error();
  return {
    facts: current,
    risk: assessSiblingMutationRisk(
      current.action,
      facts.map((item) => item.action),
    ),
    hasStrictSiblingReason: facts.some((item) =>
      assessRisk(item.action).reasonCodes.some(
        (code) => !sequentialGuidanceReasons.has(code),
      ),
    ),
  };
}

export function registerPiAdapter(
  pi: ExtensionAPI,
  observe: AdapterObserver = () => {},
  snapshotRoot?: string,
): void {
  let sessionId: string | undefined;
  let userGoal: ObservableUserGoal = Object.freeze({ status: "unknown" });
  // pending 只保存不透明身份字符串；raw input、goal 原文和 Pi event/ctx 都不会进入此 Map。
  const activeExecutions = new Map<
    string,
    {
      hostExecutionId: string;
      toolName: string;
      cwd: string;
      guidanceOrder: number;
    }
  >();
  const pendingVerifications = new Map<string, PendingVerification>();
  const pendingReads = new Map<
    string,
    { binding: Readonly<ExecutionBinding> }
  >();
  const pendingTokens = new Set<ApprovalToken>();
  const pendingApprovalCancels = new Set<() => void>();
  let latestRecovery: SessionRecoveryEntry | undefined;
  let latestResult: readonly string[] | undefined;
  let recentGuidance: RecentGuidanceContext | undefined;
  let guidanceSequence = 0;
  let publishedGuidanceOrder = 0;
  let guidanceRevision = 0;
  let welcomedCwd: string | undefined;
  let runGeneration = 0;
  let starterGeneration = 0;

  const currentIdentity = (
    ctx: ExtensionContext,
  ): StarterIdentity | undefined => starterIdentity(ctx);

  const clearRecentGuidance = (): void => {
    // 代次边界会让迟到的旧结果永远排在清理标记之前；这里只清理当前会话的
    // 脱敏关联，不触碰 Pi 对话历史、工具输入、快照正文或用户输入框内容。
    publishedGuidanceOrder = ++guidanceSequence;
    recentGuidance = undefined;
  };

  const currentRecentGuidance = (
    ctx: ExtensionContext,
  ): RecentGuidanceContext | undefined => {
    if (!recentGuidance) return undefined;
    const identity = currentIdentity(ctx);
    if (
      !identity ||
      identity.sessionId !== recentGuidance.sessionId ||
      identity.cwd !== recentGuidance.cwd
    ) {
      clearRecentGuidance();
      return undefined;
    }
    return recentGuidance;
  };

  const publishGuidance = (
    ctx: ExtensionContext,
    seed: RecentGuidanceSeed,
    order: number,
  ): boolean => {
    const identity = currentIdentity(ctx);
    if (
      !identity ||
      identity.sessionId !== seed.sessionId ||
      identity.cwd !== seed.cwd ||
      order < publishedGuidanceOrder
    )
      return false;
    publishedGuidanceOrder = order;
    recentGuidance = Object.freeze({
      ...seed,
      revision: ++guidanceRevision,
    });
    return true;
  };

  const publishResult = (
    ctx: ExtensionContext,
    lines: readonly string[],
    seed: RecentGuidanceSeed,
    order: number,
  ): boolean => {
    if (!publishGuidance(ctx, seed, order)) return false;
    latestResult = Object.freeze([...lines]);
    return true;
  };

  const beginGuidanceOperation = (): number => {
    // 内部命令也必须在第一个 await 前取得启动代次；完成时沿用这次代次，
    // 这样期间发布的新工具结果、会话边界或 cwd 清理都能拒绝迟到旧结果。
    return ++guidanceSequence;
  };

  const actionGuidance = (
    facts: HostExecutionFacts,
    category: RecentGuidanceCategory,
    effect?: PredictedEffect,
  ): RecentGuidanceSeed => ({
    sessionId: facts.sessionId,
    cwd: facts.cwd,
    category,
    actionId: facts.action.actionId,
    ...(effect ? { effectId: effect.effectId, targetId: effect.targetId } : {}),
  });

  const pendingGuidance = (
    pending: PendingVerification,
    category: RecentGuidanceCategory,
    includeTarget: boolean,
  ): RecentGuidanceSeed => {
    const relativeTarget = includeTarget ? pending.relativeTarget : undefined;
    const seed = {
      sessionId: pending.binding.sessionId,
      cwd: pending.binding.cwd,
      category,
      actionId: pending.action.actionId,
      effectId: pending.effect.effectId,
      targetId: pending.effect.targetId,
    };
    return relativeTarget ? { ...seed, relativeTarget } : seed;
  };

  const genericGuidance = (
    ctx: ExtensionContext,
    category: RecentGuidanceCategory,
  ): RecentGuidanceSeed | undefined => {
    const identity = currentIdentity(ctx);
    return identity ? { ...identity, category } : undefined;
  };

  const clearRun = (ctx?: ExtensionContext): void => {
    if (ctx) currentRecentGuidance(ctx);
    if (ctx) {
      for (const pending of pendingVerifications.values()) {
        const resultUpdate = renderOutcomeCardUpdate(
          pending.action,
          pending.effect,
          unverifiableResult(pending.expected, "unknown", "RESULT_MISSING"),
        );
        const published = publishResult(
          ctx,
          resultUpdate.lines,
          pendingGuidance(pending, "verification_unknown", true),
          pending.guidanceOrder,
        );
        if (published) setActionCard(ctx, resultUpdate);
      }
    }
    for (const cancel of [...pendingApprovalCancels]) cancel();
    for (const token of pendingTokens) invalidateApprovalToken(token);
    pendingApprovalCancels.clear();
    pendingTokens.clear();
    pendingVerifications.clear();
    pendingReads.clear();
    activeExecutions.clear();
    runGeneration += 1;
    starterGeneration += 1;
    userGoal = Object.freeze({ status: "unknown" });
  };

  const assessCurrent = (
    event: ToolCallEvent,
    ctx: ExtensionContext,
  ): Promise<Awaited<ReturnType<typeof assessMappedBatch>>> =>
    assessMappedBatch(
      mapToolCall(pi, event, ctx, sessionId, userGoal),
      event.toolCallId,
    );

  const resolveCurrentSnapshot = async (
    event: ToolCallEvent,
    ctx: ExtensionContext,
    expectedAction: HostExecutionFacts["action"],
  ) => {
    const transient = mapToolCall(pi, event, ctx, sessionId, userGoal).find(
      (item) => item.toolCallId === event.toolCallId,
    );
    return transient
      ? await resolveSensitiveSnapshotTarget({
          cwd: transient.cwd,
          tool: transient.tool,
          rawInput: transient.rawInput,
          expectedAction,
        })
      : undefined;
  };

  const captureCurrentSnapshot = async (
    event: ToolCallEvent,
    ctx: ExtensionContext,
    expectedAction: HostExecutionFacts["action"],
  ) => {
    try {
      const target = await resolveCurrentSnapshot(event, ctx, expectedAction);
      if (!target)
        return unavailablePreImageSnapshot("SNAPSHOT_TARGET_UNSUPPORTED");
      const snapshots = await loadSnapshotModule();
      if (!snapshots)
        return unavailablePreImageSnapshot("SNAPSHOT_STORAGE_UNAVAILABLE");
      return await snapshots.capturePreImageSnapshot(snapshotRoot, target);
    } catch {
      return unavailablePreImageSnapshot("SNAPSHOT_TARGET_CHANGED");
    }
  };

  const snapshotMatchesCurrent = async (
    event: ToolCallEvent,
    ctx: ExtensionContext,
    facts: HostExecutionFacts,
  ): Promise<boolean> => {
    if (facts.preImage.status !== "saved") return true;
    try {
      const target = await resolveCurrentSnapshot(event, ctx, facts.action);
      if (!target) return false;
      const snapshots = await loadSnapshotModule();
      if (!snapshots) return false;
      return Boolean(
        await snapshots.verifyPreImageSnapshotBaseline(
          snapshotRoot,
          facts.preImage,
          target,
        ),
      );
    } catch {
      return false;
    }
  };

  const internalBinding = (
    toolName:
      | "agentglass.example"
      | "agentglass.restore"
      | "agentglass.cleanup",
    ctx: ExtensionContext,
    toolCallId: string,
    payload: Record<string, unknown>,
  ): Readonly<ExecutionBinding> => {
    const currentSession = ctx.sessionManager.getSessionId();
    if (!nonEmptyString(currentSession) || !nonEmptyString(ctx.cwd))
      throw new Error();
    return Object.freeze({
      fingerprint: fingerprintTransientActionInput(toolName, payload),
      toolName,
      cwd: ctx.cwd,
      sessionId: currentSession,
      hostExecutionId: hostExecutionId(currentSession, toolCallId),
      toolCallId,
    });
  };

  const notify = (
    ctx: ExtensionContext,
    message: string,
    type: "info" | "warning" | "error" = "info",
  ): void => {
    try {
      ctx.ui.notify(message, type);
    } catch {
      // UI 失败不改变恢复或清理状态，也不回显异常。
    }
  };

  const fillGuidanceDraft = (
    ctx: ExtensionContext,
    expected: StarterContext,
    draft: GuidanceDraft,
  ): boolean => {
    // 所有引导入口共用这一处最终写入：异步菜单返回后再次检查会话、cwd、引导
    // 代次和空闲状态；get/set 紧邻执行，保留任何非空输入且绝不模拟发送。
    const state = starterStateIsCurrent(ctx, expected, starterGeneration);
    if (state === "busy") {
      notify(ctx, STARTER_BUSY, "warning");
      return false;
    }
    if (state === "stale") {
      notify(ctx, STARTER_INVALIDATED, "warning");
      return false;
    }
    if (state !== "ok") {
      notify(ctx, STARTER_UNAVAILABLE, "warning");
      return false;
    }
    try {
      const editor = ctx.ui.getEditorText();
      if (typeof editor !== "string") throw new Error();
      if (editor.length !== 0) {
        notify(
          ctx,
          "输入框已有内容，已保留。请先自行发送或清空，再打开这个入口。",
          "warning",
        );
        return false;
      }
      ctx.ui.setEditorText(draft.text);
    } catch {
      notify(ctx, STARTER_EDITOR_UNAVAILABLE, "warning");
      return false;
    }
    notify(
      ctx,
      draft.projectedTextChanged
        ? "已填入请求，其中部分文字已安全隐藏或过滤，请检查草稿后自行发送。文件修改仍需你的确认。"
        : "已填入请求，请检查后自行发送。文件修改仍需你的确认。",
    );
    return true;
  };

  const startFileTask = async (ctx: ExtensionContext): Promise<void> => {
    const initialState = starterInitialState(ctx);
    if (initialState === "busy") {
      notify(ctx, STARTER_BUSY, "warning");
      return;
    }
    if (initialState !== "ok") {
      notify(ctx, STARTER_UNAVAILABLE, "warning");
      return;
    }
    const initialEditor = starterEditorState(ctx);
    if (initialEditor === "non_empty") {
      notify(
        ctx,
        "输入框已有内容，已保留。请先自行发送或清空，再打开这个入口。",
        "warning",
      );
      return;
    }
    if (initialEditor !== "empty") {
      notify(ctx, STARTER_EDITOR_UNAVAILABLE, "warning");
      return;
    }
    const identity = starterIdentity(ctx);
    if (!identity) {
      notify(ctx, STARTER_UNAVAILABLE, "warning");
      return;
    }

    // 代次只存在内存中：另一轮引导、agent_end、session_start 或 shutdown 都会使
    // 旧流程失效。每次 await 后重新核对宿主身份和空闲状态，不能把草稿写进新会话。
    const expected = Object.freeze({
      ...identity,
      generation: ++starterGeneration,
    });
    const afterAwait = (): boolean => {
      const state = starterStateIsCurrent(ctx, expected, starterGeneration);
      if (state === "busy") {
        notify(ctx, STARTER_BUSY, "warning");
        return false;
      }
      if (state === "stale") {
        notify(ctx, STARTER_INVALIDATED, "warning");
        return false;
      }
      if (state !== "ok") {
        notify(ctx, STARTER_UNAVAILABLE, "warning");
        return false;
      }
      const editor = starterEditorState(ctx);
      if (editor === "non_empty") {
        notify(ctx, STARTER_INPUT_CHANGED, "warning");
        return false;
      }
      if (editor !== "empty") {
        notify(ctx, STARTER_EDITOR_UNAVAILABLE, "warning");
        return false;
      }
      return true;
    };
    const readInput = async (
      title: string,
      placeholder: string,
    ): Promise<string | null | undefined> => {
      try {
        const value = await ctx.ui.input(title, placeholder);
        if (value !== undefined && typeof value !== "string") {
          notify(ctx, STARTER_UNAVAILABLE, "warning");
          return null;
        }
        return value;
      } catch {
        notify(ctx, STARTER_UNAVAILABLE, "warning");
        return null;
      }
    };

    let selected: string | undefined;
    try {
      selected = await ctx.ui.select("开始一个文件任务", [
        "创建说明",
        "润色文案",
        "整理文本",
        "关闭",
      ]);
    } catch {
      notify(ctx, STARTER_UNAVAILABLE, "warning");
      return;
    }
    if (!afterAwait()) return;
    const task = starterTask(selected);
    if (!task) {
      notify(ctx, STARTER_CANCELLED);
      return;
    }

    const pathValue = await readInput(
      "文件路径（项目相对路径）",
      "例如 docs/activity.md",
    );
    if (pathValue === null) return;
    if (pathValue === undefined) {
      notify(ctx, STARTER_CANCELLED);
      return;
    }
    if (!afterAwait()) return;
    if (pathValue.trim().length === 0) {
      notify(ctx, "已结束：缺少必填的文件路径，没有修改文件或输入框。");
      return;
    }

    const requestTitle =
      task === "create"
        ? "主题与要求（必填）"
        : task === "polish"
          ? "调整风格与要求（必填）"
          : "希望的结构与要求（必填）";
    const requestValue = await readInput(
      requestTitle,
      "请用普通文字描述你想要的结果",
    );
    if (requestValue === null) return;
    if (requestValue === undefined) {
      notify(ctx, STARTER_CANCELLED);
      return;
    }
    if (!afterAwait()) return;
    if (requestValue.trim().length === 0) {
      notify(ctx, "已结束：缺少必填的要求，没有修改文件或输入框。");
      return;
    }

    let preserveValue = "";
    if (task !== "create") {
      const value = await readInput(
        "必须保留的内容（可留空）",
        "没有特别要求可以直接确认留空",
      );
      if (value === null) return;
      if (value === undefined) {
        notify(ctx, STARTER_CANCELLED);
        return;
      }
      if (!afterAwait()) return;
      preserveValue = value;
    }

    const draft = starterDraft(task, {
      path: pathValue,
      request: requestValue,
      preserve: preserveValue,
    });
    if (!draft) {
      notify(
        ctx,
        "无法生成安全请求：请使用明确的项目相对路径和较短的普通文字后重新打开入口。没有修改文件或输入框。",
        "warning",
      );
      return;
    }

    fillGuidanceDraft(ctx, expected, draft);
  };

  const problemDraft = (
    context: RecentGuidanceContext,
  ): GuidanceDraft | undefined => {
    if (
      context.category === "batch_mutation" ||
      context.category === "batch_context_unknown"
    ) {
      return Object.freeze({
        text: [
          "请让 Pi 每次只改一个文件；每次只改一个普通项目文件。",
          "不要同时提出多个文件修改；不要安装、运行程序或使用 shell。",
          "每一步仍需 AgentGlass 的独立检查和确认。",
        ].join("\n"),
        projectedTextChanged: false,
      });
    }
    if (
      context.category !== "verification_mismatch" &&
      context.category !== "verification_unknown" &&
      context.category !== "recovery_conflict"
    )
      return undefined;
    const target = context.relativeTarget
      ? starterPath(context.relativeTarget)
      : undefined;
    if (!target) return undefined;
    return Object.freeze({
      text: [
        "请先查看这个普通项目文件，不要修改它。",
        `文件：${target}`,
        "如果无法安全确认，请说明原因；不要自行创建替代文件或重复执行刚才的动作。",
      ].join("\n"),
      projectedTextChanged: false,
    });
  };

  const problemFixedMessage = (category: RecentGuidanceCategory): string => {
    switch (category) {
      case "user_cancellation":
        return "你刚才选择停止，这一步没有获得执行许可。AgentGlass 不会继续这一步。";
      case "verification_matched":
      case "recovery_complete":
      case "other_result":
        return "刚才的结果已确认，没有需要处理的问题。AgentGlass 不会自动提出下一步。";
      case "verification_mismatch":
      case "verification_unknown":
      case "recovery_conflict":
        return "无法安全表示刚才涉及的文件，因此没有填入定向请求。请返回 Pi，明确一份普通项目文件。";
      case "recovery_failed":
        return "恢复结果无法确认；AgentGlass 不会自动重试恢复。请返回 Pi，明确一份普通项目文件。";
      case "batch_mutation":
      case "batch_context_unknown":
        return "无法安全生成这次处理请求。请返回 Pi，明确一份普通项目文件。";
      case "other_blocked":
        return "刚才这一步被安全检查停止，AgentGlass 不会自动重试。请返回 Pi，明确一份普通项目文件。";
    }
  };

  const processRecentProblem = async (ctx: ExtensionContext): Promise<void> => {
    if (activeExecutions.size > 0) {
      notify(ctx, STARTER_BUSY, "warning");
      return;
    }
    const initialState = starterInitialState(ctx);
    if (initialState === "busy") {
      notify(ctx, STARTER_BUSY, "warning");
      return;
    }
    if (initialState !== "ok") {
      notify(ctx, STARTER_UNAVAILABLE, "warning");
      return;
    }
    const context = currentRecentGuidance(ctx);
    if (!context) {
      notify(
        ctx,
        "当前没有可处理的最近问题。请返回 Pi，明确一份普通项目文件。",
      );
      return;
    }
    const draft = problemDraft(context);
    if (!draft) {
      notify(ctx, problemFixedMessage(context.category), "warning");
      return;
    }
    const identity = starterIdentity(ctx);
    if (!identity) {
      notify(ctx, STARTER_UNAVAILABLE, "warning");
      return;
    }
    // 这是处理菜单自己的短暂代次；菜单等待期间若有新结果、session/cwd 切换或
    // agent 重新运行，旧上下文就不再是“刚才的问题”，不能把草稿填入新任务。
    const expected = Object.freeze({
      ...identity,
      generation: ++starterGeneration,
    });
    const choiceLabel =
      context.category === "batch_mutation" ||
      context.category === "batch_context_unknown"
        ? "填入：每次只改一个文件"
        : "填入：先查看这份文件";
    let choice: string | undefined;
    try {
      choice = await ctx.ui.select("处理刚才的问题", ["关闭", choiceLabel]);
    } catch {
      notify(ctx, MENU_UNAVAILABLE, "warning");
      return;
    }
    if (
      currentRecentGuidance(ctx) !== context ||
      starterStateIsCurrent(ctx, expected, starterGeneration) !== "ok"
    ) {
      notify(
        ctx,
        "最近的问题已变化，这次请求没有填入。请重新明确一份普通项目文件。",
        "warning",
      );
      return;
    }
    if (choice !== choiceLabel) {
      notify(ctx, "已关闭：没有生成请求草稿。");
      return;
    }
    fillGuidanceDraft(ctx, expected, draft);
  };

  const showWelcome = (ctx: ExtensionContext): void => {
    setWelcomePanel(ctx, welcomeLines(ctx.cwd));
  };

  const showHelp = async (ctx: ExtensionContext): Promise<void> => {
    let recovery = latestRecovery;
    if (recovery) {
      try {
        const snapshots = await loadSnapshotModule();
        if (
          !snapshots ||
          !(await snapshots.recoveryEntryIsCurrent(snapshotRoot, recovery))
        ) {
          if (latestRecovery === recovery) latestRecovery = undefined;
          recovery = undefined;
        }
      } catch {
        recovery = undefined;
      }
    }
    const sections = helpSections(latestResult, recovery);
    try {
      await showHelpOverlay(ctx, ctx.cwd, sections);
      // 帮助是临时查看，不覆盖常驻欢迎面板；关闭后恢复原来的项目提示。
      setWelcomePanel(ctx, welcomeLines(ctx.cwd));
    } catch {
      setWelcomePanel(ctx, compactHelpLines(ctx.cwd, recovery));
      notify(ctx, "帮助浮层无法打开，已显示精简帮助。", "warning");
    }
  };

  const prepareExample = async (ctx: ExtensionContext): Promise<void> => {
    const guidanceOrder = beginGuidanceOperation();
    const inspected = await inspectExamplePlan(ctx.cwd);
    if (inspected === "conflict") {
      notify(
        ctx,
        `未准备安全示例：当前文件夹下的 ${EXAMPLE_DIRECTORY_NAME} 已存在，AgentGlass 不会覆盖已有目录或文件。请换一个空的当前文件夹后重试。`,
        "warning",
      );
      return;
    }
    if (!inspected) {
      notify(
        ctx,
        "未准备安全示例：无法可靠确认当前工作文件夹的位置或类型。请在普通项目文件夹中重试。",
        "warning",
      );
      return;
    }

    let currentSession: string;
    try {
      currentSession = ctx.sessionManager.getSessionId();
    } catch {
      notify(
        ctx,
        "未准备安全示例：无法确认当前会话。请重新打开项目后重试。",
        "warning",
      );
      return;
    }
    if (!nonEmptyString(currentSession)) {
      notify(
        ctx,
        "未准备安全示例：无法确认当前会话。请重新打开项目后重试。",
        "warning",
      );
      return;
    }

    const callId = randomUUID();
    const payload = {
      cwd: inspected.cwd,
      directory: inspected.directory,
      file: inspected.file,
      contentSha256: createHash("sha256")
        .update(EXAMPLE_ACTIVITY_TEXT, "utf8")
        .digest("hex"),
    };
    let token: ApprovalToken;
    try {
      token = issueApprovalToken(
        callId,
        internalBinding("agentglass.example", ctx, callId, payload),
      );
    } catch {
      notify(
        ctx,
        "未准备安全示例：无法建立这次精确批准。请重新打开项目后重试。",
        "warning",
      );
      return;
    }
    pendingTokens.add(token);
    const choice = await requestOutcomeApproval(
      ctx,
      Object.freeze({
        actionId: callId,
        title: "下一步：准备安全示例",
        expectedOutcome: `预计结果：在当前工作文件夹下创建 ${EXAMPLE_RELATIVE_FILE}。`,
        attention:
          "需要注意：这里只创建这个固定示例目录和文件，不会覆盖已有内容；目录本身不提供自动恢复。",
        recovery:
          "恢复：示例目录准备不是可恢复的文件修改；部分失败会保留已创建内容。",
        details: [
          `位置：当前工作文件夹下的 ${EXAMPLE_RELATIVE_FILE}。`,
          "内容：固定无秘密活动说明，不读取或保存你的私密信息。",
          `下一步目标：${EXAMPLE_GOAL}；之后的修改仍会走普通文件审批和恢复链路。`,
        ],
      }),
      pendingApprovalCancels,
    );
    if (choice !== "continue") {
      invalidateApprovalToken(token);
      pendingTokens.delete(token);
      notify(ctx, "已停止：未批准准备安全示例，没有创建目录或文件。");
      return;
    }
    if (!(await examplePlanIsCurrent(inspected, ctx))) {
      invalidateApprovalToken(token);
      pendingTokens.delete(token);
      notify(
        ctx,
        "已停止：批准期间当前文件夹或示例位置发生变化，没有创建目录或文件。",
        "warning",
      );
      return;
    }
    let finalBinding: Readonly<ExecutionBinding>;
    try {
      finalBinding = internalBinding(
        "agentglass.example",
        ctx,
        callId,
        payload,
      );
    } catch {
      invalidateApprovalToken(token);
      pendingTokens.delete(token);
      notify(
        ctx,
        "已停止：批准期间无法确认当前会话或文件夹，没有创建目录或文件。",
        "warning",
      );
      return;
    }
    if (!consumeApprovalToken(token, callId, finalBinding)) {
      pendingTokens.delete(token);
      notify(ctx, APPROVAL_CHANGED_REASON, "warning");
      return;
    }
    pendingTokens.delete(token);

    let directoryCreated = false;
    try {
      await mkdir(inspected.directory);
      directoryCreated = true;
      await writeFile(inspected.file, EXAMPLE_ACTIVITY_TEXT, {
        encoding: "utf8",
        flag: "wx",
      });
      const result = [
        "安全示例已准备。",
        `已创建：当前工作文件夹下的 ${EXAMPLE_RELATIVE_FILE}。`,
        "内容：固定无秘密活动说明。",
        `下一步目标：${EXAMPLE_GOAL}。`,
        "未覆盖已有内容；示例目录本身不提供自动恢复。",
      ];
      const identity = currentIdentity(ctx);
      const published = identity
        ? publishResult(
            ctx,
            result,
            { ...identity, category: "other_result", actionId: callId },
            guidanceOrder,
          )
        : false;
      if (published) {
        setActionCard(ctx, {
          actionId: callId,
          state: "matched",
          lines: result,
        });
        setWelcomePanel(ctx, result);
        notify(ctx, `安全示例已准备：可在对话中使用“${EXAMPLE_GOAL}”。`);
      }
    } catch {
      let fileExists = false;
      let directoryExists = false;
      try {
        fileExists = (await lstat(inspected.file)).isFile();
      } catch {
        // 文件不存在或无法读取都不能被写成“没有创建”。
      }
      try {
        await lstat(inspected.directory);
        directoryExists = true;
      } catch {
        // 目录不存在或无法读取都不能被写成“没有创建”。
      }
      const result = [
        "安全示例准备未完成。",
        fileExists
          ? "活动说明文件已经出现，但内容无法确认。"
          : directoryCreated
            ? "已创建示例文件夹，但活动说明文件未完成。"
            : directoryExists
              ? "示例位置已经出现，但无法确认其创建者或内容。"
              : "没有确认创建任何示例内容。",
        "已保留已创建内容，未自动删除；示例目录本身不提供自动恢复。",
      ];
      const identity = currentIdentity(ctx);
      const published = identity
        ? publishResult(
            ctx,
            result,
            { ...identity, category: "other_result", actionId: callId },
            guidanceOrder,
          )
        : false;
      if (published) {
        setActionCard(ctx, {
          actionId: callId,
          state: "unknown",
          lines: result,
        });
        setWelcomePanel(ctx, result);
        notify(ctx, result.join(" "), "warning");
      }
    }
  };

  pi.registerCommand("agentglass", {
    description:
      "查看 AgentGlass 帮助、处理刚才的问题、准备安全示例、恢复最近修改或清理本地恢复数据",
    handler: async (args, ctx) => {
      let commandSession: string | undefined;
      try {
        const current = ctx.sessionManager.getSessionId();
        commandSession = nonEmptyString(current) ? current : undefined;
      } catch {
        commandSession = undefined;
      }
      // 恢复许可只属于创建它的会话与 cwd；一旦观察到边界切换便立即丢弃内存入口，
      // 防止用户切回旧环境后让已经失效的入口“复活”。磁盘证据仍留给单独审批的清理。
      if (
        latestRecovery &&
        (latestRecovery.sessionId !== commandSession ||
          latestRecovery.cwd !== ctx.cwd)
      ) {
        latestRecovery = undefined;
      }
      if (ctx.mode !== "tui" || !ctx.hasUI) {
        notify(ctx, APPROVAL_UNAVAILABLE_REASON, "warning");
        return;
      }
      currentRecentGuidance(ctx);
      let menuHasRecovery = Boolean(latestRecovery);
      if (latestRecovery) {
        try {
          const snapshots = await loadSnapshotModule();
          menuHasRecovery = Boolean(
            snapshots &&
              (await snapshots.recoveryEntryIsCurrent(
                snapshotRoot,
                latestRecovery,
              )),
          );
        } catch {
          menuHasRecovery = false;
        }
      }
      let action = args.trim().toLowerCase();
      if (!action) {
        const helpChoice = "› 查看欢迎与帮助";
        const startChoice = "✦ 开始一个文件任务";
        const problemChoice = "⚑ 处理刚才的问题";
        const exampleChoice = "✦ 准备安全示例";
        const cleanupChoice = "× 清理本地恢复数据";
        const menuOptions = [
          helpChoice,
          startChoice,
          problemChoice,
          exampleChoice,
          ...(menuHasRecovery ? ["↶ 恢复最近一次修改"] : []),
          cleanupChoice,
          "关闭",
        ];
        let choice: string | undefined;
        try {
          choice = await ctx.ui.select("🛡 AgentGlass", menuOptions);
        } catch {
          notify(ctx, MENU_UNAVAILABLE, "warning");
          return;
        }
        const recoveryChoice = menuHasRecovery
          ? "↶ 恢复最近一次修改"
          : undefined;
        action =
          choice === helpChoice
            ? "help"
            : choice === startChoice
              ? "start"
              : choice === problemChoice
                ? "process"
                : choice === exampleChoice
                  ? "example"
                  : recoveryChoice && choice === recoveryChoice
                    ? "restore"
                    : choice === cleanupChoice
                      ? "cleanup"
                      : "";
      }
      if (
        action === "help" ||
        action === "welcome" ||
        action === "帮助" ||
        action === "欢迎"
      ) {
        await showHelp(ctx);
        return;
      }
      if (
        action === "start" ||
        action === "任务" ||
        action === "开始任务" ||
        action === "开始一个文件任务"
      ) {
        await startFileTask(ctx);
        return;
      }
      if (
        action === "process" ||
        action === "处理" ||
        action === "处理问题" ||
        action === "处理刚才的问题"
      ) {
        await processRecentProblem(ctx);
        return;
      }
      if (
        action === "example" ||
        action === "示例" ||
        action === "准备示例" ||
        action === "试一个例子"
      ) {
        await prepareExample(ctx);
        return;
      }
      if (action === "restore" || action === "恢复") {
        const guidanceOrder = beginGuidanceOperation();
        const entry = latestRecovery;
        const snapshots = entry ? await loadSnapshotModule() : undefined;
        let recoveryIsCurrent = false;
        if (
          entry &&
          entry.sessionId === commandSession &&
          entry.cwd === ctx.cwd &&
          snapshots
        ) {
          recoveryIsCurrent = await snapshots.recoveryEntryIsCurrent(
            snapshotRoot,
            entry,
          );
        }
        if (!recoveryIsCurrent) {
          const sameCurrentContext = Boolean(
            entry &&
              entry.sessionId === commandSession &&
              entry.cwd === ctx.cwd &&
              snapshots,
          );
          if (sameCurrentContext && entry) {
            const seed = {
              sessionId: entry.sessionId,
              cwd: entry.cwd,
              category: "recovery_conflict" as const,
              actionId: entry.actionId,
              effectId: entry.effectId,
              targetId: entry.targetId,
              ...(entry.relativeTarget
                ? { relativeTarget: entry.relativeTarget }
                : {}),
            };
            publishGuidance(ctx, seed, guidanceOrder);
          }
          if (entry && latestRecovery === entry) latestRecovery = undefined;
          notify(
            ctx,
            !entry
              ? "当前会话没有可用的最近恢复项。"
              : !snapshots
                ? SNAPSHOT_MODULE_UNAVAILABLE_REASON
                : "已停止：当前文件与这次修改完成后的记录不一致，已保留当前内容。",
            "warning",
          );
          return;
        }
        if (!entry || !snapshots) return;
        const callId = randomUUID();
        const payload = {
          snapshotId: entry.snapshotId,
          actionId: entry.actionId,
        };
        const binding = internalBinding(
          "agentglass.restore",
          ctx,
          callId,
          payload,
        );
        const token = issueApprovalToken(callId, binding);
        pendingTokens.add(token);
        const card: OutcomeCard = Object.freeze({
          actionId: callId,
          title: entry.targetExisted
            ? `下一步：恢复 ${entry.targetLabel}`
            : `下一步：删除刚才创建的 ${entry.targetLabel}`,
          expectedOutcome: entry.targetExisted
            ? `预计结果：将用修改前副本替换 ${entry.targetLabel} 的当前内容。`
            : `预计结果：将删除这次修改创建的 ${entry.targetLabel}。`,
          attention:
            "需要注意：这是新的单文件变更；继续后本恢复入口会被单次消费，失败也不会自动重试。",
          recovery: "恢复后会独立核对文件内容、存在状态和受支持权限。",
          details: [
            `位置：当前项目内的 ${entry.targetLabel}。`,
            "如果路径、身份、字节或权限已变化，将停止并保留当前文件。",
          ],
        });
        const choice = await requestOutcomeApproval(
          ctx,
          card,
          pendingApprovalCancels,
        );
        if (choice !== "continue") {
          invalidateApprovalToken(token);
          pendingTokens.delete(token);
          const seed = genericGuidance(ctx, "user_cancellation");
          if (seed) publishGuidance(ctx, seed, guidanceOrder);
          notify(ctx, "已停止：未批准恢复，文件和恢复入口均保留。");
          return;
        }
        if (
          latestRecovery !== entry ||
          !snapshots ||
          !(await snapshots.recoveryEntryIsCurrent(snapshotRoot, entry))
        ) {
          if (latestRecovery === entry) latestRecovery = undefined;
          invalidateApprovalToken(token);
          pendingTokens.delete(token);
          notify(ctx, "已停止：批准期间恢复依据或当前文件已变化。", "warning");
          return;
        }
        const finalBinding = internalBinding(
          "agentglass.restore",
          ctx,
          callId,
          payload,
        );
        if (!consumeApprovalToken(token, callId, finalBinding)) {
          pendingTokens.delete(token);
          notify(ctx, APPROVAL_CHANGED_REASON, "warning");
          return;
        }
        pendingTokens.delete(token);
        latestRecovery = undefined;
        const result = await snapshots.restoreRecoveryEntry(
          snapshotRoot,
          entry,
        );
        const resultLines = Object.freeze([
          result.status === "restored"
            ? `已确认：${entry.targetLabel} 已恢复到这次修改之前。`
            : result.status === "conflict"
              ? `已停止：${entry.targetLabel} 已变化，保留当前文件。`
              : `无法确认：${entry.targetLabel} 的恢复结果。`,
          `内容/存在状态：${result.content === "matched" ? "已匹配修改前副本" : result.content === "missing" ? "已确认文件不存在" : "未确认"}。`,
          `权限：${result.permissions === "matched" ? "已匹配记录" : result.permissions === "not_applicable" ? "不适用" : "未确认"}。`,
          "这次恢复入口已消费；不会自动重试或创建 redo。",
        ]);
        const recoveryCategory: RecentGuidanceCategory =
          result.status === "restored"
            ? "recovery_complete"
            : result.status === "conflict"
              ? "recovery_conflict"
              : "recovery_failed";
        const published = publishResult(
          ctx,
          resultLines,
          {
            sessionId: entry.sessionId,
            cwd: entry.cwd,
            category: recoveryCategory,
            actionId: entry.actionId,
            effectId: entry.effectId,
            targetId: entry.targetId,
            ...(entry.relativeTarget
              ? { relativeTarget: entry.relativeTarget }
              : {}),
          },
          guidanceOrder,
        );
        if (published)
          setActionCard(ctx, {
            actionId: callId,
            state:
              result.status === "restored"
                ? "matched"
                : result.status === "conflict"
                  ? "mismatch"
                  : "unknown",
            lines: resultLines,
          });
        return;
      }

      if (action === "cleanup" || action === "清理") {
        const guidanceOrder = beginGuidanceOperation();
        const snapshots = await loadSnapshotModule();
        if (!snapshots) {
          notify(ctx, SNAPSHOT_MODULE_UNAVAILABLE_REASON, "warning");
          return;
        }
        const cleanup = await snapshots.inspectCleanupSet(snapshotRoot);
        if (cleanup.fileCount === 0) {
          notify(ctx, "没有可验证归属且可清理的 AgentGlass 恢复数据。");
          return;
        }
        const callId = randomUUID();
        const binding = internalBinding("agentglass.cleanup", ctx, callId, {
          fingerprint: cleanup.fingerprint,
          fileCount: cleanup.fileCount,
          logicalBytes: cleanup.logicalBytes,
        });
        const token = issueApprovalToken(callId, binding);
        pendingTokens.add(token);
        const choice = await requestOutcomeApproval(
          ctx,
          Object.freeze({
            actionId: callId,
            title: "下一步：清理 AgentGlass 本地恢复数据",
            expectedOutcome: `预计结果：删除 ${cleanup.fileCount} 个已验证私有文件，共 ${cleanup.logicalBytes} 字节。`,
            attention: `需要注意：${latestRecovery ? "当前最近一次恢复能力也会丢失。" : "删除后这些副本不能用于恢复。"}`,
            recovery: "清理失败时会保留未删项并报告实际结果。",
            details: [
              "只处理经私有根目录、manifest schema 和引用关系验证的文件。",
              "损坏、未来版本或无法验证归属的数据会保留。",
            ],
          }),
          pendingApprovalCancels,
        );
        if (choice !== "continue") {
          invalidateApprovalToken(token);
          pendingTokens.delete(token);
          notify(ctx, "已停止：未批准清理，本地数据未删除。");
          return;
        }
        const current = await snapshots.inspectCleanupSet(snapshotRoot);
        const finalBinding = internalBinding(
          "agentglass.cleanup",
          ctx,
          callId,
          {
            fingerprint: cleanup.fingerprint,
            fileCount: cleanup.fileCount,
            logicalBytes: cleanup.logicalBytes,
          },
        );
        if (
          current.fingerprint !== cleanup.fingerprint ||
          !consumeApprovalToken(token, callId, finalBinding)
        ) {
          invalidateApprovalToken(token);
          pendingTokens.delete(token);
          notify(
            ctx,
            "已停止：批准期间待清理集合已变化，未删除任何数据。",
            "warning",
          );
          return;
        }
        pendingTokens.delete(token);
        const result = await snapshots.cleanSnapshotSet(snapshotRoot, cleanup);
        const activeSnapshotId = latestRecovery?.snapshotId;
        if (
          activeSnapshotId &&
          result.deletedFiles.some((file) =>
            file.startsWith(`${activeSnapshotId}.`),
          )
        ) {
          latestRecovery = undefined;
        }
        const cleanupResult = Object.freeze([
          `清理结果：已删除 ${result.deleted} 个文件，${result.failed} 个失败并已保留。`,
          result.changed
            ? "待清理集合在批准期间发生变化，未继续删除。"
            : "只处理了已验证归属的 AgentGlass 私有数据。",
        ]);
        const identity = currentIdentity(ctx);
        const published = identity
          ? publishResult(
              ctx,
              cleanupResult,
              { ...identity, category: "other_result", actionId: callId },
              guidanceOrder,
            )
          : false;
        if (published) setWelcomePanel(ctx, cleanupResult);
        notify(
          ctx,
          `清理结果：已删除 ${result.deleted} 个文件，${result.failed} 个失败并已保留。`,
          result.failed > 0 || result.changed ? "warning" : "info",
        );
        return;
      }
      if (action)
        notify(
          ctx,
          "可用操作：/agentglass help、/agentglass process、/agentglass start、/agentglass example、/agentglass restore 或 /agentglass cleanup。",
        );
    },
  });

  pi.on("session_start", (_event, ctx) => {
    clearRun();
    latestRecovery = undefined;
    latestResult = undefined;
    clearRecentGuidance();
    try {
      const current = ctx.sessionManager.getSessionId();
      sessionId = nonEmptyString(current) ? current : undefined;
    } catch {
      sessionId = undefined;
    }
    if (
      ctx.mode === "tui" &&
      ctx.hasUI &&
      nonEmptyString(ctx.cwd) &&
      welcomedCwd !== ctx.cwd
    ) {
      welcomedCwd = ctx.cwd;
      showWelcome(ctx);
    }
  });
  pi.on("before_agent_start", (event) => {
    // 新一轮真实 agent run 在 agent_end 之前就必须使引导失效；否则异步表单返回后
    // 可能把旧请求写进正在运行的新任务。这里只增加内存代次，不保存 prompt 原文。
    starterGeneration += 1;
    try {
      userGoal = nonEmptyString(event.prompt)
        ? projectObservableUserGoal(event.prompt)
        : Object.freeze({ status: "unknown" });
    } catch {
      // 目标原文无法安全投影时只保留 unknown，异常消息和原文都不会跨事件存活。
      userGoal = Object.freeze({ status: "unknown" });
    }
  });
  pi.on("tool_call", async (event, ctx) => {
    let batch: readonly TransientHostExecutionInput[];
    let currentToken: ApprovalToken | undefined;
    const toolCallId = event.toolCallId;
    const guidanceOrder = ++guidanceSequence;
    try {
      if (activeExecutions.has(toolCallId)) throw new Error();
      batch = mapToolCall(pi, event, ctx, sessionId, userGoal);
      const current = batch.find((item) => item.toolCallId === toolCallId);
      if (!current) throw new Error();
      if (
        latestRecovery &&
        (latestRecovery.sessionId !== current.sessionId ||
          latestRecovery.cwd !== current.cwd)
      ) {
        latestRecovery = undefined;
      }
      // 在第一个 await 前同步占位；同一调用的并发重入只能看到已占用状态并失败关闭。
      activeExecutions.set(toolCallId, {
        hostExecutionId: current.hostExecutionId,
        toolName: current.tool.name,
        cwd: current.cwd,
        guidanceOrder,
      });
    } catch (error) {
      const seed = genericGuidance(
        ctx,
        error instanceof SiblingContextError
          ? "batch_context_unknown"
          : "other_blocked",
      );
      if (seed) publishGuidance(ctx, seed, guidanceOrder);
      return {
        block: true,
        reason:
          error instanceof SiblingContextError
            ? BATCH_CONTEXT_REASON
            : BLOCK_REASON,
      };
    }

    try {
      let prepared = await assessMappedBatch(batch, toolCallId);
      batch = Object.freeze([]);
      // 结果卡重新生成时才重新读取 event.input；token、pending 集合和 observer 都不保存 raw input。
      for (;;) {
        let observed = prepared.facts;
        let currentRisk = prepared.risk;
        let verificationTarget:
          | NonNullable<
              Awaited<ReturnType<typeof resolveSensitiveSnapshotTarget>>
            >
          | undefined;
        let expected: ExpectedFilePostcondition | undefined;
        if (prepared.risk.decision === "ask") {
          observed = Object.freeze({
            ...prepared.facts,
            preImage: await captureCurrentSnapshot(
              event,
              ctx,
              prepared.facts.action,
            ),
          });
          const beforeCard = await assessCurrent(event, ctx);
          const snapshotStillCurrent = await snapshotMatchesCurrent(
            event,
            ctx,
            observed,
          );
          if (
            !sameApprovalFacts(
              observed,
              prepared.risk,
              beforeCard.facts,
              beforeCard.risk,
            ) ||
            !snapshotStillCurrent
          ) {
            prepared = beforeCard;
            continue;
          }
          currentRisk = requireMutationBackup(
            observed.action,
            prepared.risk,
            observed.preImage,
          );
        }
        await observe(observed);

        if (prepared.risk.reasonCodes.includes("BATCH_MUTATION_BLOCKED")) {
          publishGuidance(
            ctx,
            {
              ...actionGuidance(
                observed,
                !prepared.hasStrictSiblingReason &&
                  canOfferSequentialDraft(currentRisk)
                  ? "batch_mutation"
                  : "other_blocked",
                undefined,
              ),
            },
            guidanceOrder,
          );
          activeExecutions.delete(toolCallId);
          return { block: true as const, reason: MULTIPLE_MUTATIONS_REASON };
        }
        if (prepared.risk.reasonCodes.includes("BATCH_CONTEXT_UNKNOWN")) {
          publishGuidance(
            ctx,
            {
              ...actionGuidance(
                observed,
                !prepared.hasStrictSiblingReason &&
                  canOfferSequentialDraft(currentRisk)
                  ? "batch_context_unknown"
                  : "other_blocked",
                undefined,
              ),
            },
            guidanceOrder,
          );
          activeExecutions.delete(toolCallId);
          return { block: true as const, reason: BATCH_CONTEXT_REASON };
        }
        const effect = predictEffects(observed.action, currentRisk)[0];
        if (!effect) throw new Error();
        if (currentRisk.decision === "auto_allow") {
          setReadStatus(
            ctx,
            renderReadNotice(observed.action, prepared.risk, effect),
          );
          pendingReads.set(toolCallId, {
            binding: executionBinding(observed),
          });
          return undefined;
        }
        if (currentRisk.decision === "hard_block") {
          publishGuidance(
            ctx,
            actionGuidance(observed, "other_blocked", effect),
            guidanceOrder,
          );
          activeExecutions.delete(toolCallId);
          return {
            block: true as const,
            reason: currentRisk.reasonCodes.includes("BACKUP_UNAVAILABLE")
              ? BACKUP_BLOCK_REASON
              : SAFETY_BLOCK_REASON,
          };
        }
        if (
          ctx.mode !== "tui" ||
          !ctx.hasUI ||
          observed.capabilities.canPromptForApproval !== "yes"
        ) {
          publishGuidance(
            ctx,
            actionGuidance(observed, "other_blocked", effect),
            guidanceOrder,
          );
          activeExecutions.delete(toolCallId);
          return { block: true as const, reason: APPROVAL_UNAVAILABLE_REASON };
        }

        verificationTarget = await resolveCurrentSnapshot(
          event,
          ctx,
          observed.action,
        );
        if (!verificationTarget) {
          publishGuidance(
            ctx,
            actionGuidance(observed, "other_blocked", effect),
            guidanceOrder,
          );
          activeExecutions.delete(toolCallId);
          return { block: true as const, reason: SAFETY_BLOCK_REASON };
        }
        try {
          expected = await prepareExpectedPostcondition(
            event,
            ctx,
            observed,
            effect,
            verificationTarget,
          );
        } catch {
          publishGuidance(
            ctx,
            actionGuidance(observed, "other_blocked", effect),
            guidanceOrder,
          );
          activeExecutions.delete(toolCallId);
          return { block: true as const, reason: SAFETY_BLOCK_REASON };
        }

        const card = renderOutcomeCard(
          observed.action,
          currentRisk,
          effect,
          observed.preImage,
          observed.capabilities,
          latestRecovery !== undefined,
        );
        const token = issueApprovalToken(
          observed.action.actionId,
          executionBinding(observed),
        );
        currentToken = token;
        pendingTokens.add(token);
        const choice = await requestOutcomeApproval(
          ctx,
          card,
          pendingApprovalCancels,
        );
        if (choice !== "continue") {
          invalidateApprovalToken(token);
          pendingTokens.delete(token);
          currentToken = undefined;
          publishGuidance(
            ctx,
            actionGuidance(observed, "user_cancellation", undefined),
            guidanceOrder,
          );
          activeExecutions.delete(toolCallId);
          return { block: true as const, reason: APPROVAL_STOPPED_REASON };
        }

        const current = await assessCurrent(event, ctx);
        const snapshotStillCurrent = await snapshotMatchesCurrent(
          event,
          ctx,
          observed,
        );
        if (
          !sameApprovalFacts(
            observed,
            prepared.risk,
            current.facts,
            current.risk,
          ) ||
          !snapshotStillCurrent
        ) {
          invalidateApprovalToken(token);
          pendingTokens.delete(token);
          currentToken = undefined;
          prepared = current;
          continue;
        }

        // 所有异步路径/前像检查之后，再同步读取一次 Pi 当前事件与宿主 envelope。
        // 这样最后一个 await 后可检测的输入、绑定、工具身份、能力或 sibling 变化，
        // 会先撤销旧 token 并生成新卡，而不是带着较早的 facts 交还执行。
        const finalBatch = mapToolCall(pi, event, ctx, sessionId, userGoal);
        const finalTransient = finalBatch.find(
          (item) => item.toolCallId === toolCallId,
        );
        if (!finalTransient) throw new Error();
        const currentBinding = transientExecutionBinding(finalTransient);
        if (
          !sameExecutionBinding(token.binding, currentBinding) ||
          !sameRuntimeEnvelope(finalTransient, current.facts)
        ) {
          invalidateApprovalToken(token);
          pendingTokens.delete(token);
          currentToken = undefined;
          prepared = await assessMappedBatch(finalBatch, toolCallId);
          continue;
        }

        // 所有异步复核结束后，在交还 Pi 前同步消费；此后任何 replay 都只能失败。
        const consumed = consumeApprovalToken(
          token,
          current.facts.action.actionId,
          currentBinding,
        );
        pendingTokens.delete(token);
        currentToken = undefined;
        if (consumed && verificationTarget && expected) {
          const relativeTarget = safeRelativeGuidanceTarget(observed.input);
          pendingVerifications.set(toolCallId, {
            binding: token.binding,
            action: observed.action,
            effect,
            targetPath: verificationTarget.targetPath,
            expected,
            preImage: observed.preImage,
            ...(relativeTarget ? { relativeTarget } : {}),
            guidanceOrder,
            inFlight: false,
          });
          setActionCard(ctx, renderOutcomeCardUpdate(observed.action, effect));
          return undefined;
        }
        activeExecutions.delete(toolCallId);
        publishGuidance(
          ctx,
          actionGuidance(observed, "other_blocked", effect),
          guidanceOrder,
        );
        return { block: true as const, reason: APPROVAL_CHANGED_REASON };
      }
    } catch {
      // 任一异常都必须立即撤销本次尚未消费的授权，不能等到会话清理才失效。
      if (currentToken) {
        invalidateApprovalToken(currentToken);
        pendingTokens.delete(currentToken);
      }
      activeExecutions.delete(toolCallId);
      const seed = genericGuidance(ctx, "other_blocked");
      if (seed) publishGuidance(ctx, seed, guidanceOrder);
      return { block: true as const, reason: BLOCK_REASON };
    }
  });
  pi.on("tool_result", async (event, ctx) => {
    currentRecentGuidance(ctx);
    const read = pendingReads.get(event.toolCallId);
    if (read) {
      pendingReads.delete(event.toolCallId);
      const matched = resultBindingMatches(
        pi,
        read,
        event.toolCallId,
        event.toolName,
        event.input,
        ctx,
      );
      setReadStatus(
        ctx,
        matched && !event.isError
          ? "已完成这次文件查看；文件内容由 Pi 显示。"
          : "无法确认这次文件查看是否完成。",
      );
      return;
    }

    const pending = pendingVerifications.get(event.toolCallId);
    if (!pending || pending.inFlight) return;
    const identity = currentIdentity(ctx);
    if (
      !identity ||
      identity.sessionId !== pending.binding.sessionId ||
      identity.cwd !== pending.binding.cwd
    ) {
      // 目录或会话已切换时，迟到结果既不能成为当前问题，也不能继续覆盖当前卡。
      clearRecentGuidance();
      pendingVerifications.delete(event.toolCallId);
      activeExecutions.delete(event.toolCallId);
      return;
    }
    pending.inFlight = true;
    const generation = runGeneration;
    const matches = resultBindingMatches(
      pi,
      pending,
      event.toolCallId,
      event.toolName,
      event.input,
      ctx,
    );
    const outcome = event.isError ? "failed" : "succeeded";
    const observed = await verifyFilePostcondition(
      pending.targetPath,
      pending.expected,
      outcome,
    );
    if (
      runGeneration !== generation ||
      pendingVerifications.get(event.toolCallId) !== pending
    ) {
      return;
    }
    const report = matches
      ? observed
      : unverifiableResult(
          pending.expected,
          outcome,
          "RESULT_IDENTITY_MISMATCH",
        );
    let recoveryAvailable = false;
    if (
      report.status === "matched" &&
      pending.expected.kind === "exact_bytes"
    ) {
      const snapshots = await loadSnapshotModule();
      const ready = snapshots
        ? await snapshots.finalizeRecoverySnapshot(
            snapshotRoot,
            pending.preImage,
            pending.effect.effectId,
            pending.expected.expectedSha256,
            pending.expected.expectedByteLength,
          )
        : undefined;
      if (ready && snapshots && runGeneration === generation) {
        const previous = latestRecovery;
        const replacementRecorded =
          !previous ||
          (await snapshots.markRecoveryState(
            snapshotRoot,
            previous,
            "superseded",
          ));
        if (replacementRecorded) {
          latestRecovery = Object.freeze({
            ...ready,
            sessionId: pending.binding.sessionId,
            cwd: pending.binding.cwd,
            targetLabel: pending.effect.targetLabel,
            ...(pending.relativeTarget
              ? { relativeTarget: pending.relativeTarget }
              : {}),
          });
          recoveryAvailable = true;
        }
      }
    }
    if (
      runGeneration !== generation ||
      pendingVerifications.get(event.toolCallId) !== pending
    ) {
      return;
    }
    const resultUpdate = renderOutcomeCardUpdate(
      pending.action,
      pending.effect,
      report,
      recoveryAvailable,
    );
    const guidanceCategory: RecentGuidanceCategory = !matches
      ? "other_blocked"
      : report.status === "matched"
        ? "verification_matched"
        : report.status === "mismatch"
          ? "verification_mismatch"
          : "verification_unknown";
    const published = publishResult(
      ctx,
      resultUpdate.lines,
      pendingGuidance(
        pending,
        guidanceCategory,
        matches && report.status !== "matched",
      ),
      pending.guidanceOrder,
    );
    if (published) setActionCard(ctx, resultUpdate);
    pendingVerifications.delete(event.toolCallId);
  });
  pi.on("tool_execution_end", (event, ctx) => {
    currentRecentGuidance(ctx);
    let endMatches = false;
    try {
      const currentSession = ctx.sessionManager.getSessionId();
      const active = activeExecutions.get(event.toolCallId);
      endMatches = Boolean(
        active &&
          nonEmptyString(currentSession) &&
          currentSession === sessionId &&
          ctx.cwd === active.cwd &&
          active.hostExecutionId ===
            hostExecutionId(currentSession, event.toolCallId) &&
          active.toolName === event.toolName,
      );
    } catch {
      endMatches = false;
    }
    if (!endMatches) return;
    const pending = pendingVerifications.get(event.toolCallId);
    if (pending && !pending.inFlight) {
      const resultUpdate = renderOutcomeCardUpdate(
        pending.action,
        pending.effect,
        unverifiableResult(
          pending.expected,
          event.isError ? "failed" : "unknown",
          "RESULT_MISSING",
        ),
      );
      const published = publishResult(
        ctx,
        resultUpdate.lines,
        pendingGuidance(pending, "verification_unknown", true),
        pending.guidanceOrder,
      );
      if (published) setActionCard(ctx, resultUpdate);
      pendingVerifications.delete(event.toolCallId);
    }
    if (pendingReads.delete(event.toolCallId))
      setReadStatus(ctx, "无法确认这次文件查看是否完成。");
    activeExecutions.delete(event.toolCallId);
  });
  pi.on("agent_end", (_event, ctx) => clearRun(ctx));
  pi.on("session_shutdown", () => {
    clearRun();
    latestRecovery = undefined;
    sessionId = undefined;
    clearRecentGuidance();
  });
}
