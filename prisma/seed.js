/**
 * 数据库 seed 脚本：把 prisma/seed-data.json 同步到当前本地数据库
 *
 * 两种模式：
 *   - 默认（完整同步）：按 id upsert，把 seed 数据覆盖到本地，重复运行不产生重复数据。
 *   - `--additive`（增量）：只补入本地缺失的数据，**不覆盖**本地已有改动，
 *     适合每次 `npm run dev` 时自动执行（配合 scripts/predev.js）。
 *
 * 数据来源：scripts/export-seed.js 导出（改完数据后跑它更新 seed-data.json）。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const isAdditive = process.argv.includes('--additive')

const dataFile = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'seed-data.json'
)
const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'))

const counts = {
  users: data.users.length,
  resumes: data.resumes.length,
  jobs: data.jobs.length,
  jobEvents: (data.jobEvents || []).length,
  tasks: data.tasks.length,
  reviews: data.reviews.length,
}

async function upsertAll(model, rows) {
  for (const row of rows) {
    await prisma[model].upsert({
      where: { id: row.id },
      create: row,
      update: row,
    })
  }
}

async function additiveSync(model, rows) {
  const existing = await prisma[model].findMany({ select: { id: true } })
  const existingIds = new Set(existing.map((r) => r.id))
  const toCreate = rows.filter((r) => !existingIds.has(r.id))
  if (toCreate.length) {
    await prisma[model].createMany({ data: toCreate })
    console.log(`  补入 ${model}: ${toCreate.length} 条`)
  }
}

// 按外键依赖顺序导入：users -> resumes -> jobs -> jobEvents -> tasks -> reviews
if (isAdditive) {
  console.log('增量模式：只补缺失数据，不覆盖本地改动')
  for (const model of ['user', 'resume', 'job', 'jobEvent', 'task', 'review']) {
    await additiveSync(model, data[`${model}s`] || [])
  }
} else {
  await upsertAll('user', data.users)
  await upsertAll('resume', data.resumes)
  await upsertAll('job', data.jobs)
  await upsertAll('jobEvent', data.jobEvents || [])
  await upsertAll('task', data.tasks)
  await upsertAll('review', data.reviews)
}

console.log(
  `✅ Seed 完成: users ${counts.users} / resumes ${counts.resumes} / jobs ${counts.jobs} / jobEvents ${counts.jobEvents} / tasks ${counts.tasks} / reviews ${counts.reviews}`
)

await prisma.$disconnect()
