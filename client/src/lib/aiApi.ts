import { api } from './api'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface AdvisorRequest {
  companyId: string
  history: ChatMessage[]
  message: string
}

type DeltaEvent = { type: 'delta'; text: string }
type DoneEvent = { type: 'done' }
type ErrorEvent = { type: 'error'; message: string }
export type AdvisorEvent = DeltaEvent | DoneEvent | ErrorEvent

const FALLBACK_BASE = 'http://localhost:5001'

function apiBase(): string {
  return import.meta.env.VITE_API_URL || FALLBACK_BASE
}

/**
 * Stream the strategic advisor response via SSE. Yields {type: 'delta', text}
 * tokens, ending with {type: 'done'} or {type: 'error'}.
 */
export async function* advisorStream(req: AdvisorRequest, signal?: AbortSignal): AsyncGenerator<AdvisorEvent, void, void> {
  const res = await fetch(`${apiBase()}/api/ai/advisor`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
    signal,
  })

  if (!res.ok) {
    let detail = ''
    try { detail = (await res.json()).error ?? '' } catch { /* */ }
    yield { type: 'error', message: detail || `HTTP ${res.status}` }
    return
  }
  if (!res.body) {
    yield { type: 'error', message: 'لا توجد استجابة من الخادم' }
    return
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''

  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      // SSE messages are separated by a blank line.
      let sep
      while ((sep = buffer.indexOf('\n\n')) !== -1) {
        const block = buffer.slice(0, sep)
        buffer = buffer.slice(sep + 2)
        for (const line of block.split('\n')) {
          if (!line.startsWith('data:')) continue
          const payload = line.slice(5).trim()
          if (!payload) continue
          try {
            const evt = JSON.parse(payload) as AdvisorEvent
            yield evt
            if (evt.type === 'done' || evt.type === 'error') return
          } catch {
            // skip malformed event
          }
        }
      }
    }
  } finally {
    try { reader.releaseLock() } catch { /* */ }
  }
}

// Wrappers for the non-streaming endpoints (filled in batches 2+3)
export async function aiTowsSuggestions(payload: { companyId: string; swot: { strengths: string[]; weaknesses: string[]; opportunities: string[]; threats: string[] } }) {
  const { data } = await api.post('/api/ai/tows-suggestions', payload)
  return data as { so: string[]; wo: string[]; st: string[]; wt: string[] }
}

export async function aiPresentation(payload: { companyId: string }) {
  const { data } = await api.post('/api/ai/presentation', payload)
  return data as { title: string; slides: { title: string; bullets: string[] }[] }
}

export async function aiPainScreen(payload: { companyId: string; answers: { question: string; answer: string }[] }) {
  const { data } = await api.post('/api/ai/pain-screen', payload)
  return data as { pains: { title: string; severity: number; recommendedTools: { label: string; to: string }[] }[] }
}

export async function aiPredictions(companyId: string) {
  const { data } = await api.get(`/api/ai/predictions/${companyId}`)
  return data as {
    series: { kpiId: string; name: string; unit: string; history: { date: string; value: number }[]; forecast: { date: string; value: number; lower?: number; upper?: number }[] }[]
    narrative: string
  }
}

export async function aiSimulate(payload: { companyId: string; revenueGrowthPct: number; costReductionPct: number; baseRevenue: number; baseCost: number; investment: number }) {
  const { data } = await api.post('/api/ai/simulate', payload)
  return data as {
    projectedRevenue: number
    projectedCost: number
    netBenefit: number
    roi: number
    paybackMonths: number
    narrative?: string
  }
}
