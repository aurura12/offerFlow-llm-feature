# 岗位时间线与同公司多岗位设计

## 目标

参考 `cihaiqiuao/offerflow-offline` 的实现，为 OfferFlow 增加两项能力：

1. 每个岗位拥有“阶段流程 + 手动进展记录”的时间线；
2. 同一公司的多个岗位在岗位库和看板中聚合展示，同时保留每个岗位独立的状态、详情和时间线。

参考项目的核心模式是：岗位记录仍然独立保存，时间线事件独立保存并通过岗位 ID 关联，公司卡片只是基于公司名和批次的视图分组，不引入独立的公司实体。

## 范围与非目标

### 本次范围

- 创建岗位时自动记录“创建投递”事件；
- 岗位状态变化时自动记录状态变更事件；
- 在岗位详情中手动添加沟通、面试和其他进展节点；
- 自动事件不可删除，手动事件可以删除；
- 在岗位库中按公司聚合多个岗位；
- 在看板中按列聚合同公司岗位；
- 提供“同公司新增岗位”快捷入口，并预填共享信息；
- 兼容当前 `Job.timeline` 中已有的历史数据；
- 保留当前项目已有的 10 个细分状态和面试轮次逻辑。

### 非目标

- 本次不新增 `Company` Prisma 模型；
- 不把同公司的不同岗位合并成一条 Job；
- 不共享不同岗位的时间线、面试复盘或 Offer 数据；
- 不重做现有 10 列看板、岗位表格和整体主题风格；
- 不引入邮件通知、招聘网站抓取或自动同步。

## 参考项目实现结论

参考项目使用以下结构：

- `ApplicationRecord`：一条岗位投递记录，包含公司和岗位字段；
- `ApplicationEvent`：通过 `applicationId` 关联岗位，字段包括事件类型、标题、日期、备注、前后阶段；
- 创建投递时写入 `CREATED` 事件；
- 更新阶段时写入 `STAGE_CHANGED` 事件；
- 手动进展使用 `NOTE` 事件；
- 删除事件时只允许删除 `NOTE`；
- 公司分组使用标准化后的 `company + batch` 作为 key；
- “同公司新岗位”通过复制公司、城市、渠道等字段打开新增表单。

当前项目采用 Prisma + API Routes + `AppContext`，因此复用上述领域逻辑，但将 IndexedDB 的存储调用替换为 Prisma 事务和 API 调用。

## 数据模型

### 新增 `JobEvent` 模型

在 `prisma/schema.prisma`、`prisma/schema.sqlite.prisma` 和 `prisma/schema.pg.prisma` 中新增：

```prisma
model JobEvent {
  id         String   @id @default(cuid())
  userId     String
  jobId      String
  type       String
  title      String
  eventDate  String
  notes      String?
  fromStatus String?
  toStatus   String?
  createdAt  DateTime @default(now())

  user User @relation(fields: [userId], references: [id])
  job  Job  @relation(fields: [jobId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([jobId, eventDate])
}
```

`type` 的约定值：

- `CREATED`：创建投递；
- `STATUS_CHANGED`：状态变化；
- `NOTE`：用户手动添加的沟通/面试/其他节点；
- `EDITED`：仅用于兼容旧 `Job.timeline` 中的编辑记录，新编辑不再自动产生此类记录。

`User` 增加 `jobEvents JobEvent[]`，`Job` 增加 `events JobEvent[]`。

### 旧 `Job.timeline` 的兼容策略

- 第一版保留 `Job.timeline` 字段，避免旧 seed 数据和旧数据库无法读取；
- 新创建和新修改的事件统一写入 `JobEvent`，不再由前端直接拼接 `timeline`；
- 增加一次性幂等迁移脚本，把旧 JSON 时间线转换为 `JobEvent`；
- 迁移后的旧数据仍保留在 `timeline` 中，但 UI 以 `JobEvent` 为主；若某条旧数据尚未迁移，详情页使用 legacy fallback 展示；
- 后续确认迁移稳定后，再单独考虑移除 `Job.timeline`，本次不做破坏性删除。

## 事件写入规则

### 创建岗位

`POST /api/jobs` 使用 Prisma transaction：

1. 创建 Job；
2. 创建 `CREATED` JobEvent；
3. `eventDate` 使用 `appliedDate`，没有投递日期时使用当天日期；
4. 标题格式为 `创建投递 · {当前状态}`。

### 更新岗位

`PUT /api/jobs` 先读取并校验当前用户拥有该 Job，然后在 transaction 中：

1. 更新岗位字段；
2. 如果 status 发生变化，追加 `STATUS_CHANGED` 事件；
3. 事件包含 `fromStatus`、`toStatus` 和 `状态A → 状态B` 标题；
4. 其他字段编辑不自动追加事件；
5. 客户端 Board、JobModal、JobDetailModal 不再自行拼接状态时间线，避免重复事件。

### 手动事件

新增岗位事件 API，至少支持：

- `POST /api/jobs/[id]/events`：创建 `NOTE`；
- `DELETE /api/jobs/[id]/events/[eventId]`：删除手动 `NOTE`。

创建时校验：标题非空、日期格式为 `YYYY-MM-DD`、岗位属于当前用户。删除时再次校验用户权限，并拒绝删除 `CREATED`、`STATUS_CHANGED`、`EDITED`。

## 阶段流程展示

参考项目展示 5 个顶层阶段，但当前项目已有 10 个细分状态，因此增加映射而不改变原有状态：

| 顶层时间线阶段 | 当前状态映射 |
|---|---|
| 已投递 | `待投递`、`已投递` |
| 笔试 | `笔试/在线测评` |
| 面试 | `AI 面试`、`一面中`、`二面中`、`三面中`、`终面中` |
| Offer | `Offer` |
| 已结束 | `已结束` |

阶段条显示 5 个节点；当前阶段旁显示细分状态，例如“面试 · 二面中”。面试节点下继续展示 `interviewRounds` 中的轮次信息，保持当前应用已有的面试统计逻辑。

阶段日期来源优先级：

1. 对应 `toStatus` 的最早 `STATUS_CHANGED` 事件日期；
2. `CREATED` 事件日期作为“已投递”日期；
3. 没有日期时显示“待补充/待进入”。

## 岗位详情时间线 UI

在现有 `JobDetailModal` 中复刻参考项目的结构：

1. 岗位基本信息和快捷状态操作；
2. 顶部阶段流程条；
3. 手动进展表单：
   - 进展标题；
   - 日期；
   - 备注；
   - 当前处于面试状态时，可以选择面试轮次作为标题；
4. 下方按日期倒序显示事件列表；
5. 自动事件只展示，不显示删除按钮；
6. 手动事件显示删除按钮；
7. 保持现有弹窗滚动、主题和 Toast 反馈。

## 同公司多岗位

### 分组函数

新增纯函数，供 Board 和 Positions 共用：

```js
normalizeCompanyName(companyName) -> string
groupJobsByCompany(jobs) -> Array<{ company, jobs }>
```

标准化规则：

- 空值归入“未填写公司”；
- 去除首尾空格；
- 分组 key 使用 `toLocaleLowerCase()`；
- 展示名称使用该组第一条记录的原始公司名；
- 过滤应先执行，再对过滤后的岗位分组；
- 公司组按组内最新 `appliedDate` 倒序；岗位按 `appliedDate` 倒序。

### 岗位库

当前 `Positions.jsx` 已有基础公司 rowspan 分组，改为使用共用分组函数：

- 支持“字节跳动”和带首尾空格的同名记录聚合；
- 保留每个岗位独立行、勾选、编辑、删除和详情点击；
- 公司单元格显示公司名和岗位数量；
- 不改变现有筛选、搜索和 CSV 导出行为。

### 看板

当前 `Board.jsx` 继续保留 10 列拖拽看板，但每列内部按公司聚合：

- 同一列内同公司岗位显示为一个公司分组卡片；
- 每个岗位仍是独立可拖拽项；
- 公司卡片显示公司名、该列岗位数和岗位列表；
- 公司卡片底部提供“同公司新增岗位”；
- 新岗位创建后默认进入当前列状态。

如果单列中多个岗位的拖拽嵌套影响原生 HTML5 拖拽，则第一版保留当前单岗位卡片拖拽，在卡片上增加公司徽标和同公司岗位数量；公司聚合优先在 Positions 完整落地，Board 以不破坏拖拽为验收前提。

### 同公司新增岗位

从公司组点击后打开 `JobModal`，预填：

- `companyName`；
- `city`；
- `channel`；
- `contactName`；
- `contactInfo`；
- 当前看板列对应的 `status`（从看板入口新增时）。

不自动复制：岗位名称、岗位链接、JD、投递日期、简历、下一步行动和岗位备注。

## 前端数据流

- `/api/jobs` 返回岗位及其 `events`；
- `AppContext` 保持现有 `jobs` CRUD，并增加 `addJobEvent`、`deleteJobEvent`；
- 岗位详情从当前 `jobs` 中读取对应岗位和事件，保存后重新加载或局部更新；
- Dashboard 的“最近动态”从所有岗位的 `events` 展平、按 `eventDate/createdAt` 倒序；
- 退出登录时不新增额外缓存，沿用当前用户隔离和 localStorage 清理逻辑。

## 数据迁移与协作同步

- 新增 Prisma migration 创建 `JobEvent` 表；
- 新增幂等脚本迁移已有 `Job.timeline`；
- `scripts/predev.js` 在 seed 增量同步后执行迁移脚本；
- `scripts/export-seed.js` 增加导出 `jobEvents`；
- `prisma/seed.js` 按 `users → resumes → jobs → jobEvents → tasks → reviews` 顺序同步，满足 Job 对 Resume 的外键依赖；
- 删除岗位时通过 `onDelete: Cascade` 删除事件；
- 所有事件查询和写入都必须按当前用户权限校验。

## 验收标准

### 时间线

- 新建岗位后能看到“创建投递”节点；
- 拖拽岗位状态后只产生一条状态变更节点；
- 在详情页能添加带日期和备注的手动节点；
- 手动节点可以删除，自动节点不能删除；
- 旧 `Job.timeline` 数据可见且不会重复迁移；
- Dashboard 最近动态能展示来自多个岗位的事件。

### 同公司多岗位

- 同一公司至少两个岗位时，岗位库只显示一个公司分组并列出多个岗位；
- 公司名大小写、首尾空格差异不会产生错误分组；
- 每个岗位仍能独立查看、编辑、删除和拖拽状态；
- 从公司分组新增岗位会预填共享信息；
- 删除一个岗位不会影响同公司的其他岗位；
- 一个岗位的时间线和面试复盘不会出现在同公司的其他岗位中。

## 许可证说明

参考项目为 MIT License。若实现阶段直接复制其大段代码或结构，应在仓库中保留原许可证声明及 `cihaiqiuao` 的版权说明；当前设计优先复用领域逻辑和交互，不直接复制其离线存储实现。
