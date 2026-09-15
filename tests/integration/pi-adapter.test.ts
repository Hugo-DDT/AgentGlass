import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type AgentSessionRuntime,
  createAgentSession,
  createReadToolDefinition,
  DefaultResourceLoader,
  type ExtensionUIContext,
  InteractiveMode,
  ModelRuntime,
  SessionManager,
  SettingsManager,
  type ToolDefinition,
} from "@earendil-works/pi-coding-agent";
import { Editor } from "@earendil-works/pi-tui";
import { afterEach, expect, test, vi } from "vitest";
import { registerPiAdapter } from "../../src/adapter/pi/adapter.js";
import {
  consumeApprovalToken,
  executionBinding,
  issueApprovalToken,
} from "../../src/core/approval.js";
import type {
  ExecutionBinding,
  HostExecutionFacts,
} from "../../src/core/domain.js";
import * as inputBoundary from "../../src/core/input-boundary.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});

function assistantMessage(
  calls: Array<{
    id: string;
    name: string;
    arguments: Record<string, unknown>;
  }>,
): Parameters<SessionManager["appendMessage"]>[0] {
  return {
    role: "assistant",
    content: calls.map((call) => ({ type: "toolCall" as const, ...call })),
    api: "anthropic-messages",
    provider: "test",
    model: "test",
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason: "toolUse",
    timestamp: Date.now(),
  };
}

async function createRuntime(options?: {
  overriddenRead?: boolean;
  snapshotUnavailable?: boolean;
  bindUI?: boolean;
  captureStartup?: boolean;
}) {
  const cwd = await mkdtemp(join(tmpdir(), "agentglass-adapter-"));
  temporaryDirectories.push(cwd);
  const observed: HostExecutionFacts[] = [];
  const settingsManager = SettingsManager.inMemory();
  const loader = new DefaultResourceLoader({
    cwd,
    agentDir: join(cwd, "agent"),
    settingsManager,
    extensionFactories: [
      {
        name: "agentglass-integration",
        factory: (pi) => {
          const observer = (facts: HostExecutionFacts) => {
            observed.push(facts);
          };
          if (options?.snapshotUnavailable) registerPiAdapter(pi, observer);
          else
            registerPiAdapter(
              pi,
              observer,
              join(cwd, ".agentglass", "snapshots"),
            );
        },
      },
    ],
    noExtensions: true,
    noSkills: true,
    noPromptTemplates: true,
    noThemes: true,
    noContextFiles: true,
  });
  await loader.reload();
  const sessionManager = SessionManager.inMemory(cwd, {
    id: "session-one",
  });
  const modelRuntime = await ModelRuntime.create({
    authPath: join(cwd, "auth.json"),
    modelsPath: null,
    refreshOnCreate: false,
  });
  const { session } = await createAgentSession({
    cwd,
    resourceLoader: loader,
    settingsManager,
    sessionManager,
    modelRuntime,
    ...(options?.overriddenRead
      ? {
          customTools: [
            createReadToolDefinition(cwd) as unknown as ToolDefinition,
          ],
        }
      : {}),
  });
  const startupWidgets: string[][] = [];
  const uiContext = options?.bindUI
    ? session.extensionRunner.getUIContext()
    : undefined;
  const startupUIContext: ExtensionUIContext | undefined =
    uiContext && options?.captureStartup
      ? {
          ...uiContext,
          setWidget: ((
            key: string,
            content: string[] | undefined,
            options?,
          ) => {
            if (key === "agentglass-welcome" && Array.isArray(content))
              startupWidgets.push([...content]);
            uiContext.setWidget(key, content, options);
          }) as ExtensionUIContext["setWidget"],
        }
      : uiContext;
  await session.bindExtensions({
    mode: options?.bindUI ? "tui" : "print",
    ...(startupUIContext ? { uiContext: startupUIContext } : {}),
  });
  return { cwd, observed, session, sessionManager, startupWidgets };
}

interface ApprovalUiStep {
  inputs?: string[];
  widths?: number[];
  missingResult?: boolean;
  error?: boolean;
  onOpen?: () => void | Promise<void>;
}

interface TestComponent {
  render(width: number): string[];
  handleInput?(data: string): void;
  dispose?(): void;
}

type TestCustomFactory<T> = (
  tui: {
    requestRender(): void;
    terminal: { rows: number; columns: number };
  },
  theme: unknown,
  keybindings: { matches(data: string, key: string): boolean },
  done: (value: T) => void,
) => TestComponent | Promise<TestComponent>;

function installApprovalUi(
  runtime: Awaited<ReturnType<typeof createRuntime>>,
  steps: ApprovalUiStep[],
  mode: "tui" | "rpc" | "print" | "json" = "tui",
) {
  const runner = runtime.session.extensionRunner;
  const base = runner.getUIContext();
  const rendered: string[][] = [];
  const statuses: Array<{ key: string; text: string | undefined }> = [];
  const widgets: Array<{ key: string; content: string[] | undefined }> = [];
  const notifications: Array<{ message: string; type: string | undefined }> =
    [];
  let customCalls = 0;
  let doneCalls = 0;
  const custom = (async <T>(factory: TestCustomFactory<T>) => {
    const step = steps[customCalls++];
    if (!step || step.error) throw new Error("synthetic UI error");
    if (step.missingResult) return undefined as T;
    await step.onOpen?.();
    let resolveResult: (value: T) => void = () => {};
    const resultPromise = new Promise<T>((resolve) => {
      resolveResult = resolve;
    });
    const component = await factory(
      {
        requestRender: () => {},
        terminal: { rows: 24, columns: 80 },
      },
      base.theme,
      {
        matches: (data: string, key: string) =>
          data ===
          (
            {
              "tui.select.cancel": "esc",
              "tui.select.up": "up",
              "tui.select.down": "down",
              "tui.select.pageUp": "pageup",
              "tui.select.pageDown": "pagedown",
              "tui.input.tab": "tab",
              "tui.select.confirm": "enter",
            } as Record<string, string>
          )[key],
      },
      (value: T) => {
        doneCalls++;
        resolveResult(value);
      },
    );
    for (const width of step.widths ?? [80])
      rendered.push(component.render(width));
    for (const input of step.inputs ?? []) {
      component.handleInput?.(input);
      rendered.push(component.render(step.widths?.[0] ?? 80));
    }
    const result = await resultPromise;
    component.dispose?.();
    return result;
  }) as unknown as ExtensionUIContext["custom"];
  runner.setUIContext(
    {
      ...base,
      custom,
      setStatus: (key, text) => statuses.push({ key, text }),
      setWidget: (key, content) =>
        widgets.push({
          key,
          content: Array.isArray(content) ? [...content] : undefined,
        }),
      notify: (message, type) => notifications.push({ message, type }),
    },
    mode,
  );
  return {
    rendered,
    statuses,
    widgets,
    notifications,
    get customCalls() {
      return customCalls;
    },
    get doneCalls() {
      return doneCalls;
    },
  };
}

interface StarterDialogStep {
  value?: string;
  error?: boolean;
  onOpen?: (controls: {
    setEditorText(text: string): void;
    setCwd(cwd: string): void;
  }) => void | Promise<void>;
}

function installStarterUi(
  runtime: Awaited<ReturnType<typeof createRuntime>>,
  steps: StarterDialogStep[],
  options?: {
    editorText?: string;
    getEditorTextError?: boolean;
    getEditorTextErrorAt?: number;
    setEditorTextError?: boolean;
  },
) {
  const runner = runtime.session.extensionRunner;
  const base = runner.getUIContext();
  let editorText = options?.editorText ?? "";
  let dialogCalls = 0;
  let getEditorTextCalls = 0;
  let setCalls = 0;
  const editorEvents: Array<"get" | "set"> = [];
  const dialogTitles: string[] = [];
  const notifications: Array<{ message: string; type: string | undefined }> =
    [];
  const takeStep = async (title: string): Promise<string | undefined> => {
    dialogTitles.push(title);
    const step = steps[dialogCalls++];
    if (!step) return undefined;
    await step.onOpen?.({
      setEditorText: (text) => (editorText = text),
      // 测试真实 ExtensionRunner 的动态 cwd getter；生产代码不提供此旁路。
      setCwd: (cwd) => {
        (runner as unknown as { cwd: string }).cwd = cwd;
      },
    });
    if (step.error) throw new Error("synthetic starter UI error");
    return step.value;
  };
  runner.setUIContext(
    {
      ...base,
      select: (title) => takeStep(title),
      input: (title) => takeStep(title),
      getEditorText: () => {
        editorEvents.push("get");
        getEditorTextCalls += 1;
        if (
          options?.getEditorTextError ||
          options?.getEditorTextErrorAt === getEditorTextCalls
        )
          throw new Error("synthetic editor read error");
        return editorText;
      },
      setEditorText: (text) => {
        editorEvents.push("set");
        setCalls += 1;
        if (options?.setEditorTextError)
          throw new Error("synthetic editor write error");
        editorText = text;
      },
      notify: (message, type) => notifications.push({ message, type }),
    },
    "tui",
  );
  return {
    dialogTitles,
    notifications,
    get dialogCalls() {
      return dialogCalls;
    },
    get setCalls() {
      return setCalls;
    },
    get getEditorTextCalls() {
      return getEditorTextCalls;
    },
    editorEvents,
    get editorText() {
      return editorText;
    },
  };
}

async function runStarter(
  runtime: Awaited<ReturnType<typeof createRuntime>>,
): Promise<void> {
  await runtime.session.prompt("/agentglass", {
    expandPromptTemplates: true,
  });
}

async function setGoal(
  runtime: Awaited<ReturnType<typeof createRuntime>>,
  goal: string,
): Promise<void> {
  await runtime.session.extensionRunner.emitBeforeAgentStart(
    goal,
    undefined,
    "system",
    { cwd: runtime.cwd },
  );
}

async function emitCall(
  runtime: Awaited<ReturnType<typeof createRuntime>>,
  call: { id: string; name: string; arguments: Record<string, unknown> },
) {
  runtime.sessionManager.appendMessage(assistantMessage([call]));
  return runtime.session.extensionRunner.emitToolCall({
    type: "tool_call",
    toolCallId: call.id,
    toolName: call.name,
    input: call.arguments,
  });
}

async function emitBatch(
  runtime: Awaited<ReturnType<typeof createRuntime>>,
  calls: Array<{
    id: string;
    name: string;
    arguments: Record<string, unknown>;
  }>,
) {
  runtime.sessionManager.appendMessage(assistantMessage(calls));
  return Promise.all(
    calls.map((call) =>
      runtime.session.extensionRunner.emitToolCall({
        type: "tool_call",
        toolCallId: call.id,
        toolName: call.name,
        input: call.arguments,
      }),
    ),
  );
}

test("Pi 0.85.1 maps the current goal, current siblings, and real execution identities", async () => {
  const runtime = await createRuntime();
  runtime.sessionManager.appendMessage(
    assistantMessage([
      { id: "old-call", name: "read", arguments: { path: "old.txt" } },
    ]),
  );
  runtime.sessionManager.appendMessage({
    role: "user",
    content: "new turn",
    timestamp: Date.now(),
  });
  await setGoal(runtime, "读取当前说明");
  await writeFile(join(runtime.cwd, "now.txt"), "now", "utf8");
  runtime.sessionManager.appendMessage(
    assistantMessage([
      { id: "current-read", name: "read", arguments: { path: "now.txt" } },
      {
        id: "current-write",
        name: "write",
        arguments: { path: "note.txt", content: "ok" },
      },
    ]),
  );

  const result = await runtime.session.extensionRunner.emitToolCall({
    type: "tool_call",
    toolCallId: "current-read",
    toolName: "read",
    input: { path: "now.txt" },
  });
  const facts = runtime.observed[0];

  expect(result).toBeUndefined();
  expect(facts).toMatchObject({
    toolCallId: "current-read",
    sessionId: "session-one",
    cwd: runtime.cwd,
    tool: { name: "read", status: "verified_builtin" },
    userGoal: { status: "observed", redactedText: "读取当前说明" },
  });
  expect(facts?.hostExecutionId).toMatch(/^[a-f\d]{64}$/);
  expect(facts?.siblings.map((sibling) => sibling.toolCallId)).toEqual([
    "current-read",
    "current-write",
  ]);
  expect(facts?.siblings.map((sibling) => sibling.toolCallId)).not.toContain(
    "old-call",
  );
  expect(facts?.siblings[0]?.hostExecutionId).toBe(facts?.hostExecutionId);
});

test("B-002 keeps one recovery across agent_end, restores through /agentglass, and consumes it once", async () => {
  const runtime = await createRuntime();
  const ui = installApprovalUi(runtime, [
    { inputs: ["down", "down", "enter"] },
    { inputs: ["enter"] },
    { inputs: ["enter"] },
    { inputs: ["down", "down", "enter"] },
  ]);
  const targetPath = join(runtime.cwd, "recover.txt");
  await writeFile(targetPath, "before", "utf8");
  const call = {
    id: "recover-original",
    name: "write",
    arguments: { path: "recover.txt", content: "after" },
  };
  expect(await emitCall(runtime, call)).toBeUndefined();
  await writeFile(targetPath, "after", "utf8");
  await runtime.session.extensionRunner.emitToolResult({
    type: "tool_result",
    toolCallId: call.id,
    toolName: "write",
    input: call.arguments,
    content: [{ type: "text", text: "ignored" }],
    details: undefined,
    isError: false,
  });
  const helpRenderStart = ui.rendered.length;
  await runtime.session.prompt("/agentglass help");
  const helpOutput = ui.rendered.slice(helpRenderStart).flat().join("\n");
  expect(helpOutput).toContain("当前会话可恢复最近一次");
  expect(helpOutput).toContain("/agentglass restore");
  await runtime.session.extensionRunner.emit({
    type: "tool_execution_end",
    toolCallId: call.id,
    toolName: "write",
    result: {},
    isError: false,
  });
  await runtime.session.extensionRunner.emit({
    type: "agent_end",
    messages: [],
  });

  expect(
    await emitCall(runtime, {
      id: "replacement-refused",
      name: "write",
      arguments: { path: "other.txt", content: "not approved" },
    }),
  ).toMatchObject({ block: true });
  expect(ui.rendered.flat().join("").replaceAll(" ", "")).toContain(
    "上一项将不再提供恢复入口",
  );

  await runtime.session.prompt("/agentglass restore");
  expect(await readFile(targetPath, "utf8")).toBe("before");
  expect(ui.widgets.at(-1)?.content?.join("\n")).toContain("已恢复");
  expect(ui.customCalls).toBe(4);

  await runtime.session.prompt("/agentglass restore");
  expect(ui.customCalls).toBe(4);
  expect(ui.notifications.at(-1)?.message).toContain("没有可用");
});

test("B-002 blocks recovery drift and cleanup requires a separate exact approval", async () => {
  const runtime = await createRuntime();
  const ui = installApprovalUi(runtime, [
    { inputs: ["down", "down", "enter"] },
    { inputs: ["enter"] },
    { inputs: ["down", "down", "enter"] },
  ]);
  const targetPath = join(runtime.cwd, "cleanup.txt");
  const call = {
    id: "cleanup-original",
    name: "write",
    arguments: { path: "cleanup.txt", content: "after" },
  };
  expect(await emitCall(runtime, call)).toBeUndefined();
  await writeFile(targetPath, "after", "utf8");
  await runtime.session.extensionRunner.emitToolResult({
    type: "tool_result",
    toolCallId: call.id,
    toolName: "write",
    input: call.arguments,
    content: [{ type: "text", text: "ignored" }],
    details: undefined,
    isError: false,
  });
  await writeFile(targetPath, "later edit", "utf8");
  await runtime.session.prompt("/agentglass restore");
  expect(await readFile(targetPath, "utf8")).toBe("later edit");
  expect(ui.customCalls).toBe(1);
  expect(ui.notifications.at(-1)?.message).toContain("保留当前内容");
  await writeFile(targetPath, "after", "utf8");
  await runtime.session.prompt("/agentglass restore");
  expect(ui.customCalls).toBe(1);
  expect(ui.notifications.at(-1)?.message).toContain("没有可用");

  runtime.sessionManager.newSession({ id: "cleanup-session-two" });
  await runtime.session.extensionRunner.emit({
    type: "session_start",
    reason: "new",
  });
  await runtime.session.prompt("/agentglass restore");
  expect(ui.customCalls).toBe(1);
  expect(ui.notifications.at(-1)?.message).toContain("没有可用");

  const snapshotDirectory = join(runtime.cwd, ".agentglass", "snapshots");
  const beforeCleanup = await readdir(snapshotDirectory);
  await runtime.session.prompt("/agentglass cleanup");
  expect(await readdir(snapshotDirectory)).toEqual(beforeCleanup);
  expect(ui.notifications.at(-1)?.message).toContain("未批准清理");
  await runtime.session.prompt("/agentglass cleanup");
  expect(await readdir(snapshotDirectory)).toEqual([]);
  expect(ui.notifications.at(-1)?.message).toContain("已删除");
});

test("B-002 invalidates restoration when the target drifts inside the approval dialog", async () => {
  const runtime = await createRuntime();
  const targetPath = join(runtime.cwd, "approval-drift.txt");
  const ui = installApprovalUi(runtime, [
    { inputs: ["down", "down", "enter"] },
    {
      onOpen: () => writeFile(targetPath, "later edit", "utf8"),
      inputs: ["down", "down", "enter"],
    },
  ]);
  await writeFile(targetPath, "before", "utf8");
  const call = {
    id: "approval-drift-original",
    name: "write",
    arguments: { path: "approval-drift.txt", content: "after" },
  };
  expect(await emitCall(runtime, call)).toBeUndefined();
  await writeFile(targetPath, "after", "utf8");
  await runtime.session.extensionRunner.emitToolResult({
    type: "tool_result",
    toolCallId: call.id,
    toolName: "write",
    input: call.arguments,
    content: [],
    details: undefined,
    isError: false,
  });
  await runtime.session.prompt("/agentglass restore");
  expect(await readFile(targetPath, "utf8")).toBe("later edit");
  expect(ui.notifications.at(-1)?.message).toContain("批准期间");
});

test("Pi 0.85.1 sibling guard blocks only mutation/unknown members when a batch has at least two", async () => {
  const cases = [
    {
      name: "read + read",
      calls: [
        { id: "r1", name: "read", arguments: { path: "a.txt" } },
        { id: "r2", name: "read", arguments: { path: "b.txt" } },
      ],
      blocked: [],
    },
    {
      name: "read + write",
      calls: [
        { id: "r", name: "read", arguments: { path: "a.txt" } },
        {
          id: "w",
          name: "write",
          arguments: { path: "one.txt", content: "one" },
        },
      ],
      blocked: [],
    },
    {
      name: "write + write to different files",
      calls: [
        {
          id: "w1",
          name: "write",
          arguments: { path: "one.txt", content: "one" },
        },
        {
          id: "w2",
          name: "write",
          arguments: { path: "two.txt", content: "two" },
        },
      ],
      blocked: ["w1", "w2"],
    },
    {
      name: "write + unknown",
      calls: [
        {
          id: "w",
          name: "write",
          arguments: { path: "one.txt", content: "one" },
        },
        { id: "u", name: "mystery", arguments: {} },
      ],
      blocked: ["w", "u"],
    },
    {
      name: "unknown + unknown",
      calls: [
        { id: "u1", name: "mystery", arguments: {} },
        { id: "u2", name: "other", arguments: {} },
      ],
      blocked: ["u1", "u2"],
    },
    {
      name: "three siblings",
      calls: [
        { id: "r", name: "read", arguments: { path: "a.txt" } },
        {
          id: "w",
          name: "write",
          arguments: { path: "one.txt", content: "one" },
        },
        {
          id: "e",
          name: "edit",
          arguments: {
            path: "a.txt",
            edits: [{ oldText: "a", newText: "b" }],
          },
        },
      ],
      blocked: ["w", "e"],
    },
  ] as const;

  for (const fixture of cases) {
    const runtime = await createRuntime();
    await Promise.all(
      fixture.calls
        .filter((call) => call.name === "read" || call.name === "edit")
        .map((call) =>
          writeFile(join(runtime.cwd, `${call.arguments.path}`), "a"),
        ),
    );
    const results = await emitBatch(runtime, [...fixture.calls]);
    const blockedBySiblingGuard = fixture.calls
      .filter((_call, index) =>
        results[index]?.reason?.includes("一次只提出一个变更"),
      )
      .map((call) => call.id);
    expect(blockedBySiblingGuard, fixture.name).toEqual(fixture.blocked);
    for (const result of results.filter((item) =>
      item?.reason?.includes("一次只提出一个变更"),
    )) {
      expect(result?.reason).toContain("一次只提出一个变更");
    }
    if (fixture.name === "read + write") {
      expect(results[0]).toBeUndefined();
      expect(results[1]).toMatchObject({
        block: true,
        reason: expect.stringContaining("明确确认"),
      });
    }
  }
});

test("Pi 0.85.1 verified read/write/edit sources and schemas stay locked", async () => {
  const runtime = await createRuntime();
  await writeFile(join(runtime.cwd, "existing.txt"), "before", "utf8");
  await setGoal(runtime, "classify built-in file tools");
  const fileTools = runtime.session
    .getAllTools()
    .filter((tool) => ["read", "write", "edit"].includes(tool.name));
  const schemas = Object.fromEntries(
    fileTools.map((tool) => [tool.name, tool.parameters]),
  );
  expect(
    Object.fromEntries(fileTools.map((tool) => [tool.name, tool.sourceInfo])),
  ).toEqual({
    read: {
      path: "<builtin:read>",
      source: "builtin",
      scope: "temporary",
      origin: "top-level",
    },
    write: {
      path: "<builtin:write>",
      source: "builtin",
      scope: "temporary",
      origin: "top-level",
    },
    edit: {
      path: "<builtin:edit>",
      source: "builtin",
      scope: "temporary",
      origin: "top-level",
    },
  });
  expect(schemas).toMatchObject({
    read: {
      required: ["path"],
      properties: {
        path: { type: "string" },
        offset: { type: "number" },
        limit: { type: "number" },
      },
    },
    write: {
      required: ["path", "content"],
      properties: { path: { type: "string" }, content: { type: "string" } },
    },
    edit: {
      required: ["path", "edits"],
      properties: {
        path: { type: "string" },
        edits: {
          type: "array",
          items: {
            required: ["oldText", "newText"],
            properties: {
              oldText: { type: "string" },
              newText: { type: "string" },
            },
          },
        },
      },
    },
  });

  const calls = [
    { id: "read-file", name: "read", arguments: { path: "existing.txt" } },
    {
      id: "write-file",
      name: "write",
      arguments: { path: "new.txt", content: "new" },
    },
    {
      id: "edit-file",
      name: "edit",
      arguments: {
        path: "existing.txt",
        edits: [{ oldText: "before", newText: "after" }],
      },
    },
  ];

  for (const call of calls) {
    await emitCall(runtime, call);
    await runtime.session.extensionRunner.emit({
      type: "tool_execution_end",
      toolCallId: call.id,
      toolName: call.name,
      result: {},
      isError: false,
    });
  }

  expect(
    runtime.observed.map(({ tool, action, preImage }) => ({
      tool,
      action,
      preImage,
    })),
  ).toMatchObject([
    {
      tool: { name: "read", status: "verified_builtin" },
      action: {
        kind: "read",
        mutatesState: "no",
        impactFacts: { effect: "read" },
      },
    },
    {
      tool: { name: "write", status: "verified_builtin" },
      action: {
        kind: "write",
        mutatesState: "yes",
        impactFacts: { effect: "create" },
      },
      preImage: {
        status: "saved",
        targetExisted: "no",
        canRestoreNow: false,
        recoveryGrade: "unknown",
      },
    },
    {
      tool: { name: "edit", status: "verified_builtin" },
      action: {
        kind: "edit",
        mutatesState: "yes",
        impactFacts: { effect: "edit" },
      },
      preImage: {
        status: "saved",
        targetExisted: "yes",
        permissionMetadata: "captured",
        canRestoreNow: false,
        recoveryGrade: "unknown",
      },
    },
  ]);
  for (const facts of runtime.observed) {
    expect(facts.action.evidenceCodes).toContain("TOOL_IDENTITY_VERIFIED");
    expect(facts.action.evidenceCodes).toContain("TOOL_SCHEMA_VERIFIED");
  }
});

test("Pi 0.85.1 capability modes do not equate hasUI with safe approval", async () => {
  const runtime = await createRuntime();
  await setGoal(runtime, "inspect modes");
  const runner = runtime.session.extensionRunner;
  const dialogContext = runner.getUIContext();
  const cases = [
    ["tui", dialogContext, "local_interactive", "yes"],
    ["rpc", dialogContext, "remote_interactive", "no"],
    ["json", undefined, "event_stream", "no"],
    ["print", undefined, "one_shot", "no"],
    ["tui", undefined, "unknown", "unknown"],
    ["rpc", undefined, "unknown", "unknown"],
    ["json", dialogContext, "unknown", "unknown"],
    ["print", dialogContext, "unknown", "unknown"],
  ] as const;

  for (const [mode, ui, interaction, canPromptForApproval] of cases) {
    runner.setUIContext(ui, mode);
    const id = `call-${runtime.observed.length}`;
    await emitCall(runtime, {
      id,
      name: "read",
      arguments: { path: "note.txt" },
    });
    expect(runtime.observed.at(-1)?.capabilities).toEqual({
      interaction,
      canPromptForApproval,
    });
    await runner.emit({
      type: "tool_execution_end",
      toolCallId: id,
      toolName: "read",
      result: {},
      isError: false,
    });
  }
});

test("unknown and same-name overridden tools retain degraded identity", async () => {
  const unknown = await createRuntime();
  await setGoal(unknown, "unknown tool");
  const unknownResult = await emitCall(unknown, {
    id: "unknown-call",
    name: "mystery",
    arguments: {},
  });
  expect(unknown.observed[0]).toMatchObject({
    tool: { name: "mystery", status: "unknown" },
    evidenceCodes: ["TOOL_IDENTITY_UNKNOWN"],
  });
  expect(unknownResult).toMatchObject({ block: true });

  // Bash 分类结果不会进入文件工具 fast path；真实 Pi 生命周期中仍按 unsupported/unknown 阻止。
  const bashResult = await emitCall(unknown, {
    id: "bash-call",
    name: "bash",
    arguments: { command: "pwd" },
  });
  expect(unknown.observed.at(-1)).toMatchObject({
    tool: { name: "bash" },
    action: { kind: "unknown", mutatesState: "unknown" },
  });
  expect(bashResult).toMatchObject({ block: true });

  const overridden = await createRuntime({ overriddenRead: true });
  await setGoal(overridden, "overridden tool");
  await emitCall(overridden, {
    id: "override-call",
    name: "read",
    arguments: { path: "note.txt" },
  });
  expect(
    overridden.session.getAllTools().find((tool) => tool.name === "read"),
  ).toHaveProperty("sourceInfo.source", "sdk");
  expect(overridden.observed[0]).toMatchObject({
    tool: { name: "read", status: "overridden" },
    evidenceCodes: ["TOOL_IDENTITY_OVERRIDDEN"],
  });
});

test("missing, duplicate, changed-session, and incomplete sibling identities fail closed", async () => {
  const missing = await createRuntime();
  missing.sessionManager.appendMessage(
    assistantMessage([{ id: "", name: "read", arguments: {} }]),
  );
  expect(
    await missing.session.extensionRunner.emitToolCall({
      type: "tool_call",
      toolCallId: "",
      toolName: "read",
      input: {},
    }),
  ).toMatchObject({ block: true });

  const duplicateSibling = await createRuntime();
  duplicateSibling.sessionManager.appendMessage(
    assistantMessage([
      { id: "duplicate", name: "read", arguments: {} },
      { id: "duplicate", name: "write", arguments: {} },
    ]),
  );
  expect(
    await duplicateSibling.session.extensionRunner.emitToolCall({
      type: "tool_call",
      toolCallId: "duplicate",
      toolName: "read",
      input: {},
    }),
  ).toMatchObject({
    block: true,
    reason: expect.stringContaining("无法确认"),
  });

  const staleSession = await createRuntime();
  staleSession.sessionManager.newSession({ id: "session-two" });
  expect(
    await emitCall(staleSession, {
      id: "changed-session",
      name: "read",
      arguments: {},
    }),
  ).toMatchObject({ block: true });

  const incomplete = await createRuntime();
  incomplete.sessionManager.appendMessage({
    role: "user",
    content: "not an assistant tool-call message",
    timestamp: Date.now(),
  });
  expect(
    await incomplete.session.extensionRunner.emitToolCall({
      type: "tool_call",
      toolCallId: "missing-sibling",
      toolName: "read",
      input: {},
    }),
  ).toMatchObject({
    block: true,
    reason: expect.stringContaining("无法确认"),
  });

  const staleTurn = await createRuntime();
  staleTurn.sessionManager.appendMessage(
    assistantMessage([
      { id: "old-write", name: "write", arguments: { path: "old.txt" } },
    ]),
  );
  staleTurn.sessionManager.appendMessage({
    role: "user",
    content: "new turn",
    timestamp: Date.now(),
  });
  staleTurn.sessionManager.appendMessage(
    assistantMessage([
      { id: "new-read", name: "read", arguments: { path: "new.txt" } },
    ]),
  );
  expect(
    await staleTurn.session.extensionRunner.emitToolCall({
      type: "tool_call",
      toolCallId: "old-write",
      toolName: "write",
      input: { path: "old.txt", content: "old" },
    }),
  ).toMatchObject({
    block: true,
    reason: expect.stringContaining("无法确认"),
  });

  const unprovable = await createRuntime();
  unprovable.sessionManager.appendMessage({
    ...assistantMessage([
      { id: "current-write", name: "write", arguments: {} },
    ]),
    content: [
      {
        type: "toolCall",
        id: "current-write",
        name: "write",
        arguments: null,
      },
    ],
  } as unknown as Parameters<SessionManager["appendMessage"]>[0]);
  expect(
    await unprovable.session.extensionRunner.emitToolCall({
      type: "tool_call",
      toolCallId: "current-write",
      toolName: "write",
      input: { path: "new.txt", content: "new" },
    }),
  ).toMatchObject({
    block: true,
    reason: expect.stringContaining("无法确认"),
  });
});

test("active execution and goal state are cleaned up by Pi lifecycle events", async () => {
  const runtime = await createRuntime({ bindUI: true });
  await setGoal(runtime, "first goal");
  await writeFile(join(runtime.cwd, "note.txt"), "note", "utf8");
  const call = { id: "reused", name: "read", arguments: { path: "note.txt" } };
  expect(await emitCall(runtime, call)).toBeUndefined();
  const firstExecutionId = runtime.observed[0]?.hostExecutionId;
  const firstFacts = runtime.observed[0];
  if (!firstFacts) throw new Error("real Pi facts missing");
  const oldSessionToken = issueApprovalToken(
    firstFacts.action.actionId,
    executionBinding(firstFacts),
  );
  expect(
    await runtime.session.extensionRunner.emitToolCall({
      type: "tool_call",
      toolCallId: call.id,
      toolName: call.name,
      input: call.arguments,
    }),
  ).toMatchObject({ block: true });

  await runtime.session.extensionRunner.emit({
    type: "tool_execution_end",
    toolCallId: call.id,
    toolName: call.name,
    result: {},
    isError: false,
  });
  expect(
    await runtime.session.extensionRunner.emitToolCall({
      type: "tool_call",
      toolCallId: call.id,
      toolName: call.name,
      input: call.arguments,
    }),
  ).toBeUndefined();

  const runnerBeforeReload = runtime.session.extensionRunner;
  await runtime.session.reload();
  expect(runtime.session.extensionRunner).not.toBe(runnerBeforeReload);
  expect(await emitCall(runtime, call)).toBeUndefined();
  expect(runtime.observed.at(-1)?.userGoal).toEqual({ status: "unknown" });

  await runtime.session.extensionRunner.emit({
    type: "agent_end",
    messages: [],
  });
  await runtime.session.extensionRunner.emitToolCall({
    type: "tool_call",
    toolCallId: call.id,
    toolName: call.name,
    input: call.arguments,
  });
  expect(runtime.observed.at(-1)?.userGoal).toEqual({ status: "unknown" });

  await runtime.session.extensionRunner.emit({
    type: "session_shutdown",
    reason: "quit",
  });
  expect(
    await runtime.session.extensionRunner.emitToolCall({
      type: "tool_call",
      toolCallId: "after-shutdown",
      toolName: "read",
      input: {},
    }),
  ).toMatchObject({ block: true });

  runtime.sessionManager.newSession({ id: "session-two" });
  await runtime.session.extensionRunner.emit({
    type: "session_start",
    reason: "new",
  });
  await setGoal(runtime, "second goal");
  expect(await emitCall(runtime, call)).toBeUndefined();
  const secondSessionFacts = runtime.observed.at(-1);
  expect(secondSessionFacts).toMatchObject({ sessionId: "session-two" });
  expect(secondSessionFacts?.hostExecutionId).not.toBe(firstExecutionId);
  if (!secondSessionFacts) throw new Error("new Pi session facts missing");
  expect(
    consumeApprovalToken(
      oldSessionToken,
      firstFacts.action.actionId,
      executionBinding(secondSessionFacts),
    ),
  ).toBe(false);
});

test("Pi 0.85.1 binds the real cwd so approval cannot cross project sessions", async () => {
  const first = await createRuntime();
  const second = await createRuntime();
  await Promise.all([
    writeFile(join(first.cwd, "same.txt"), "same", "utf8"),
    writeFile(join(second.cwd, "same.txt"), "same", "utf8"),
  ]);
  const call = {
    id: "same-call",
    name: "read",
    arguments: { path: "same.txt" },
  };
  expect(await emitCall(first, call)).toBeUndefined();
  expect(await emitCall(second, call)).toBeUndefined();
  const firstFacts = first.observed[0];
  const secondFacts = second.observed[0];
  if (!firstFacts || !secondFacts) throw new Error("real Pi facts missing");

  expect(firstFacts.cwd).not.toBe(secondFacts.cwd);
  expect(firstFacts.sessionId).toBe(secondFacts.sessionId);
  expect(firstFacts.toolCallId).toBe(secondFacts.toolCallId);
  expect(firstFacts.action.fingerprint).toEqual(secondFacts.action.fingerprint);
  const token = issueApprovalToken(
    firstFacts.action.actionId,
    executionBinding(firstFacts),
  );
  expect(
    consumeApprovalToken(
      token,
      firstFacts.action.actionId,
      executionBinding(secondFacts),
    ),
  ).toBe(false);
});

test("raw tool and goal secrets never enter observable or blocked adapter output", async () => {
  const runtime = await createRuntime();
  const secret = "token=synthetic-adapter-credential";
  await setGoal(runtime, `保存 ${secret}`);
  await writeFile(join(runtime.cwd, "note.txt"), "note", "utf8");
  const results = await emitBatch(runtime, [
    { id: "sibling-read", name: "read", arguments: { path: "note.txt" } },
    {
      id: "secret-call",
      name: "write",
      arguments: { path: "new.txt", content: secret },
    },
  ]);
  const serialized = JSON.stringify(runtime.observed);
  expect(serialized).not.toContain(secret);
  expect(serialized).not.toContain("rawInput");
  expect(serialized).not.toContain('"canonical":');
  expect(JSON.stringify(results)).not.toContain(secret);

  const blocked = await runtime.session.extensionRunner.emitToolCall({
    type: "tool_call",
    toolCallId: "secret-call",
    toolName: "write",
    input: { content: secret },
  });
  expect(JSON.stringify(blocked)).not.toContain(secret);
});

test("Pi 0.85.1 TUI Continue is single-shot, Explain is not approval, Stop/Esc fail closed, and resize rerenders", async () => {
  const continueRuntime = await createRuntime();
  const continueUi = installApprovalUi(continueRuntime, [
    { inputs: ["down", "down", "enter", "enter"], widths: [18, 80] },
  ]);
  const continueResult = await emitCall(continueRuntime, {
    id: "continue-write",
    name: "write",
    arguments: { path: "continue.txt", content: "approved" },
  });
  expect(continueResult).toBeUndefined();
  expect(continueUi.doneCalls).toBe(1);
  expect(continueUi.rendered[0]?.every((line) => [...line].length <= 18)).toBe(
    true,
  );
  const wideActionLines = (continueUi.rendered[1] ?? []).filter(
    (line) => line.includes("[当前]") || line.includes("[ ]"),
  );
  expect(wideActionLines).toHaveLength(3);
  expect(wideActionLines[0]).toContain("[当前] 停止这一步");
  expect(wideActionLines[1]).toContain("[ ] 查看详情");
  expect(wideActionLines[2]).toContain("[ ] 继续这次修改");

  const explainRuntime = await createRuntime();
  const explainUi = installApprovalUi(explainRuntime, [
    { inputs: ["down", "enter", "down", "enter"] },
  ]);
  expect(
    await emitCall(explainRuntime, {
      id: "explain-write",
      name: "write",
      arguments: { path: "explain.txt", content: "approved after details" },
    }),
  ).toBeUndefined();
  expect(explainUi.doneCalls).toBe(1);
  expect(explainUi.rendered.some((lines) => lines.includes("详情："))).toBe(
    true,
  );
  expect(
    explainUi.rendered.some((lines) =>
      lines.join("").includes("查看详情不会批准修改"),
    ),
  ).toBe(true);

  for (const [id, input] of [
    ["stop-write", "enter"],
    ["escape-write", "esc"],
  ] as const) {
    const runtime = await createRuntime();
    installApprovalUi(runtime, [{ inputs: [input] }]);
    expect(
      await emitCall(runtime, {
        id,
        name: "write",
        arguments: { path: `${id}.txt`, content: "must not run" },
      }),
    ).toMatchObject({
      block: true,
      reason: expect.stringContaining("没有批准"),
    });
  }
});

test("Pi 0.85.1 TUI runs the complete supported read/write/edit pre-execution chain", async () => {
  const runtime = await createRuntime();
  const ui = installApprovalUi(runtime, [
    { inputs: ["down", "down", "enter"] },
    { inputs: ["down", "down", "enter"] },
  ]);
  await writeFile(join(runtime.cwd, "existing.txt"), "before", "utf8");

  expect(
    await emitCall(runtime, {
      id: "vertical-read",
      name: "read",
      arguments: { path: "existing.txt" },
    }),
  ).toBeUndefined();
  expect(
    await emitCall(runtime, {
      id: "vertical-write",
      name: "write",
      arguments: { path: "created.txt", content: "created" },
    }),
  ).toBeUndefined();
  const editArguments = {
    path: "existing.txt",
    edits: [{ oldText: "before", newText: "after" }],
  };
  expect(
    await emitCall(runtime, {
      id: "vertical-edit",
      name: "edit",
      arguments: editArguments,
    }),
  ).toBeUndefined();

  expect(ui.customCalls).toBe(2);
  expect(ui.statuses).toContainEqual({
    key: "agentglass-read",
    text: "正在查看：existing.txt，不会修改它。",
  });
  expect(runtime.observed.map((facts) => facts.action.kind)).toEqual([
    "read",
    "write",
    "edit",
  ]);
  const edit = runtime.session.getToolDefinition("edit");
  if (!edit) throw new Error("locked edit tool missing");
  await edit.execute(
    "vertical-edit",
    editArguments,
    undefined,
    undefined,
    undefined as never,
  );
  expect(await readFile(join(runtime.cwd, "existing.txt"), "utf8")).toBe(
    "after",
  );
});

test("Pi 0.85.1 abort, missing custom result, UI error, RPC hasUI, and no UI cannot approve", async () => {
  const aborted = await createRuntime();
  const abortUi = installApprovalUi(aborted, [{}]);
  const pending = emitCall(aborted, {
    id: "abort-write",
    name: "write",
    arguments: { path: "abort.txt", content: "must not run" },
  });
  await vi.waitFor(() => expect(abortUi.customCalls).toBe(1), {
    timeout: 30_000,
  });
  await aborted.session.extensionRunner.emit({
    type: "agent_end",
    messages: [],
  });
  await expect(pending).resolves.toMatchObject({ block: true });

  const reloaded = await createRuntime({ bindUI: true });
  const reloadUi = installApprovalUi(reloaded, [{}]);
  const pendingReload = emitCall(reloaded, {
    id: "reload-write",
    name: "write",
    arguments: { path: "reload.txt", content: "must not run" },
  });
  await vi.waitFor(() => expect(reloadUi.customCalls).toBe(1), {
    timeout: 30_000,
  });
  await reloaded.session.reload();
  await expect(pendingReload).resolves.toMatchObject({ block: true });

  for (const fixture of [
    { name: "missing custom result", step: { missingResult: true } },
    { name: "UI error", step: { error: true } },
  ]) {
    const runtime = await createRuntime();
    installApprovalUi(runtime, [fixture.step]);
    expect(
      await emitCall(runtime, {
        id: fixture.name,
        name: "write",
        arguments: { path: `${fixture.name}.txt`, content: "must not run" },
      }),
    ).toMatchObject({ block: true });
  }

  const rpc = await createRuntime();
  const rpcUi = installApprovalUi(
    rpc,
    [{ inputs: ["down", "down", "enter"] }],
    "rpc",
  );
  expect(
    await emitCall(rpc, {
      id: "rpc-write",
      name: "write",
      arguments: { path: "rpc.txt", content: "must not run" },
    }),
  ).toMatchObject({
    block: true,
    reason: expect.stringContaining("本地审批界面"),
  });
  expect(rpcUi.customCalls).toBe(0);

  for (const mode of ["print", "json"] as const) {
    const conflicting = await createRuntime();
    const conflictingUi = installApprovalUi(
      conflicting,
      [{ inputs: ["down", "down", "enter"] }],
      mode,
    );
    expect(
      await emitCall(conflicting, {
        id: `${mode}-ui-write`,
        name: "write",
        arguments: { path: `${mode}.txt`, content: "must not run" },
      }),
    ).toMatchObject({
      block: true,
      reason: expect.stringContaining("本地审批界面"),
    });
    expect(conflictingUi.customCalls).toBe(0);
  }

  const noUi = await createRuntime();
  expect(
    await emitCall(noUi, {
      id: "print-write",
      name: "write",
      arguments: { path: "print.txt", content: "must not run" },
    }),
  ).toMatchObject({
    block: true,
    reason: expect.stringContaining("本地审批界面"),
  });
  noUi.session.extensionRunner.setUIContext(undefined, "json");
  expect(
    await emitCall(noUi, {
      id: "json-write",
      name: "write",
      arguments: { path: "json.txt", content: "must not run" },
    }),
  ).toMatchObject({
    block: true,
    reason: expect.stringContaining("本地审批界面"),
  });
  noUi.session.extensionRunner.setUIContext(undefined, "tui");
  expect(
    await emitCall(noUi, {
      id: "tui-no-ui-write",
      name: "write",
      arguments: { path: "tui.txt", content: "must not run" },
    }),
  ).toMatchObject({
    block: true,
    reason: expect.stringContaining("本地审批界面"),
  });
});

test("Pi 0.85.1 regenerates the card after input change and executes only the exact current action", async () => {
  const runtime = await createRuntime();
  const call = {
    id: "changed-write",
    name: "write",
    arguments: { path: "changed.txt", content: "first" },
  };
  const ui = installApprovalUi(runtime, [
    {
      onOpen: () => {
        call.arguments.content = "second";
      },
      inputs: ["down", "down", "enter"],
    },
    { inputs: ["down", "down", "enter"] },
  ]);

  expect(await emitCall(runtime, call)).toBeUndefined();
  expect(ui.customCalls).toBe(2);
  expect(runtime.observed).toHaveLength(2);
  expect(runtime.observed[0]?.input.fingerprint.value).not.toBe(
    runtime.observed[1]?.input.fingerprint.value,
  );

  const write = runtime.session.getToolDefinition("write");
  if (!write) throw new Error("locked write tool missing");
  await write.execute(
    call.id,
    call.arguments,
    undefined,
    undefined,
    undefined as never,
  );
  expect(await readFile(join(runtime.cwd, "changed.txt"), "utf8")).toBe(
    "second",
  );
});

test("Pi 0.85.1 invalidates a saved pre-image after target drift and requires a fresh card", async () => {
  const runtime = await createRuntime();
  const targetPath = join(runtime.cwd, "drift.txt");
  await writeFile(targetPath, "before", "utf8");
  const ui = installApprovalUi(runtime, [
    {
      onOpen: () => writeFile(targetPath, "concurrent change", "utf8"),
      inputs: ["down", "down", "enter"],
    },
    { inputs: ["down", "down", "enter"] },
  ]);

  expect(
    await emitCall(runtime, {
      id: "drift-write",
      name: "write",
      arguments: { path: "drift.txt", content: "planned" },
    }),
  ).toBeUndefined();
  expect(ui.customCalls).toBe(2);
  expect(runtime.observed).toHaveLength(2);
  expect(runtime.observed[0]?.preImage.snapshotId).not.toBe(
    runtime.observed[1]?.preImage.snapshotId,
  );
});

test("Pi 0.85.1 exposes every required binding dimension and each changed value invalidates approval", async () => {
  const runtime = await createRuntime();
  await writeFile(join(runtime.cwd, "binding.txt"), "binding", "utf8");
  expect(
    await emitCall(runtime, {
      id: "binding-read",
      name: "read",
      arguments: { path: "binding.txt" },
    }),
  ).toBeUndefined();
  const facts = runtime.observed[0];
  if (!facts) throw new Error("real Pi facts missing");
  const approved = executionBinding(facts);
  const changes: Partial<ExecutionBinding>[] = [
    { fingerprint: { ...approved.fingerprint, value: "f".repeat(64) } },
    { toolName: "edit" },
    { cwd: join(runtime.cwd, "other") },
    { sessionId: "session-two" },
    { hostExecutionId: "different-execution" },
    { toolCallId: "different-call" },
  ];

  expect(approved).toMatchObject({
    toolName: "read",
    cwd: runtime.cwd,
    sessionId: "session-one",
    hostExecutionId: expect.stringMatching(/^[a-f\d]{64}$/),
  });
  for (const change of changes) {
    const token = issueApprovalToken(facts.action.actionId, approved);
    expect(
      consumeApprovalToken(token, facts.action.actionId, {
        ...approved,
        ...change,
      }),
    ).toBe(false);
  }
});

test("B-001 hard-blocks a mutation when required snapshot storage is unavailable", async () => {
  const runtime = await createRuntime({ snapshotUnavailable: true });
  const ui = installApprovalUi(runtime, []);

  expect(
    await emitCall(runtime, {
      id: "degraded-write",
      name: "write",
      arguments: { path: "degraded.txt", content: "approved" },
    }),
  ).toMatchObject({
    block: true,
    reason: expect.stringContaining("修改前证据"),
  });
  expect(runtime.observed[0]?.preImage).toMatchObject({
    status: "unavailable",
    canRestoreNow: false,
    recoveryGrade: "unknown",
  });
  expect(ui.customCalls).toBe(0);
});

test("B-001 hard-blocks an overwrite whose pre-image exceeds the 10 MiB limit", async () => {
  const runtime = await createRuntime();
  const ui = installApprovalUi(runtime, []);
  await writeFile(
    join(runtime.cwd, "large.txt"),
    Buffer.alloc(10 * 1024 * 1024 + 1),
  );
  expect(
    await emitCall(runtime, {
      id: "large-preimage",
      name: "write",
      arguments: { path: "large.txt", content: "replacement" },
    }),
  ).toMatchObject({
    block: true,
    reason: expect.stringContaining("修改前证据"),
  });
  expect(runtime.observed.at(-1)?.preImage).toMatchObject({
    status: "unavailable",
    failureCode: "SNAPSHOT_FILE_TOO_LARGE",
  });
  expect(ui.customCalls).toBe(0);
});

test("B-001 correlates one result to one card and rejects duplicate, wrong-order, drifted, missing, and late results", async () => {
  const runtime = await createRuntime();
  const ui = installApprovalUi(runtime, [
    { inputs: ["down", "down", "enter"] },
    { inputs: ["down", "down", "enter"] },
    { inputs: ["down", "down", "enter"] },
  ]);
  const runner = runtime.session.extensionRunner;

  await runner.emitToolResult({
    type: "tool_result",
    toolCallId: "not-started",
    toolName: "write",
    input: { path: "ignored.txt", content: "ignored" },
    content: [{ type: "text", text: "must be ignored" }],
    details: undefined,
    isError: false,
  });
  expect(ui.widgets).toHaveLength(0);

  const matched = {
    id: "matched-result",
    name: "write",
    arguments: { path: "matched.txt", content: "expected" },
  };
  expect(await emitCall(runtime, matched)).toBeUndefined();
  await writeFile(join(runtime.cwd, "matched.txt"), "expected", "utf8");
  const resultEvent = {
    type: "tool_result" as const,
    toolCallId: matched.id,
    toolName: "write" as const,
    input: matched.arguments,
    content: [{ type: "text" as const, text: "untrusted result" }],
    details: undefined,
    isError: false,
  };
  await runner.emitToolResult(resultEvent);
  const afterFirst = ui.widgets.length;
  const matchedCard = ui.widgets.at(-1)?.content ?? [];
  expect(matchedCard[0]).toContain("已确认：matched.txt");
  expect(matchedCard[1]).toContain("✓ 工具状态");
  expect(matchedCard[2]).toContain("✓ 文件核对");
  expect(matchedCard[3]).toContain("? 仍未知");
  expect(matchedCard[4]).toContain("• 核对范围");
  expect(matchedCard[5]).toContain("↶ 恢复");
  expect(matchedCard[6]).toContain("› 下一步");
  await runner.emitToolResult(resultEvent);
  expect(ui.widgets).toHaveLength(afterFirst);
  expect(JSON.stringify(ui.widgets)).not.toContain("untrusted result");
  await runner.emit({
    type: "tool_execution_end",
    toolCallId: matched.id,
    toolName: "write",
    result: {},
    isError: false,
  });

  const drifted = {
    id: "drifted-result",
    name: "write",
    arguments: { path: "drifted.txt", content: "expected" },
  };
  expect(await emitCall(runtime, drifted)).toBeUndefined();
  await writeFile(join(runtime.cwd, "drifted.txt"), "expected", "utf8");
  await runner.emitToolResult({
    ...resultEvent,
    toolCallId: drifted.id,
    input: { path: "other.txt", content: "expected" },
  });
  expect(ui.widgets.at(-1)?.content?.[0]).toContain("无法确认：drifted.txt");
  await runner.emit({
    type: "tool_execution_end",
    toolCallId: drifted.id,
    toolName: "write",
    result: {},
    isError: false,
  });

  const missing = {
    id: "missing-result",
    name: "write",
    arguments: { path: "missing-result.txt", content: "expected" },
  };
  expect(await emitCall(runtime, missing)).toBeUndefined();
  const beforeWrongEnd = ui.widgets.length;
  await runner.emit({
    type: "tool_execution_end",
    toolCallId: missing.id,
    toolName: "edit",
    result: {},
    isError: false,
  });
  expect(ui.widgets).toHaveLength(beforeWrongEnd);
  await runner.emit({
    type: "tool_execution_end",
    toolCallId: missing.id,
    toolName: "write",
    result: { content: [{ type: "text", text: "not inspected" }] },
    isError: false,
  });
  expect(ui.widgets.at(-1)?.content?.join("\n")).toContain(
    "无法确认工具是否完成",
  );
  expect(JSON.stringify(ui.widgets)).not.toContain("not inspected");

  const lifecycle = await createRuntime();
  const lifecycleUi = installApprovalUi(lifecycle, [
    { inputs: ["down", "down", "enter"] },
  ]);
  const late = {
    id: "late-result",
    name: "write",
    arguments: { path: "late.txt", content: "expected" },
  };
  expect(await emitCall(lifecycle, late)).toBeUndefined();
  await lifecycle.session.extensionRunner.emit({
    type: "session_shutdown",
    reason: "quit",
  });
  const beforeLate = lifecycleUi.widgets.length;
  await lifecycle.session.extensionRunner.emitToolResult({
    ...resultEvent,
    toolCallId: late.id,
    input: late.arguments,
  });
  expect(lifecycleUi.widgets).toHaveLength(beforeLate);

  const ended = await createRuntime();
  const endedUi = installApprovalUi(ended, [
    { inputs: ["down", "down", "enter"] },
  ]);
  const endedCall = {
    id: "agent-ended",
    name: "write",
    arguments: { path: "ended.txt", content: "expected" },
  };
  expect(await emitCall(ended, endedCall)).toBeUndefined();
  await ended.session.extensionRunner.emit({ type: "agent_end", messages: [] });
  expect(endedUi.widgets.at(-1)?.content?.join("\n")).toContain(
    "无法确认工具是否完成",
  );
  const afterEnd = endedUi.widgets.length;
  await ended.session.extensionRunner.emitToolResult({
    ...resultEvent,
    toolCallId: endedCall.id,
    input: endedCall.arguments,
  });
  expect(endedUi.widgets).toHaveLength(afterEnd);
});

test("B-001 keeps repeated read feedback on one status key", async () => {
  const runtime = await createRuntime();
  const ui = installApprovalUi(runtime, []);
  await writeFile(join(runtime.cwd, "read.txt"), "content", "utf8");
  for (const id of ["read-one", "read-two"]) {
    const call = { id, name: "read", arguments: { path: "read.txt" } };
    expect(await emitCall(runtime, call)).toBeUndefined();
    await runtime.session.extensionRunner.emitToolResult({
      type: "tool_result",
      toolCallId: id,
      toolName: "read",
      input: call.arguments,
      content: [{ type: "text", text: "content" }],
      details: undefined,
      isError: false,
    });
    await runtime.session.extensionRunner.emit({
      type: "tool_execution_end",
      toolCallId: id,
      toolName: "read",
      result: {},
      isError: false,
    });
  }
  expect(new Set(ui.statuses.map(({ key }) => key))).toEqual(
    new Set(["agentglass-read"]),
  );
  expect(ui.widgets).toHaveLength(0);
});

test("B-003 reuses /agentglass for help, the fixed example, conflicts, and cancellation", async () => {
  const runtime = await createRuntime({
    bindUI: true,
    captureStartup: true,
  });
  expect(runtime.startupWidgets).toHaveLength(1);
  const startup = runtime.startupWidgets[0]?.join("\n") ?? "";
  expect(startup).toContain("AgentGlass 已启用");
  expect(startup).toContain("• 当前项目");
  expect(startup).toContain("✓ 支持");
  expect(startup).toContain("› 命令");
  expect(startup).not.toContain("当前项目：");
  await runtime.session.extensionRunner.emit({
    type: "session_start",
    reason: "reload",
  });
  expect(runtime.startupWidgets).toHaveLength(1);
  const ui = installApprovalUi(runtime, [
    { inputs: ["pagedown", "pagedown", "pagedown", "pagedown", "esc"] },
    { inputs: ["down", "down", "enter"] },
    { inputs: ["pagedown", "pagedown", "pagedown", "pagedown", "esc"] },
    { inputs: ["enter"] },
  ]);

  const firstHelpRender = ui.rendered.length;
  await runtime.session.prompt("/agentglass help");
  const helpRenders = ui.rendered.slice(firstHelpRender);
  expect(helpRenders[0]?.length ?? 0).toBeGreaterThan(18);
  expect(helpRenders[0]?.some((line) => line.includes("能力"))).toBe(true);
  expect(
    helpRenders.some((lines) => lines.some((line) => line.includes("操作"))),
  ).toBe(true);
  expect(
    helpRenders.some((lines) =>
      lines.some((line) => line.includes("最近结果")),
    ),
  ).toBe(true);
  expect(helpRenders.flat().join("\n")).not.toContain(runtime.cwd);
  expect(ui.customCalls).toBe(1);

  await runtime.session.prompt("/agentglass example");
  const examplePath = join(runtime.cwd, "agentglass-example", "活动说明.txt");
  expect(await readFile(examplePath, "utf8")).toBe(
    "活动说明\n\n活动名称：社区旧物交换日\n时间：周六 10:00—15:00\n地点：社区活动室\n安排：带来闲置物品，现场登记后交换。\n报名：现场登记。\n",
  );
  expect(ui.customCalls).toBe(2);

  const secondHelpRender = ui.rendered.length;
  await runtime.session.prompt("/agentglass help");
  const secondHelpRenders = ui.rendered.slice(secondHelpRender);
  expect(secondHelpRenders.flat().join("\n")).toContain("最近结果");
  expect(secondHelpRenders.flat().join("\n")).toContain("安全示例已准备");
  expect(ui.customCalls).toBe(3);

  await runtime.session.prompt("/agentglass example");
  expect(ui.customCalls).toBe(3);
  expect(ui.notifications.at(-1)?.message).toContain("不会覆盖已有目录或文件");

  await rm(join(runtime.cwd, "agentglass-example"), {
    recursive: true,
    force: true,
  });
  await runtime.session.prompt("/agentglass example");
  expect(ui.customCalls).toBe(4);
  expect(ui.notifications.at(-1)?.message).toContain("没有创建目录或文件");
  expect(
    await readFile(
      join(runtime.cwd, "agentglass-example", "活动说明.txt"),
      "utf8",
    ).catch(() => undefined),
  ).toBeUndefined();
});

test("B-003 blocks example preparation without interactive UI", async () => {
  const runtime = await createRuntime();
  await runtime.session.prompt("/agentglass example");
  expect(
    await readFile(
      join(runtime.cwd, "agentglass-example", "活动说明.txt"),
      "utf8",
    ).catch(() => undefined),
  ).toBeUndefined();
});

test("B-003 help falls back to a compact widget when the floating view fails", async () => {
  const runtime = await createRuntime({ bindUI: true });
  const ui = installApprovalUi(runtime, [{ error: true }]);

  await runtime.session.prompt("/agentglass help");

  const fallback = ui.widgets.at(-1)?.content?.join("\n") ?? "";
  expect(fallback).toContain("✓ 能力");
  expect(fallback).toContain("× 限制");
  expect(ui.notifications.at(-1)?.message).toContain("帮助浮层无法打开");
});

test("N-001 verifies the locked Pi editor setter is synchronous and does not submit", () => {
  let submitted = 0;
  const editor = new Editor({ requestRender: () => {} } as never, {
    borderColor: (value) => value,
    selectList: {} as never,
  });
  editor.onSubmit = () => {
    submitted += 1;
  };

  editor.setText("用户草稿");

  expect(editor.getText()).toBe("用户草稿");
  expect(editor.getExpandedText()).toBe("用户草稿");
  expect(submitted).toBe(0);
});

test("N-001 verifies locked Pi InteractiveMode editor UI mapping without submission", async () => {
  const runtime = await createRuntime();
  const runtimeHost = {
    session: runtime.session,
    setBeforeSessionInvalidate: () => {},
    setRebindSession: () => {},
  } as unknown as AgentSessionRuntime;
  const interactiveMode = new InteractiveMode(runtimeHost);

  try {
    // 直接使用锁定包的 InteractiveMode 生成 ExtensionUIContext，不能用
    // runner.setUIContext 覆盖 get/set；这样才能验证 Pi 宿主实际的 editor wiring。
    const ui = (
      interactiveMode as unknown as {
        createExtensionUIContext: () => ExtensionUIContext;
      }
    ).createExtensionUIContext();
    const editor = (
      interactiveMode as unknown as {
        editor: { onSubmit: (text: string) => void };
      }
    ).editor;
    let submitted = 0;
    editor.onSubmit = () => {
      submitted += 1;
    };

    ui.setEditorText("真实 InteractiveMode 草稿");

    expect(ui.getEditorText()).toBe("真实 InteractiveMode 草稿");
    expect(submitted).toBe(0);
  } finally {
    interactiveMode.stop();
  }
});

test("N-001 fills the three local Chinese starter drafts without sending or changing files", async () => {
  const cases = [
    {
      steps: [
        { value: "✦ 开始一个文件任务" },
        { value: "创建说明" },
        { value: "docs/activity.md" },
        { value: "为新成员说明活动流程" },
      ],
      expected: "请为这个文件创建一份说明。",
    },
    {
      steps: [
        { value: "✦ 开始一个文件任务" },
        { value: "润色文案" },
        { value: "copy.md" },
        { value: "语气更清楚" },
        { value: "活动日期和报名方式" },
      ],
      expected: "请先查看这个文件，再按要求润色文案。",
    },
    {
      steps: [
        { value: "✦ 开始一个文件任务" },
        { value: "整理文本" },
        { value: "notes.md" },
        { value: "按主题分组并补充标题" },
        { value: "保留原有事实" },
      ],
      expected: "请先查看这个文件，再按要求整理文本结构。",
    },
  ];

  for (const item of cases) {
    const runtime = await createRuntime();
    const beforeFiles = await readdir(runtime.cwd);
    const sendUserMessage = vi.spyOn(runtime.session, "sendUserMessage");
    const ui = installStarterUi(runtime, item.steps);

    await runStarter(runtime);

    expect(ui.editorText).toContain(item.expected);
    expect(ui.editorText).toContain("不安装、不运行程序");
    expect(ui.setCalls).toBe(1);
    expect(ui.editorEvents.slice(-2)).toEqual(["get", "set"]);
    expect(sendUserMessage).not.toHaveBeenCalled();
    expect(runtime.observed).toHaveLength(0);
    expect(await readdir(runtime.cwd)).toEqual(beforeFiles);
    sendUserMessage.mockRestore();
  }
});

test("N-001 preserves existing input and does not fill after cancellation or missing required fields", async () => {
  const cases: Array<{
    steps: StarterDialogStep[];
    editorText?: string;
    expected?: string;
  }> = [
    {
      steps: [{ value: "关闭" }],
    },
    {
      steps: [{ value: "✦ 开始一个文件任务" }, { value: "创建说明" }],
    },
    {
      steps: [
        { value: "✦ 开始一个文件任务" },
        { value: "创建说明" },
        { value: "   " },
      ],
      expected: "缺少必填的文件路径",
    },
    {
      steps: [
        { value: "✦ 开始一个文件任务" },
        { value: "创建说明" },
        { value: "notes.md" },
        { value: "\t  " },
      ],
      expected: "缺少必填的要求",
    },
  ];

  for (const item of cases) {
    const runtime = await createRuntime();
    const beforeFiles = await readdir(runtime.cwd);
    const sendUserMessage = vi.spyOn(runtime.session, "sendUserMessage");
    const ui = installStarterUi(
      runtime,
      item.steps,
      item.editorText === undefined
        ? undefined
        : { editorText: item.editorText },
    );

    await runStarter(runtime);

    expect(ui.setCalls).toBe(0);
    expect(ui.editorText).toBe(item.editorText ?? "");
    if (item.expected)
      expect(ui.notifications.at(-1)?.message).toContain(item.expected);
    expect(sendUserMessage).not.toHaveBeenCalled();
    expect(runtime.observed).toHaveLength(0);
    expect(await readdir(runtime.cwd)).toEqual(beforeFiles);
    sendUserMessage.mockRestore();
  }

  const existing = await createRuntime();
  const existingFiles = await readdir(existing.cwd);
  const existingSend = vi.spyOn(existing.session, "sendUserMessage");
  const existingUi = installStarterUi(
    existing,
    [{ value: "✦ 开始一个文件任务" }],
    { editorText: "  用户已有内容  " },
  );

  await runStarter(existing);

  expect(existingUi.setCalls).toBe(0);
  expect(existingUi.editorText).toBe("  用户已有内容  ");
  expect(existingUi.notifications.at(-1)?.message).toContain("已有内容");
  expect(existingSend).not.toHaveBeenCalled();
  expect(existing.observed).toHaveLength(0);
  expect(await readdir(existing.cwd)).toEqual(existingFiles);
  existingSend.mockRestore();
});

test("N-001 rejects busy, changed, stale, ambiguous, secret, control, and oversized starter flows", async () => {
  const busy = await createRuntime({ bindUI: true });
  const busyFiles = await readdir(busy.cwd);
  const busySend = vi.spyOn(busy.session, "sendUserMessage");
  const busyUi = installStarterUi(busy, [{ value: "✦ 开始一个文件任务" }]);
  const runner = busy.session.extensionRunner as unknown as {
    isIdleFn: () => boolean;
  };
  const previousIdle = runner.isIdleFn;
  runner.isIdleFn = () => false;

  await runStarter(busy);

  expect(busyUi.setCalls).toBe(0);
  expect(busyUi.notifications.length).toBeGreaterThan(0);
  expect(busySend).not.toHaveBeenCalled();
  expect(busy.observed).toHaveLength(0);
  expect(await readdir(busy.cwd)).toEqual(busyFiles);
  runner.isIdleFn = previousIdle;
  busySend.mockRestore();

  const duringInput = await createRuntime();
  const duringInputFiles = await readdir(duringInput.cwd);
  const duringInputSend = vi.spyOn(duringInput.session, "sendUserMessage");
  const duringInputUi = installStarterUi(duringInput, [
    { value: "✦ 开始一个文件任务" },
    { value: "创建说明" },
    { value: "notes.md" },
    {
      value: "写一份说明",
      onOpen: ({ setEditorText }) => setEditorText("用户期间输入"),
    },
  ]);

  await runStarter(duringInput);

  expect(duringInputUi.setCalls).toBe(0);
  expect(duringInputUi.editorText).toBe("用户期间输入");
  expect(duringInputUi.notifications.at(-1)?.message).toContain(
    "引导期间发生变化",
  );
  expect(duringInputSend).not.toHaveBeenCalled();
  expect(duringInput.observed).toHaveLength(0);
  expect(await readdir(duringInput.cwd)).toEqual(duringInputFiles);
  duringInputSend.mockRestore();

  const stale = await createRuntime();
  const staleFiles = await readdir(stale.cwd);
  const staleSend = vi.spyOn(stale.session, "sendUserMessage");
  const staleUi = installStarterUi(stale, [
    { value: "✦ 开始一个文件任务" },
    {
      value: "创建说明",
      onOpen: () =>
        stale.session.extensionRunner.emit({
          type: "session_start",
          reason: "reload",
        }),
    },
  ]);

  await runStarter(stale);

  expect(staleUi.setCalls).toBe(0);
  expect(staleUi.notifications.at(-1)?.message).toContain("任务或文件夹已变化");
  expect(staleSend).not.toHaveBeenCalled();
  expect(stale.observed).toHaveLength(0);
  expect(await readdir(stale.cwd)).toEqual(staleFiles);
  staleSend.mockRestore();

  const running = await createRuntime();
  const runningFiles = await readdir(running.cwd);
  const runningSend = vi.spyOn(running.session, "sendUserMessage");
  const runningUi = installStarterUi(running, [
    { value: "✦ 开始一个文件任务" },
    {
      value: "创建说明",
      onOpen: async () => {
        await running.session.extensionRunner.emitBeforeAgentStart(
          "新的真实任务",
          undefined,
          "system",
          { cwd: running.cwd },
        );
      },
    },
  ]);

  await runStarter(running);

  expect(runningUi.setCalls).toBe(0);
  expect(runningUi.notifications.at(-1)?.message).toContain(
    "任务或文件夹已变化",
  );
  expect(runningSend).not.toHaveBeenCalled();
  expect(running.observed).toHaveLength(0);
  expect(await readdir(running.cwd)).toEqual(runningFiles);
  runningSend.mockRestore();

  const cwdChanged = await createRuntime();
  const cwdChangedFiles = await readdir(cwdChanged.cwd);
  const cwdChangedSend = vi.spyOn(cwdChanged.session, "sendUserMessage");
  const cwdChangedUi = installStarterUi(cwdChanged, [
    { value: "✦ 开始一个文件任务" },
    { value: "创建说明" },
    { value: "notes.md" },
    {
      value: "写一份说明",
      onOpen: ({ setCwd }) => setCwd(join(cwdChanged.cwd, "changed-cwd")),
    },
  ]);

  await runStarter(cwdChanged);

  expect(cwdChangedUi.setCalls).toBe(0);
  expect(cwdChangedUi.notifications.at(-1)?.message).toContain(
    "任务或文件夹已变化",
  );
  expect(cwdChangedSend).not.toHaveBeenCalled();
  expect(cwdChanged.observed).toHaveLength(0);
  expect(await readdir(cwdChanged.cwd)).toEqual(cwdChangedFiles);
  cwdChangedSend.mockRestore();

  for (const invalidPath of [
    "../notes.md",
    "C:\\notes.md",
    "notes/password=synthetic-secret.md",
  ]) {
    const runtime = await createRuntime();
    const beforeFiles = await readdir(runtime.cwd);
    const sendUserMessage = vi.spyOn(runtime.session, "sendUserMessage");
    const ui = installStarterUi(runtime, [
      { value: "✦ 开始一个文件任务" },
      { value: "创建说明" },
      { value: invalidPath },
    ]);

    await runStarter(runtime);

    expect(ui.setCalls).toBe(0);
    expect(ui.notifications.at(-1)?.message).toContain("没有修改文件或输入框");
    expect(sendUserMessage).not.toHaveBeenCalled();
    expect(runtime.observed).toHaveLength(0);
    expect(await readdir(runtime.cwd)).toEqual(beforeFiles);
    sendUserMessage.mockRestore();
  }

  const secretAndControl = await createRuntime();
  const secretFiles = await readdir(secretAndControl.cwd);
  const secretSend = vi.spyOn(secretAndControl.session, "sendUserMessage");
  const secretUi = installStarterUi(secretAndControl, [
    { value: "✦ 开始一个文件任务" },
    { value: "润色文案" },
    { value: "copy.md" },
    { value: "password=synthetic-secret\u001b[31m语气清晰" },
    { value: "保留日期" },
  ]);

  await runStarter(secretAndControl);

  expect(secretUi.setCalls).toBe(1);
  expect(secretUi.editorText).not.toContain("synthetic-secret");
  expect(secretUi.editorText).not.toContain("\u001b");
  expect(secretUi.editorText).not.toContain("[31m");
  expect(secretUi.notifications.at(-1)?.message).toContain("安全隐藏或过滤");
  expect(secretSend).not.toHaveBeenCalled();
  expect(secretAndControl.observed).toHaveLength(0);
  expect(await readdir(secretAndControl.cwd)).toEqual(secretFiles);
  secretSend.mockRestore();

  const oversizedFlows: StarterDialogStep[][] = [
    [
      { value: "✦ 开始一个文件任务" },
      { value: "创建说明" },
      { value: "notes.md" },
      { value: "x".repeat(4097) },
    ],
    [
      { value: "✦ 开始一个文件任务" },
      { value: "润色文案" },
      { value: "notes.md" },
      { value: "x".repeat(4096) },
      { value: "x".repeat(4096) },
    ],
  ];
  for (const steps of oversizedFlows) {
    const runtime = await createRuntime();
    const beforeFiles = await readdir(runtime.cwd);
    const sendUserMessage = vi.spyOn(runtime.session, "sendUserMessage");
    const ui = installStarterUi(runtime, steps);

    await runStarter(runtime);

    expect(ui.setCalls).toBe(0);
    expect(ui.notifications.at(-1)?.message).toContain("无法生成安全请求");
    expect(sendUserMessage).not.toHaveBeenCalled();
    expect(runtime.observed).toHaveLength(0);
    expect(await readdir(runtime.cwd)).toEqual(beforeFiles);
    sendUserMessage.mockRestore();
  }

  const redactionFailure = await createRuntime();
  const redactionFiles = await readdir(redactionFailure.cwd);
  const redactionSend = vi.spyOn(redactionFailure.session, "sendUserMessage");
  const redactionUi = installStarterUi(redactionFailure, [
    { value: "✦ 开始一个文件任务" },
    { value: "创建说明" },
    { value: "notes.md" },
    { value: "写一份说明" },
  ]);
  const redactionSpy = vi
    .spyOn(inputBoundary, "redactDisplayString")
    .mockImplementation(() => {
      throw new Error("synthetic redaction failure");
    });

  try {
    await runStarter(redactionFailure);
  } finally {
    redactionSpy.mockRestore();
  }

  expect(redactionUi.setCalls).toBe(0);
  expect(redactionUi.notifications.at(-1)?.message).toContain(
    "无法生成安全请求",
  );
  expect(redactionSend).not.toHaveBeenCalled();
  expect(redactionFailure.observed).toHaveLength(0);
  expect(await readdir(redactionFailure.cwd)).toEqual(redactionFiles);
  redactionSend.mockRestore();
});

test("N-001 reports UI read/write failures without retrying or clearing the editor", async () => {
  const noUi = await createRuntime();
  const noUiFiles = await readdir(noUi.cwd);
  const noUiSend = vi.spyOn(noUi.session, "sendUserMessage");

  await noUi.session.prompt("/agentglass start");

  expect(noUiSend).not.toHaveBeenCalled();
  expect(noUi.observed).toHaveLength(0);
  expect(await readdir(noUi.cwd)).toEqual(noUiFiles);
  noUiSend.mockRestore();

  const menuFailure = await createRuntime({ bindUI: true });
  const menuFiles = await readdir(menuFailure.cwd);
  const menuSend = vi.spyOn(menuFailure.session, "sendUserMessage");
  const menuUi = installStarterUi(menuFailure, [{ error: true }]);

  await runStarter(menuFailure);

  expect(menuUi.setCalls).toBe(0);
  expect(menuUi.notifications.at(-1)?.message).toContain("AgentGlass 菜单");
  expect(menuSend).not.toHaveBeenCalled();
  expect(menuFailure.observed).toHaveLength(0);
  expect(await readdir(menuFailure.cwd)).toEqual(menuFiles);
  menuSend.mockRestore();

  const readFailure = await createRuntime();
  const readFiles = await readdir(readFailure.cwd);
  const readSend = vi.spyOn(readFailure.session, "sendUserMessage");
  const readUi = installStarterUi(
    readFailure,
    [{ value: "✦ 开始一个文件任务" }],
    { getEditorTextError: true },
  );

  await runStarter(readFailure);

  expect(readUi.setCalls).toBe(0);
  expect(readUi.notifications.at(-1)?.message).toContain(
    "无法确认请求是否填入",
  );
  expect(readSend).not.toHaveBeenCalled();
  expect(readFailure.observed).toHaveLength(0);
  expect(await readdir(readFailure.cwd)).toEqual(readFiles);
  readSend.mockRestore();

  const finalReadFailure = await createRuntime();
  const finalReadFiles = await readdir(finalReadFailure.cwd);
  const finalReadSend = vi.spyOn(finalReadFailure.session, "sendUserMessage");
  const finalReadUi = installStarterUi(
    finalReadFailure,
    [
      { value: "✦ 开始一个文件任务" },
      { value: "创建说明" },
      { value: "notes.md" },
      { value: "写一份说明" },
    ],
    { getEditorTextErrorAt: 5 },
  );

  await runStarter(finalReadFailure);

  expect(finalReadUi.setCalls).toBe(0);
  expect(finalReadUi.getEditorTextCalls).toBe(5);
  expect(finalReadUi.editorEvents.slice(-1)).toEqual(["get"]);
  expect(finalReadUi.notifications.at(-1)?.message).toContain(
    "无法确认请求是否填入",
  );
  expect(finalReadSend).not.toHaveBeenCalled();
  expect(finalReadFailure.observed).toHaveLength(0);
  expect(await readdir(finalReadFailure.cwd)).toEqual(finalReadFiles);
  finalReadSend.mockRestore();

  const writeFailure = await createRuntime();
  const writeFiles = await readdir(writeFailure.cwd);
  const writeSend = vi.spyOn(writeFailure.session, "sendUserMessage");
  const writeUi = installStarterUi(
    writeFailure,
    [
      { value: "✦ 开始一个文件任务" },
      { value: "创建说明" },
      { value: "notes.md" },
      { value: "写一份说明" },
    ],
    { setEditorTextError: true },
  );

  await runStarter(writeFailure);

  expect(writeUi.setCalls).toBe(1);
  expect(writeUi.editorText).toBe("");
  expect(writeUi.editorEvents.slice(-2)).toEqual(["get", "set"]);
  expect(writeUi.notifications.at(-1)?.message).toContain(
    "无法确认请求是否填入",
  );
  expect(writeSend).not.toHaveBeenCalled();
  expect(writeFailure.observed).toHaveLength(0);
  expect(await readdir(writeFailure.cwd)).toEqual(writeFiles);
  writeSend.mockRestore();
});
