/**
 * 数据库 seed 脚本：把 prisma/seed-data.json 同步到当前本地数据库
 *
 * 幂等：按 id upsert，重复运行不会产生重复数据。
 * 由 `npm run db:seed` 调用（package.json 中 prisma.seed 配置）。
 *
 * 数据来源：scripts/export-seed.js 导出（改完数据后跑它更新 seed-data.json）。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const dataFile = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'seed-data.json'
)
const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'))

const counts = {
  users: data.users.length,
  resumes: data.resumes.length,
  jobs: data.jobs.length,
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

// 按外键依赖顺序导入：users -> resumes -> jobs -> tasks -> reviews
await upsertAll('user', data.users)
await upsertAll('resume', data.resumes)
await upsertAll('job', data.jobs)
await upsertAll('task', data.tasks)
await upsertAll('review', data.reviews)

console.log(
  `✅ Seed 完成: users ${counts.users} / resumes ${counts.resumes} / jobs ${counts.jobs} / tasks ${counts.tasks} / reviews ${counts.reviews}`
)

await prisma.$disconnect()
