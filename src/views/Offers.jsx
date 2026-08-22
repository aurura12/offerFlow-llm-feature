'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useApp } from '../store/AppContext'
import { calculateAnnualCash, yuanToK } from '../lib/offerComparison'
import JobDetailModal from '../components/JobDetailModal'

const money = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 })

function formatAnnualCash(offer) {
  const annualCash = calculateAnnualCash(offer)
  return annualCash == null ? '待补充' : `¥${money.format(annualCash)}`
}

export default function Offers() {
  const router = useRouter()
  const { jobs, offers, deleteJob, addToast } = useApp()
  const [selectedJobId, setSelectedJobId] = useState(null)

  const offerItems = jobs
    .filter((job) => job.status === 'Offer' || offers.some((offer) => offer.jobId === job.id))
    .map((job) => ({ job, offer: offers.find((item) => item.jobId === job.id) || null }))

  const handleDelete = async (job) => {
    await deleteJob(job.id)
    addToast('岗位已删除', 'success')
  }

  return (
    <div className="px-6 py-6 max-w-6xl">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-theme-text">Offer 对比</h1>
          <p className="text-sm text-theme-secondary mt-1">只比较国内岗位，先把关键条件放在一起看</p>
        </div>
        <button onClick={() => router.push('/positions')} className="btn-secondary px-4 py-2 rounded-xl text-sm font-medium shrink-0">
          去岗位库添加
        </button>
      </div>

      {offerItems.length === 0 ? (
        <div className="card-modern p-10 text-center">
          <div className="text-4xl mb-3">☆</div>
          <h2 className="text-lg font-semibold text-theme-text">还没有可比较的 Offer</h2>
          <p className="text-sm text-theme-secondary mt-2">把岗位状态改成「Offer」，或在岗位详情里填写 Offer 条件。</p>
          <button onClick={() => router.push('/positions')} className="btn-gradient mt-5 px-4 py-2 rounded-xl text-sm font-medium text-white">
            打开岗位库
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Summary label="Offer 数" value={offerItems.length} />
            <Summary label="已填年现金" value={offerItems.filter(({ offer }) => calculateAnnualCash(offer) != null).length} />
            <Summary label="待补充" value={offerItems.filter(({ offer }) => calculateAnnualCash(offer) == null).length} />
            <Summary label="最晚决策日" value={getLatestDeadline(offerItems)} />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {offerItems.map(({ job, offer }) => (
              <button
                key={job.id}
                type="button"
                onClick={() => setSelectedJobId(job.id)}
                className="card-modern card-hover p-5 text-left w-full"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-lg font-semibold text-theme-text truncate">{job.companyName || '未填写公司'}</p>
                    <p className="text-sm text-theme-secondary mt-1 truncate">{job.jobTitle || '未填写岗位'}</p>
                  </div>
                  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/[0.15] px-2.5 py-1 text-xs text-emerald-700 dark:text-emerald-300 shrink-0">
                    {job.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-5">
                  <OfferField label="年现金（估算）" value={formatAnnualCash(offer)} emphasized />
                  <OfferField label="月 base（K）" value={offer?.monthlyBaseYuan != null ? `${money.format(yuanToK(offer.monthlyBaseYuan))}K` : '待补充'} />
                  <OfferField label="薪资月数" value={offer?.salaryMonths != null ? `${offer.salaryMonths} 个月` : '待补充'} />
                  <OfferField label="城市" value={offer?.city || job.city || '待补充'} />
                  <OfferField label="决策截止" value={offer?.decisionDeadline || '未填写'} />
                  <OfferField label="工作模式" value={job.workMode || '未填写'} />
                </div>

                {(offer?.benefits || offer?.notes) && (
                  <p className="mt-4 pt-3 border-t border-theme-border text-xs text-theme-secondary line-clamp-2">
                    {offer.benefits || offer.notes}
                  </p>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      <JobDetailModal
        open={Boolean(selectedJobId)}
        jobId={selectedJobId}
        onClose={() => setSelectedJobId(null)}
        onEdit={() => { setSelectedJobId(null); router.push('/positions') }}
        onDelete={handleDelete}
      />
    </div>
  )
}

function Summary({ label, value }) {
  return (
    <div className="card-modern p-4">
      <p className="text-xs text-theme-muted">{label}</p>
      <p className="text-xl font-semibold text-theme-text mt-1">{value}</p>
    </div>
  )
}

function OfferField({ label, value, emphasized = false }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/[0.03]">
      <p className="text-xs text-theme-muted">{label}</p>
      <p className={`text-sm mt-1 ${emphasized ? 'text-emerald-600 dark:text-emerald-300 font-semibold' : 'text-slate-800 dark:text-white/85'}`}>{value}</p>
    </div>
  )
}

function getLatestDeadline(items) {
  const dates = items.map(({ offer }) => offer?.decisionDeadline).filter(Boolean).sort()
  return dates[dates.length - 1] || '未填写'
}
