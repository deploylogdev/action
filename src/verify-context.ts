// What a verify run is checking: which repository, at which commit, over which
// files. Everything here is decided from the workflow event, never from an input,
// because the three fields have to agree with each other and with the diff GitHub
// will match annotations against.
//
// Two rules carry it.
//
// **The ref is the pull request's head, not `context.sha`.** On a `pull_request`
// event `context.sha` is the ephemeral merge commit GitHub synthesises. The server
// re-pins this repository to whatever ref it is sent and reports `finding.line` at
// that ref, and GitHub silently drops an annotation whose line is not in the pull
// request's diff hunks — which are computed at the head. Send the merge commit and
// correct findings land on lines that do not render.
//
// **An incomplete file list is worse than no file list.** `changedFiles` scopes
// which claims get evaluated, so a list missing a path reports a clean manual over
// real drift: the false-clean shape. Whenever the list cannot be trusted to be
// complete, this resolves to `null`, which asks the server for a full sweep. Noisy
// and honest beats quiet and wrong.

const FULL_SHA = /^[0-9a-f]{40}$/

/**
 * GitHub's pull-request files endpoint stops at 3000 files and says so by
 * omission, not by an error. A response at the cap is indistinguishable from a
 * pull request that happens to touch exactly that many, so both are treated as
 * truncated.
 */
export const CHANGED_FILE_CAP = 3000

export interface PullRequestFile {
  filename: string
  /** Present on a rename. The manual cites the old path, so both are changed. */
  previous_filename?: string
}

export interface WorkflowRun {
  /** `owner/repo` for the repository this workflow is running in. */
  repository: string
  eventName: string
  /** `github.context.sha`. On a pull request this is the merge commit. */
  sha: string
  pullRequest: { number: number; headSha: string } | null
}

export interface VerifyContext {
  repository: string
  ref: string
  /** Repository-relative paths, or null for a full sweep. */
  changedFiles: string[] | null
}

export interface ResolveLogger {
  info(message: string): void
  warning(message: string): void
}

/** Lists the files of one pull request. The `octokit.paginate` call, injected. */
export type ListPullRequestFiles = (pullNumber: number) => Promise<PullRequestFile[]>

/**
 * The paths a pull request touches, or null when the list is not trustworthy.
 * Renames contribute both names: a claim citing the old path has drifted, and
 * dropping the old name is how that finding goes missing.
 */
export async function collectChangedPaths(
  listFiles: ListPullRequestFiles,
  pullNumber: number,
): Promise<string[] | null> {
  const files = await listFiles(pullNumber)
  if (files.length >= CHANGED_FILE_CAP) return null

  const paths = new Set<string>()
  for (const file of files) {
    paths.add(file.filename)
    if (file.previous_filename) paths.add(file.previous_filename)
  }
  return [...paths]
}

export async function resolveVerifyContext(
  run: WorkflowRun,
  listFiles: ListPullRequestFiles | null,
  logger: ResolveLogger,
): Promise<VerifyContext> {
  const ref = run.pullRequest ? run.pullRequest.headSha : run.sha

  if (!FULL_SHA.test(ref)) {
    throw new Error(
      `Could not determine a full commit sha for this run (got "${ref}"). ` +
        'The verify endpoint pins the repository to this ref and rejects anything ' +
        'that is not a 40-character sha.',
    )
  }

  const changedFiles = await resolveChangedFiles(run, listFiles, logger)
  return { repository: run.repository, ref, changedFiles }
}

async function resolveChangedFiles(
  run: WorkflowRun,
  listFiles: ListPullRequestFiles | null,
  logger: ResolveLogger,
): Promise<string[] | null> {
  if (!run.pullRequest) {
    logger.info(
      `This is a \`${run.eventName}\` run, not a pull request, so there is no file list to scope ` +
        'the check to. Verifying the whole manual.',
    )
    return null
  }

  if (!listFiles) {
    logger.warning(
      'No github-token was provided, so the changed files could not be read and the whole manual ' +
        'is being verified. Pass `github-token: ${{ github.token }}` with ' +
        '`permissions: pull-requests: read` to scope the check to this pull request.',
    )
    return null
  }

  let paths: string[] | null
  try {
    paths = await collectChangedPaths(listFiles, run.pullRequest.number)
  } catch (err) {
    logger.warning(
      `Could not read the files of pull request #${run.pullRequest.number} ` +
        `(${err instanceof Error ? err.message : String(err)}). Verifying the whole manual.`,
    )
    return null
  }

  if (paths === null) {
    logger.warning(
      `Pull request #${run.pullRequest.number} touches at least ${CHANGED_FILE_CAP} files, which is ` +
        'where GitHub stops listing them. Verifying the whole manual rather than a partial list.',
    )
    return null
  }

  logger.info(`Verifying claims that cite any of the ${paths.length} files this pull request changes.`)
  return paths
}
