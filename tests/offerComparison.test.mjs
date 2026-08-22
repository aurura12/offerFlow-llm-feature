import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateAnnualCash, parseOfferInput } from '../src/lib/offerComparison.js'

test('calculates annual cash', () => {
  assert.equal(calculateAnnualCash({
    monthlyBaseYuan: 20000,
    salaryMonths: 14,
    annualBonusYuan: 10000,
  }), 290000)
})

test('returns null when required values are missing', () => {
  assert.equal(calculateAnnualCash({ monthlyBaseYuan: null, salaryMonths: 14 }), null)
  assert.equal(calculateAnnualCash({ monthlyBaseYuan: 20000, salaryMonths: null }), null)
})

test('missing bonus is zero', () => {
  assert.equal(calculateAnnualCash({ monthlyBaseYuan: 20000, salaryMonths: 13 }), 260000)
})

test('rejects invalid numeric input', () => {
  assert.equal(parseOfferInput({ monthlyBaseYuan: -1 }).ok, false)
  assert.equal(parseOfferInput({ salaryMonths: 'abc' }).ok, false)
})

test('normalizes empty optional fields', () => {
  assert.deepEqual(parseOfferInput({ city: ' 上海 ', benefits: '' }), {
    ok: true,
    data: {
      monthlyBaseYuan: null,
      salaryMonths: null,
      annualBonusYuan: null,
      city: '上海',
      decisionDeadline: null,
      benefits: null,
      notes: null,
    },
  })
})
