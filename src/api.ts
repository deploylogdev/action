import type { EntryType } from './inputs.js'

export interface CreateEntryInput {
  title: string
  body_markdown: string
  entry_type: EntryType
  version: string | null
  publish: boolean
}

export interface CreatedEntry {
  id: string
  slug: string
  published: boolean
  title: string
  version: string | null
}

export interface AiSummary {
  title: string
  entry_type: EntryType
  body_markdown: string
}

export interface SummarizeInput {
  project_slug: string
  release_notes: string
  version?: string | null
}

export interface SummarizeResponse {
  summary: AiSummary
  model: string
  usage: { used: number; limit: number | null; month_key: string }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export interface ApiClientConfig {
  baseUrl: string
  apiKey: string
  userAgent?: string
  fetchFn?: typeof fetch
}

export function createApiClient(config: ApiClientConfig) {
  const fetchFn = config.fetchFn ?? fetch
  const userAgent = config.userAgent ?? 'deploylog-action/1.0'

  async function request<T>(path: string, init: RequestInit): Promise<T> {
    const res = await fetchFn(`${config.baseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
        'User-Agent': userAgent,
        ...(init.headers ?? {}),
      },
    })

    const text = await res.text()
    let payload: unknown = null
    if (text) {
      try {
        payload = JSON.parse(text)
      } catch {
        // non-JSON body; leave payload null
      }
    }

    if (!res.ok) {
      const errObj = extractError(payload)
      throw new ApiError(
        errObj.message ?? `Request failed with status ${res.status}`,
        res.status,
        errObj.code,
      )
    }

    const data = extractData(payload)
    return data as T
  }

  async function createEntry(projectSlug: string, input: CreateEntryInput): Promise<CreatedEntry> {
    return request<CreatedEntry>(`/api/cli/projects/${encodeURIComponent(projectSlug)}/entries`, {
      method: 'POST',
      body: JSON.stringify(input),
    })
  }

  async function summarize(input: SummarizeInput): Promise<SummarizeResponse> {
    return request<SummarizeResponse>('/api/cli/ai-summarize', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  }

  return { createEntry, summarize }
}

function extractError(payload: unknown): { message?: string; code?: string } {
  if (!payload || typeof payload !== 'object') return {}
  const p = payload as Record<string, unknown>
  const err = p.error
  if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>
    const out: { message?: string; code?: string } = {}
    if (typeof e.message === 'string') out.message = e.message
    if (typeof e.code === 'string') out.code = e.code
    return out
  }
  if (typeof p.message === 'string') return { message: p.message }
  return {}
}

function extractData(payload: unknown): unknown {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return (payload as { data: unknown }).data
  }
  return payload
}
