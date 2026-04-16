import { describe, expect, it } from 'vitest'
import { deriveEntryFromRelease, extractVersion } from './release.js'

describe('extractVersion', () => {
  it('strips leading v from semver tags', () => {
    expect(extractVersion('v1.2.3')).toBe('1.2.3')
    expect(extractVersion('1.2.3')).toBe('1.2.3')
  })

  it('preserves prerelease and build metadata', () => {
    expect(extractVersion('v2.0.0-beta.1')).toBe('2.0.0-beta.1')
    expect(extractVersion('1.0.0+build.42')).toBe('1.0.0+build.42')
  })

  it('returns null for non-semver tags', () => {
    expect(extractVersion('release-2026-04')).toBeNull()
    expect(extractVersion('v1.2')).toBeNull()
    expect(extractVersion('')).toBeNull()
    expect(extractVersion(null)).toBeNull()
    expect(extractVersion(undefined)).toBeNull()
  })
})

describe('deriveEntryFromRelease', () => {
  it('uses release.name when present', () => {
    const result = deriveEntryFromRelease({
      tag_name: 'v1.2.3',
      name: 'Spring Update',
      body: '## Features\n- New stuff',
    })
    expect(result.title).toBe('Spring Update')
    expect(result.body).toBe('## Features\n- New stuff')
    expect(result.version).toBe('1.2.3')
  })

  it('falls back to tag when name is empty', () => {
    const result = deriveEntryFromRelease({
      tag_name: 'v1.2.3',
      name: '',
      body: 'notes',
    })
    expect(result.title).toBe('v1.2.3')
  })

  it('falls back to "Release" when name and tag are empty', () => {
    const result = deriveEntryFromRelease({ tag_name: '', name: '', body: '' })
    expect(result.title).toBe('Release')
    expect(result.body).toBe('')
    expect(result.version).toBeNull()
  })

  it('trims whitespace on all fields', () => {
    const result = deriveEntryFromRelease({
      tag_name: '  v1.0.0  ',
      name: '  Hello  ',
      body: '  body  ',
    })
    expect(result.title).toBe('Hello')
    expect(result.body).toBe('body')
    expect(result.version).toBe('1.0.0')
  })

  it('handles null fields gracefully', () => {
    const result = deriveEntryFromRelease({
      tag_name: null,
      name: null,
      body: null,
    })
    expect(result.title).toBe('Release')
    expect(result.body).toBe('')
    expect(result.version).toBeNull()
  })

  it('extracts null version from non-semver tag', () => {
    const result = deriveEntryFromRelease({
      tag_name: 'release-q2-2026',
      name: 'Q2 Release',
      body: 'notes',
    })
    expect(result.version).toBeNull()
    expect(result.title).toBe('Q2 Release')
  })
})
