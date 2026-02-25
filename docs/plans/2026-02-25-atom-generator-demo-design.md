# 基于素材的灵感生成器（Demo）设计文档

**日期：** 2026-02-25  
**状态：** Approved (Demo Scope)  
**作者：** Codex + 用户共创

## 1. 目标与范围

本次仅面向 Demo，优先考虑功能丰富性与功能测试完整度，不做重工程化优化。

必须交付功能：
1. 参数化灵感生成（目标/去重强度/新颖度）
2. 多模型切换生成
3. 生成结果去重与重排
4. 原子落盘与可追溯（source item ids）

## 2. 内容原子定义

每个内容原子包含：
1. `hook`（标题钩子）
2. `thesis`（核心观点）
3. `evidence_snippet`（论据片段）
4. `tone`（情绪/语气）
5. `audience`（受众）
6. `reusable_sentence`（可复用句子）
7. `source_item_ids`（来源素材 ID 列表）

## 3. 交互模式

采用“参数灵活的炒菜模式”，入口为 API 与 CLI。

关键参数：
1. `goal`: `inspire | publishable | reusable`
2. `dedupe_strength`: `low | medium | high`
3. `novelty`: `safe | balanced | bold`

## 4. 架构方案（平衡版）

采用两阶段：
1. 选料：从 `inbox/items.jsonl` 读取素材并构建上下文
2. 出菜：调用可切换 provider 的 LLM 生成原子，再做去重重排

结果写入：
1. `inbox/atoms.jsonl` 持久化每次 run 结果
2. 输出保留 `run_id`、参数快照、来源素材 ID，支持回放

## 5. 测试策略（Demo）

采用混合测试：
1. 主测试使用 mock provider（稳定、快速）
2. 补充 1-2 条真实 provider 冒烟测试（环境变量缺失时自动 skip）

覆盖维度：
1. API：参数校验、返回结构、去重与追溯字段
2. CLI：参数透传与结果输出
3. 存储：`atoms.jsonl` 落盘结构
4. Provider：切换逻辑

## 6. 验收标准（Demo）

1. 单次生成可产出最多 15 条有效原子
2. 输出字段满足原子 schema
3. 每条原子可追溯到来源素材 ID
4. mock 主线测试通过 + 冒烟测试可触发
