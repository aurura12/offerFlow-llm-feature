# 岗位时间线与同公司多岗位实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 按参考 OfferFlow Offline 的实现，为当前 OfferFlow 增加独立岗位事件时间线、阶段流程展示、同公司岗位聚合和同公司新增岗位入口。

**Architecture:** 新增 `JobEvent` Prisma 模型保存创建、状态变更和手动进展事件，保留旧 `Job.timeline` 作为兼容字段并通过幂等脚本回填。公司不建独立表，使用纯函数按标准化公司名分组；API 负责自动事件和权限校验，`AppContext` 负责客户端状态同步，详情弹窗负责时间线交互。

**Tech Stack:** Next.js 16 App Router, React 19, Prisma 6, SQLite/PostgreSQL, Node `node:test`, Tailwind CSS 4。

**Spec:** `docs/superpowers/specs/2026-08-22-job-timeline-company-groups-design.md`

## Global Constraints

- 不新增 `Company` Prisma 模型；公司只是岗位视图分组。
- 保留当前 `Job` 的 10 个状态和 `interviewRounds` 字段，不改现有状态值。
- 第一版保留 `Job.timeline`，新事件统一写入 `JobEvent`，不得由前端直接拼接新时间线。
- 所有岗位事件 API 必须校验当前用户拥有对应 Job，禁止通过事件 ID 跨用户读取或删除。
- 自动事件 `CREATED`、`STATUS_CHANGED`、`EDITED` 不可删除，只有 `NOTE` 可以删除。
- 不增加运行时依赖；测试使用 Node 内置 `node:test`。
- 直接复制参考项目大段代码时，保留其 MIT 许可证和 `cihaiqiuao` 版权说明。
- 完成前运行 `npm test`、`npx prisma validate` 和 `npx next build --webpack`。

---

### Task 1: 建立时间线与公司分组领域函数

**Files:**
- Create: `src/lib/jobTimeline.js`
- Create: `src/lib/jobGroups.js`
- Create: `tests/jobTimeline.test.mjs`
- Create: `tests/jobGroups.test.mjs`
- Modify: `package.json`

**Interfaces:**
- `getTopLevelStage(status) -> { key, label }`
- `getJobEvents(job) -> object[]`
- `sortJobEvents(events) -> object[]`
- `canDeleteJobEvent(event) -> boolean`
- `legacyTimelineToEvents(job) -> object[]`
- `normalizeCompanyName(companyName) -> string`
- `groupJobsByCompany(jobs) -> Array<{ company, jobs }>`
- `buildCompanyPrefill(job, status) -> object`

- [ ] **Step 1: 添加测试脚本并写失败测试**

在 `package.json` 增加：

```json
"test": "node --test tests/*.test.mjs"
```

在 `tests/jobGroups.test.mjs` 写入以下行为测试：

```js
import assert from 'node:assert/strict'
import test from 'node:test'
import { groupJobsByCompany, normalizeCompanyName } from '../src/lib/jobGroups.js'

test('company grouping ignores surrounding spaces and case', () => {
  const groups = groupJobsByCompany([
    { id: '1', companyName: ' 字节跳动 ', appliedDate: '2026-08-01' },
    { id: '2', companyName: '字节跳动', appliedDate: '2026-08-02' },
    { id: '3', companyName: '小鹏', appliedDate: '2026-08-03' },
  ])
  assert.equal(normalizeCompanyName(' 字节跳动 '), '字节跳动')
  assert.equal(groups.length, 2)
  assert.deepEqual(groups[0].jobs.map((job) => job.id), ['2', '1'])
})
```

在 `tests/jobTimeline.test.mjs` 写入以下行为测试：

```js
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  canDeleteJobEvent,
  getTopLevelStage,
  legacyTimelineToEvents,
  sortJobEvents,
} from '../src/lib/jobTimeline.js'

test('current statuses map to the five reference timeline stages', () => {
  assert.equal(getTopLevelStage('二面中').key, 'INTERVIEW')
  assert.equal(getTopLevelStage('笔试/在线测评').key, 'ASSESSMENT')
  assert.equal(getTopLevelStage('已结束').key, 'CLOSED')
})

test('only manual NOTE events can be deleted', () => {
  assert.equal(canDeleteJobEvent({ type: 'NOTE' }), true)
  assert.equal(canDeleteJobEvent({ type: 'STATUS_CHANGED' }), false)
})

test('legacy timeline conversion is deterministic and preserves edit history', () => {
  const events = legacyTimelineToEvents({ id: 'job-1', timeline: [
    { date: '2026-08-01', action: '投递简历', detail: '官网投递' },
    { date: '2026-08-02', action: '状态变更', detail: '从 已投递 更新为 一面中' },
  ] })
  assert.equal(events[0].id, 'legacy-job-1-0')
  assert.equal(events[1].type, 'STATUS_CHANGED')
  assert.equal(events[1].fromStatus, '已投递')
  assert.equal(events[1].toStatus, '一面中')
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test`

Expected: FAIL，因为 `src/lib/jobGroups.js` 和 `src/lib/jobTimeline.js` 尚未创建。

- [ ] **Step 3: 实现公司分组函数**

`src/lib/jobGroups.js` 实现以下规则：先过滤由调用方传入的列表，再按 `normalizeCompanyName(companyName)` 分组；组内岗位按 `appliedDate` 倒序，日期相同按 `createdAt` 倒序；公司组按组内最新投递日期倒序；空公司名统一展示为“未填写公司”。

`buildCompanyPrefill(job, status)` 返回：

```js
{
  companyName: job.companyName || '',
  city: job.city || '',
  channel: job.channel || '',
  contactName: job.contactName || '',
  contactInfo: job.contactInfo || '',
  status: status || '已投递',
}
```

- [ ] **Step 4: 实现时间线函数**

`src/lib/jobTimeline.js` 定义 `TOP_LEVEL_STAGES` 为 `已投递 / 笔试 / 面试 / Offer / 已结束`，并按设计规格完成当前 10 个状态到 5 个顶层阶段的映射。`getJobEvents` 优先读取 `job.events`，当其为空时把 `job.timeline` 转为 legacy 事件；`sortJobEvents` 按 `eventDate`、`createdAt` 倒序。

`legacyTimelineToEvents` 使用 `legacy-${job.id}-${index}` 作为稳定 ID：`投递简历` 转为 `CREATED`，包含“状态变更”或“标记为”的记录转为 `STATUS_CHANGED`，其他记录转为 `EDITED`；从 `从 A 更新为 B` 中提取 `fromStatus` 和 `toStatus`。

- [ ] **Step 5: 运行测试确认通过**

Run: `npm test`

Expected: 所有公司分组、状态映射、删除权限和 legacy 转换测试 PASS。

- [ ] **Step 6: Commit**

```bash
git add package.json src/lib/jobTimeline.js src/lib/jobGroups.js tests
git commit -m "feat: add job timeline and company grouping domain helpers"
```

### Task 2: 添加 JobEvent 数据模型与历史数据迁移

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `prisma/schema.sqlite.prisma`
- Modify: `prisma/schema.pg.prisma`
- Create: `prisma/migrations/<generated>_add_job_events/migration.sql`
- Create: `scripts/migrate-job-timelines.js`
- Modify: `scripts/predev.js`
- Modify: `scripts/export-seed.js`
- Modify: `prisma/seed.js`
- Create: `THIRD_PARTY_NOTICES.md`

**Interfaces:**
- Prisma `JobEvent` model with `id`, `userId`, `jobId`, `type`, `title`, `eventDate`, `notes`, `fromStatus`, `toStatus`, `createdAt`.
- `node scripts/migrate-job-timelines.js` is idempotent and returns exit code 0 when there is nothing to migrate.
- Seed data includes `jobEvents` after `jobs` and before dependent records.

- [ ] **Step 1: 修改三个 Prisma schema**

在 `User` 增加 `jobEvents JobEvent[]`，在 `Job` 增加 `events JobEvent[]`，并添加设计规格中定义的 `JobEvent` 模型。保留 `Job.timeline Json?`，关系使用 `onDelete: Cascade`，增加 `[userId]` 和 `[jobId, eventDate]` 索引。

- [ ] **Step 2: 生成并检查 SQLite migration**

Run: `npm run db:sqlite`

Run: `npx prisma migrate dev --name add_job_events`

Expected: 生成创建 `JobEvent` 表、两个索引以及指向 `users`/`Job` 的外键 migration；不得删除 `Job.timeline`。

- [ ] **Step 3: 实现幂等 legacy 回填脚本**

脚本读取所有 `Job.timeline` 数组，调用 `legacyTimelineToEvents(job)`，对每个事件执行 `prisma.jobEvent.upsert({ where: { id }, create, update: {} })`；`update: {}` 确保脚本重复运行不会覆盖用户后来编辑过的事件。旧事件的 `createdAt` 使用 `${eventDate}T00:00:00.000Z`，无法解析的日期使用当前时间。

- [ ] **Step 4: 接入开发启动同步**

在 `scripts/predev.js` 的 additive seed 完成后执行 `node scripts/migrate-job-timelines.js`，确保新增 seed 数据先入库再回填事件。

- [ ] **Step 5: 扩展 seed 导出和导入**

`scripts/export-seed.js` 增加 `jobEvents: await prisma.jobEvent.findMany({ orderBy: { id: 'asc' } })`；`prisma/seed.js` 增加数量统计和 `jobEvent` 的完整 upsert/additive 导入，顺序固定为 `user -> resume -> job -> jobEvent -> task -> review`，并对旧 seed 文件使用 `data.jobEvents || []`。

- [ ] **Step 6: 添加第三方许可证说明**

创建 `THIRD_PARTY_NOTICES.md`，记录参考仓库 URL、MIT License、`Copyright (c) 2026 cihaiqiuao`，说明本项目复用了时间线与公司分组的领域思路。

- [ ] **Step 7: 验证数据库和回填**

Run: `npx prisma validate`

Run: `node scripts/migrate-job-timelines.js`

Run: `node scripts/migrate-job-timelines.js`

Expected: 两次执行都成功，第二次不产生重复事件；`prisma/seed-data.json` 中包含 `jobEvents`。

- [ ] **Step 8: Commit**

```bash
git add prisma scripts/predev.js scripts/export-seed.js prisma/seed.js THIRD_PARTY_NOTICES.md
git commit -m "feat: add persisted job events and legacy timeline migration"
```

### Task 3: 实现岗位事件 API 与 AppContext 同步

**Files:**
- Modify: `src/app/api/jobs/route.js`
- Create: `src/app/api/jobs/[id]/events/route.js`
- Create: `src/app/api/jobs/[id]/events/[eventId]/route.js`
- Modify: `src/store/AppContext.jsx`

**Interfaces:**
- `GET /api/jobs -> Job[]`，每个 Job 包含按 `eventDate asc, createdAt asc` 排序的 `events`。
- `POST /api/jobs -> { job, event }`，创建岗位时返回自动生成的 `CREATED` 事件。
- `PUT /api/jobs -> { job, event: JobEvent | null }`，状态变化时返回自动生成的 `STATUS_CHANGED` 事件。
- `POST /api/jobs/[id]/events` 接收 `{ title, eventDate, notes }`，返回 `{ event }`。
- `DELETE /api/jobs/[id]/events/[eventId]` 返回 `{ success: true }`。
- `useApp().addJobEvent(jobId, input) -> Promise<JobEvent | undefined>`。
- `useApp().deleteJobEvent(jobId, eventId) -> Promise<void>`。

- [ ] **Step 1: 先定义 API 行为检查清单**

在修改代码前确认以下请求都能被现有 middleware 拦截为 401：无 Cookie 访问、访问其他用户 Job、访问其他用户 Event、删除自动 Event。把这些场景记录为实现验收项，API 错误消息分别使用“未登录”“无权操作此记录”“自动生成的流程记录不能删除”。

- [ ] **Step 2: 让 GET /api/jobs 返回 events**

在 `findMany` 中增加：

```js
include: {
  events: { orderBy: [{ eventDate: 'asc' }, { createdAt: 'asc' }] },
},
```

保留 `where: { userId: user.id }`，不要返回其他用户的 Job 或 Event。

- [ ] **Step 3: 把创建岗位和 CREATED 事件放进同一个 transaction**

`POST /api/jobs` 只接收现有 Job 字段，创建后写入 `JobEvent`：`type: 'CREATED'`、`title: 创建投递 · ${job.status}`、`eventDate: job.appliedDate || today`、`toStatus: job.status`。返回包含 `job` 和 `event` 的结果，保证 AppContext 可立即更新。

- [ ] **Step 4: 把状态变更事件放进 PUT transaction**

`PUT /api/jobs` 先读取 `{ id, userId }`，校验所有权后只更新 Job 字段；如果 `data.status !== existing.status`，同一 transaction 创建 `STATUS_CHANGED` 事件，填入 `fromStatus`、`toStatus`、当天日期和 `从 ${existing.status} 更新为 ${data.status}` 标题。忽略客户端传入的 `events`，防止绕过事件权限规则。

接口响应必须返回更新后的 `job` 和 `event`；未发生状态变化时 `event` 为 `null`，让 AppContext 可以在不重新请求全部岗位的情况下同步当前详情。

- [ ] **Step 5: 实现手动事件 POST 路由**

在 `[id]/events/route.js` 中用 `getAuthUser()` 查找 `{ id, userId }`；标题 `trim()` 后不能为空，日期必须匹配 `/^\d{4}-\d{2}-\d{2}$/`；创建 `NOTE` 并返回完整事件。

- [ ] **Step 6: 实现手动事件 DELETE 路由**

在 `[id]/events/[eventId]/route.js` 中使用 `findFirst({ where: { id: eventId, jobId: id, userId: user.id } })`；找不到返回 404；`type !== 'NOTE'` 返回 400；通过 `delete` 删除后返回 `{ success: true }`。

- [ ] **Step 7: 扩展 AppContext 方法**

`loadAllData` 保存 API 返回的 `events`；`addJob` 将返回的 `event` 放入新 Job；`updateJob` 将返回的非空 `event` 追加到对应 Job 的 `events`；`addJobEvent` 成功后把返回事件追加到对应 Job 的 `events`；`deleteJobEvent` 成功后从对应 Job 的 `events` 移除；API 失败统一调用现有 `addToast`。旧 localStorage 数据没有 `events` 时不报错，由 `getJobEvents` 提供 legacy fallback。

- [ ] **Step 8: 验证 API 契约和构建**

Run: `npx prisma generate`

Run: `npm test`

Run: `npx next build --webpack`

Expected: Prisma Client 生成成功，领域测试 PASS，Webpack build PASS。

- [ ] **Step 9: Commit**

```bash
git add src/app/api/jobs src/store/AppContext.jsx
git commit -m "feat: expose job event APIs and client state methods"
```

### Task 4: 复刻岗位详情时间线交互

**Files:**
- Create: `src/components/JobTimeline.jsx`
- Modify: `src/components/JobDetailModal.jsx`
- Modify: `src/components/JobModal.jsx`

**Interfaces:**
- `JobTimeline({ job, events, onAddEvent, onDeleteEvent, disabled })`：渲染阶段条、手动事件表单和事件列表。
- `JobModal` 接收已有的 `initialStatus`，新增可选 `initialValues`，用于同公司新增岗位预填。

- [ ] **Step 1: 写时间线组件的交互验收用例**

在实现前固定以下 UI 行为：打开详情显示 5 个顶层阶段；当前 `二面中` 显示为“面试 · 二面中”；事件按日期倒序；自动事件没有删除按钮；手动 NOTE 显示删除按钮；面试状态下标题字段显示面试轮次选择器。

- [ ] **Step 2: 实现阶段映射和阶段日期展示**

使用 `getTopLevelStage`、`sortJobEvents` 和 `getJobEvents`；每个阶段日期取对应状态变更事件的最早日期，已投递阶段取 CREATED 事件日期，没有日期显示“待补充/待进入”。面试阶段额外显示 `job.interviewRounds` 中已有的轮次。

- [ ] **Step 3: 实现手动事件表单**

表单包含标题/轮次、日期、备注和“添加进展”按钮；提交调用 `onAddEvent({ title, eventDate, notes })`；成功后清空标题和备注，日期恢复当天；失败保持输入内容并显示 Toast。

- [ ] **Step 4: 实现事件列表和删除确认**

列表使用事件 ID 作为 key，显示标题、日期、备注和事件类型；只对 `NOTE` 调用 `onDeleteEvent`，删除前使用现有确认弹窗或 `window.confirm`，自动事件不渲染删除操作。

- [ ] **Step 5: 接入 JobDetailModal**

从 `useApp()` 取出 `addJobEvent`、`deleteJobEvent`，把现有 timeline JSX 替换为 `JobTimeline`；保留状态快捷按钮、日程创建、面试复盘创建、编辑和删除功能；详情页状态修改只调用 `updateJob({ status })`，不再传 `timeline`。

- [ ] **Step 6: 清理 JobModal 的前端 timeline 拼接**

删除新增岗位和编辑岗位时构造 `timeline` 的逻辑；新增岗位仅提交 Job 字段，让 API 生成 CREATED 事件；编辑岗位仅提交字段变更，让 API 在 status 变化时生成 STATUS_CHANGED 事件；保留当前投递日期默认当天逻辑。

- [ ] **Step 7: 构建验证**

Run: `npm test`

Run: `npx next build --webpack`

Expected: 时间线组件编译成功，原有详情弹窗功能没有 TypeScript/编译错误。

- [ ] **Step 8: Commit**

```bash
git add src/components/JobTimeline.jsx src/components/JobDetailModal.jsx src/components/JobModal.jsx
git commit -m "feat: add editable job timeline detail UI"
```

### Task 5: 实现岗位库公司聚合和同公司新增岗位

**Files:**
- Modify: `src/views/Positions.jsx`
- Modify: `src/components/JobModal.jsx`
- Create: `src/components/CompanyJobGroup.jsx`

**Interfaces:**
- `CompanyJobGroup({ company, jobs, onOpen, onAddRole, renderJob })`：展示公司标题、岗位数量、岗位列表和新增岗位按钮。
- `JobModal({ open, job, onClose, initialStatus, initialValues })`：新建时将 `initialValues` 合并到 `emptyForm`，编辑时忽略 `initialValues`。

- [ ] **Step 1: 用共用分组函数替换 Positions 本地分组**

删除 `Positions.jsx` 内部按原始公司字符串建立 `groups` 的实现，改为对 `filteredJobs` 调用 `groupJobsByCompany(filteredJobs)`；保持筛选先于分组，保留当前排序、勾选、编辑、删除和 CSV 导出。

- [ ] **Step 2: 保留 rowspan 表格并增加公司级新增按钮**

公司单元格继续使用 `rowSpan={jobs.length}`，增加“同公司新增岗位”按钮；点击时调用 `buildCompanyPrefill(jobs[0])`，打开 `JobModal`，不影响行点击和复选框事件冒泡。

- [ ] **Step 3: 扩展 JobModal 预填逻辑**

初始化表单时使用：

```js
const base = job
  ? { ...emptyForm, ...job }
  : { ...emptyForm, ...initialValues, status: initialStatus || initialValues?.status || emptyForm.status }
```

从公司入口只预填公司、城市、渠道、联系人和联系方式；岗位名、岗位链接、JD、投递日期、简历、下一步和备注保持空白。

- [ ] **Step 4: 验证岗位级隔离**

手动创建两个同公司岗位，分别修改状态、删除其中一个、打开另一个详情；确认公司分组仍显示剩余岗位，事件、复盘和 Offer 不互相串联。

- [ ] **Step 5: 验证构建**

Run: `npm test`

Run: `npx next build --webpack`

Expected: 公司分组测试 PASS，页面构建成功。

- [ ] **Step 6: Commit**

```bash
git add src/views/Positions.jsx src/components/JobModal.jsx src/components/CompanyJobGroup.jsx
git commit -m "feat: group positions by company and add same-company jobs"
```

### Task 6: 在看板中复刻同公司岗位聚合并保持拖拽

**Files:**
- Modify: `src/views/Board.jsx`
- Modify: `src/components/CompanyJobGroup.jsx`

**Interfaces:**
- Board 每列使用 `groupJobsByCompany(colJobs)`。
- 每个岗位继续把原有 `Card` 作为独立 draggable 节点，公司的 wrapper 不接管拖拽事件。
- `onAddRole(job)` 打开带当前列 status 的新增表单。

- [ ] **Step 1: 写入列内分组计算**

在每个列的 `colJobs` 过滤和排序完成后调用 `groupJobsByCompany(colJobs)`，不要对未过滤的全量 jobs 分组；列计数继续统计岗位数量而不是公司数量。

- [ ] **Step 2: 为公司组增加标题和岗位数量**

公司组标题显示公司名、该列岗位数和最新岗位日期；组内逐条渲染现有 `Card`，保留 `onDragStart`、`onDrop`、详情打开、编辑、删除、Offer、结束和跟进行动。

- [ ] **Step 3: 添加同公司新增按钮**

公司组底部调用 `onAddRole(companyJobs[0])`；Board 传入当前 column status，让 JobModal 默认状态与当前列一致；预填字段使用 `buildCompanyPrefill`。

- [ ] **Step 4: 检查 HTML5 拖拽回归**

手动验证：同公司两张卡片可以分别拖到不同列；拖拽公司组空白区域不触发状态更新；点击公司组新增按钮不会打开岗位详情；原有快捷菜单和 Portal 菜单仍正常。

- [ ] **Step 5: 构建验证并提交**

Run: `npm test`

Run: `npx next build --webpack`

```bash
git add src/views/Board.jsx src/components/CompanyJobGroup.jsx
git commit -m "feat: group same-company jobs inside board columns"
```

### Task 7: 接入 Dashboard 最近动态和完整回归验证

**Files:**
- Modify: `src/views/Dashboard.jsx`
- Modify: `README.md`
- Modify: `task_plan.md`

**Interfaces:**
- Dashboard 从 `jobs[].events` 展平最近动态，事件项带 `jobId`、公司名和岗位名。
- README 增加“岗位时间线”和“同公司多岗位”的使用说明。

- [ ] **Step 1: 改造 Dashboard 最近动态数据源**

将当前从 `job.timeline` 展平的逻辑改为：对每个 Job 调用 `getJobEvents(job)`，为事件补充 `companyName`、`jobTitle`、`jobId`，按 `eventDate` 和 `createdAt` 倒序取前 6 条；点击事件打开对应岗位详情。

- [ ] **Step 2: 增加旧数据 fallback 展示**

当某个 Job 没有 `events` 时由 `getJobEvents` 读取旧 `timeline`；展示文本保持现有公司、日期和动作格式，避免历史数据在迁移前消失。

- [ ] **Step 3: 更新使用说明和开发计划状态**

README 增加：岗位详情可添加手动进展、状态变化自动记录、同公司岗位分组和“同公司新增岗位”入口；`task_plan.md` 增加本功能完成项和迁移说明。

- [ ] **Step 4: 执行完整检查**

Run: `npm test`

Run: `npx prisma validate`

Run: `node scripts/migrate-job-timelines.js`

Run: `npx next build --webpack`

Expected: 测试通过、Prisma schema 有效、legacy 回填可重复执行、Webpack production build 成功。

- [ ] **Step 5: 进行手动验收**

使用本地账号完成以下流程：

1. 新建岗位，确认出现“创建投递”；
2. 拖动到另一个状态，确认只出现一条状态变化；
3. 在详情页添加面试/沟通节点，确认可删除；
4. 确认自动节点没有删除按钮；
5. 创建同公司第二个岗位，确认岗位库聚合且可独立编辑；
6. 在看板中分别拖动两个同公司岗位，确认状态互不影响；
7. 删除其中一个岗位，确认另一个岗位的事件、复盘和 Offer 仍存在；
8. 刷新页面，确认事件和公司分组仍存在。

- [ ] **Step 6: Commit**

```bash
git add src/views/Dashboard.jsx README.md task_plan.md
git commit -m "feat: finish timeline and company grouping integration"
```

## 执行顺序与检查点

按 Task 1 → Task 2 → Task 3 → Task 4 → Task 5 → Task 6 → Task 7 顺序执行。每个 Task 结束后先运行该 Task 的测试/构建命令，再进入下一项；如果数据库 migration 或拖拽嵌套出现问题，暂停并回到对应 Task 修正，不在最后一次性处理。
