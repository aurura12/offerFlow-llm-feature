# Offer 对比设计

## 目标

在现有 OfferFlow 中增加一个简单的一级页面，用于集中查看已收到的国内 Offer，并填写基础薪资信息，帮助用户做直观比较。

本功能只覆盖国内三类岗位：公务员、央国企、私企研发岗。不加入 AI、权重评分、城市生活成本模型、税后收入估算、股权估值或自动推荐。

## 参考实现

参考项目：`cihaiqiuao/offerflow-offline`。

其实际实现逻辑为：

- 工作台提供一级导航 `Offer 对比`；移动端提供 `Offer` 入口；
- 过滤出状态为 `Offer` 的岗位，或已经存在 Offer 信息的岗位；
- 每个岗位显示一张 Offer 卡片；
- 点击卡片打开岗位详情，在详情中编辑 Offer 信息；
- 预计年度现金使用 `月薪 × 薪资月数 + 年度奖金` 计算；
- 缺失薪资字段显示为“信息不完整”，不把未知值静默当成 0。

参考源码：

- `src/components/workspace.tsx` 的 `WorkspaceView`、导航和 `Offers` 视图；
- `src/lib/domain.ts` 的 `OfferRecord`、`parseOfferInput` 和 `calculateAnnualCash`。

## 产品边界

### 包含

- `/offers` 一级页面；
- 侧边栏和移动端底部导航入口；
- 仪表盘 Offer 数量卡片跳转；
- Offer 卡片列表；
- 在岗位详情中编辑 Offer 基础信息；
- 预计年度现金计算；
- 央国企、公务员和私企研发岗共用同一套基础字段；
- 福利、编制、正式工/外包、加班等差异信息通过福利和备注记录。

### 不包含

- AI 分析、AI 推荐或自然语言提取；
- 自定义评分和权重；
- 城市生活成本数据库；
- 税后收入计算；
- 股权未来价值估算；
- 自动判断公务员或央国企福利的货币价值；
- 多 Offer 选择结果持久化；
- 独立的 Offer 版本历史。

## 页面与交互

### Offer 对比页面

页面路径为 `/offers`，组件建议放在 `src/views/Offers.jsx`。

页面只展示以下岗位：

```js
job.status === 'Offer'
```

如果后续允许 Offer 状态回退，只要 Offer 记录仍存在，也可以继续显示：

```js
job.status === 'Offer' || offerExistsForJob
```

每张卡片展示：

- 公司/单位；
- 岗位；
- 城市；
- 岗位状态；
- 月薪；
- 薪资月数；
- 年度奖金；
- 预计年度现金；
- 决策截止日期；
- `查看并编辑` 操作。

页面没有复杂的排序和推荐。默认按岗位投递日期或更新时间倒序展示。

### 岗位详情中的 Offer 区域

在现有 `JobDetailModal` 中增加 Offer 信息区域。岗位状态为 `Offer` 时显示；如果已有 Offer 记录，即使状态发生变化，也允许打开和编辑。

字段：

- 税前月薪：非负数字，可为空；
- 薪资月数：非负数字，允许小数，可为空；
- 年度奖金：非负数字，可为空；
- Offer 城市：文本，可为空，默认使用岗位城市；
- 决策截止：日期，可为空；
- 福利：多行文本，可为空；
- 备注：多行文本，可为空。

字段单位固定为人民币元，页面不支持外币和汇率。

### 入口

- `src/components/Sidebar.jsx` 增加 `Offer 对比`；
- `src/components/BottomNav.jsx` 增加 `Offer`；
- `src/views/Dashboard.jsx` 的 Offer 统计卡片跳转 `/offers`；
- `src/components/JobDetailModal.jsx` 的 Offer 信息区域提供编辑入口。

## 数据模型

新增 `Offer` Prisma 模型，与 `Job` 建立一对一关系：

```prisma
model Offer {
  id               String   @id @default(cuid())
  userId           String
  jobId            String   @unique
  monthlyBaseYuan  Int?
  salaryMonths     Float?
  annualBonusYuan  Int?
  city             String?
  decisionDeadline String?
  benefits         String?
  notes            String?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  user User @relation(fields: [userId], references: [id])
  job  Job  @relation(fields: [jobId], references: [id], onDelete: Cascade)

  @@index([userId])
}
```

`User` 增加 `offers Offer[]`，`Job` 增加 `offer Offer?`。

同时更新：

- `prisma/schema.prisma`；
- `prisma/schema.sqlite.prisma`；
- `prisma/schema.pg.prisma`；
- SQLite migration。

不修改现有 `Job.salaryRange`，它继续作为岗位列表中的原始薪资范围；Offer 页面使用结构化字段计算。

## 计算逻辑

提供独立的纯函数，建议放在 `src/lib/offerComparison.js`：

```js
export function calculateAnnualCash(offer) {
  if (offer.monthlyBaseYuan == null || offer.salaryMonths == null) {
    return null
  }

  return offer.monthlyBaseYuan * offer.salaryMonths + (offer.annualBonusYuan || 0)
}
```

规则：

- 月薪和薪资月数任一缺失，结果为 `null`；
- 年度奖金缺失时按 0 计算；
- 所有数字必须是非负数；
- 计算结果只代表预计年度现金，不代表税后收入或完整总包；
- 页面显示 `null` 时使用“信息不完整”。

## API 与数据流

建议提供：

- `GET /api/offers`：读取当前用户的 Offer，并关联岗位基本信息；
- `PUT /api/jobs/[id]/offer`：按 Job 创建或更新 Offer；
- `DELETE /api/jobs/[id]/offer`：删除 Offer 信息，不删除 Job；

写入时必须校验：

- Job 属于当前用户；
- 数值字段为非负数字；
- `decisionDeadline` 为 `YYYY-MM-DD` 或空值；
- city、benefits、notes 统一保存为字符串或空值。

当 Job 状态变为 `Offer` 时，可以在状态更新流程中创建空 Offer 记录，也可以在用户第一次打开 Offer 信息区域时懒创建。第一版采用懒创建，避免状态迁移产生无意义的空数据。

## 错误处理

- Offer 不存在时，页面显示空状态，而不是报错；
- 数值非法时阻止保存并显示“薪资字段必须是非负数字”；
- 岗位不属于当前用户时返回 404；
- API 保存失败时保留表单内容并显示错误 Toast；
- 删除 Offer 只删除薪资信息，不影响岗位、面试、任务和时间线。

## 测试要求

纯函数测试覆盖：

```text
20,000 × 14 + 10,000 = 290,000
月薪缺失 => null
薪资月数缺失 => null
奖金缺失 => 月薪 × 薪资月数
负数输入 => 校验失败
```

API 测试覆盖：

- 当前用户可以读取自己的 Offer；
- 用户不能读取或修改其他用户的 Offer；
- 创建 Offer 后再次 PUT 会更新而不是重复创建；
- 删除 Offer 不会删除 Job。

页面验证覆盖：

- Offer 状态岗位出现在 `/offers`；
- 非 Offer 状态岗位不出现在页面；
- 卡片点击可以打开对应岗位详情；
- 编辑后年度现金和卡片信息刷新；
- 空数据时显示“进入 Offer 阶段的机会会自动出现在这里”。

