'use client'
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useApp } from '../store/AppContext'
import ModalHeader from './ModalHeader'
import GlowCard from './GlowCard'

const STATUS_OPTIONS = ['待投递', '已投递', '笔试/在线测评', 'AI 面试', '一面中', '二面中', '三面中', '终面中', 'Offer', '已结束']
export const WORK_MODE_LABELS = { onsite: '到岗', remote: '远程', hybrid: '混合办公' }
const WORK_MODE_OPTIONS = [
  { value: 'onsite', label: '到岗' },
  { value: 'remote', label: '远程' },
  { value: 'hybrid', label: '混合办公' },
]
const CHANNEL_OPTIONS = ['', '内推', '官网投递', '猎头', '招聘平台', '校园招聘', '其他']
const PRIORITY_OPTIONS = ['高', '中', '低']

const emptyForm = {
  companyName: '', jobTitle: '', status: '已投递', city: '', salaryRange: '',
  workMode: 'onsite', channel: '', priority: '中', appliedDate: '',
  jobLink: '', jdText: '', resumeId: '', contactName: '', contactInfo: '',
  nextAction: '', notes: '',
}

// Stable helper components defined OUTSIDE JobModal to prevent remount on every render
function Input({ label, value, onChange, placeholder, type = 'text', large, ...rest }) {
  return (
    <div className={large ? 'col-span-2' : ''}>
      <label className="text-sm text-offer-muted block mb-1">{label}</label>
      {large && type === 'textarea' ? (
        <textarea
          value={value ?? ''}
          onChange={onChange}
          placeholder={placeholder}
          rows={4}
          className="min-h-[40px] w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white placeholder:text-gray-500 outline-none transition-all duration-200 focus:border-purple-400/70 focus:ring-2 focus:ring-purple-500/20 resize-none"
          {...rest}
        />
      ) : (
        <input
          type={type}
          value={value ?? ''}
          onChange={onChange}
          placeholder={placeholder}
          className="min-h-[40px] w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white placeholder:text-gray-500 outline-none transition-all duration-200 focus:border-purple-400/70 focus:ring-2 focus:ring-purple-500/20"
          {...rest}
        />
      )}
    </div>
  )
}

function Select({ label, value, onChange, options }) {
  return (
    <div>
      <label className="text-sm text-offer-muted block mb-1">{label}</label>
      <select
        value={value ?? ''}
        onChange={onChange}
        className="min-h-[40px] rounded-xl border border-white/10 bg-gray-950 px-4 py-2.5 text-sm font-medium text-white outline-none transition-all duration-200 focus:border-purple-400/70 focus:ring-2 focus:ring-purple-500/20 appearance-none cursor-pointer"
      >
        {options.map((opt) => {
          const val = typeof opt === 'object' ? opt.value : opt
          const label = typeof opt === 'object' ? opt.label : opt
          return (
            <option key={val} value={val} className="bg-gray-950 text-white">{label}</option>
          )
        })}
      </select>
    </div>
  )
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

const FIELD_LABELS = {
  companyName: '公司', jobTitle: '岗位', status: '状态', city: '城市',
  salaryRange: '薪资', workMode: '工作模式', channel: '渠道', priority: '优先级',
  appliedDate: '投递日期', jobLink: '链接', jdText: 'JD', resumeId: '简历',
  contactName: '联系人', contactInfo: '联系方式', nextAction: '下一步', notes: '备注',
}

function formatFieldValue(val, resumes) {
  if (!val) return ''
  if (val in WORK_MODE_LABELS) return WORK_MODE_LABELS[val]
  if (/^[a-f0-9-]{36}$/.test(val)) {
    const r = resumes.find((x) => x.id === val)
    if (r) return `${r.name} (${r.version})`
  }
  return val
}

function CityInput({ label, value, onChange, options }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  const filtered = useMemo(() => {
    if (!value) return options
    const kw = value.toLowerCase()
    return options.filter((c) => c.toLowerCase().includes(kw))
  }, [value, options])

  useEffect(() => {
    if (!open) return
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <label className="text-sm text-offer-muted block mb-1">{label}</label>
      <input
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder="选择或输入城市"
        autoComplete="off"
        className="min-h-[40px] w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white placeholder:text-gray-500 outline-none transition-all duration-200 focus:border-purple-400/70 focus:ring-2 focus:ring-purple-500/20"
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
          {filtered.map((city) => (
            <li
              key={city}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onChange(city); setOpen(false) }}
              className="cursor-pointer px-4 py-2 text-sm text-slate-700 hover:bg-purple-50 hover:text-purple-600 transition-colors"
            >
              {city}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function JobModal({ open, job, onClose, initialStatus }) {
  const { resumes, cities, addCity, addToast, addJob, updateJob } = useApp()
  const [form, setForm] = useState(emptyForm)

  useEffect(() => {
    if (open) {
      const base = job ? { ...emptyForm, ...job } : { ...emptyForm }
      if (!job && initialStatus) base.status = initialStatus
      setForm(base)
    }
  }, [open, job, initialStatus])

  const handleChange = useCallback((field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }, [])

  // ESC close
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  const handleSave = async () => {
    if (!form.companyName.trim() || !form.jobTitle.trim()) {
      addToast('公司名称和岗位名称为必填项', 'error')
      return
    }

    if (form.city?.trim()) addCity(form.city)

    if (job) {
      const changed = []
      for (const [key, label] of Object.entries(FIELD_LABELS)) {
        const oldVal = (job[key] ?? '').toString().trim()
        const newVal = (form[key] ?? '').toString().trim()
        if (oldVal !== newVal) changed.push({ label, oldVal, newVal })
      }
      const detail = changed.length
        ? changed.map((c) => `${c.label}: ${formatFieldValue(c.oldVal, resumes)} → ${formatFieldValue(c.newVal, resumes) || '(空)'}`).join('；')
        : `更新了「${form.companyName} · ${form.jobTitle}」信息`

      const patch = {
        ...form,
        timeline: [
          ...(form.timeline || job.timeline || []),
          { date: todayStr(), action: '编辑岗位', detail },
        ],
      }
      await updateJob(job.id, patch)
      addToast('岗位已更新', 'success')
    } else {
      await addJob({ ...form, timeline: [] })
      addToast('岗位已新增', 'success')
    }
    onClose()
  }

  // ---- GlowCard: center glow on focused input ----
  const handleFocusIn = useCallback((e) => {
    const card = e.target.closest('.glow-card')
    if (!card) return
    const target = e.target
    const cardRect = card.getBoundingClientRect()
    const targetRect = target.getBoundingClientRect()
    card.style.setProperty('--mouse-x', `${targetRect.left + targetRect.width / 2 - cardRect.left}px`)
    card.style.setProperty('--mouse-y', `${targetRect.top + targetRect.height / 2 - cardRect.top}px`)
  }, [])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm modal-overlay" onClick={onClose}>
      <div className="modal-panel border w-full max-w-2xl mx-4 max-h-[90vh] min-h-0 flex flex-col shadow-2xl shadow-black/40" onClick={(e) => e.stopPropagation()}>
        <GlowCard style={{ background: 'transparent', border: 'none', boxShadow: 'none', padding: 0 }} className="rounded-[22px] w-full max-w-full min-w-0 flex flex-col flex-1">
        <div className="bg-white/90 backdrop-blur-xl dark:bg-transparent dark:backdrop-filter-none rounded-[22px] w-full max-w-full min-w-0 flex flex-col flex-1 min-h-0">
        {/* Header */}
        <ModalHeader title={job ? '编辑岗位' : '新增岗位'} onClose={onClose} />

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 pt-6 pb-7" onFocus={handleFocusIn}>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Input label="公司名称 *" value={form.companyName} onChange={(e) => handleChange('companyName', e.target.value)} placeholder="例如：ByteDance" />
            <Input label="岗位名称 *" value={form.jobTitle} onChange={(e) => handleChange('jobTitle', e.target.value)} placeholder="例如：高级后端工程师" />

            <Select label="当前状态" value={form.status} onChange={(e) => handleChange('status', e.target.value)} options={STATUS_OPTIONS} />
            <CityInput label="城市" value={form.city ?? ''} onChange={(v) => handleChange('city', v)} options={cities} />

            <Input label="薪资范围" value={form.salaryRange} onChange={(e) => handleChange('salaryRange', e.target.value)} placeholder="例如：30K-50K" />
            <Select label="工作模式" value={form.workMode} onChange={(e) => handleChange('workMode', e.target.value)} options={WORK_MODE_OPTIONS} />

            <Select label="投递渠道" value={form.channel} onChange={(e) => handleChange('channel', e.target.value)} options={CHANNEL_OPTIONS} />
            <Select label="优先级" value={form.priority} onChange={(e) => handleChange('priority', e.target.value)} options={PRIORITY_OPTIONS} />

            <Input label="投递日期" type="date" value={form.appliedDate} onChange={(e) => handleChange('appliedDate', e.target.value)} />
            <Input label="岗位链接" value={form.jobLink} onChange={(e) => handleChange('jobLink', e.target.value)} placeholder="https://..." />

            {/* Resume selector */}
            <div>
              <label className="text-sm text-offer-muted block mb-1">关联简历</label>
              <select
                value={form.resumeId ?? ''}
                onChange={(e) => handleChange('resumeId', e.target.value)}
                className="min-h-[40px] rounded-xl border border-white/10 bg-gray-950 px-4 py-2.5 text-sm font-medium text-white outline-none transition-all duration-200 focus:border-purple-400/70 focus:ring-2 focus:ring-purple-500/20 appearance-none cursor-pointer"
              >
                <option value="" className="bg-gray-950 text-offer-muted">不关联</option>
                {resumes.map((r) => (
                  <option key={r.id} value={r.id} className="bg-gray-950 text-white">
                    {r.name} ({r.version})
                  </option>
                ))}
              </select>
            </div>

            <Input label="联系人 / HR" value={form.contactName} onChange={(e) => handleChange('contactName', e.target.value)} placeholder="姓名" />

            <Input label="联系方式" value={form.contactInfo} onChange={(e) => handleChange('contactInfo', e.target.value)} placeholder="微信 / 电话" />
            <Input label="下一步行动" value={form.nextAction} onChange={(e) => handleChange('nextAction', e.target.value)} placeholder="例如：准备二面" />

            <Input label="JD 原文" value={form.jdText} onChange={(e) => handleChange('jdText', e.target.value)} placeholder="粘贴 JD 内容..." large type="textarea" />
            <Input label="备注" value={form.notes} onChange={(e) => handleChange('notes', e.target.value)} placeholder="其他备注信息" large type="textarea" />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-5 border-t border-slate-200 dark:border-white/10">
          <button
            onClick={onClose}
            className="btn-secondary px-4 py-2 rounded-xl text-sm font-medium"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="btn-gradient px-5 py-2 rounded-xl text-sm font-medium text-white"
          >
            {job ? '保存修改' : '新增岗位'}
          </button>
        </div>
        </div>
        </GlowCard>
      </div>
    </div>
  )
}
