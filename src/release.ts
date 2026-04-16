// Pure helpers for deriving DeployLog entry fields from a GitHub release payload.

export interface ReleasePayload {
  tag_name?: string | null
  name?: string | null
  body?: string | null
  prerelease?: boolean
  draft?: boolean
}

export interface DerivedRelease {
  title: string
  body: string
  version: string | null
}

const SEMVER = /^v?(\d+\.\d+\.\d+(?:[-+][\w.-]+)?)$/

export function extractVersion(tag: string | null | undefined): string | null {
  if (!tag) return null
  const match = tag.match(SEMVER)
  return match?.[1] ?? null
}

export function deriveEntryFromRelease(release: ReleasePayload): DerivedRelease {
  const tag = release.tag_name?.trim() ?? ''
  const name = release.name?.trim() ?? ''
  const body = release.body?.trim() ?? ''

  const title = name || tag || 'Release'
  const version = extractVersion(tag)

  return { title, body, version }
}
