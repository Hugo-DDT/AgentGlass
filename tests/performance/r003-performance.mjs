import { execFile, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat,
  truncate,
  writeFile,
} from "node:fs/promises";
import { cpus, release, tmpdir } from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), "../..");
const INPUT_LIMIT = 64 * 1024;
const FILE_LIMIT = 10 * 1024 * 1024;
const TOTAL_LIMIT = 100 * 1024 * 1024;
const ENTRY_LIMIT = 4096;
const temporaryRoots = [];
const stageSamples = new Map();

function option(name) {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function percentile(values, ratio) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[
    Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)
  ];
}

function summarize(values) {
  if (values.length === 0) return { samples: 0 };
  const mean =
    values.reduce((total, value) => total + value, 0) / values.length;
  return {
    samples: values.length,
    p50Ms: Number(percentile(values, 0.5).toFixed(3)),
    p95Ms: Number(percentile(values, 0.95).toFixed(3)),
    minMs: Number(Math.min(...values).toFixed(3)),
    maxMs: Number(Math.max(...values).toFixed(3)),
    meanMs: Number(mean.toFixed(3)),
  };
}

function recordStage(name, milliseconds) {
  const values = stageSamples.get(name) ?? [];
  values.push(milliseconds);
  stageSamples.set(name, values);
}

async function timed(name, operation) {
  const start = performance.now();
  const result = await operation();
  recordStage(name, performance.now() - start);
  return result;
}

async function measured(name, operation, samples, warmup = 0, runs = 1) {
  const values = [];
  for (let run = 0; run < runs; run += 1) {
    for (let index = 0; index < warmup; index += 1) await operation();
    for (let index = 0; index < samples; index += 1) {
      const start = performance.now();
      await operation();
      values.push(performance.now() - start);
    }
  }
  return { name, ...summarize(values) };
}

async function importCandidate(packageRoot, file) {
  return import(
    pathToFileURL(path.join(packageRoot, "dist", "src", "core", file)).href
  );
}

async function readPackageInfo(packageRoot, tarball) {
  const packageJson = JSON.parse(
    await readFile(path.join(packageRoot, "package.json"), "utf8"),
  );
  const result = {
    name: packageJson.name,
    version: packageJson.version,
    packageRootKind: "isolated npm install from R-002 tarball",
  };
  if (tarball) {
    const bytes = await readFile(tarball);
    result.tarball = {
      fileName: path.basename(tarball),
      packedBytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    };
  }
  return result;
}

async function getCommandVersion(command, args) {
  try {
    const { stdout } = await execFileAsync(command, args, {
      windowsHide: true,
      maxBuffer: 16 * 1024,
    });
    return stdout.trim().split(/\r?\n/u).at(-1) ?? "";
  } catch {
    return null;
  }
}

async function fileSystemName(targetPath) {
  if (process.platform !== "win32")
    return "POSIX filesystem (R-002 support is Windows-only)";
  try {
    const root = path
      .parse(path.resolve(targetPath))
      .root.replace(/[\\/]$/u, "");
    const { stdout } = await execFileAsync(
      "fsutil.exe",
      ["fsinfo", "volumeinfo", root],
      {
        windowsHide: true,
        maxBuffer: 32 * 1024,
      },
    );
    const match = /(?:File System Name|文件系统名称)\s*:\s*([^\r\n]+)/iu.exec(
      stdout,
    );
    if (match?.[1]?.trim()) return match[1].trim();
    const knownName = /\b(NTFS|ReFS|FAT32|exFAT)\b/iu.exec(stdout);
    return knownName?.[1] ?? "Windows filesystem (name unavailable)";
  } catch {
    return "Windows filesystem (name unavailable)";
  }
}

async function runPiCli(packageRoot, withExtension) {
  const root = await mkdtemp(path.join(tmpdir(), "agentglass-r003-cli-"));
  temporaryRoots.push(root);
  const cwd = path.join(root, "project");
  const agentDir = path.join(root, "agent");
  await mkdir(cwd);
  await mkdir(agentDir);
  const args = ["--offline", "--print", "--no-session"];
  if (withExtension) args.push("-e", packageRoot);
  else args.push("--no-extensions");

  // 通过真实 Pi 可执行文件做裸机/加载候选对照；--offline、空 stdin 和隔离目录
  // 保证不会调用生产模型、读取用户认证或把测试状态写入工作区。stdout/stderr
  // 只消费不保存，避免原始提示、诊断或扩展输出进入性能证据。
  const executable = process.platform === "win32" ? "cmd.exe" : "pi";
  const commandArgs =
    process.platform === "win32"
      ? [
          "/d",
          "/s",
          "/c",
          ["pi", ...args]
            .map((arg) =>
              /\s/u.test(arg) ? `"${arg.replaceAll('"', '""')}"` : arg,
            )
            .join(" "),
        ]
      : args;
  const start = performance.now();
  const exitCode = await new Promise((resolve, reject) => {
    const child = spawn(executable, commandArgs, {
      cwd,
      env: { ...process.env, PI_CODING_AGENT_DIR: agentDir },
      windowsHide: true,
    });
    child.stdout?.resume();
    child.stderr?.resume();
    child.once("error", reject);
    child.once("close", resolve);
    child.stdin.end("\n");
  });
  return { elapsedMs: performance.now() - start, exitCode };
}

async function loadComparison(packageRoot, samples) {
  const pairs = [];
  for (let index = 0; index < samples; index += 1) {
    // 交替首个进程，避免固定裸机→扩展顺序把机器瞬时负载偏差带入增量。
    const extensionFirst = index % 2 === 1;
    const firstResult = await runPiCli(packageRoot, extensionFirst);
    const secondResult = await runPiCli(packageRoot, !extensionFirst);
    const extensionResult = extensionFirst ? firstResult : secondResult;
    const bareResult = extensionFirst ? secondResult : firstResult;
    pairs.push({
      bareMs: Number(bareResult.elapsedMs.toFixed(3)),
      withExtensionMs: Number(extensionResult.elapsedMs.toFixed(3)),
      deltaMs: Number(
        (extensionResult.elapsedMs - bareResult.elapsedMs).toFixed(3),
      ),
      bareExitCode: bareResult.exitCode,
      extensionExitCode: extensionResult.exitCode,
      order: extensionFirst ? "extension-first" : "bare-first",
    });
  }
  return {
    samples: pairs.length,
    target:
      "same-machine paired Pi CLI startup with alternating order and empty stdin; offline, model and user-file work excluded",
    bare: summarize(pairs.map((pair) => pair.bareMs)),
    withExtension: summarize(pairs.map((pair) => pair.withExtensionMs)),
    loadIncrement: summarize(pairs.map((pair) => pair.deltaMs)),
    pairs,
  };
}

async function makeFixture(name, size = 1024, existing = true) {
  const root = await mkdtemp(path.join(tmpdir(), `agentglass-r003-${name}-`));
  temporaryRoots.push(root);
  const workspace = path.join(root, "project");
  const snapshotRoot = path.join(root, "snapshots");
  await mkdir(workspace);
  const targetPath = path.join(workspace, "measure.txt");
  if (existing) await writeFile(targetPath, Buffer.alloc(size, 65));
  return { root, workspace, snapshotRoot, targetPath };
}

function actionTarget(action) {
  const target = action.targets[0];
  if (!target) throw new Error("missing benchmark target");
  return target;
}

async function measureCorePaths(packageRoot, runs) {
  // 这里刻意把“纯预检”和真实路径链路拆开：前者在同一进程预热后只调用
  // canonicalization/fingerprint、脱敏投影、风险聚合和效果推导；后者逐项纳入
  // realpath、文件读写、快照、ACL、Pi edit 推导和独立核验，防止用最快的纯函数
  // 掩盖用户真正等待的安全成本。所有文件内容均为合成字节，结果只输出计时摘要。
  const [
    boundary,
    classification,
    execution,
    riskEngine,
    prediction,
    verification,
    stable,
    snapshot,
  ] = await Promise.all([
    importCandidate(packageRoot, "input-boundary.js"),
    importCandidate(packageRoot, "file-classification.js"),
    importCandidate(packageRoot, "execution-input.js"),
    importCandidate(packageRoot, "risk-engine.js"),
    importCandidate(packageRoot, "predicted-effects.js"),
    importCandidate(packageRoot, "file-verification.js"),
    importCandidate(packageRoot, "stable-file.js"),
    importCandidate(packageRoot, "pre-image-snapshot.js"),
  ]);
  const fixture = await makeFixture("core", 1024);
  const normalContent = "A".repeat(INPUT_LIMIT - 256);
  const rawWrite = { path: "measure.txt", content: normalContent };
  const writeTool = { name: "write", status: "verified_builtin" };
  const readTool = { name: "read", status: "verified_builtin" };
  const classified = await classification.classifyFileAction({
    actionId: "r003-base",
    cwd: fixture.workspace,
    tool: writeTool,
    rawInput: rawWrite,
  });
  const baseAction = classified.action;
  const purePreflight = await measured(
    "purePreflightUnder64KiB",
    () => {
      // 纯预检只测 raw canonicalization/redaction 与确定性风险/预期效果计算；
      // 它刻意不调用 realpath/lstat、snapshot、ACL、Pi UI、文件读取或模型。
      const projected = boundary.projectTransientActionInput("write", rawWrite);
      const action = { ...baseAction, fingerprint: projected.fingerprint };
      const risk = riskEngine.assessSiblingMutationRisk(action, [action]);
      prediction.predictEffects(action, risk);
    },
    1000,
    100,
    runs,
  );
  const readAction = await classification.classifyFileAction({
    actionId: "r003-read",
    cwd: fixture.workspace,
    tool: readTool,
    rawInput: { path: "measure.txt" },
  });
  const transient = {
    hostExecutionId: "r003-host-execution",
    toolCallId: "r003-tool-call",
    sessionId: "r003-session",
    cwd: fixture.workspace,
    tool: writeTool,
    capabilities: { interaction: "one_shot", canPromptForApproval: "no" },
    siblings: [
      {
        hostExecutionId: "r003-host-execution",
        toolCallId: "r003-tool-call",
        sessionId: "r003-session",
        cwd: fixture.workspace,
        tool: writeTool,
      },
    ],
    userGoal: { status: "unknown" },
    rawInput: rawWrite,
  };
  const realPathPreflight = await measured(
    "classificationAndPathPreflight",
    async () => {
      const facts = await execution.projectHostExecutionInput(transient);
      const risk = riskEngine.assessSiblingMutationRisk(facts.action, [
        facts.action,
      ]);
      prediction.predictEffects(facts.action, risk);
    },
    Math.max(10, 10 * runs),
    2,
  );
  const readPath = await measured(
    "realpathAndStableFileRead",
    () => stable.readStableFile(fixture.targetPath, FILE_LIMIT),
    Math.max(10, 10 * runs),
    2,
  );
  const classificationRead = await measured(
    "readClassificationWithRealpath",
    () =>
      classification.classifyFileAction({
        actionId: "r003-read-repeat",
        cwd: fixture.workspace,
        tool: readTool,
        rawInput: { path: "measure.txt" },
      }),
    Math.max(10, 10 * runs),
    2,
  );

  const editInput = {
    path: "measure.txt",
    edits: [{ oldText: "R003-EDIT-UNIQUE-MARKER", newText: "B".repeat(1024) }],
  };
  await writeFile(
    fixture.targetPath,
    Buffer.concat([
      Buffer.from("R003-EDIT-UNIQUE-MARKER", "utf8"),
      Buffer.alloc(1024 - 24, 65),
    ]),
  );
  const before = await stable.readStableFile(fixture.targetPath, FILE_LIMIT);
  const editDerivation = await measured(
    "expectedEditDerivation",
    async () => {
      let finalContent;
      const definition = await import("@earendil-works/pi-coding-agent").then(
        ({ createEditToolDefinition }) =>
          createEditToolDefinition(fixture.workspace, {
            operations: {
              access: async () => {},
              readFile: async () => before.bytes,
              writeFile: async (_target, content) => {
                finalContent = content;
              },
            },
          }),
      );
      await definition.execute(
        "r003-edit",
        editInput,
        undefined,
        undefined,
        undefined,
      );
      if (finalContent === undefined)
        throw new Error("edit derivation missing");
      verification.hashFileBytes(Buffer.from(finalContent, "utf8"));
    },
    Math.max(10, 10 * runs),
    2,
  );

  const writeAfter = Buffer.alloc(1024, 66);
  const exactExpected = {
    actionId: "r003-verify-action",
    effectId: "r003-verify-effect",
    targetId: "r003-verify-target",
    kind: "exact_bytes",
    expectedSha256: verification.hashFileBytes(writeAfter),
    expectedByteLength: writeAfter.length,
    beforeSha256: verification.hashFileBytes(before.bytes),
    beforeIdentity: before.identity,
    targetExisted: true,
  };
  const verificationStage = await measured(
    "independentFileVerification",
    () =>
      verification.verifyFilePostcondition(
        fixture.targetPath,
        exactExpected,
        "succeeded",
      ),
    Math.max(10, 10 * runs),
    2,
  );

  const captureSizes = [1024, 64 * 1024, 1024 * 1024, FILE_LIMIT];
  const preImage = {};
  for (const size of captureSizes) {
    const samples =
      size === FILE_LIMIT ? Math.max(2, runs) : Math.max(5, 5 * runs);
    preImage[`${size}Bytes`] = await measured(
      `preImageCapture_${size}Bytes`,
      async () => {
        const item = await makeFixture(`snapshot-${size}`, size);
        try {
          await snapshot.capturePreImageSnapshot(item.snapshotRoot, {
            actionId: "r003-snapshot-action",
            targetId: "r003-snapshot-target",
            targetPath: item.targetPath,
            targetExisted: true,
          });
        } finally {
          await rm(item.root, { recursive: true, force: true });
        }
      },
      samples,
      0,
    );
  }
  const aclProcess =
    process.platform === "win32"
      ? await measured(
          "windowsAclChildProcessEquivalent",
          async () => {
            const item = await makeFixture("acl", 1024);
            try {
              const script =
                "$ErrorActionPreference='Stop'; $item=Get-Item -LiteralPath $env:AGENTGLASS_R003_ACL_PATH; $null=$item.GetAccessControl()";
              const encoded = Buffer.from(script, "utf16le").toString("base64");
              await execFileAsync(
                "powershell.exe",
                [
                  "-NoLogo",
                  "-NoProfile",
                  "-NonInteractive",
                  "-EncodedCommand",
                  encoded,
                ],
                {
                  windowsHide: true,
                  timeout: 10_000,
                  maxBuffer: 16 * 1024,
                  env: {
                    ...process.env,
                    AGENTGLASS_R003_ACL_PATH: item.targetPath,
                  },
                },
              );
            } finally {
              await rm(item.root, { recursive: true, force: true });
            }
          },
          Math.max(5, 5 * runs),
          0,
        )
      : {
          name: "windowsAclChildProcessEquivalent",
          samples: 0,
          status: "not_applicable",
        };

  const fullChain = await measureFullChain(
    snapshot,
    stable,
    verification,
    runs,
  );
  const stages = Object.fromEntries(
    [...stageSamples].map(([name, values]) => [name, summarize(values)]),
  );
  return {
    inputDataset: {
      kind: "synthetic non-secret text",
      ordinaryInputBytes: Buffer.byteLength(JSON.stringify(rawWrite)),
      limitBytes: INPUT_LIMIT,
    },
    purePreflight,
    pathAndIo: {
      realPathPreflight,
      readPath,
      classificationRead,
      editDerivation,
      verificationStage,
    },
    preImage,
    aclProcess,
    fullChain,
    stages,
    baseClassification: {
      readDecision: riskEngine.assessRisk(readAction.action).decision,
      writeDecision: riskEngine.assessRisk(baseAction).decision,
      targetState: actionTarget(baseAction).state,
    },
  };
}

async function measureFullChain(snapshot, stable, verification, runs) {
  // 每个样本都从受控临时项目开始，并完整走到 ready、恢复和清理；任一中间状态
  // 不满足明确证据就让测量失败，而不是把部分完成写成成功。finally 只删除本次
  // 创建的隔离根，不触碰工作区或用户恢复副本。
  const samples = Math.max(2, runs);
  const fullSamples = [];
  for (let index = 0; index < samples; index += 1) {
    const item = await makeFixture(`full-${index}`, 1024);
    const before = await stable.readStableFile(item.targetPath, FILE_LIMIT);
    const after = Buffer.alloc(1024, 66);
    const expected = {
      actionId: `r003-full-action-${index}`,
      effectId: `r003-full-effect-${index}`,
      targetId: `r003-full-target-${index}`,
      kind: "exact_bytes",
      expectedSha256: verification.hashFileBytes(after),
      expectedByteLength: after.length,
      beforeSha256: verification.hashFileBytes(before.bytes),
      beforeIdentity: before.identity,
      targetExisted: true,
    };
    const fullStart = performance.now();
    try {
      const preImage = await timed("full.preImage", () =>
        snapshot.capturePreImageSnapshot(item.snapshotRoot, {
          actionId: expected.actionId,
          targetId: expected.targetId,
          targetPath: item.targetPath,
          targetExisted: true,
        }),
      );
      if (preImage.status !== "saved" || !preImage.snapshotId)
        throw new Error("pre-image not saved");
      await timed("full.fileWrite", () => writeFile(item.targetPath, after));
      const report = await timed("full.verification", () =>
        verification.verifyFilePostcondition(
          item.targetPath,
          expected,
          "succeeded",
        ),
      );
      if (report.status !== "matched")
        throw new Error("verification did not match");
      const ready = await timed("full.recoveryFinalize", () =>
        snapshot.finalizeRecoverySnapshot(
          item.snapshotRoot,
          preImage,
          expected.effectId,
          expected.expectedSha256,
          expected.expectedByteLength,
        ),
      );
      if (!ready) throw new Error("recovery entry not ready");
      await timed("full.recoveryCurrentCheck", () =>
        snapshot.recoveryEntryIsCurrent(item.snapshotRoot, ready),
      );
      const restored = await timed("full.restore", () =>
        snapshot.restoreRecoveryEntry(item.snapshotRoot, ready),
      );
      if (restored.status !== "restored")
        throw new Error("restore did not match");
      const cleanup = await timed("full.cleanupInspection", () =>
        snapshot.inspectCleanupSet(item.snapshotRoot),
      );
      await timed("full.cleanup", () =>
        snapshot.cleanSnapshotSet(item.snapshotRoot, cleanup),
      );
      fullSamples.push(performance.now() - fullStart);
    } finally {
      await rm(item.root, { recursive: true, force: true });
    }
  }
  return {
    samples: fullSamples.length,
    totalThroughReadyRestoreCleanup: summarize(fullSamples),
  };
}

function uuidEntry(index, suffix) {
  return `00000000-0000-0000-0000-${index.toString(16).padStart(12, "0")}.${suffix}`;
}

async function quotaScenarios(snapshot) {
  // 配额测试先放入“旧”数据，再提出新变更，分别验证边界、超限、未知版本、锁和
  // 故障注入。预期是新变更停止且旧数据保留；清理仅针对本次受控 Temp 根，不能
  // 为了让基准继续跑而静默删除旧 snapshot。
  const results = [];
  const exact = await makeFixture("quota-file-exact", FILE_LIMIT);
  try {
    const captured = await snapshot.capturePreImageSnapshot(
      exact.snapshotRoot,
      {
        actionId: "r003-file-exact",
        targetId: "r003-file-exact-target",
        targetPath: exact.targetPath,
        targetExisted: true,
      },
    );
    results.push({
      name: "10MiB-file-boundary",
      status: captured.status,
      failureCode: captured.failureCode,
      oldDataPreserved: true,
    });
  } finally {
    await rm(exact.root, { recursive: true, force: true });
  }
  const oversized = await makeFixture("quota-file-over", FILE_LIMIT + 1);
  try {
    const captured = await snapshot.capturePreImageSnapshot(
      oversized.snapshotRoot,
      {
        actionId: "r003-file-over",
        targetId: "r003-file-over-target",
        targetPath: oversized.targetPath,
        targetExisted: true,
      },
    );
    results.push({
      name: "10MiB-file-over",
      status: captured.status,
      failureCode: captured.failureCode,
      oldDataPreserved:
        (await lstat(oversized.targetPath)).size === FILE_LIMIT + 1,
    });
  } finally {
    await rm(oversized.root, { recursive: true, force: true });
  }
  for (const [name, bytes] of [
    ["100MiB-total-boundary", TOTAL_LIMIT],
    ["100MiB-total-over", TOTAL_LIMIT + 1],
  ]) {
    const item = await makeFixture(`quota-${name}`, 0, false);
    const oldData = path.join(item.snapshotRoot, uuidEntry(1, "preimage"));
    await mkdir(item.snapshotRoot, { recursive: true });
    await writeFile(oldData, "");
    await truncate(oldData, bytes);
    try {
      const captured = await snapshot.capturePreImageSnapshot(
        item.snapshotRoot,
        {
          actionId: `r003-${name}`,
          targetId: `r003-${name}-target`,
          targetPath: item.targetPath,
          targetExisted: false,
        },
      );
      results.push({
        name,
        status: captured.status,
        failureCode: captured.failureCode,
        oldDataPreserved: (await lstat(oldData)).size === bytes,
      });
    } finally {
      await rm(item.root, { recursive: true, force: true });
    }
  }
  const entries = await makeFixture("quota-entries", 0, false);
  await mkdir(entries.snapshotRoot, { recursive: true });
  for (let index = 0; index < ENTRY_LIMIT - 1; index += 1)
    await writeFile(
      path.join(entries.snapshotRoot, uuidEntry(index, "preimage")),
      "",
    );
  try {
    const first = await snapshot.capturePreImageSnapshot(entries.snapshotRoot, {
      actionId: "r003-entry-first",
      targetId: "r003-entry-first-target",
      targetPath: entries.targetPath,
      targetExisted: false,
    });
    const second = await snapshot.capturePreImageSnapshot(
      entries.snapshotRoot,
      {
        actionId: "r003-entry-second",
        targetId: "r003-entry-second-target",
        targetPath: path.join(entries.workspace, "second.txt"),
        targetExisted: false,
      },
    );
    results.push({
      name: "4096-entry-boundary",
      first: first.status,
      second: second.status,
      secondFailureCode: second.failureCode,
      oldDataPreserved:
        (await readdir(entries.snapshotRoot)).length >= ENTRY_LIMIT,
    });
  } finally {
    await rm(entries.root, { recursive: true, force: true });
  }
  const locked = await makeFixture("quota-lock", 0, false);
  await mkdir(locked.snapshotRoot, { recursive: true });
  await writeFile(path.join(locked.snapshotRoot, ".snapshot.lock"), "lock");
  try {
    const captured = await snapshot.capturePreImageSnapshot(
      locked.snapshotRoot,
      {
        actionId: "r003-lock",
        targetId: "r003-lock-target",
        targetPath: locked.targetPath,
        targetExisted: false,
      },
    );
    results.push({
      name: "lock-competition",
      status: captured.status,
      failureCode: captured.failureCode,
      oldDataPreserved: true,
    });
  } finally {
    await rm(locked.root, { recursive: true, force: true });
  }
  const legacy = await makeFixture("quota-legacy", 0, false);
  await mkdir(legacy.snapshotRoot, { recursive: true });
  const legacyManifest = path.join(
    legacy.snapshotRoot,
    uuidEntry(2, "manifest.json"),
  );
  await writeFile(
    legacyManifest,
    JSON.stringify({ schemaVersion: 99, kind: "future" }),
  );
  try {
    const set = await snapshot.inspectCleanupSet(legacy.snapshotRoot);
    const cleaned = await snapshot.cleanSnapshotSet(legacy.snapshotRoot, set);
    results.push({
      name: "legacy-future-data",
      inspectedFiles: set.fileCount,
      cleanChanged: cleaned.changed,
      oldDataPreserved: (await stat(legacyManifest)).isFile(),
    });
  } finally {
    await rm(legacy.root, { recursive: true, force: true });
  }
  for (const injection of [
    "permission_error",
    "disk_full",
    "interrupted_publish",
  ]) {
    const item = await makeFixture(`fault-${injection}`, 0, false);
    try {
      const captured = await snapshot.capturePreImageSnapshot(
        item.snapshotRoot,
        {
          actionId: `r003-${injection}`,
          targetId: `r003-${injection}-target`,
          targetPath: item.targetPath,
          targetExisted: false,
        },
        injection,
      );
      results.push({
        name: `failure-${injection}`,
        status: captured.status,
        failureCode: captured.failureCode,
        oldDataPreserved: true,
      });
    } finally {
      await rm(item.root, { recursive: true, force: true });
    }
  }
  return results;
}

function memorySample(label) {
  if (typeof global.gc === "function") global.gc();
  const memory = process.memoryUsage();
  return {
    label,
    rssBytes: memory.rss,
    heapUsedBytes: memory.heapUsed,
    externalBytes: memory.external,
    arrayBuffersBytes: memory.arrayBuffers,
    activeResourceCount: process.getActiveResourcesInfo?.().length ?? null,
  };
}

function assistantMessage(id) {
  return {
    role: "assistant",
    content: [
      { type: "toolCall", id, name: "read", arguments: { path: "note.txt" } },
    ],
    api: "anthropic-messages",
    provider: "r003-test",
    model: "r003-test",
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

async function lifecycleMeasurement(packageRoot) {
  // 使用真实 Pi SDK 会话但不调用模型，重复 read 事件后显式触发 agent_end、reload、
  // session/cwd 关联切换、shutdown 和 dispose，再采集 RSS/heap/active resources。
  // session history 是 Pi 自身状态，单独标注为贡献者，不能被误报为 AgentGlass 泄漏。
  const {
    createAgentSession,
    DefaultResourceLoader,
    ModelRuntime,
    SessionManager,
    SettingsManager,
  } = await import("@earendil-works/pi-coding-agent");
  const root = await mkdtemp(path.join(tmpdir(), "agentglass-r003-lifecycle-"));
  const cwd = path.join(root, "project");
  const agentDir = path.join(root, "agent");
  await mkdir(cwd);
  await mkdir(agentDir);
  await writeFile(path.join(cwd, "note.txt"), "note", "utf8");
  const settingsManager = SettingsManager.inMemory();
  const loader = new DefaultResourceLoader({
    cwd,
    agentDir,
    settingsManager,
    additionalExtensionPaths: [packageRoot],
    noExtensions: true,
    noSkills: true,
    noPromptTemplates: true,
    noThemes: true,
    noContextFiles: true,
  });
  const previousAgentDir = process.env.PI_CODING_AGENT_DIR;
  process.env.PI_CODING_AGENT_DIR = agentDir;
  try {
    await loader.reload();
  } finally {
    if (previousAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
    else process.env.PI_CODING_AGENT_DIR = previousAgentDir;
  }
  const sessionManager = SessionManager.inMemory(cwd, {
    id: "r003-session-one",
  });
  const modelRuntime = await ModelRuntime.create({
    authPath: path.join(agentDir, "auth.json"),
    modelsPath: null,
    refreshOnCreate: false,
  });
  const { session } = await createAgentSession({
    cwd,
    agentDir,
    resourceLoader: loader,
    settingsManager,
    sessionManager,
    modelRuntime,
  });
  await session.bindExtensions({ mode: "print" });
  const checkpoints = [memorySample("start")];
  const cycles = 256;
  for (let index = 0; index < cycles; index += 1) {
    const id = `r003-read-${index}`;
    sessionManager.appendMessage(assistantMessage(id));
    const result = await session.extensionRunner.emitToolCall({
      type: "tool_call",
      toolCallId: id,
      toolName: "read",
      input: { path: "note.txt" },
    });
    if (result !== undefined) throw new Error("read was not allowed");
    await session.extensionRunner.emitToolResult({
      type: "tool_result",
      toolCallId: id,
      toolName: "read",
      input: { path: "note.txt" },
      content: [],
      details: undefined,
      isError: false,
    });
    if ([64, 128, 256].includes(index + 1))
      checkpoints.push(memorySample(`after-${index + 1}-read-cycles`));
  }
  await session.extensionRunner.emit({ type: "agent_end", messages: [] });
  checkpoints.push(memorySample("after-agent-end"));
  await session.reload();
  checkpoints.push(memorySample("after-reload"));
  sessionManager.newSession({ id: "r003-session-two" });
  await session.extensionRunner.emit({ type: "session_start", reason: "new" });
  checkpoints.push(memorySample("after-session-switch"));
  await session.extensionRunner.emit({
    type: "session_shutdown",
    reason: "quit",
  });
  checkpoints.push(memorySample("after-shutdown"));
  session.dispose?.();
  if (typeof global.gc === "function") global.gc();
  const afterDispose = memorySample("after-dispose");
  await rm(root, { recursive: true, force: true });
  return {
    cycles,
    checkpoints,
    afterDispose,
    scope:
      "actual Pi session plus Adapter; Pi session message history remains a separate contributor",
    lifecycleEvents: [
      "agent_end",
      "reload",
      "session_start(new)",
      "session_shutdown",
      "dispose",
    ],
  };
}

async function main() {
  const packageRootOption = option("--package-root");
  const packageRoot = packageRootOption ? path.resolve(packageRootOption) : "";
  const tarball = option("--tarball");
  const runs = positiveInteger(option("--runs"), 3);
  if (!packageRoot || !(await lstat(packageRoot).catch(() => undefined)))
    throw new Error("--package-root must point to an installed candidate");
  if (process.argv.includes("--load-only")) {
    process.stdout.write(
      `${JSON.stringify(await loadComparison(packageRoot, runs), null, 2)}\n`,
    );
    return;
  }
  const report = {
    schemaVersion: 1,
    task: "R-003",
    measuredAt: new Date().toISOString(),
    cwdKind: "G:/work/AgentGlass",
    host: {
      platform: process.platform,
      release: release(),
      arch: process.arch,
      cpuCount: cpus().length,
      node: process.version,
      npm: await getCommandVersion(
        process.platform === "win32" ? "cmd.exe" : "npm",
        process.platform === "win32"
          ? ["/d", "/s", "/c", "npm --version"]
          : ["--version"],
      ),
      pi: await getCommandVersion(
        process.platform === "win32" ? "cmd.exe" : "pi",
        process.platform === "win32"
          ? ["/d", "/s", "/c", "pi --version"]
          : ["--version"],
      ),
      filesystem: await fileSystemName(repoRoot),
      terminal: {
        columns: process.stdout.columns ?? null,
        rows: process.stdout.rows ?? null,
        mode: "non-interactive test-side measurement",
      },
      load: "idle local machine; no production model request",
    },
    candidate: await readPackageInfo(packageRoot, tarball),
    sampling: {
      purePreflight: {
        warmupPerRun: 100,
        samplesPerRun: 1000,
        runs,
        aggregateSamples: 1000 * runs,
      },
      fileAndLifecycle:
        "repeated controlled samples; count is retained per result",
      timer:
        "performance.now wall-clock around the named operation; setup and cleanup outside the timed interval unless named",
    },
    scope: {
      purePreflightIncludes: [
        "fingerprint/canonicalization",
        "redacted projection",
        "risk aggregation",
        "effect prediction",
      ],
      purePreflightExcludes: [
        "lstat/realpath",
        "file reads/writes",
        "snapshot",
        "ACL child process",
        "Pi UI",
        "model",
      ],
      fullPathIncludes: [
        "path preflight",
        "file I/O",
        "pre-image",
        "verification",
        "recovery",
        "cleanup",
      ],
      modelAndUserWait: "not invoked; reported separately as excluded",
      secrets:
        "synthetic non-secret bytes only; no raw payload, user file body or snapshot body is emitted",
    },
    loadComparison: await loadComparison(packageRoot, Math.max(3, runs)),
    core: await measureCorePaths(packageRoot, runs),
    quotas: await quotaScenarios(
      await importCandidate(packageRoot, "pre-image-snapshot.js"),
    ),
    lifecycle: await lifecycleMeasurement(packageRoot),
  };
  report.activeHandlesAfterMeasurement =
    process.getActiveResourcesInfo?.() ?? null;
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

try {
  await main();
} finally {
  for (const root of temporaryRoots.splice(0))
    await rm(root, { recursive: true, force: true });
}
