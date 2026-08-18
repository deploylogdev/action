# 55 — Manual verify mode: transport, changed files, and the real pull-request arm

**Status:** blocked · **Type:** AFK · **Lane:** deploylog-action
**Parent:** ../deploylog/issues/prd-manual.md *(PRD lives in the deploylog repo)*
**Blocked by:** `../deploylog/issues/56` (the verify endpoint), which is itself blocked by
`../deploylog/issues/49` (mirror tables). Out-of-repo dependencies this repo's DAG cannot see.
**Verification:** PRD assertions 1 and 2, observable. A scratch pull request that changes a cited constant shows the annotation inline; with escalation off the check is green and the finding is still visible.

The half of issue 45 that could not be built when 45 was built. 45 shipped the delivery decisions as
pure functions over a fixture report (`src/annotate.ts`, `src/verdict.ts`, both tested). This wires
them to a real run.

## What to build

- **An API client method** for the verify endpoint issue 56 defines, following the existing
  `src/api.ts` shape. Mirror the endpoint's response schema, not the internal service type.
- **Changed-files acquisition.** The Action has no source for this today. Either a `github-token`
  input plus `permissions: pull-requests: read` and the pull-request files API, or a checkout depth
  the workflow guarantees plus a git diff. Pick one and document the workflow snippet it requires.
- **Mode dispatch.** An explicit `mode: publish | verify` input, defaulting to `publish`. Do not
  infer from `github.context.eventName`: a workflow triggered on both `release` and `push` would
  start running verify on pushes nobody opted into. `src/main.ts` reads only
  `github.context.payload.release` today, so the entry point needs a real refactor.
- **`action.yml` inputs and outputs**: `mode`, `fail-on` (`none` | `drift` | `any`, default `none`,
  parsed by the existing `parseFailOn`), whatever identifies the manual, and outputs for the counts.
- **The edge**: `core.warning(message, { file, startLine, title })` per annotation — `warning`, not
  `error`, when escalation is off, because red squiggles on a green check read as broken —
  `core.summary` for `renderSummary`, and `core.setFailed` on `verdict.failure`.

## Acceptance criteria

- [ ] A scratch pull request changing a cited constant shows the annotation inline on the changed line.
- [ ] With `fail-on: none` the check is green and the finding is still visible in the output.
- [ ] With `fail-on: drift` the same finding fails the check.
- [ ] With `fail-on: any` a run with errors and no drift fails the check.
- [ ] A run with no findings is silent: no annotations, no job summary.
- [ ] An existing `release`-triggered workflow is unaffected by the upgrade.

## Carried forward from issue 45

**An annotation can be correct and still not render.** `finding.line` is where the value sits at
HEAD, which may fall outside the pull request's diff hunks, and GitHub silently drops annotations for
lines not in the diff. This is the arm that discovers it. Measure it on the scratch pull request
before calling the delivery surface done, and if it bites, the fix is a decision about what to do
with an out-of-hunk finding (summary-only, or nearest-hunk), not a bug in `planAnnotations`.

## Boundaries

- Do NOT rewrite `src/annotate.ts` or `src/verdict.ts` to reach these criteria; they are tested and
  their controls are the calibration. If a delivery rule is wrong, change it deliberately and move
  its control with it.
- Do NOT commit a `dist` build produced without a clean rebuild.
