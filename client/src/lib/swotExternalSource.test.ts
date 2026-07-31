import { describe, expect, it } from 'vitest'

import { externalSourceState } from './swotExternalSource'

describe('externalSourceState — ثلاث حالات (محرّك قبل شاشة)', () => {
  it('لا سجلّ خارجيّ إطلاقاً → missing', () => {
    expect(externalSourceState(false, 0)).toBe('missing')
    expect(externalSourceState(false, 5)).toBe('missing') // لا سجلّ ⇒ missing مهما كان العدّ
  })

  it('سجلّ موجود بلا عوامل ({}‎ — يتيم فارغ) → empty', () => {
    expect(externalSourceState(true, 0)).toBe('empty')
  })

  it('سجلّ موجود وله عوامل → ready', () => {
    expect(externalSourceState(true, 1)).toBe('ready')
    expect(externalSourceState(true, 12)).toBe('ready')
  })

  it('عدد سالب/غير صالح يُعامَل كصفر (empty لا ready)', () => {
    expect(externalSourceState(true, -1)).toBe('empty')
    expect(externalSourceState(true, Number.NaN)).toBe('empty')
  })
})
