# Task Detail 实时对接文档（Injection Only）

## 1. 目标

当前阶段只做 `Injection` 实时展示，不做 `Dumps`。

前端页面（`/tasks/[id]`）需要：
- 任务统计（Progress、WPM、RPS、Injected、WAF、Category、ETA）
- Injection 列表实时追加
- 用户换浏览器/刷新后可恢复当前状态（不丢）

---

## 2. 总体方案

采用 `Snapshot + SSE`：

1. 前端打开页面，先请求一次快照（Snapshot）  
2. 再连接 SSE，接收增量事件（Stats + Injection Results）  
3. 断线后自动重连，必要时按事件游标补齐

说明：  
仅靠 SSE 不能保证“换浏览器不丢”，因为 SSE 不是历史存储。必须由服务端提供快照接口。

---

## 3. 服务端需要提供的接口

## 3.1 获取任务快照（必须）

- `GET /task/:id/snapshot`
- 作用：页面初次加载和刷新时恢复完整状态

建议返回：

```json
{
  "task_id": "xxx",
  "status": "running",
  "stats": {
    "websites_total": 500,
    "websites_done": 120,
    "remaining": 380,
    "success": 10,
    "failed": 110,
    "waf_detected": 28,
    "rps": 1.58,
    "rps_history": [1.2, 1.4, 1.5, 1.58, 1.6],
    "wpm": 95.2,
    "wpm_history": [72, 84, 90, 95.2, 96],
    "category": {
      "Education": 40,
      "Gaming": 20,
      "Failed": 40
    },
    "eta_seconds": 240
  },
  "injection_items": [
    {
      "domain": "example.com",
      "country": "US",
      "category": "Education",
      "created_at": "2026-02-13T10:00:00Z"
    }
  ],
  "last_event_id": "evt_00000123"
}
```

---

## 3.2 SSE 事件流（必须）

- `GET /sse/:id`
- Header：`Authorization: Bearer <token>`
- 返回 `text/event-stream`

至少发送两类业务事件：

1) `stats`

```json
{
  "type": "stats",
  "websites_total": 500,
  "websites_done": 120,
  "remaining": 380,
  "success": 10,
  "failed": 110,
  "waf_detected": 28,
  "rps": 1.58,
  "rps_history": [1.2, 1.4, 1.5, 1.58, 1.6],
  "wpm": 95.2,
  "wpm_history": [72, 84, 90, 95.2, 96],
  "category": {
    "Education": 40,
    "Gaming": 20,
    "Failed": 40
  },
  "eta_seconds": 240
}
```

2) `results_batch`（Injection 列表）

```json
{
  "type": "results_batch",
  "items": [
    {
      "domain": "example.com",
      "country": "US",
      "category": "Education"
    }
  ]
}
```

注意：  
前端 Injection 顶部数字来自 `stats.success`，不是来自列表计数。

---

## 3.3 事件游标补偿（强烈建议）

为避免断线期间丢事件，建议支持：

- SSE 每条事件带 `id: <event_id>`
- 客户端重连带 `Last-Event-ID` 或 `?since=<event_id>`
- 服务端返回该游标之后的事件

如果暂时不做事件补偿，至少要保证快照接口是完整可信的，前端可先拉快照再继续订阅。

---

## 4. 服务端状态存储要求

必须持久化（DB 或 Redis）：

1. 当前任务统计 `stats`（上面字段）  
2. Injection 列表（建议保存最近 N 条，例如 500~2000）  
3. `last_event_id`（用于补偿）

可选优化：
- `rps_history/wpm_history` 采用固定窗口（例如最近 32 个点）
- `category` 直接存百分比（前端按收到值展示）

---

## 5. SSE 输出规范

每个事件必须符合 SSE 标准并以空行结束：

```text
id: evt_00000124
event: stats
data: {"type":"stats", ...}

```

重点：
- 一条完整消息后必须有 `\n\n`
- `data:` 可以多行，但最终必须能拼成合法 JSON
- 可定时发送心跳注释行：`: ping`

---

## 6. 前后端字段映射（当前版本）

- `stats.rps` + `stats.rps_history` -> Requests 图表
- `stats.wpm` + `stats.wpm_history` -> Websites 图表
- `stats.success` -> Injected 数字
- `stats.websites_total` + `stats.websites_done` -> Progress
- `stats.waf_detected` -> WAF
- `stats.category` -> Category Pie
- `stats.eta_seconds` -> ETA
- `results_batch.items[]` -> Injection 表格追加

---

## 7. 验收清单（给后端）

1. 首次打开任务页，快照可返回完整 stats 和 injection_items  
2. SSE 可连续推送 `stats` 与 `results_batch`  
3. 前端不刷新时，数字与表格持续更新  
4. 刷新页面后，状态可恢复（不清零）  
5. 换浏览器登录同账号后，状态仍可恢复  
6. 断网重连后可继续接收新事件（有游标补偿更佳）

---

## 8. 当前不做的内容

- Dumps 列表及 Dumps 状态流
- Dumps 相关统计映射

本阶段只保证 Injection 链路完整可用。

---

## 9. 大数据量（10k+）时服务器必须做什么

如果任务 Injection 结果很多（例如 10k、50k），服务端必须控量，否则前端会卡顿甚至崩溃。

必须执行：

1. 快照接口分页返回  
- 不要一次返回全量  
- `GET /task/:id/snapshot` 建议支持 `limit` + `cursor`（或 `page`）  
- 首次只返回首屏（建议 50~100 条）

2. SSE 批量推送（results_batch）  
- 合并后再推，避免一条一推  
- 建议每批最多 50~200 条  
- 建议每 200ms~1000ms 一个批次（按吞吐压测调整）

3. SSE 事件可恢复（游标）  
- 每条事件有 `event_id`  
- 客户端重连支持 `Last-Event-ID` 或 `since`  
- 能补断线期间遗漏的数据

4. 服务端保存全量，前端只看窗口  
- 服务端保存完整 Injection 结果  
- 前端只展示最近 N 条（例如 500~1000）  
- 历史数据通过分页接口按需查询

5. 查询接口支持排序/过滤（至少基础）  
- 按时间倒序、按国家、按分类查询  
- 避免前端拿全量后本地筛选

6. 设置限流与保护策略  
- 单连接推送频率上限  
- 单任务每秒最大事件数上限  
- 大批量时自动降频与合批

建议执行（高并发场景）：

1. 使用 Redis/Kafka 做事件缓冲  
- Worker 写入事件流  
- SSE 网关按连接消费并推送

2. 为 snapshot 和 list 查询加缓存  
- 热任务优先命中缓存，减少 DB 压力

3. 监控与告警  
- 监控推送延迟、丢包率、重连率、队列堆积

结论：  
10k 不是问题，问题是“是否做了控量和恢复机制”。服务端必须负责全量持久化、分批推送、断线补偿；前端只展示窗口数据。
