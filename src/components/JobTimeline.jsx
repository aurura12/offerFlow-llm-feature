'use client'

import { useMemo, useState } from 'react'
import { TOP_LEVEL_STAGES, getJobEvents, getStageDates, getTopLevelStage, sortJobEvents, canDeleteJobEvent } from '../lib/jobTimeline'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function eventTitle(event) {
  if (event.type === 'CREATED') return event.title || '创建投递'
  if (event.type === 'STATUS_CHANGED') return event.title || '状态变更'
  if (event.type === 'NOTE') return event.title || '补充记录'
  return event.title || '岗位信息更新'
}

function eventNotes(event) {
  if (event.notes) return event.notes
  if (event.type === 'STATUS_CHANGED' && (event.fromStatus || event.toStatus)) {
    return `从 ${event.fromStatus || '-'} 更新为 ${event.toStatus || '-'}`
  }
  return ''
}

function formatDate(date) {
  if (!date) return '待进入'
  return date.slice(0, 10).replaceAll('-', '/')
}

export default function JobTimeline({ job, onAddEvent, onDeleteEvent }) {
  const [form, setForm] = useState({ title: '', eventDate: todayStr(), notes: '' })
  const currentStage = getTopLevelStage(job.status)
  const currentIndex = TOP_LEVEL_STAGES.findIndex((stage) => stage.key === currentStage.key)
  const stageDates = getStageDates(job)
  const events = useMemo(() => sortJobEvents(getJobEvents(job)), [job])

  const submit = async () => {
    if (!form.title.trim() || !form.eventDate) return
    const event = await onAddEvent(form)
    if (event) setForm({ title: '', eventDate: todayStr(), notes: '' })
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-white/45 uppercase tracking-wider">流程时间线</h3>
        <span className="text-[11px] text-white/35">当前阶段：{currentStage.label}</span>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-white/[0.06] dark:bg-white/[0.02]">
        <div className="grid grid-cols-5 gap-2">
          {TOP_LEVEL_STAGES.map((stage, index) => {
            const isCurrent = index === currentIndex
            const isDone = index < currentIndex
            return (
              <div key={stage.key} className="min-w-0 text-center">
                <div className="flex items-center">
                  {index > 0 && <div className={`h-0.5 flex-1 ${isDone ? 'bg-offer-primary' : 'bg-slate-200 dark:bg-white/10'}`} />}
                  <div className={`mx-1 h-3 w-3 shrink-0 rounded-full border-2 ${isCurrent ? 'border-offer-primary bg-offer-primary ring-4 ring-offer-primary/15' : isDone ? 'border-offer-primary bg-offer-primary' : 'border-slate-300 bg-white dark:border-white/25 dark:bg-[#15171d]'}`} />
                  {index < TOP_LEVEL_STAGES.length - 1 && <div className={`h-0.5 flex-1 ${index < currentIndex ? 'bg-offer-primary' : 'bg-slate-200 dark:bg-white/10'}`} />}
                </div>
                <p className={`mt-2 truncate text-[11px] ${isCurrent ? 'font-semibold text-offer-accent' : 'text-white/45'}`}>{stage.label}</p>
                <p className={`mt-1 text-[10px] ${isCurrent ? 'text-offer-accent/80' : 'text-white/35'}`}>{formatDate(stageDates[stage.key])}</p>
              </div>
            )
          })}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-[1fr_130px_auto] gap-2">
        <input
          value={form.title}
          onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
          placeholder="补充沟通记录（例如：HR 沟通、约面、薪资确认）"
          className="min-h-[40px] rounded-xl border border-white/10 bg-white/[0.03] px-3 text-sm text-white placeholder:text-gray-500 outline-none focus:border-purple-400/70"
        />
        <input
          type="date"
          value={form.eventDate}
          onChange={(e) => setForm((prev) => ({ ...prev, eventDate: e.target.value }))}
          className="min-h-[40px] rounded-xl border border-white/10 bg-white/[0.03] px-3 text-sm text-white outline-none focus:border-purple-400/70"
        />
        <button onClick={submit} className="btn-gradient rounded-xl px-3 text-sm font-medium text-white">补充记录</button>
      </div>
      <textarea
        value={form.notes}
        onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
        placeholder="补充沟通备注（可选）"
        rows={2}
        className="mt-2 min-h-[40px] w-full resize-none rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-gray-500 outline-none focus:border-purple-400/70"
      />

      <div className="relative mt-5 space-y-4 border-l border-slate-200 pl-4 dark:border-white/[0.06]">
        {events.map((event) => (
          <div key={event.id} className="relative">
            <div className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-offer-primary dark:border-[#13151A]" />
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-white/45">{event.eventDate}</p>
                <p className="text-sm font-medium text-white/90">{eventTitle(event)}</p>
                {eventNotes(event) && <p className="mt-0.5 whitespace-pre-wrap text-xs text-white/45">{eventNotes(event)}</p>}
              </div>
              {canDeleteJobEvent(event) && (
                <button onClick={() => onDeleteEvent(event.id)} className="shrink-0 text-xs text-white/35 hover:text-red-400">删除</button>
              )}
            </div>
          </div>
        ))}
        {events.length === 0 && <p className="text-sm text-white/45">暂无时间线记录</p>}
      </div>
    </section>
  )
}
