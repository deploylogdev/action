import { describe, expect, it, vi } from 'vitest'
import { createApiClient, ApiError } from './api.js'

function makeFetch(
  response: { ok?: boolean; status?: number; body: unknown; text?: string },
): typeof fetch {
  const body = response.text ?? JSON.stringify(response.body)
  const ok = response.ok ?? true
  const status = response.status ?? (ok ? 200 : 400)
  return vi.fn().mockResolvedValue({
    ok,
    status,
    text: async () => body,
  }) as unknown as typeof fetch
}

describe('createApiClient', () => {
  it('sends Bearer auth and JSON body to createEntry', async () => {
    const fetchFn = makeFetch({
      body: {
        data: {
          id: 'entry-1',
          slug: 'foo',
          published: false,
          title: 'Foo',
          version: '1.0.0',
        },
      },
    })
    const client = createApiClient({
      baseUrl: 'https://deploylog.dev',
      apiKey: 'dk_test',
      fetchFn,
    })

    const result = await client.createEntry('my-app', {
      title: 'Foo',
      body_markdown: 'notes',
      entry_type: 'feature',
      version: '1.0.0',
      publish: true,
    })

    expect(result.id).toBe('entry-1')
    const mockFetch = fetchFn as unknown as ReturnType<typeof vi.fn>
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://deploylog.dev/api/cli/projects/my-app/entries')
    expect(init.method).toBe('POST')
    const headers = init.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer dk_test')
    expect(headers['Content-Type']).toBe('application/json')
    expect(init.body).toBe(
      JSON.stringify({
        title: 'Foo',
        body_markdown: 'notes',
        entry_type: 'feature',
        version: '1.0.0',
        publish: true,
      }),
    )
  })

  it('URL-encodes the project slug', async () => {
    const fetchFn = makeFetch({
      body: { data: { id: 'x', slug: 'x', published: false, title: 'x', version: null } },
    })
    const client = createApiClient({ baseUrl: 'https://api.test', apiKey: 'dk_k', fetchFn })
    await client.createEntry('weird/slug', {
      title: 't',
      body_markdown: 'b',
      entry_type: 'fix',
      version: null,
      publish: false,
    })
    const mockFetch = fetchFn as unknown as ReturnType<typeof vi.fn>
    const [url] = mockFetch.mock.calls[0] as [string]
    expect(url).toBe('https://api.test/api/cli/projects/weird%2Fslug/entries')
  })

  it('throws ApiError with server message on non-2xx', async () => {
    const fetchFn = makeFetch({
      ok: false,
      status: 429,
      body: {
        error: {
          code: 'QUOTA_EXCEEDED',
          message: 'Free tier exhausted for this month.',
        },
      },
    })
    const client = createApiClient({ baseUrl: 'https://api.test', apiKey: 'dk_k', fetchFn })

    await expect(
      client.summarize({ project_slug: 'p', release_notes: 'notes' }),
    ).rejects.toMatchObject({
      name: 'ApiError',
      status: 429,
      code: 'QUOTA_EXCEEDED',
      message: 'Free tier exhausted for this month.',
    })
  })

  it('falls back to generic message when no error body', async () => {
    const fetchFn = makeFetch({ ok: false, status: 500, text: '', body: null })
    const client = createApiClient({ baseUrl: 'https://api.test', apiKey: 'dk_k', fetchFn })
    await expect(
      client.createEntry('p', {
        title: 't',
        body_markdown: 'b',
        entry_type: 'feature',
        version: null,
        publish: false,
      }),
    ).rejects.toBeInstanceOf(ApiError)
  })

  it('unwraps { data } envelope when present', async () => {
    const fetchFn = makeFetch({
      body: {
        data: {
          summary: {
            title: 'Clean notes',
            entry_type: 'feature',
            body_markdown: '**New**\n- thing',
          },
          model: 'claude-haiku-4-5',
          usage: { used: 1, limit: 5, month_key: '2026-04' },
        },
      },
    })
    const client = createApiClient({ baseUrl: 'https://api.test', apiKey: 'dk_k', fetchFn })
    const res = await client.summarize({ project_slug: 'p', release_notes: 'notes' })
    expect(res.summary.title).toBe('Clean notes')
    expect(res.model).toBe('claude-haiku-4-5')
    expect(res.usage.limit).toBe(5)
  })

  it('accepts payloads without data envelope', async () => {
    const fetchFn = makeFetch({
      body: { id: 'entry-raw', slug: 's', published: false, title: 't', version: null },
    })
    const client = createApiClient({ baseUrl: 'https://api.test', apiKey: 'dk_k', fetchFn })
    const res = await client.createEntry('p', {
      title: 't',
      body_markdown: 'b',
      entry_type: 'feature',
      version: null,
      publish: false,
    })
    expect(res.id).toBe('entry-raw')
  })
})
