import assert from 'node:assert/strict'
import test from 'node:test'
import { buildCompanyPrefill, groupJobsByCompany, normalizeCompanyName } from '../src/lib/jobGroups.js'

test('company grouping ignores surrounding spaces and case', () => {
  const groups = groupJobsByCompany([
    { id: '1', companyName: ' 字节跳动 ', appliedDate: '2026-08-01' },
    { id: '2', companyName: '字节跳动', appliedDate: '2026-08-02' },
    { id: '3', companyName: '小鹏', appliedDate: '2026-07-03' },
  ])

  assert.equal(normalizeCompanyName(' 字节跳动 '), '字节跳动')
  assert.equal(groups.length, 2)
  assert.deepEqual(groups[0].jobs.map((job) => job.id), ['2', '1'])
})

test('company prefill copies shared fields but keeps role-specific fields empty', () => {
  assert.deepEqual(
    buildCompanyPrefill({
      companyName: '字节跳动',
      city: '北京',
      channel: '内推',
      contactName: 'HR',
      contactInfo: 'wx-1',
    }, '一面中'),
    {
      companyName: '字节跳动',
      city: '北京',
      channel: '内推',
      contactName: 'HR',
      contactInfo: 'wx-1',
      status: '一面中',
    },
  )
})
