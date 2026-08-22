/**
 * npm run dev 启动前的自动数据库同步
 *
 * 目标：`git pull` 后直接 `npm run dev`，数据库就是最新的，不需要手动操作。
 *
 * 做的事情：
 *   1. 确保 .env / schema.prisma 是 SQLite 模式（缺了就从模板复制）
 *   2. 应用未执行的迁移（自动兼容老库无迁移历史的情况，调用 db-setup.js）
 *   3. 增量导入 seed 数据（只补缺失，不覆盖本地改动）
 *
 * 由 package.json 的 dev 脚本调用。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

function run(cmd) {
  execSync(cmd, { stdio: 'inherit', cwd: root })
}

// 1. 保证 SQLite 模式所需文件存在
if (!fs.existsSync(path.join(root, '.env')) && fs.existsSync(path.join(root, '.env.sqlite'))) {
  fs.copyFileSync(path.join(root, '.env.sqlite'), path.join(root, '.env'))
  console.log('已从 .env.sqlite 生成 .env')
}
const schemaPath = path.join(root, 'prisma', 'schema.prisma')
const schemaText = fs.existsSync(schemaPath) ? fs.readFileSync(schemaPath, 'utf8') : ''
if (!schemaText.includes('provider = "sqlite"')) {
  fs.copyFileSync(path.join(root, 'prisma', 'schema.sqlite.prisma'), schemaPath)
  console.log('已切换 schema.prisma 到 SQLite 模式')
}

// 2. 应用迁移（自动兼容老库）
run('node scripts/db-setup.js')

// 3. 增量导入 seed 数据（只补缺失）
if (fs.existsSync(path.join(root, 'prisma', 'seed-data.json'))) {
  run('node prisma/seed.js --additive')
}

// 4. 将旧 Job.timeline JSON 幂等迁移到 JobEvent
run('node scripts/migrate-job-timelines.js')
