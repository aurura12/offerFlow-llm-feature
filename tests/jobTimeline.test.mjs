import assert from 'node:assert/strict'
import test from 'node:test'
import {
  canDeleteJobEvent,
  getStageDates,
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
  const events = legacyTimelineToEvents({
    id: 'job-1',
    timeline: [
      { date: '2026-08-01', action: '投递简历', detail: '官网投递' },
      { date: '2026-08-02', action: '状态变更', detail: '从 已投递 更新为 一面中' },
    ],
  })

  assert.equal(events[0].id, 'legacy-job-1-0')
  assert.equal(events[1].type, 'STATUS_CHANGED')
  assert.equal(events[1].fromStatus, '已投递')
  assert.equal(events[1].toStatus, '一面中')
})

test('events are sorted newest first with creation time as a tie breaker', () => {
  const sorted = sortJobEvents([
    { id: 'old', eventDate: '2026-08-01', createdAt: '2026-08-01T09:00:00.000Z' },
    { id: 'new', eventDate: '2026-08-02', createdAt: '2026-08-02T09:00:00.000Z' },
    { id: 'same-day-later', eventDate: '2026-08-02', createdAt: '2026-08-02T10:00:00.000Z' },
  ])

  assert.deepEqual(sorted.map((event) => event.id), ['same-day-later', 'new', 'old'])
})

test('stage dates come from the latest event that entered each stage', () => {
  const dates = getStageDates({
    appliedDate: '2026-08-01',
    status: '二面中',
    events: [
      { type: 'CREATED', eventDate: '2026-08-01', toStatus: '已投递' },
      { type: 'STATUS_CHANGED', eventDate: '2026-08-03', toStatus: '笔试/在线测评' },
      { type: 'STATUS_CHANGED', eventDate: '2026-08-05', toStatus: '一面中' },
      { type: 'STATUS_CHANGED', eventDate: '2026-08-08', toStatus: '二面中' },
      { type: 'STATUS_CHANGED', eventDate: '2026-08-09', toStatus: '二面中' },
    ],
  })

  assert.deepEqual(dates, {
    APPLIED: '2026-08-01',
    ASSESSMENT: '2026-08-03',
    INTERVIEW: '2026-08-09',
    OFFER: null,
    CLOSED: null,
  })
})
