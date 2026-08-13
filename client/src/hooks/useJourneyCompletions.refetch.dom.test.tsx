// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'

// ─── إثبات إصلاح «الخطوة لا تتقدّم بعد الحفظ» ──────────────────────────────────
// قبل الإصلاح: useJourneyCompletions يجلب مرّةً عند التركيب فقط، فحفظ artifact
// (مثل STAKEHOLDERS في صفحة أصحاب المصلحة) لا يُحدِّث الاكتمال حتى إعادة تحميل.
// بعده: upsertArtifact يبثّ ARTIFACT_SAVED_EVENT، والهوك يعيد الجلب (debounce)،
// فيظهر النوع الجديد حيًّا. نُبقي ARTIFACT_SAVED_EVENT الحقيقيّ ونحقن قائمة الجلب.
const h = vi.hoisted(() => ({ artifacts: [] as { type: string; data: unknown }[] }))

vi.mock('@/lib/strategicApi', async (orig) => {
  const actual = await orig<typeof import('@/lib/strategicApi')>()
  return {
    ...actual, // يُبقي ARTIFACT_SAVED_EVENT حقيقيًّا
    listAllArtifacts: vi.fn(async () => h.artifacts),
    getSWOT: vi.fn(async () => null),
    listKPIs: vi.fn(async () => []),
    listObjectives: vi.fn(async () => []),
  }
})
vi.mock('@/lib/deptApi', async (orig) => {
  const actual = await orig<typeof import('@/lib/deptApi')>()
  return { ...actual, listDepartments: vi.fn(async () => []) }
})

import { ARTIFACT_SAVED_EVENT } from '@/lib/strategicApi'
import { useJourneyCompletions } from '@/hooks/useJourneyCompletions'

function Probe({ companyId }: { companyId: string }) {
  const { loading, nonEmptyArtifactTypes } = useJourneyCompletions(companyId)
  const label = loading
    ? 'loading'
    : nonEmptyArtifactTypes.has('STAKEHOLDERS_FINANCE') ? 'has-stakeholders' : 'no-stakeholders'
  return <div data-testid="out">{label}</div>
}

const emitSaved = (companyId: string) =>
  window.dispatchEvent(new CustomEvent(ARTIFACT_SAVED_EVENT, { detail: { companyId, type: 'STAKEHOLDERS_FINANCE' } }))

const STAKE = { type: 'STAKEHOLDERS_FINANCE', data: { rows: [{ name: 'المساهمون', influence: 5, interest: 5 }] } }

afterEach(() => { cleanup(); h.artifacts = [] })

describe('useJourneyCompletions — تقدّم الخطوة بعد الحفظ (ARTIFACT_SAVED_EVENT)', () => {
  it('حفظ لنفس الشركة ⇒ إعادة جلب ⇒ يظهر النوع الجديد بلا إعادة تحميل', async () => {
    h.artifacts = []
    render(<Probe companyId="c1" />)
    await waitFor(() => expect(screen.getByTestId('out').textContent).toBe('no-stakeholders'))

    h.artifacts = [STAKE]        // الحفظ نجح على الخادم
    emitSaved('c1')              // upsertArtifact كان يبثّ هذا
    await waitFor(() => expect(screen.getByTestId('out').textContent).toBe('has-stakeholders'), { timeout: 2500 })
  })

  it('حفظ لشركة أخرى لا يُعيد الجلب (لا تقدّم زائف عبر العملاء)', async () => {
    h.artifacts = []
    render(<Probe companyId="c1" />)
    await waitFor(() => expect(screen.getByTestId('out').textContent).toBe('no-stakeholders'))

    h.artifacts = [STAKE]
    emitSaved('OTHER')           // شركة مختلفة — يجب أن يُتجاهَل
    await new Promise((r) => setTimeout(r, 1200)) // أطول من debounce (٨٠٠ms)
    expect(screen.getByTestId('out').textContent).toBe('no-stakeholders')
  })
})
