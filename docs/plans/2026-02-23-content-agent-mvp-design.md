# 内容创作 Agent MVP 设计文档

**日期：** 2026-02-23  
**状态：** Draft v2（根据评审修订）  
**作者：** Codex + 用户共创

## 1. 背景与目标

你要构建一套面向内容创作的 Agent 系统，目标是：

1. 把喜欢的内容沉淀为可复用“食材”（知识库素材）
2. 把写作方法沉淀为“炒菜技巧”（技巧库）
3. 围绕当下议题进行“摆盘拼装”，产出长文与短帖

当前优先级：先解决信息源分散问题，统一收集入口，再做提取与入库。

## 2. 已确认约束

1. 创作形态：`长文/随笔` + `社媒短帖`
2. 发布倾向：以公开发布为主
3. 内容定位：写给“同类的人”
4. 心理边界：只做表达与写作，不提供心理建议
5. 工作端：电脑端（Chrome/Edge，可安装扩展）
6. 收集方案：`浏览器扩展 + 本地 localhost 收件箱服务`
7. 收藏字段档位：A（仅 URL + 标题 + 备注 + 标签）

## 3. MVP 范围与非目标

### 3.1 MVP 范围（本阶段必须完成）

1. 统一采集入口：浏览器扩展一键收藏
2. 本地收件箱：`inbox/items.jsonl` 持久化
3. 基础去重与规范化：URL 轻度 canonical 处理
4. 可回放日志：每条收藏有稳定 `id` 与时间戳
5. 手工可检索：按标签、来源、时间筛选（CLI 或脚本）

### 3.2 非目标（后续阶段）

1. 平台热榜自动抓取（小红书/抖音/推特/公众号）
2. 历史收藏一键批量导出
3. 自动抓全文、OCR、视频转写
4. 向量检索与复杂 RAG 编排
5. 自动发布到平台

## 4. 方案对比与选型

| 方案 | 描述 | 优点 | 缺点 |
|---|---|---|---|
| A. 浏览器扩展 + localhost API | 在浏览器中点击扩展，写入本地收件箱 | 最贴合当前工作流；结构化输入稳定；后续可扩展自动化 | 需要安装扩展并运行本地服务 |
| B. Bookmarklet + 剪贴板 | 点击书签脚本生成结构化文本后手动粘贴 | 零安装扩展；实现快 | 交互和可靠性较弱；权限受限；易丢字段 |
| C. Obsidian 插件 / 本地桌面 App | 深度集成笔记生态或独立应用 | 集成能力强；可做更复杂流程 | 开发成本高，MVP 周期过长 |

**选型结论：** 采用 **方案 A**。原因是它在“低成本”与“可持续扩展”之间最平衡，能尽快形成可执行的采集闭环，同时不锁死后续扩展路径。

## 5. 总体架构（从最小闭环开始）

### 5.1 组件

1. `Capture Agent`（浏览器扩展）
   - 读取当前页 `url/title`
   - 用户输入 `note/tags/source`
   - 调用本地 API 写入收件箱

2. `Inbox API`（本地服务，仅 `127.0.0.1`）
   - 校验请求和 token
   - URL canonicalize
   - 生成 `id`
   - 追加写入 `items.jsonl`
   - 回写 dedupe 信号

3. `Storage`（本地文件）
   - `inbox/items.jsonl`：事实记录（append-only）
   - `inbox/index.json`：轻量索引（`canonical_url -> latest_id`）

### 5.2 后续接入（不是本阶段交付）

1. `Extraction Agent`：从收件箱提取结构信号
2. `Curation Agent`：建议是否入知识库
3. `Assembly Agent`：围绕议题拼装成长文/短帖

## 6. 数据契约

### 6.1 写入 API

- `POST /api/v1/items`
- Header:
  - `Content-Type: application/json`
  - `X-Inbox-Token: <token>`

Request:

```json
{
  "url": "https://example.com/post/123?utm_source=abc",
  "title": "示例标题",
  "note": "我想学习它的叙事推进方式",
  "tags": ["叙事", "共鸣"],
  "source": "wechat"
}
```

Response:

```json
{
  "ok": true,
  "id": "itm_20260223_8f0e9f6d",
  "deduplicated": false
}
```

### 6.2 `items.jsonl` 单行格式

```json
{
  "id": "itm_20260223_8f0e9f6d",
  "url": "https://example.com/post/123?utm_source=abc",
  "canonical_url": "https://example.com/post/123",
  "title": "示例标题",
  "note": "我想学习它的叙事推进方式",
  "tags": ["叙事", "共鸣"],
  "source": "wechat",
  "captured_at": "2026-02-23T09:30:21.125Z",
  "client": "extension"
}
```

字段规则：

1. `note` 必填，长度 5-280 字
2. `tags` 可空，入库时统一小写并去首尾空格
3. `source` 为必填枚举：`xhs | douyin | x | wechat | other`
4. `canonical_url` 去掉常见追踪参数：`utm_*`, `spm`, `from`, `source`, `si`
5. URL hash 片段默认移除（`#...`）

## 7. 目录结构（MVP）

```text
Creator/
  docs/
    plans/
      2026-02-23-content-agent-mvp-design.md
      2026-02-23-content-agent-implementation-plan.md
  inbox/
    items.jsonl
    index.json
  inbox-server/
    src/
    tests/
  browser-extension/
    manifest.json
    popup.html
    popup.js
    service-worker.js
```

## 8. 高质量信息源策略（操作层）

为避免噪音和抓取风险，采集策略采用“白名单优先”：

1. 每个平台先建立 20-50 个种子账号/号主
2. 每次收藏必须附 1 句“为什么值得学”
3. 收藏先进收件箱，不直接入知识库
4. 周度复盘：标记高复用条目，进入提取/入库流程

## 9. 安全与合规

1. 本地服务只监听 `127.0.0.1`
2. 写入必须携带 `X-Inbox-Token`
3. 不做绕过登录、反爬、破解等行为
4. 原始链接保留来源信息，便于版权与引用追溯

## 10. 错误处理与降级策略

1. 本地服务未启动：
   - 扩展提交失败后提示“服务未连接”
   - 展示 `Copy JSON` 按钮，允许用户复制并手工落库
2. JSONL 写入失败（磁盘满/权限不足）：
   - API 返回 `500`，错误码 `STORAGE_WRITE_FAILED`
   - 扩展显示可重试提示，不吞错
3. `index.json` 损坏：
   - 读取失败时自动备份为 `index.json.bak.<timestamp>`
   - 基于 `items.jsonl` 重建索引后继续服务
4. 并发写入冲突：
   - MVP 假设单机单用户低并发，不做跨进程锁
   - 若出现冲突，记录日志并在下一阶段引入文件锁或单写队列

## 11. 测试策略

1. 单元测试：
   - URL canonicalize 规则
   - Zod schema 校验（字段边界与错误信息）
2. 集成测试：
   - `POST /api/v1/items` 端到端（auth + validate + storage）
   - dedupe 返回语义
3. 手动测试：
   - 浏览器扩展 capture 流程
   - 服务离线时 fallback copy-json 流程

## 12. MVP 验收标准

1. 扩展点击后 3 秒内完成写入
2. 非法 token 请求被拒绝（401）
3. 缺字段请求被拒绝（400）
4. 合法请求成功写入一行 JSONL（200）
5. 同一 canonical URL 重复提交可识别（返回 `deduplicated: true`）

## 13. 里程碑

1. `M1` 收集闭环：扩展 + 本地 API + JSONL 持久化
2. `M2` 提取闭环：从 JSONL 生成结构化提取结果
3. `M3` 入库闭环：提取结果进入知识库/技巧库
4. `M4` 拼装闭环：输入议题输出长文与短帖草稿

## 14. 已决策项（替代原待决问题）

1. `source` 采用手工选择，不做域名自动推断
2. 重复提交策略：保留新记录，返回 `deduplicated: true`
3. `tags` 采用自由输入，不做受控词表
4. 提取层（LLM/规则）不纳入 MVP，延后到 `M2` 决策
