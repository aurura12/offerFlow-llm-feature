/**
 * 导入 CSV 投递记录到 zhou 用户
 *
 * 用法: node --env-file=.env scripts/import-jobs.js "提前批及秋招简历投递 - Sheet1.csv" <userId>
 *
 * CSV 列: 日期 | 公司 | 岗位 | 进度 | 备注 | 账号 | 密码
 * 进度列映射到看板状态;账号/密码不导入(模型无对应字段)
 */
import fs from 'node:fs'
import { PrismaClient } from '@prisma/client'

// ---- 简易 CSV 解析(支持引号内换行) ----
function parseCSV(text) {
  const rows = []
  let row = [], field = '', inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ }
        else inQuotes = false
      } else field += c
    } else {
      if (c === '"') inQuotes = true
      else if (c === ',') { row.push(field); field = '' }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++
        row.push(field); field = ''
        rows.push(row); row = []
      } else field += c
    }
  }
  if (field || row.length) { row.push(field); rows.push(row) }
  return rows.filter((r) => r.some((f) => f.trim() !== ''))
}

// ---- 进度 -> 看板状态映射 ----
function mapStatus(progress) {
  const p = progress || ''
  if (p.includes('简历挂')) return '已结束'
  if (p.includes('人才库')) return '已结束'
  if (p.includes('测评')) return 'OA / 笔试'
  return '已投递'
}

// ---- 日期转换 2026/6/11 -> 2026-06-11 ----
function toISODate(dateStr) {
  if (!dateStr) return null
  const m = dateStr.trim().match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/)
  if (!m) return dateStr.trim()
  return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
}

const [csvPath, userId] = process.argv.slice(2)
if (!csvPath || !userId) {
  console.error('用法: node --env-file=.env scripts/import-jobs.js <csv路径> <userId>')
  process.exit(1)
}

const text = fs.readFileSync(csvPath, 'utf8')
const rows = parseCSV(text)
if (!rows.length) {
  console.error('CSV 为空')
  process.exit(1)
}

const header = rows[0]
const dataRows = rows.slice(1)
console.log(`表头: ${header.map((h, i) => `${i}:${h}`).join(' | ')}`)
console.log(`数据行数: ${dataRows.length}`)

const prisma = new PrismaClient()

// 校验目标用户
const user = await prisma.user.findUnique({ where: { id: userId } })
if (!user) {
  console.error(`用户不存在: ${userId}`)
  process.exit(1)
}
console.log(`目标用户: ${user.username} (${user.id})`)

// 现有岗位用于去重
const existing = await prisma.job.findMany({ where: { userId }, select: { companyName: true, jobTitle: true } })
const existingKeys = new Set(existing.map((j) => `${j.companyName}|${j.jobTitle || ''}`))
console.log(`该用户已有岗位: ${existing.length} 条`)

const toCreate = []
const skipped = []
for (const r of dataRows) {
  // 列: 0=日期 1=公司 2=岗位 3=进度 4=备注 5=账号 6=密码
  const company = (r[1] || '').replace(/\n/g, ' ').trim().replace(/^\/\s*/, '') // 清洗 "/ 公司名"
  const jobTitle = (r[2] || '').replace(/\n/g, ' ').trim()
  const progress = (r[3] || '').replace(/\n/g, ' / ').trim()
  const note = (r[4] || '').replace(/\n/g, ' ').trim()
  if (!company) { skipped.push({ reason: '公司名为空', row: r }); continue }

  const key = `${company}|${jobTitle}`
  if (existingKeys.has(key)) { skipped.push({ reason: '已存在', row: { company, jobTitle } }); continue }

  const notes = [progress, note].filter(Boolean).join('；')
  toCreate.push({
    userId,
    companyName: company,
    jobTitle: jobTitle || '未填写',
    status: mapStatus(progress),
    appliedDate: toISODate(r[0]),
    notes: notes || null,
  })
}

console.log(`待导入: ${toCreate.length} 条, 跳过: ${skipped.length} 条`)
if (skipped.length) {
  console.log('跳过明细:')
  skipped.forEach((s) => console.log('  -', s.reason, JSON.stringify(s.row)))
}

if (toCreate.length) {
  const result = await prisma.job.createMany({ data: toCreate })
  console.log(`✅ 导入成功: ${result.count} 条`)
}

// 打印导入结果便于核对
const jobs = await prisma.job.findMany({ where: { userId }, orderBy: { appliedDate: 'asc' } })
console.log(`\n${user.username} 当前岗位共 ${jobs.length} 条:`)
jobs.forEach((j) => console.log(`  ${j.appliedDate || '-'} | ${j.companyName} | ${j.jobTitle} | ${j.status}${j.notes ? ` | 备注:${j.notes}` : ''}`))

await prisma.$disconnect()
