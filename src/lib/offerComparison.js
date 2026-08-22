function optionalNumber(value) {
  if (value === '' || value === null || value === undefined) return null
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : null
}

function optionalText(value) {
  if (value === '' || value === null || value === undefined) return null
  return String(value).trim() || null
}

function optionalDate(value) {
  const date = optionalText(value)
  if (!date) return null
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null
}

export function kToYuan(value) {
  if (value === '' || value === null || value === undefined) return null
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number * 1000 : null
}

export function yuanToK(value) {
  if (value === '' || value === null || value === undefined) return null
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number / 1000 : null
}

export function parseOfferInput(value) {
  const input = value || {}
  const monthlyBaseYuan = optionalNumber(input.monthlyBaseYuan)
  const salaryMonths = optionalNumber(input.salaryMonths)
  const annualBonusYuan = optionalNumber(input.annualBonusYuan)

  const invalidNumber = [
    ['monthlyBaseYuan', input.monthlyBaseYuan, monthlyBaseYuan],
    ['salaryMonths', input.salaryMonths, salaryMonths],
    ['annualBonusYuan', input.annualBonusYuan, annualBonusYuan],
  ].some(([, raw, parsed]) => raw !== '' && raw !== null && raw !== undefined && parsed === null)

  if (invalidNumber) return { ok: false, error: '薪资字段必须是非负数字' }
  if (input.decisionDeadline && !optionalDate(input.decisionDeadline)) {
    return { ok: false, error: '决策截止日期格式无效' }
  }

  return {
    ok: true,
    data: {
      monthlyBaseYuan,
      salaryMonths,
      annualBonusYuan,
      city: optionalText(input.city),
      decisionDeadline: optionalDate(input.decisionDeadline),
      benefits: optionalText(input.benefits),
      notes: optionalText(input.notes),
    },
  }
}

export function calculateAnnualCash(offer) {
  if (offer?.monthlyBaseYuan == null || offer?.salaryMonths == null) return null
  return offer.monthlyBaseYuan * offer.salaryMonths + (offer.annualBonusYuan || 0)
}
