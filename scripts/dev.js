/**
 * npm run dev 启动器：数据库自动同步 + 实时导出 + 启动 Next.js
 *
 * 解决的问题：dev.db 被 git 忽略，VS Code 看不到数据库改动。
 * 方案：监听 dev.db 文件变化，变化后自动导出为 prisma/seed-data.json，
 * 这样 VS Code 的源代码管理面板能实时显示数据库改动，直接点按钮提交即可。
 *
 * 流程：
 *   1. 先执行 predev 同步（环境检查 + 应用迁移 + 增量 seed）
 *   2. 启动数据库文件监视器（轮询 mtime，变更后防抖导出）
 *   3. 启动 next dev --turbopack
 *
 * 退出时（Ctrl+C 或 next 退出）监视器随之停止。
 */
import { spawn, execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const DB_FILE = path.join(root, 'prisma', 'dev.db')

function runNode(script) {
  execFileSync(process.execPath, [script], { stdio: 'inherit', cwd: root })
}

// 1. 同步数据库（环境 + 迁移 + 增量 seed）
runNode('scripts/predev.js')
// 启动时先导出一遍，让已有的数据库改动立刻在 VS Code 显示
runNode('scripts/export-seed.js')

// 2. 数据库监视器：dev.db 变化 -> 防抖 1.5s -> 导出 seed
// 同时监控 dev.db 及其 journal/wal/shm 附属文件，兼容各种 SQLite 日志模式
function dbMtime() {
  let max = 0
  for (const name of fs.readdirSync(path.dirname(DB_FILE))) {
    if (name.startsWith('dev.db')) {
      try {
        const m = fs.statSync(path.join(path.dirname(DB_FILE), name)).mtimeMs
        if (m > max) max = m
      } catch {}
    }
  }
  return max
}

let lastMtime = dbMtime()
let exportTimer = null

function checkDb() {
  const m = dbMtime()
  if (m !== lastMtime) {
    lastMtime = m
    if (exportTimer) return
    exportTimer = setTimeout(() => {
      exportTimer = null
      try {
        console.log('[dev] 检测到数据库变化，导出 seed-data.json ...')
        execFileSync(process.execPath, ['scripts/export-seed.js'], {
          stdio: 'inherit',
          cwd: root,
        })
      } catch (err) {
        console.error('[dev] 数据库导出失败（稍后数据库变化时会重试）:', err.message)
      }
    }, 1500)
  }
}
setInterval(checkDb, 1000)

// 3. 启动 next dev
const child = spawn('npx', ['next', 'dev', '--turbopack'], {
  stdio: 'inherit',
  cwd: root,
  shell: process.platform === 'win32',
})

child.on('error', (err) => {
  console.error('启动 next dev 失败:', err.message)
  process.exit(1)
})
child.on('exit', (code) => {
  process.exit(code ?? 0)
})
