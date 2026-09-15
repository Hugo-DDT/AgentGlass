# AgentGlass Pi Web Codex Prompt 手册

> 版本：1.1 · 2026-09-15 · 对应 development-plan §8 · 五份未来阶段提示词（当前暂缓）

正式任务、依赖和 Done Definition 以 [开发计划](development-plan.md) 为准，本手册只展开未来阶段执行要求。用户已决定暂缓 Pi Web 适配，当前 W-001～W-005 均为 `DEFERRED`；阅读提示词本身不执行任务，也不授权恢复适配。此前执行结果以开发计划和 references §41～§43 的历史记录为准。当前发布基线是已发布的 `0.8.0`。

如果未来重新启动本阶段，只能在重新明确分配、重新核对 `0.8.0` 基线和实际宿主制品后，复制目标任务的完整 text 代码块。按 **W-001 → W-002 → W-003 → W-004 → W-005** 逐项分配并评审；每份只授权对应任务，不要一次粘贴五份。历史 W-001～W-005 证据不能替代新一轮候选、制品和安全验收。

## W-001 规范与真实宿主合约

~~~text
现在执行 docs/development-plan.md §8 的 W-001「规范与真实宿主合约」。仅分配本任务。
核对首版发布证据（references §40）；本消息仅分配 W-001，不实施生产适配。

仓库与依据
- AgentGlass 仓库为 G:/work/AgentGlass。先读取 AGENTS.md、docs/development-plan.md §8 的当前任务及完整 Done Definition、docs/security-invariants.md §15、docs/architecture.md §12、docs/product-spec.md §9、docs/outcome-card-spec.md §8、docs/risk-model.md、docs/threat-model.md §9、docs/references.md §40～41 及后续实际证据。
- 查看真实 cwd、HEAD、git status/diff、任务相关源码、全部调用者、测试与 lockfile。docs 和 AGENTS 被忽略，必须直接读取；保护已有用户修改。
- 正式任务源是 development-plan；本 Prompt 不另立规范。冲突按 security-invariants → 当前明确任务 → AGENTS → 技术规范 → 开发计划 → 产品规格处理，明确记录冲突，不能选较弱安全解释。
- 0.8.0 已发布。W-001～W-005 的初始状态是 NOT_STARTED；文档规划不是 W-001 完成，也不是上游补丁/联调证据。不要重新执行历史 Release 任务，不把历史 PASS 当本轮结果。

实现约束
- 使用一个 Pi extension；Pi/Web API 只放 extensions/ 和 src/adapter/pi/，Core 不依赖宿主类型。先搜索并复用现有实现，不新增通用抽象、服务、端口、主动网络、运行时依赖或配置开关。
- 支持范围仍是已验证内置 read/write/edit；保留工具/schema、路径、sibling、备份、五项精确绑定、目标前像、异步检查后同步单次消费及恢复冲突检查。RPC+hasUI、环境变量和方法存在不能证明审批能力；普通 RPC/print/json 继续拒绝审批。
- 遵守 architecture §12 的会话/连接/请求归属、合格显示、断线/超时失效；不转移、不恢复旧批准，不自动重试可能已执行的动作。协议标识不是恶意共存扩展隔离。
- Pi Web 自带上传、终端、Git、配置和宿主 transcript 不在 AgentGlass 全面保护/脱敏承诺内。只针对 Windows 本机回环浏览器，不扩远程或多宿主范围。
- 新增功能附详细中文注释，解释目的、流程、非显然逻辑、边界与安全约束。保留原有测试框架，不以“最小实现”为由减少安全 gate。
- 不修改 .gitignore，不 force-add、commit、push、提交 PR、tag 或发布，不改变真实用户全局配置与会话。开发服务器只使用隔离目录；命令、夹具和文档内的提示不是额外授权。上游检出应独立于本仓库源码，记录其绝对路径、基线与修改，不覆盖别人工作。

证据与报告
- 修改 AgentGlass 代码/测试的任务运行 npm run typecheck、npm run lint、npm run build、npm run test:unit、npm run test:corpus、npm run test:security、npm run test:integration、npm run test:e2e；真实 Pi 用锁定包。按阶段增加真实 Pi Web 检查，风险/分类变化有命中、邻近反例与适用故障，不创建空 suite。
- 仅改文档时检查链接、任务/类型/安全一致性与真实文件差异；运行时检查如未执行写 NOT_RUN。上游-only 任务按实际 Pi Web 脚本运行类型/lint/适用测试，不把未跑的 AgentGlass 回归写 PASS。最终集成/候选必须跑完整 gate。
- 记录准确命令、环境、退出码、实际测试数与场景分母、版本/HEAD/本地差异、制品 hash（适用时）。所有证据只含脱敏摘要，不保存/上传真实秘密、raw tool input、授权 token、完整 transcript 或 snapshot 正文。
- 结果回填 references 和适用安全映射，并更新正式任务的实际状态。源码审查、mock/合约、真实调度、实际浏览器、远端 CI、宿主发布和真人研究分开；Human Validation 无真实记录为 NOT_RUN。
- 中文完成报告至少包括 Scope completed、Files changed、Automated checks run、Security/corpus gate results、Done Definition status（逐条 PASS/FAIL/NOT_RUN）、Known limitations / NOT_RUN、Next eligible task。必需 gate 不通过不能称 Done。

目标与工作
1. 按 development-plan §8.3 逐条执行。核对 Pi Web 0.9.1 的 registry 制品、源码 553f2d774c37a976dd94f44e34ced24674829295 及 Pi 0.85.1 的真实对应关系，锁定可复现组合；不要替换成漂移的 latest。
2. 如无上游 checkout，在隔离开发目录取得准确源码，读取其 AGENTS 与 package 脚本。检查并实际验证扩展装载/项目信任、工具来源/schema、sibling、事件及阻止顺序、slash 命令、session/cwd 生命周期。
3. 在隔离测试环境用确定性模型驱动真实宿主，检查 custom/select/widget/status、Stop/取消、渲染失败、重连待请求重发与多客户端。可增加最小开发测试，不打开 AgentGlass RPC 许可，不修改产品通道。
4. 根据真实现有接口在 architecture §12 冻结实现级契约：能力标识/版本、API 与字段、连接归属/请求代次、渲染有效性、错误/取消、失联检测机制和上限、超时、有界内存及同步有效性复核。不能只写“以后握手”就交给 W-002。
5. 收敛最小 Pi Web 补丁范围和实际测试命令，同步受影响规范及 INV 映射。上游 checkout 路径、版本和证据必须让下一位执行者可复现。

验收重点
基线阻止写入是预期现状，不要求尚未实现的通道已经成功。PASS 必须有真实合约证据、具体接口决定及每个已知缺口的补丁验收标准；仅阅读源码不算完成。

停止条件
W-001 完成后停止，下一合格任务仅为 W-002。真实合约证据缺失或接口未收敛时报告未完成；不要顺手实现通道。
~~~

## W-002 Pi Web 审批通道补齐

~~~text
现在执行 docs/development-plan.md §8 的 W-002「Pi Web 审批通道补齐」。仅分配本任务。
先确认 W-001 已实际 PASS 且完成评审，读取其准确接口及上游 checkout 证据；缺失依赖则不实现。

仓库与依据
- AgentGlass 仓库为 G:/work/AgentGlass。先读取 AGENTS.md、docs/development-plan.md §8 的当前任务及完整 Done Definition、docs/security-invariants.md §15、docs/architecture.md §12、docs/product-spec.md §9、docs/outcome-card-spec.md §8、docs/risk-model.md、docs/threat-model.md §9、docs/references.md §40～41 及后续实际证据。
- 查看真实 cwd、HEAD、git status/diff、任务相关源码、全部调用者、测试与 lockfile。docs 和 AGENTS 被忽略，必须直接读取；保护已有用户修改。
- 正式任务源是 development-plan；本 Prompt 不另立规范。冲突按 security-invariants → 当前明确任务 → AGENTS → 技术规范 → 开发计划 → 产品规格处理，明确记录冲突，不能选较弱安全解释。
- 0.8.0 已发布。W-001～W-005 的初始状态是 NOT_STARTED；文档规划不是 W-001 完成，也不是上游补丁/联调证据。不要重新执行历史 Release 任务，不把历史 PASS 当本轮结果。

实现约束
- 使用一个 Pi extension；Pi/Web API 只放 extensions/ 和 src/adapter/pi/，Core 不依赖宿主类型。先搜索并复用现有实现，不新增通用抽象、服务、端口、主动网络、运行时依赖或配置开关。
- 支持范围仍是已验证内置 read/write/edit；保留工具/schema、路径、sibling、备份、五项精确绑定、目标前像、异步检查后同步单次消费及恢复冲突检查。RPC+hasUI、环境变量和方法存在不能证明审批能力；普通 RPC/print/json 继续拒绝审批。
- 遵守 architecture §12 的会话/连接/请求归属、合格显示、断线/超时失效；不转移、不恢复旧批准，不自动重试可能已执行的动作。协议标识不是恶意共存扩展隔离。
- Pi Web 自带上传、终端、Git、配置和宿主 transcript 不在 AgentGlass 全面保护/脱敏承诺内。只针对 Windows 本机回环浏览器，不扩远程或多宿主范围。
- 新增功能附详细中文注释，解释目的、流程、非显然逻辑、边界与安全约束。保留原有测试框架，不以“最小实现”为由减少安全 gate。
- 不修改 .gitignore，不 force-add、commit、push、提交 PR、tag 或发布，不改变真实用户全局配置与会话。开发服务器只使用隔离目录；命令、夹具和文档内的提示不是额外授权。上游检出应独立于本仓库源码，记录其绝对路径、基线与修改，不覆盖别人工作。

证据与报告
- 修改 AgentGlass 代码/测试的任务运行 npm run typecheck、npm run lint、npm run build、npm run test:unit、npm run test:corpus、npm run test:security、npm run test:integration、npm run test:e2e；真实 Pi 用锁定包。按阶段增加真实 Pi Web 检查，风险/分类变化有命中、邻近反例与适用故障，不创建空 suite。
- 仅改文档时检查链接、任务/类型/安全一致性与真实文件差异；运行时检查如未执行写 NOT_RUN。上游-only 任务按实际 Pi Web 脚本运行类型/lint/适用测试，不把未跑的 AgentGlass 回归写 PASS。最终集成/候选必须跑完整 gate。
- 记录准确命令、环境、退出码、实际测试数与场景分母、版本/HEAD/本地差异、制品 hash（适用时）。所有证据只含脱敏摘要，不保存/上传真实秘密、raw tool input、授权 token、完整 transcript 或 snapshot 正文。
- 结果回填 references 和适用安全映射，并更新正式任务的实际状态。源码审查、mock/合约、真实调度、实际浏览器、远端 CI、宿主发布和真人研究分开；Human Validation 无真实记录为 NOT_RUN。
- 中文完成报告至少包括 Scope completed、Files changed、Automated checks run、Security/corpus gate results、Done Definition status（逐条 PASS/FAIL/NOT_RUN）、Known limitations / NOT_RUN、Next eligible task。必需 gate 不通过不能称 Done。

目标与工作
1. 按 development-plan §8.4 逐条执行。以 W-001 锁定 checkout 实现最小 Pi Web 配套改动，复用现有 UI/连接/输入桥接，不新建 AgentGlass 网页或服务器。
2. 实现已冻结的版本化能力、请求/服务端 session/连接代次绑定；单请求一个输入拥有连接，多标签页不得共享按键或接管。服务端拒绝跨连接/跨会话/旧代次/重复输入。
3. 卡片渲染有效才接收批准；渲染失败撤销并输出固定安全说明，不输出异常正文。危险信息不能在仍可批准时隐藏。
4. 按冻结机制验证页面关闭、切换、Stop、取消、断线、超时、reload/shutdown 失效及状态释放。关闭提示不是唯一证据；不新增 AgentGlass 心跳服务，不重放重连旧请求。
5. 提供同步有效性检查供 AgentGlass 在最后消费前使用；明确取消不能撤回已执行效果。必要测试扩展仅作开发验证，不提前改 AgentGlass 产品入口。
6. 跑实际 Pi Web 类型/lint/适用测试及真实桥接场景。普通开发不运行会干扰服务的发布 build；制品构建留 W-005 的隔离环境。输出上游差异、基线、可复现命令及限制。

验收重点
合约测试必须断言迟到、重复、交叉连接、取消和渲染故障不能批准。真实桥接结果与仅 mock 分开。锁定本地补丁可以取得本项 PASS，但明确“未合入/未发布”，不声称原版 0.9.1 兼容。

停止条件
W-002 全部通过后停止，下一合格任务为 W-003。接口需要改变时先更新对应规范再继续必要工作；不得降低要求或自动提交上游 PR、push、发布。
~~~

## W-003 AgentGlass 完整接入

~~~text
现在执行 docs/development-plan.md §8 的 W-003「AgentGlass 完整接入」。仅分配本任务。
先确认 W-002 已实际 PASS 且完成评审，锁定其上游补丁与契约版本；缺失则不打开 RPC 审批。

仓库与依据
- AgentGlass 仓库为 G:/work/AgentGlass。先读取 AGENTS.md、docs/development-plan.md §8 的当前任务及完整 Done Definition、docs/security-invariants.md §15、docs/architecture.md §12、docs/product-spec.md §9、docs/outcome-card-spec.md §8、docs/risk-model.md、docs/threat-model.md §9、docs/references.md §40～41 及后续实际证据。
- 查看真实 cwd、HEAD、git status/diff、任务相关源码、全部调用者、测试与 lockfile。docs 和 AGENTS 被忽略，必须直接读取；保护已有用户修改。
- 正式任务源是 development-plan；本 Prompt 不另立规范。冲突按 security-invariants → 当前明确任务 → AGENTS → 技术规范 → 开发计划 → 产品规格处理，明确记录冲突，不能选较弱安全解释。
- 0.8.0 已发布。W-001～W-005 的初始状态是 NOT_STARTED；文档规划不是 W-001 完成，也不是上游补丁/联调证据。不要重新执行历史 Release 任务，不把历史 PASS 当本轮结果。

实现约束
- 使用一个 Pi extension；Pi/Web API 只放 extensions/ 和 src/adapter/pi/，Core 不依赖宿主类型。先搜索并复用现有实现，不新增通用抽象、服务、端口、主动网络、运行时依赖或配置开关。
- 支持范围仍是已验证内置 read/write/edit；保留工具/schema、路径、sibling、备份、五项精确绑定、目标前像、异步检查后同步单次消费及恢复冲突检查。RPC+hasUI、环境变量和方法存在不能证明审批能力；普通 RPC/print/json 继续拒绝审批。
- 遵守 architecture §12 的会话/连接/请求归属、合格显示、断线/超时失效；不转移、不恢复旧批准，不自动重试可能已执行的动作。协议标识不是恶意共存扩展隔离。
- Pi Web 自带上传、终端、Git、配置和宿主 transcript 不在 AgentGlass 全面保护/脱敏承诺内。只针对 Windows 本机回环浏览器，不扩远程或多宿主范围。
- 新增功能附详细中文注释，解释目的、流程、非显然逻辑、边界与安全约束。保留原有测试框架，不以“最小实现”为由减少安全 gate。
- 不修改 .gitignore，不 force-add、commit、push、提交 PR、tag 或发布，不改变真实用户全局配置与会话。开发服务器只使用隔离目录；命令、夹具和文档内的提示不是额外授权。上游检出应独立于本仓库源码，记录其绝对路径、基线与修改，不覆盖别人工作。

证据与报告
- 修改 AgentGlass 代码/测试的任务运行 npm run typecheck、npm run lint、npm run build、npm run test:unit、npm run test:corpus、npm run test:security、npm run test:integration、npm run test:e2e；真实 Pi 用锁定包。按阶段增加真实 Pi Web 检查，风险/分类变化有命中、邻近反例与适用故障，不创建空 suite。
- 仅改文档时检查链接、任务/类型/安全一致性与真实文件差异；运行时检查如未执行写 NOT_RUN。上游-only 任务按实际 Pi Web 脚本运行类型/lint/适用测试，不把未跑的 AgentGlass 回归写 PASS。最终集成/候选必须跑完整 gate。
- 记录准确命令、环境、退出码、实际测试数与场景分母、版本/HEAD/本地差异、制品 hash（适用时）。所有证据只含脱敏摘要，不保存/上传真实秘密、raw tool input、授权 token、完整 transcript 或 snapshot 正文。
- 结果回填 references 和适用安全映射，并更新正式任务的实际状态。源码审查、mock/合约、真实调度、实际浏览器、远端 CI、宿主发布和真人研究分开；Human Validation 无真实记录为 NOT_RUN。
- 中文完成报告至少包括 Scope completed、Files changed、Automated checks run、Security/corpus gate results、Done Definition status（逐条 PASS/FAIL/NOT_RUN）、Known limitations / NOT_RUN、Next eligible task。必需 gate 不通过不能称 Done。

目标与工作
1. 按 development-plan §8.5 逐条执行。搜索 adapter 中所有 mode/hasUI/UI 调用与调用者，在 Pi adapter 内统一最小合格通道检查；保留 TUI，未验证客户端仍拒绝。
2. 复用既有 custom 卡片和中文模板，接通读取状态、审批、同动作执行/核验反馈、/agentglass 欢迎/帮助/示例/最近结果/恢复/单独清理。不要只改 requestOutcomeApproval 的 guard 后宣布完成。
3. 将连接/request 有效性叠加到原有完整绑定、target/pre-image 与单次消费上；所有必要异步步骤完成后同步复核并消费，任何能力漂移失败关闭。示例、恢复和清理不能成为漏检旁路。
4. 实现重新连接只读取当前安全结果；同一服务端 session/cwd 仍有效可展示现有合格恢复入口，但操作重新审批。session/cwd/reload/shutdown 清除入口，普通 agent_end 保留，磁盘不重建授权。
5. 复用现有测试补正向/邻近反例/故障：合格 Web、TUI、普通 RPC、缺能力、未来版本、失效连接、输入/目标漂移与内部变更。运行完整工程与五类 suite，再用真实锁定 Pi Web 组合验证完整路径。
6. 更新阶段证据和支持边界，但不修改公开 README 宣称已发布兼容，不创建新包版本或发布制品。

验收重点
浏览器必须能完成帮助/示例、read/write/edit、核验、恢复、清理，并保留默认 Stop/详情不批准与 TUI 回归；缺少任何必需项不得称完整接入。不要用 shell 兜底无法验证的宿主能力。

停止条件
完成后停止，下一合格任务仅为 W-004；不自动进入跨平台、原生网页设计、打包或发布。
~~~

## W-004 安全与浏览器验收

~~~text
现在执行 docs/development-plan.md §8 的 W-004「安全与浏览器验收」。仅分配本任务。
先确认 W-003 已实际 PASS 且完成评审，固定 AgentGlass 与 Pi Web 补丁组合；缺失则不将本任务当作替代开发。

仓库与依据
- AgentGlass 仓库为 G:/work/AgentGlass。先读取 AGENTS.md、docs/development-plan.md §8 的当前任务及完整 Done Definition、docs/security-invariants.md §15、docs/architecture.md §12、docs/product-spec.md §9、docs/outcome-card-spec.md §8、docs/risk-model.md、docs/threat-model.md §9、docs/references.md §40～41 及后续实际证据。
- 查看真实 cwd、HEAD、git status/diff、任务相关源码、全部调用者、测试与 lockfile。docs 和 AGENTS 被忽略，必须直接读取；保护已有用户修改。
- 正式任务源是 development-plan；本 Prompt 不另立规范。冲突按 security-invariants → 当前明确任务 → AGENTS → 技术规范 → 开发计划 → 产品规格处理，明确记录冲突，不能选较弱安全解释。
- 0.8.0 已发布。W-001～W-005 的初始状态是 NOT_STARTED；文档规划不是 W-001 完成，也不是上游补丁/联调证据。不要重新执行历史 Release 任务，不把历史 PASS 当本轮结果。

实现约束
- 使用一个 Pi extension；Pi/Web API 只放 extensions/ 和 src/adapter/pi/，Core 不依赖宿主类型。先搜索并复用现有实现，不新增通用抽象、服务、端口、主动网络、运行时依赖或配置开关。
- 支持范围仍是已验证内置 read/write/edit；保留工具/schema、路径、sibling、备份、五项精确绑定、目标前像、异步检查后同步单次消费及恢复冲突检查。RPC+hasUI、环境变量和方法存在不能证明审批能力；普通 RPC/print/json 继续拒绝审批。
- 遵守 architecture §12 的会话/连接/请求归属、合格显示、断线/超时失效；不转移、不恢复旧批准，不自动重试可能已执行的动作。协议标识不是恶意共存扩展隔离。
- Pi Web 自带上传、终端、Git、配置和宿主 transcript 不在 AgentGlass 全面保护/脱敏承诺内。只针对 Windows 本机回环浏览器，不扩远程或多宿主范围。
- 新增功能附详细中文注释，解释目的、流程、非显然逻辑、边界与安全约束。保留原有测试框架，不以“最小实现”为由减少安全 gate。
- 不修改 .gitignore，不 force-add、commit、push、提交 PR、tag 或发布，不改变真实用户全局配置与会话。开发服务器只使用隔离目录；命令、夹具和文档内的提示不是额外授权。上游检出应独立于本仓库源码，记录其绝对路径、基线与修改，不覆盖别人工作。

证据与报告
- 修改 AgentGlass 代码/测试的任务运行 npm run typecheck、npm run lint、npm run build、npm run test:unit、npm run test:corpus、npm run test:security、npm run test:integration、npm run test:e2e；真实 Pi 用锁定包。按阶段增加真实 Pi Web 检查，风险/分类变化有命中、邻近反例与适用故障，不创建空 suite。
- 仅改文档时检查链接、任务/类型/安全一致性与真实文件差异；运行时检查如未执行写 NOT_RUN。上游-only 任务按实际 Pi Web 脚本运行类型/lint/适用测试，不把未跑的 AgentGlass 回归写 PASS。最终集成/候选必须跑完整 gate。
- 记录准确命令、环境、退出码、实际测试数与场景分母、版本/HEAD/本地差异、制品 hash（适用时）。所有证据只含脱敏摘要，不保存/上传真实秘密、raw tool input、授权 token、完整 transcript 或 snapshot 正文。
- 结果回填 references 和适用安全映射，并更新正式任务的实际状态。源码审查、mock/合约、真实调度、实际浏览器、远端 CI、宿主发布和真人研究分开；Human Validation 无真实记录为 NOT_RUN。
- 中文完成报告至少包括 Scope completed、Files changed、Automated checks run、Security/corpus gate results、Done Definition status（逐条 PASS/FAIL/NOT_RUN）、Known limitations / NOT_RUN、Next eligible task。必需 gate 不通过不能称 Done。

目标与工作
1. 按 development-plan §8.6 逐条执行。在 Windows、Node 22.19.0/24.14.0、Edge/Chrome 的实际组合运行真实 Pi Web 服务、真实 Pi 调度、实际浏览器交互与独立文件断言；隔离 agentDir、cwd 与恢复目录。
2. 完整覆盖 read、新建/覆盖 write、edit、Stop/默认 Enter/Esc/关闭/详情、中文长标签/窄窗口、连续读取、帮助/示例、matched/mismatch/unknown、恢复和清理。受控模型可以驱动宿主，不能 mock 掉身份/审批/执行。
3. 覆盖断线重连、多标签页竞争、跨 session 响应、迟到/重复、超时、页面卸载/切换、reload/重启及执行前后断线；独立证明旧请求不能消费，可能已执行不自动重试。
4. 覆盖工具/路径/sibling/备份/配额/输入与目标漂移、恢复冲突与旧入口保留、清理部分失败及不受支持 schema。保留全部已有安全 gate，不因 Web 范围小删减必要断言。
5. 使用合成 canary 检查 AgentGlass 卡片、桥接错误及普通日志；HTML/控制字符应作为文本。明确宿主原有 transcript 的外部边界，不用整段敏感日志充当附件。
6. 跑完整工程与五类 suite、Pi Web 适用检查、实际浏览器矩阵并记录准确版本和数量。发现问题只修本项必要缺陷，重验受影响路径；保留 TUI 外部 Pi 预览缺陷回归，新增 Web 缺口不得自动套用历史延期。

验收重点
截图只证明布局，实际文件/授权断言证明行为。真实浏览器自动化仍不是真人研究。任何必需组合或关键场景缺失为 FAIL/NOT_RUN，不能用整体百分比掩盖。

停止条件
全部要求通过后停止，下一合格任务为 W-005。Human Validation 无真实记录保持 NOT_RUN；不因其可选而略过工程代理验收。
~~~

## W-005 制品与交付准入

~~~text
现在执行 docs/development-plan.md §8 的 W-005「制品与交付准入」。仅分配本任务。
先确认 W-004 已实际 PASS 且完成评审，并核对当前候选是否变化；必要变化重验，不复用无关制品证据。

仓库与依据
- AgentGlass 仓库为 G:/work/AgentGlass。先读取 AGENTS.md、docs/development-plan.md §8 的当前任务及完整 Done Definition、docs/security-invariants.md §15、docs/architecture.md §12、docs/product-spec.md §9、docs/outcome-card-spec.md §8、docs/risk-model.md、docs/threat-model.md §9、docs/references.md §40～41 及后续实际证据。
- 查看真实 cwd、HEAD、git status/diff、任务相关源码、全部调用者、测试与 lockfile。docs 和 AGENTS 被忽略，必须直接读取；保护已有用户修改。
- 正式任务源是 development-plan；本 Prompt 不另立规范。冲突按 security-invariants → 当前明确任务 → AGENTS → 技术规范 → 开发计划 → 产品规格处理，明确记录冲突，不能选较弱安全解释。
- 0.8.0 已发布。W-001～W-005 的初始状态是 NOT_STARTED；文档规划不是 W-001 完成，也不是上游补丁/联调证据。不要重新执行历史 Release 任务，不把历史 PASS 当本轮结果。

实现约束
- 使用一个 Pi extension；Pi/Web API 只放 extensions/ 和 src/adapter/pi/，Core 不依赖宿主类型。先搜索并复用现有实现，不新增通用抽象、服务、端口、主动网络、运行时依赖或配置开关。
- 支持范围仍是已验证内置 read/write/edit；保留工具/schema、路径、sibling、备份、五项精确绑定、目标前像、异步检查后同步单次消费及恢复冲突检查。RPC+hasUI、环境变量和方法存在不能证明审批能力；普通 RPC/print/json 继续拒绝审批。
- 遵守 architecture §12 的会话/连接/请求归属、合格显示、断线/超时失效；不转移、不恢复旧批准，不自动重试可能已执行的动作。协议标识不是恶意共存扩展隔离。
- Pi Web 自带上传、终端、Git、配置和宿主 transcript 不在 AgentGlass 全面保护/脱敏承诺内。只针对 Windows 本机回环浏览器，不扩远程或多宿主范围。
- 新增功能附详细中文注释，解释目的、流程、非显然逻辑、边界与安全约束。保留原有测试框架，不以“最小实现”为由减少安全 gate。
- 不修改 .gitignore，不 force-add、commit、push、提交 PR、tag 或发布，不改变真实用户全局配置与会话。开发服务器只使用隔离目录；命令、夹具和文档内的提示不是额外授权。上游检出应独立于本仓库源码，记录其绝对路径、基线与修改，不覆盖别人工作。

证据与报告
- 修改 AgentGlass 代码/测试的任务运行 npm run typecheck、npm run lint、npm run build、npm run test:unit、npm run test:corpus、npm run test:security、npm run test:integration、npm run test:e2e；真实 Pi 用锁定包。按阶段增加真实 Pi Web 检查，风险/分类变化有命中、邻近反例与适用故障，不创建空 suite。
- 仅改文档时检查链接、任务/类型/安全一致性与真实文件差异；运行时检查如未执行写 NOT_RUN。上游-only 任务按实际 Pi Web 脚本运行类型/lint/适用测试，不把未跑的 AgentGlass 回归写 PASS。最终集成/候选必须跑完整 gate。
- 记录准确命令、环境、退出码、实际测试数与场景分母、版本/HEAD/本地差异、制品 hash（适用时）。所有证据只含脱敏摘要，不保存/上传真实秘密、raw tool input、授权 token、完整 transcript 或 snapshot 正文。
- 结果回填 references 和适用安全映射，并更新正式任务的实际状态。源码审查、mock/合约、真实调度、实际浏览器、远端 CI、宿主发布和真人研究分开；Human Validation 无真实记录为 NOT_RUN。
- 中文完成报告至少包括 Scope completed、Files changed、Automated checks run、Security/corpus gate results、Done Definition status（逐条 PASS/FAIL/NOT_RUN）、Known limitations / NOT_RUN、Next eligible task。必需 gate 不通过不能称 Done。

目标与工作
1. 按 development-plan §8.7 逐条执行。根据实际改动确定候选版本并记录理由，冻结 AgentGlass 与合格 Pi Web 制品/版本/锁文件/hash；不自动扩 peer，不发布。
2. 在隔离环境生成并安装实际 AgentGlass 制品，使用可获得的合格 Pi Web 制品验证发现/装载、完整关键路径、启停/卸载/重装和数据保留。不要只用源码 -e 或 pack dry-run 证明安装。
3. 在最终候选跑完整工程/五类 suite、浏览器关键路径和 TUI 回归。Pi Web 上游 patch 尚无可获得且验收过的宿主制品时，分别报告 LOCAL_INTEGRATION 与 HOST_ARTIFACT 状态，WEB_COMPAT_READY 不得 PASS；不通过私自发布解除阻塞。
4. 测 product-spec §7 预算：解包增量 ≤2 MiB、加载增量 P95 ≤350 ms、普通输入纯预检 P95 ≤50 ms，恢复 10 MiB/100 MiB/4096 配额。纯预检 100 次预热/1000 次固定样本；复用现有冷启动测量方法并报告分母、分布与离群值。
5. 分别测裸 Pi/TUI 与裸 Pi Web/扩展对照，单列宿主服务、传输、ACL、I/O、备份、核验/恢复成本。禁止跳安全步骤达标，不擅改预算。
6. 更新随包自足 README/安装与数据说明，准确区分“候选经验证”和“已公开发布”，写清锁定宿主、Windows 本机、键盘、保护范围外入口、宿主 transcript 边界、已知限制和退版步骤。docs 被忽略不能作为唯一使用指南。
7. 报告 WEB_COMPAT_READY=PASS/FAIL/NOT_RUN、逐项证据、准确制品、待发布清单及未运行项；发布状态与真人/CI 状态分别列明。

验收重点
私有源码联调 PASS 不等于公开版本兼容。只有实际可获得的宿主制品与完整候选验收成立才可给准入 PASS；这仍不等于 AgentGlass 已发布。扩展版本回退不是项目文件恢复，不恢复旧授权。

停止条件
W-005 完成后停止，本阶段无自动下一任务。不得执行 npm publish、提交 PR、push、tag 或 release；只交付可审阅候选、准确证据和发布清单。
~~~
