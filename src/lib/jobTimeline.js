export const TOP_LEVEL_STAGES = [
  { key: 'APPLIED', label: '已投递' },
  { key: 'ASSESSMENT', label: '笔试' },
  { key: 'INTERVIEW', label: '面试' },
  { key: 'OFFER', label: 'Offer' },
  { key: 'CLOSED', label: '已结束' },
]

const STATUS_STAGE_MAP = {
  '待投递': 'APPLIED',
  '已投递': 'APPLIED',
  '笔试/在线测评': 'ASSESSMENT',
  'OA / 笔试': 'ASSESSMENT',
  'AI 面试': 'INTERVIEW',
  '一面中': 'INTERVIEW',
  '二面中': 'INTERVIEW',
  '三面中': 'INTERVIEW',
  '终面中': 'INTERVIEW',
  Offer: 'OFFER',
  '已结束': 'CLOSED',
}

const LEGACY_STATUS_CHANGE = /^从\s*(.*?)\s*更新为\s*(.*?)\s*$/

function stageByKey(key) {
  return TOP_LEVEL_STAGES.find((stage) => stage.key === key) || TOP_LEVEL_STAGES[0]
}

function legacyCreatedAt(date) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date || '')
    ? `${date}T00:00:00.000Z`
    : '1970-01-01T00:00:00.000Z'
}

export function getTopLevelStage(status) {
  return stageByKey(STATUS_STAGE_MAP[status] || 'APPLIED')
}

export function getStageDates(job = {}) {
  const dates = Object.fromEntries(TOP_LEVEL_STAGES.map((stage) => [stage.key, null]))

  for (const event of getJobEvents(job)) {
    const status = event.toStatus || (event.type === 'CREATED' ? job.status : null)
    const stage = STATUS_STAGE_MAP[status]
    const eventDate = event.eventDate || ''
    if (!stage || !eventDate) continue
    if (!dates[stage] || eventDate > dates[stage]) dates[stage] = eventDate
  }

  if (!dates.APPLIED && job.appliedDate) dates.APPLIED = job.appliedDate
  return dates
}

export function legacyTimelineToEvents(job = {}) {
  if (!Array.isArray(job.timeline)) return []

  return job.timeline.map((item, index) => {
    const action = (item?.action || '').trim()
    const detail = (item?.detail || '').trim()
    const statusMatch = detail.match(LEGACY_STATUS_CHANGE)
    const isCreated = action === '投递简历'
    const isStatusChanged = action.includes('状态变更') || action.startsWith('标记为')
    const type = isCreated ? 'CREATED' : isStatusChanged ? 'STATUS_CHANGED' : 'EDITED'
    const fromStatus = statusMatch?.[1] || null
    const toStatus = statusMatch?.[2] || (action.startsWith('标记为') ? action.slice(3).trim() : null)

    return {
      id: `legacy-${job.id}-${index}`,
      jobId: job.id,
      userId: job.userId,
      type,
      title: action || '历史进展',
      eventDate: item?.date || '',
      notes: detail || null,
      fromStatus,
      toStatus,
      createdAt: legacyCreatedAt(item?.date),
    }
  })
}

export function getJobEvents(job = {}) {
  if (Array.isArray(job.events) && job.events.length > 0) return job.events
  return legacyTimelineToEvents(job)
}

export function sortJobEvents(events = []) {
  return [...events].sort((left, right) =>
    (right?.eventDate || '').localeCompare(left?.eventDate || '') ||
    (right?.createdAt || '').toString().localeCompare((left?.createdAt || '').toString()),
  )
}

export function canDeleteJobEvent(event) {
  return event?.type === 'NOTE'
}
