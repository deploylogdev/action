// The verify run: fetch a report, deliver it, decide the exit status.
//
// Everything this module decides is already decided elsewhere. `planAnnotations`
// owns which findings can be shown inline, `decideVerdict` owns what fails the
// check, and `renderSummary` owns what a developer reads. This is the wiring, and
// it stays thin on purpose — a delivery rule that grows here is a rule with no
// test of its own, because the tests for those rules live beside them.
//
// The one judgment that belongs here is the annotation level. GitHub renders
// `error` as a red squiggle, and a red squiggle beside a green check reads as a
// broken checker. So a finding is an error only when it is also the reason the
// check failed; otherwise it is a warning, whatever the report says.

import type { ActionInputs } from './inputs.js'
import type { ApiClientConfig } from './api.js'
import { createApiClient } from './api.js'
import type { ActionLogger } from './run.js'
import type { VerifyContext } from './verify-context.js'
import { planAnnotations } from './annotate.js'
import { decideVerdict, renderSummary } from './verdict.js'

export interface VerifyRunOptions {
  inputs: ActionInputs
  context: VerifyContext
  logger: ActionLogger
  clientFactory?: (config: ApiClientConfig) => ReturnType<typeof createApiClient>
}

export async function runVerify(opts: VerifyRunOptions): Promise<void> {
  const { inputs, context, logger } = opts
  const factory = opts.clientFactory ?? createApiClient
  const client = factory({ baseUrl: inputs.apiUrl, apiKey: inputs.apiKey })

  const report = await client
    .verifyManual({
      project: inputs.project,
      repository: context.repository,
      ref: context.ref,
      changedFiles: context.changedFiles,
    })
    .catch((err: unknown) => err instanceof Error ? err : new Error(String(err)))

  if (report instanceof Error) {
    logger.setFailed(`Could not verify the manual: ${report.message}`)
    return
  }

  const plan = planAnnotations(report, { repository: context.repository })
  const verdict = decideVerdict(report, inputs.failOn)

  // Red only when this is what failed the check. `verdict.failed` alone is not
  // enough: under `fail-on: any` a run fails on untriggered siblings with no
  // drift in it, and colouring the drift findings red for that would blame the
  // wrong lines.
  const level = verdict.failed && verdict.drift > 0 ? 'error' : 'warning'
  for (const annotation of plan.annotations) logger.annotate(annotation, level)

  logger.setOutput('drift-count', String(verdict.drift))
  logger.setOutput('error-count', String(report.errorCount))
  logger.setOutput('unanchored-count', String(report.unanchoredCount))
  logger.setOutput('untriggered-count', String(report.untriggeredCount))
  logger.setOutput('low-coverage-chapters', report.lowCoverageChapters.join(','))
  logger.setOutput('check-failed', String(verdict.failed))

  const summary = renderSummary(report, plan, verdict)
  if (summary) await logger.summary(summary)

  if (verdict.failed) {
    logger.setFailed(verdict.failure ?? 'Manual check failed.')
    return
  }

  if (verdict.drift === 0 && verdict.reasons.length === 0) {
    logger.info('Manual check: no drift, and nothing this run could not vouch for.')
    return
  }

  logger.info(
    `Manual check: ${verdict.drift} drifted, ${plan.annotations.length} annotated inline. ` +
      'The check is green because escalation is off.',
  )
}
