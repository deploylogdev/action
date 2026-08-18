# 55 — Manual verify mode: transport, changed files, and the real pull-request arm

**Status:** blocked (observable arm only) · **Type:** AFK · **Lane:** deploylog-action
**Parent:** ../deploylog/issues/prd-manual.md *(PRD lives in the deploylog repo)*
**Blocked by:** ~~`../deploylog/issues/56`~~ — cleared 2026-08-18. deploylog PRs #54 and #55 merged;
`src/app/api/cli/manual/verify/route.ts` is live on `main` (`9bedc81`), confirmed against
`git ls-remote`, not a local tracking ref.
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
- [~] With `fail-on: none` the check is green and the finding is still visible in the output.
      Decided and tested (`verify.test.ts`); "visible" is only observable on the real run.
- [x] With `fail-on: drift` the same finding fails the check. (`verify.test.ts`)
- [x] With `fail-on: any` a run with errors and no drift fails the check. (`verify.test.ts`)
- [x] A run with no findings is silent: no annotations, no job summary. (`verify.test.ts`)
- [x] An existing `release`-triggered workflow is unaffected by the upgrade. (`run.test.ts`,
      `inputs.test.ts` — the default mode is `publish` and a release payload present in verify mode
      is ignored rather than double-handled.)

## Run record — 2026-08-18

Built: `verifyManual` in `src/api.ts` over a mirror of `ManualVerifyRequestSchema` /
`ManualVerifyResponseSchema`; `src/verify-context.ts` (ref and changed-file resolution);
`src/verify.ts` (the run); mode dispatch in `src/run.ts`; the `core.*` edge in `src/main.ts`;
`action.yml` inputs and outputs; a README section with the workflow snippet. 76 tests pass,
`npm run package` clean, `dist/index.js` rebuilt from that run.

**Changed files come from the pull-request files API**, not a git diff, so the workflow needs no
`actions/checkout` and no `fetch-depth`. It needs `permissions: pull-requests: read` and
`github-token: ${{ github.token }}`. Without the token the run verifies the whole manual and says
so; that is the same fallback used when the event is not a pull request, and when the file list hits
GitHub's 3000-file listing cap. An incomplete file list under-scopes claims and reports a clean
manual over real drift, so every path that cannot produce a trustworthy list resolves to `null`
(full sweep) rather than to a partial one.

**The ref is `pull_request.head.sha`, never `context.sha`.** On a pull request `context.sha` is the
synthesised merge commit; the server re-pins this repository to whatever ref it is sent and reports
`finding.line` at that ref, and GitHub drops annotations for lines outside the diff hunks, which are
computed at the head. `resolveVerifyContext` throws rather than sending anything that is not a
40-character sha.

**The fourth criterion was constructed so it can only fail for the reason it names.** Against a real
multi-repository manual, `fail-on: any` fails on `untriggeredCount` alone
(`../deploylog/wiki/decisions/verify-runs-at-the-run-ref.md` §3), so an arm built on a live report
would pass whether or not the error path works. The arm pins every other not-clean signal to zero and
asserts it, its known negative (the same report under `fail-on: drift`) is green, and a sibling arm
proves an untriggered-only failure is attributed to untriggered and not to errors.

**Also corrected:** `src/annotate.ts`'s source-of-truth comment named
`src/lib/manual-verification.ts`. The wire contract is `ManualVerifyResponseSchema` in
`src/lib/schemas.ts`; the route validates against it on the way out precisely so the service type may
differ, which makes the service type the wrong thing to mirror. `VerificationReportView` itself was
checked field-by-field and needed no change.

**Not verified, and it is the whole observable arm:** nothing here has run against the live endpoint.
Criterion 1 needs a scratch pull request on a repository with a DeployLog project, a manual, a
connected repository, and `DEPLOYLOG_API_KEY` in secrets. Target: `marko-builds/deploylog`.

## Review pass — 2026-08-18

`/review-diff` over `328072f`, two axes. Fixed in the follow-up commit:

- **An empty changed-file list was trusted**, so the server evaluated no claim and the run was
  byte-identical to a verified-clean manual. `collectChangedPaths` now returns a discriminated
  `untrusted` result for both the cap and the empty case, each with its own warning.
- **A pull-request payload with no head sha silently sent the merge commit** — the one ref this
  slice exists to avoid, and the fallback was invisible. `toWorkflowRun` throws instead, and the
  narrowing moved out of `main.ts` into a tested function.
- **The `drift > 0` half of the annotation level was inert**, not merely untested: annotations are
  built only from confirmed findings and `drift` IS that count, so no state could distinguish it. A
  mutation removing it left every test green. Deleted, with its comment.
- **`unverifiable` had become readable inside `runVerify`** through the wide wire type, defeating the
  safeguard `annotate.ts:18-22` describes. The report is narrowed to `VerificationReportView` on
  arrival, so the field is unnameable again.
- **`check-failed` was unset on the transport-failure path**, inverting a downstream
  `!= 'false'` guard. Now set; the counts stay unset deliberately, since a zero would be a claim
  about a manual this run never received.
- **The job-summary write was unguarded** — a runner without `GITHUB_STEP_SUMMARY` turned a green run
  red. Caught and downgraded to a warning.
- **Secret masking sat behind two throwable statements.** Both secrets are masked immediately after
  reading now, calibrated against two mutants: removing the mask and moving it back after validation
  each turn the new test red.
- **The typecheck gate could not see test files** (`tsconfig.json` excluded them), so the two
  required-field additions this slice made were outside its scope. Exclusion removed; calibrated by
  planting a logger missing `annotate`, which the widened gate catches and `vitest` alone does not.
- A comment claiming a `skip-prerelease` env leak: **no test ever set it**. The rationale was
  invented; corrected to what is actually true.

**Decided:** `fail-on: none` keeps failing on transport errors, and the README was the wrong half.
`none` selects which *findings* fail the check; it never means the check cannot fail. A run that
could not reach DeployLog has vouched for nothing, and green would be the false clean this slice is
arranged against.

**Recorded, not fixed — this threatens criterion 1 more than the out-of-hunk risk below.** GitHub
renders at most **10 annotations per level per step**. A pull request with 15 drifted claims emits
15 `core.warning` calls, shows 10, and drops 5 with no error; the summary would say "15 findings
annotated inline" while listing none of them, because `renderSummary` deliberately excludes
annotated findings. Measure the real cap on the scratch run before deciding. The fix, if needed,
lands in `verdict.ts` — which this issue's Boundaries fence off, so it is issue 45 territory and
needs its own slice.

## Observable arm: deferred, and why

Criterion 1 cannot run today, and the blocker is not in this repo. The Manual feature's **entire
schema is unapplied in production**: `20260815000000_connected_repositories`,
`20260815010000_manual_mirror_tables` and `20260815020000_manual_chapter_approval` have never been
run against the live database. There is no `connected_repositories` table to connect a repository
in, and no `manual_versions` for a working version to live in, so `getWorkingVersion` cannot
succeed. The endpoint answers 401 rather than 404 only because Next.js routes it.

Decided 2026-08-18: **the arm waits for the Manual feature's own launch** rather than applying an
unlaunched feature's schema to production to unblock a test. Nothing about the arm expires. When
the schema ships, the setup is: an API key with `read`, connect `marko-builds/deploylog`
(installation id **153878377**), a manual chapter citing `src/lib/plan.ts`'s `FREE_PROJECT_LIMIT`,
then a scratch pull request changing that constant.

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
