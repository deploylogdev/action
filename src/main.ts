import * as core from '@actions/core'
import * as github from '@actions/github'
import { readInputs } from './inputs.js'
import { run } from './run.js'
import type { ActionLogger } from './run.js'
import type { ReleasePayload } from './release.js'
import type { ListPullRequestFiles, VerifyContext } from './verify-context.js'
import { resolveVerifyContext } from './verify-context.js'

interface PullRequestPayload {
  number: number
  head?: { sha?: string }
}

function makeLogger(): ActionLogger {
  return {
    info: (msg) => core.info(msg),
    warning: (msg) => core.warning(msg),
    debug: (msg) => core.debug(msg),
    setOutput: (name, value) => core.setOutput(name, value),
    setFailed: (msg) => core.setFailed(msg),
    annotate: (annotation, level) => {
      const properties = {
        file: annotation.file,
        startLine: annotation.line,
        title: annotation.title,
      }
      if (level === 'error') core.error(annotation.message, properties)
      else core.warning(annotation.message, properties)
    },
    summary: async (markdown) => {
      await core.summary.addRaw(markdown).write()
    },
  }
}

/**
 * The workflow's own view of itself, turned into a verify context.
 *
 * The token is optional and its absence is not an error: without it the run
 * verifies the whole manual instead of the pull request's files, which
 * `resolveVerifyContext` says out loud. A missing token that failed the run would
 * make the check impossible to try out.
 */
async function buildVerifyContext(githubToken: string): Promise<VerifyContext> {
  const { owner, repo } = github.context.repo
  const pr = github.context.payload.pull_request as PullRequestPayload | undefined
  const headSha = pr?.head?.sha ?? null

  const listFiles: ListPullRequestFiles | null = githubToken
    ? async (pullNumber) => {
        const octokit = github.getOctokit(githubToken)
        return octokit.paginate(octokit.rest.pulls.listFiles, {
          owner,
          repo,
          pull_number: pullNumber,
          per_page: 100,
        })
      }
    : null

  return resolveVerifyContext(
    {
      repository: `${owner}/${repo}`,
      eventName: github.context.eventName,
      sha: github.context.sha,
      pullRequest: pr && headSha ? { number: pr.number, headSha } : null,
    },
    listFiles,
    { info: (msg) => core.info(msg), warning: (msg) => core.warning(msg) },
  )
}

async function main(): Promise<void> {
  try {
    const inputs = readInputs()
    const release = (github.context.payload.release as ReleasePayload | undefined) ?? null
    const verify = inputs.mode === 'verify' ? await buildVerifyContext(inputs.githubToken) : null

    await run({ inputs, release, verify, logger: makeLogger() })
  } catch (err) {
    core.setFailed(err instanceof Error ? err.message : String(err))
  }
}

void main()
