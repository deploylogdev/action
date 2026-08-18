import { describe, expect, it } from 'vitest'
import { planAnnotations, type VerificationCounts, type VerificationReportView } from './annotate.js'
import { DEFAULT_FAIL_ON, decideVerdict, parseFailOn, renderSummary } from './verdict.js'

const REPO = 'deploylogdev/action'

const CLEAN: VerificationCounts = {
  confirmedCount: 0,
  errorCount: 0,
  unanchoredCount: 0,
  lowCoverageChapters: [],
  untriggeredCount: 0,
}

function counts(overrides: Partial<VerificationCounts> = {}): VerificationCounts {
  return { ...CLEAN, ...overrides }
}

function driftReport(): VerificationReportView {
  return {
    chapters: [
      {
        number: '4',
        title: 'Plans and pricing',
        confirmed: [
          {
            claimId: 'claim-1',
            text: 'The free tier is capped at three projects.',
            repository: REPO,
            source: 'src/lib/plan.ts',
            line: 12,
            detail: 'The manual says 3. The code now reads 5.',
          },
        ],
      },
    ],
    ...counts({ confirmedCount: 1 }),
  }
}

describe('decideVerdict', () => {
  it('reports drift and keeps the check green while escalation is off', () => {
    const verdict = decideVerdict(counts({ confirmedCount: 2 }), 'none')

    expect(verdict.drift).toBe(2)
    expect(verdict.failed).toBe(false)
    expect(verdict.failure).toBeNull()
  })

  it('fails the check on the same findings when escalation is on', () => {
    for (const failOn of ['drift', 'any'] as const) {
      const verdict = decideVerdict(counts({ confirmedCount: 2 }), failOn)

      expect(verdict.failed).toBe(true)
      expect(verdict.failure).toContain('2 claims')
    }
  })

  // The arm that matters. A run that could not read a single claim finds zero
  // drift, so under `drift` it is green, and it must still say loudly that it
  // could not vouch for anything. `any` is how a team that gates on this check
  // stops a broken checker from merging past it.
  it('separates could-not-check from drift, and lets `any` fail on it', () => {
    const brokenRun = counts({ errorCount: 9 })

    const underDrift = decideVerdict(brokenRun, 'drift')
    expect(underDrift.drift).toBe(0)
    expect(underDrift.failed).toBe(false)
    expect(underDrift.reasons).toHaveLength(1)
    expect(underDrift.reasons[0]).toMatchObject({ kind: 'errors', count: 9 })

    const underAny = decideVerdict(brokenRun, 'any')
    expect(underAny.failed).toBe(true)
    expect(underAny.failure).toContain('no drift was found')
  })

  it('names every count that makes a run unclean, separately', () => {
    const verdict = decideVerdict(
      counts({
        errorCount: 1,
        unanchoredCount: 2,
        lowCoverageChapters: ['3', '7'],
        untriggeredCount: 4,
      }),
      'none',
    )

    expect(verdict.reasons.map((r) => r.kind)).toEqual([
      'errors',
      'unanchored',
      'low_coverage',
      'untriggered',
    ])
    expect(verdict.reasons.map((r) => r.count)).toEqual([1, 2, 2, 4])
    expect(verdict.failed).toBe(false)
  })

  // Exit status comes from the counts, never from the report's coarse
  // `unverifiable` flag. A report carrying the flag with nothing behind it must
  // not produce a finding, which is what keeps the flag out of this decision.
  it('ignores an `unverifiable` flag that no count backs', () => {
    const flagged = { ...CLEAN, unverifiable: true } as VerificationCounts

    const verdict = decideVerdict(flagged, 'any')

    expect(verdict.reasons).toEqual([])
    expect(verdict.drift).toBe(0)
    expect(verdict.failed).toBe(false)
  })

  // The control for the whole verdict path.
  it('passes silently on a clean run under every setting', () => {
    for (const failOn of ['none', 'drift', 'any'] as const) {
      const verdict = decideVerdict(CLEAN, failOn)

      expect(verdict).toEqual({ drift: 0, reasons: [], failed: false, failure: null })
    }
  })
})

describe('parseFailOn', () => {
  it('defaults to warning only', () => {
    expect(parseFailOn('')).toBe(DEFAULT_FAIL_ON)
    expect(DEFAULT_FAIL_ON).toBe('none')
  })

  it('accepts each setting, case-insensitively', () => {
    expect(parseFailOn('none')).toBe('none')
    expect(parseFailOn(' Drift ')).toBe('drift')
    expect(parseFailOn('ANY')).toBe('any')
  })

  it('rejects anything else rather than silently warning', () => {
    expect(() => parseFailOn('true')).toThrow(/Expected one of: none, drift, any/)
  })
})

describe('renderSummary', () => {
  it('prints the drift prominently even when the check stays green', () => {
    const report = driftReport()
    const plan = planAnnotations(report, { repository: REPO })
    const verdict = decideVerdict(report, 'none')

    const summary = renderSummary(report, plan, verdict)

    expect(summary).toContain('Drift: 1 claim no longer match')
    expect(summary).toContain('1 finding annotated inline')
    expect(summary).toContain('escalation is off')
    expect(summary).toContain('fail-on: drift')
  })

  it('reports a finding with no line to attach to', () => {
    const report = driftReport()
    report.chapters[0]!.confirmed[0]!.line = null
    const plan = planAnnotations(report, { repository: REPO })
    const verdict = decideVerdict(report, 'none')

    const summary = renderSummary(report, plan, verdict)

    expect(summary).toContain('1 finding with no line in this run')
    expect(summary).toContain('The free tier is capped at three projects.')
    expect(summary).toContain('0 findings annotated inline')
  })

  it('reports could-not-check under its own heading, apart from drift', () => {
    const report: VerificationReportView = { chapters: [], ...counts({ untriggeredCount: 3 }) }
    const plan = planAnnotations(report, { repository: REPO })
    const verdict = decideVerdict(report, 'none')

    const summary = renderSummary(report, plan, verdict)

    expect(summary).toContain('No drift found')
    expect(summary).toContain('could not vouch for the manual')
    expect(summary).toContain('3 claims sit in a repository no push and no sweep visits')
  })

  // The control: a clean run writes nothing at all.
  it('writes nothing for a clean run', () => {
    const report: VerificationReportView = { chapters: [], ...CLEAN }
    const plan = planAnnotations(report, { repository: REPO })

    expect(renderSummary(report, plan, decideVerdict(report, 'none'))).toBe('')
  })
})
