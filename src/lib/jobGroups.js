function jobDateValue(job) {
  return job?.appliedDate || ''
}

function compareJobs(left, right) {
  return jobDateValue(right).localeCompare(jobDateValue(left)) ||
    (right?.createdAt || '').toString().localeCompare((left?.createdAt || '').toString())
}

export function normalizeCompanyName(companyName) {
  return (companyName || '').trim().toLocaleLowerCase()
}

export function groupJobsByCompany(jobs = []) {
  const groups = new Map()

  for (const job of jobs) {
    const key = normalizeCompanyName(job.companyName) || '__empty_company__'
    const group = groups.get(key)
    if (group) {
      group.jobs.push(job)
    } else {
      groups.set(key, {
        company: (job.companyName || '').trim() || '未填写公司',
        jobs: [job],
      })
    }
  }

  return [...groups.values()]
    .map((group) => ({ ...group, jobs: [...group.jobs].sort(compareJobs) }))
    .sort((left, right) => compareJobs(left.jobs[0], right.jobs[0]) || left.company.localeCompare(right.company))
}

export function buildCompanyPrefill(job = {}, status = '已投递') {
  return {
    companyName: job.companyName || '',
    city: job.city || '',
    channel: job.channel || '',
    contactName: job.contactName || '',
    contactInfo: job.contactInfo || '',
    status: status || '已投递',
  }
}
