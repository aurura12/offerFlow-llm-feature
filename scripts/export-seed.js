/**
 * 导出当前本地数据库为共享 seed 数据
 *
 * 用法: node --env-file=.env scripts/export-seed.js
 *
 * 把本地 dev.db 里的 users/resumes/jobs/jobEvents/tasks/reviews 全量导出到
 * prisma/seed-data.json，提交该文件即可让协作者通过 `npm run db:seed`
 * 拿到同一份数据。
 *
 * 注意: 导出的内容会进入 git 仓库，请确认没有不想公开的敏感数据。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '@prisma/client'

const outPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'prisma',
  'seed-data.json'
)

const prisma = new PrismaClient()

const data = {
  users: await prisma.user.findMany({ orderBy: { id: 'asc' } }),
  resumes: await prisma.resume.findMany({ orderBy: { id: 'asc' } }),
  jobs: await prisma.job.findMany({ orderBy: { id: 'asc' } }),
  jobEvents: await prisma.jobEvent.findMany({ orderBy: { id: 'asc' } }),
  tasks: await prisma.task.findMany({ orderBy: { id: 'asc' } }),
  reviews: await prisma.review.findMany({ orderBy: { id: 'asc' } }),
}

fs.writeFileSync(outPath, JSON.stringify(data, null, 2) + '\n')

console.log('✅ 已导出到', outPath)
console.log(
  `  users: ${data.users.length}, resumes: ${data.resumes.length}, jobs: ${data.jobs.length}, jobEvents: ${data.jobEvents.length}, tasks: ${data.tasks.length}, reviews: ${data.reviews.length}`
)
console.log('提交 prisma/seed-data.json 即可共享这份数据')

await prisma.$disconnect()
