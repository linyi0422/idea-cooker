# 文档评审反馈

**评审日期：** 2026-02-23
**评审对象：**
- `docs/plans/2026-02-23-content-agent-mvp-design.md`（设计文档）
- `docs/plans/2026-02-23-content-agent-implementation-plan.md`（实现计划）

**评审标准：** superpowers skills — `brainstorming` + `writing-plans`

---

## P0 — 必须修复

### 1. 实现计划中的代码必须完整（writing-plans 硬性要求）

Skill 原文："Complete code in plan (not 'add validation')"。以下位置用注释代替了实际代码，必须补全：

**Task 2 Step 3** — auth middleware + route handler 只有注释：
```js
// 当前：
app.post("/api/v1/items", (req, res) => {
  // token check + payload validation
});

// 应改为完整实现，包括：
// - X-Inbox-Token 校验 middleware
// - Zod schema 定义（url, title, note, tags, source 每个字段）
// - 校验失败返回 400 + 错误详情
// - 校验通过调用 storage 写入
```

**Task 2** — 缺少 Zod schema 代码。提到了用 Zod 但没给出 schema，需要补全 `inbox-server/src/schema.js` 的完整代码。

**Task 3 Step 3** — canonicalize 函数只有注释：
```js
// 当前：
export function canonicalize(inputUrl) {
  // remove utm_*, spm, from, source, si and hash
}

// 应改为完整实现，包含具体的参数过滤逻辑
```

**Task 3 Step 1** — JSONL 写入测试只有注释：
```js
// 当前：
it("writes one line to jsonl", async () => {
  // POST valid payload then assert inbox/items.jsonl has one JSON line
});

// 应改为完整测试代码，包含 setup、请求、断言
```

### 2. 设计文档必须解决待决问题（brainstorming 硬性要求）

Section 11 的 4 个待决问题应在设计阶段做出 MVP 决策，不应留白。建议决策：

| 问题 | 建议 MVP 决策 | 理由 |
|------|--------------|------|
| `source` 手工选择 vs 域名推断 | 手工选择 | MVP 最简，域名推断是优化 |
| 重复提交策略 | 保留新记录 + 返回 `deduplicated: true` | 不丢数据，最安全 |
| `tags` 自由输入 vs 受控词表 | 自由输入 | MVP 阶段不需要词表管理 |
| 提取层 LLM vs 规则 | 不在 MVP 范围 | 已列为非目标，删除此问题 |

做出决策后，将 Section 11 改为"已决策"并删除或标记为 resolved。

### 3. 设计文档必须包含方案对比（brainstorming 硬性要求）

Brainstorming skill 要求 "Propose 2-3 approaches with trade-offs"。当前文档直接给出了浏览器扩展方案，缺少替代方案对比。

建议在 Section 4 之前增加一个 "方案对比" section，至少对比：
- **方案 A：浏览器扩展 + localhost API**（当前方案）
- **方案 B：Bookmarklet + 剪贴板**（零安装，但功能受限）
- **方案 C：Obsidian 插件 / 本地 app**（生态集成好，但开发成本高）

说明选择方案 A 的理由。

---

## P1 — 应该修复

### 4. 补充测试隔离策略

Task 2 和 Task 3 涉及文件系统写入（JSONL），但 plan 没有说明测试时如何隔离。Writing-plans skill 假设执行者"不太懂测试设计"，这类细节必须交代。

建议在 Task 2 或 Task 3 开头增加：
- 使用临时目录（`os.tmpdir()` 或 `fs.mkdtempSync`）
- `beforeEach` 创建临时目录，`afterEach` 清理
- 通过配置注入 storage 路径，不硬编码

### 5. 设计文档补充 error handling section

Brainstorming skill 要求覆盖 error handling。建议增加 Section（可放在 Section 8 之后）：

需要覆盖的场景：
- 服务器未启动时扩展的降级行为（当前 plan 提到了 fallback copy-json，但设计文档没有）
- JSONL 写入失败（磁盘满、权限问题）
- index.json 损坏的恢复策略
- 并发写入冲突（虽然 MVP 单用户，但应说明不考虑）

### 6. 修复 Task 4 的可执行性

当前 Task 4 Step 2 描述模糊：
```
Run server not implemented extension yet, checklist items 1-5 fail.
```

应改为具体的验证步骤，例如：
```
Step 2: 验证 checklist 失败
1. 启动服务器：cd inbox-server && node src/index.js
2. 在 Chrome 中加载解压的扩展：chrome://extensions → 开发者模式 → 加载已解压
3. 打开任意网页，点击扩展图标
4. 预期：popup 显示当前页 URL 和标题
5. 填写 note 和 tags，点击提交
6. 预期：成功提示，inbox/items.jsonl 新增一行
```

### 7. 修复 Verification Commands 的跨平台问题

当前命令 3 使用 Windows 反斜杠：
```bash
node -e "JSON.parse(require('fs').readFileSync('..\\inbox\\items.jsonl','utf8')..."
```

应改为正斜杠（Node.js 在 Windows 上也支持）：
```bash
node -e "JSON.parse(require('fs').readFileSync('../inbox/items.jsonl','utf8')..."
```

---

## P2 — 建议改进

### 8. 修复设计文档 markdown 层级

Section 4.1 和 4.2 当前用 `##`（与 Section 4 同级），应改为 `###`。

### 9. 设计文档补充 testing strategy section

建议增加简短的测试策略说明：
- 单元测试：URL canonicalize、Zod schema 校验
- 集成测试：API endpoint 端到端（supertest）
- 手动测试：浏览器扩展 capture flow

### 10. Task 5 验证方式更具体

当前："Have a fresh reader follow checklist" — 过于模糊。
建议改为：在新终端中从 git clone 开始，按 README 步骤操作，记录每步是否成功。
