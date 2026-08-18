import { describe, expect, it, vi } from 'vitest'
import {
  CHANGED_FILE_CAP,
  collectChangedPaths,
  resolveVerifyContext,
  type PullRequestFile,
  type WorkflowRun,
} from './verify-context.js'

const HEAD = 'b'.repeat(40)
const MERGE = 'c'.repeat(40)

function makeLogger() {
  const infos: string[] = []
  const warnings: string[] = []
  return { info: (m: string) => infos.push(m), warning: (m: string) => warnings.push(m), infos, warnings }
}

const pullRun: WorkflowRun = {
  repository: 'marko-builds/deploylog',
  eventName: 'pull_request',
  sha: MERGE,
  pullRequest: { number: 7, headSha: HEAD },
}

function listing(files: PullRequestFile[]) {
  return vi.fn().mockResolvedValue(files)
}

describe('collectChangedPaths', () => {
  it('returns both names of a renamed file', async () => {
    const paths = await collectChangedPaths(
      listing([{ filename: 'src/lib/limits.ts', previous_filename: 'src/limits.ts' }]),
      7,
    )
    expect(paths?.sort()).toEqual(['src/lib/limits.ts', 'src/limits.ts'])
  })

  it('returns null at the listing cap rather than a partial list', async () => {
    const files = Array.from({ length: CHANGED_FILE_CAP }, (_, i) => ({ filename: `f${i}.ts` }))
    expect(await collectChangedPaths(listing(files), 7)).toBeNull()
  })

  it('returns a list one file below the cap', async () => {
    const files = Array.from({ length: CHANGED_FILE_CAP - 1 }, (_, i) => ({ filename: `f${i}.ts` }))
    expect(await collectChangedPaths(listing(files), 7)).toHaveLength(CHANGED_FILE_CAP - 1)
  })
})

describe('resolveVerifyContext', () => {
  it('pins the ref to the pull request head, not the merge commit', async () => {
    const ctx = await resolveVerifyContext(pullRun, listing([{ filename: 'a.ts' }]), makeLogger())
    expect(ctx.ref).toBe(HEAD)
    expect(ctx.ref).not.toBe(MERGE)
    expect(ctx.changedFiles).toEqual(['a.ts'])
    expect(ctx.repository).toBe('marko-builds/deploylog')
  })

  it('sweeps the whole manual on a non-pull-request event', async () => {
    const logger = makeLogger()
    const ctx = await resolveVerifyContext(
      { ...pullRun, eventName: 'push', pullRequest: null },
      null,
      logger,
    )
    expect(ctx.ref).toBe(MERGE)
    expect(ctx.changedFiles).toBeNull()
    expect(logger.infos.join('\n')).toContain('whole manual')
  })

  it('sweeps and warns when no token was supplied on a pull request', async () => {
    const logger = makeLogger()
    const ctx = await resolveVerifyContext(pullRun, null, logger)
    expect(ctx.changedFiles).toBeNull()
    expect(logger.warnings.join('\n')).toContain('github-token')
  })

  it('sweeps and warns when the files API fails', async () => {
    const logger = makeLogger()
    const failing = vi.fn().mockRejectedValue(new Error('Resource not accessible by integration'))
    const ctx = await resolveVerifyContext(pullRun, failing, logger)
    expect(ctx.changedFiles).toBeNull()
    expect(logger.warnings.join('\n')).toContain('Resource not accessible by integration')
  })

  it('refuses a ref that is not a full sha', async () => {
    await expect(
      resolveVerifyContext(
        { ...pullRun, pullRequest: null, sha: 'main' },
        null,
        makeLogger(),
      ),
    ).rejects.toThrow(/40-character sha/)
  })
})
