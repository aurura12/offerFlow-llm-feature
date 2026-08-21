/**
 * db:setup 数据库初始化脚本
 *
 * 处理三种本地库状态，保证任何情况下都能得到正确的库：
 *   1. 全新/空库        -> prisma migrate deploy 直接建表
 *   2. 有表但无迁移历史（旧 dev.db）-> 先 baseline（migrate resolve --applied init），再 migrate deploy
 *   3. 已有迁移历史      -> prisma migrate deploy 应用待执行迁移
 *
 * 之后由 `prisma db seed` 灌入 prisma/seed-data.json 的共享数据。
 * 由 `npm run db:setup` 调用。
 */
import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '@prisma/client'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const INIT_MIGRATION = '20260821000000_init'

function run(cmd) {
  console.log('$', cmd)
  execSync(cmd, { stdio: 'inherit', cwd: root })
}

const prisma = new PrismaClient()
try {
  const tables = await prisma.$queryRawUnsafe(
    `SELECT name FROM sqlite_master WHERE type='table' AND name IN ('_prisma_migrations','Job')`
  )
  const hasMigrationTable = tables.some((t) => t.name === '_prisma_migrations')
  const hasBusinessTables = tables.some((t) => t.name === 'Job')

  if (!hasMigrationTable && hasBusinessTables) {
    console.log('检测到已有表但无迁移历史，先基线化现有数据库...')
    run(`npx prisma migrate resolve --applied ${INIT_MIGRATION}`)
  }

  run('npx prisma migrate deploy')
} finally {
  await prisma.$disconnect()
}
