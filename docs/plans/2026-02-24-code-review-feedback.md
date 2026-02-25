# 代码评审反馈

**评审日期：** 2026-02-24
**评审对象：** MVP 初版实现代码（inbox-server + browser-extension）
**评审范围：** 设计合理性、健壮性、可维护性（不限于"能否运行"）

---

## P0 — 必须修复

### 1. `source` 作为 URL 黑名单参数会误伤正常 URL

**文件：** `inbox-server/src/url.js:3`

**当前行为：**
```js
const blocked = new Set(["spm", "from", "source", "si"]);
```
`source` 是很多平台 URL 中有语义的参数（如微信文章的 `source=xxx` 标识来源渠道），不应一律删除。

**期望行为：**
```js
const blocked = new Set(["spm", "from", "si"]);
```
移除 `"source"`。如果后续发现特定平台确实用 `source` 做追踪，再按平台域名做条件过滤。

同步更新 `inbox-server/tests/url.test.js` 中的相关测试用例。

### 2. `saveItem` 的 read-modify-write 存在并发竞态

**文件：** `inbox-server/src/storage.js:38-60`

**当前行为：** 每次写入执行 读 index.json → 内存修改 → 全量写回。两个请求同时到达时，后写入的会覆盖前一个的索引条目（JSONL 追加不受影响，但 index.json 会丢条目）。

**期望行为：** 加进程内写锁，保证 saveItem 串行执行。参考实现：

```js
// storage.js 顶部
let writeLock = Promise.resolve();

// saveItem 内部
async saveItem(input, { client }) {
  const prev = writeLock;
  let release;
  writeLock = new Promise((r) => { release = r; });
  await prev;
  try {
    // ... 现有读写逻辑不变
    return { id, deduplicated };
  } finally {
    release();
  }
}
```

### 3. `saveItem` 声明 async 但全部使用同步 fs 操作

**文件：** `inbox-server/src/storage.js:38`

**当前行为：** 函数签名 `async saveItem` 但内部全是 `appendFileSync`、`writeFileSync`、`readFileSync`，阻塞事件循环。

**期望行为：** 二选一：
- **方案 A（推荐）：** 改为 `fs.promises` 的异步操作（`appendFile`、`writeFile`、`readFile`），与 async 签名一致。
- **方案 B：** 如果刻意保持同步以简化并发控制，去掉 `async` 关键字，让 `app.js` 中的调用方知道这是同步的。

---

## P1 — 应该修复

### 4. `config.js` 和 `app.js` 对 token 的双重解析

**文件：** `inbox-server/src/app.js:7`、`inbox-server/src/config.js:6`

**当前行为：**
```js
// app.js:7
const inboxToken = options.inboxToken ?? process.env.INBOX_TOKEN ?? "";
```
`index.js` 已通过 `readConfig()` 解析 token 并传给 `createApp`，但 `createApp` 内部又 fallback 到 `process.env`。直接调用 `createApp()` 不传 token 时会静默从环境变量取值，绕过 `index.js` 的空 token 检查。

**期望行为：**
```js
// app.js:7 — 改为：
const inboxToken = options.inboxToken ?? "";
```
配置来源应单一化，由 `index.js`（生产入口）或测试代码显式传入。

### 5. URL canonicalize 不处理参数顺序和尾部斜杠

**文件：** `inbox-server/src/url.js`

**当前行为：**
- `?a=1&b=2` 和 `?b=2&a=1` 产生不同 canonical URL → 去重漏判
- `https://example.com/path` 和 `https://example.com/path/` 被视为不同 URL

**期望行为：** 在 `canonicalize` 函数返回前加一行参数排序：

```js
url.searchParams.sort();
```

尾部斜杠可暂不处理（各平台行为不一致），但参数排序是必须的。

同步在 `inbox-server/tests/url.test.js` 增加测试：
```js
it("normalizes parameter order", () => {
  expect(canonicalize("https://a.com/p?b=2&a=1")).toBe("https://a.com/p?a=1&b=2");
});
```

### 6. 设计文档提到的 index.json 重建能力未实现

**文件：** `inbox-server/src/storage.js:18-30`
**设计文档：** `docs/plans/2026-02-23-content-agent-mvp-design.md` Section 10 第 3 条

**当前行为：** `safeReadIndex` 检测到 index.json 损坏时只做备份，返回空对象。去重功能静默失效。

**期望行为：** 增加 `rebuildIndex` 函数，在损坏时从 JSONL 重建：

```js
function rebuildIndex(jsonlPath) {
  const index = {};
  if (!fs.existsSync(jsonlPath)) return index;
  const lines = fs.readFileSync(jsonlPath, "utf8").trim().split("\n");
  for (const line of lines) {
    if (!line) continue;
    try {
      const record = JSON.parse(line);
      if (record.canonical_url && record.id) {
        index[record.canonical_url] = record.id;
      }
    } catch {
      // skip malformed lines
    }
  }
  return index;
}
```

在 `safeReadIndex` 的 catch 分支中调用 `rebuildIndex(jsonlPath)` 替代返回空对象。

### 7. 测试覆盖缺口

当前 7 个测试覆盖了 happy path，以下场景缺少测试：

| 缺失场景 | 应加在哪个文件 |
|----------|--------------|
| 错误 token（非缺失，而是不匹配） | `capture-auth.test.js` |
| 重复提交后 JSONL 确实有两行 | `capture-storage.test.js` |
| `note` 恰好 5 字符（下界）和 280 字符（上界） | `capture-validation.test.js` |
| `canonicalize` 边界：无参数 URL、只有 hash | `url.test.js` |
| `safeReadIndex` 损坏时的备份和重建行为 | 新建 `tests/storage-recovery.test.js` |

每个场景写一个 `it` 即可，不需要复杂 setup。

---

## P2 — 建议改进（不阻塞交付）

### 8. 扩展可根据 URL 域名自动预填 source

**文件：** `browser-extension/popup.js`

在 `loadCurrentTab` 中根据域名自动设置 `dom.source.value`，用户仍可手动修改：

```js
const SOURCE_MAP = {
  "xiaohongshu.com": "xhs",
  "douyin.com": "douyin",
  "x.com": "x",
  "twitter.com": "x",
  "mp.weixin.qq.com": "wechat",
};

function detectSource(url) {
  try {
    const hostname = new URL(url).hostname;
    for (const [domain, source] of Object.entries(SOURCE_MAP)) {
      if (hostname === domain || hostname.endsWith("." + domain)) return source;
    }
  } catch {}
  return "other";
}
```

### 9. Manifest v3 不需要 `clipboardWrite` 权限

**文件：** `browser-extension/manifest.json:6`

**当前行为：** `permissions` 包含 `"clipboardWrite"`。
**期望行为：** 移除。`navigator.clipboard.writeText()` 在 popup 上下文中不需要此权限（该权限是给已废弃的 `document.execCommand('copy')` 用的）。多余权限会增加用户安装时的权限提示。

### 10. 扩展增加键盘快捷键支持

**文件：** `browser-extension/manifest.json`、`browser-extension/popup.js`

两处改动：
1. manifest.json 增加 `commands` 配置（可选，用于快捷键打开 popup）
2. popup.js 监听 `Ctrl+Enter` / `Cmd+Enter` 提交表单：

```js
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
    submitCapture();
  }
});
```

### 11. `health.test.js` 测试风格与其他文件不一致

**文件：** `inbox-server/tests/health.test.js`

**当前行为：** 在测试体内 inline 创建和清理 temp dir，没有使用 `beforeEach`/`afterEach`。
**期望行为：** 改为与 `capture-auth.test.js` 等文件一致的 `beforeEach`/`afterEach` 模式。

---

## 执行建议

1. 先处理 P0（3 条），每条改完跑一次 `npm run test` 确认不破坏现有测试。
2. P1 中第 7 条（补测试）建议和其他 P1 改动一起做——先改代码，再补测试验证。
3. P2 可以作为独立的后续 commit，不与 P0/P1 混在一起。
